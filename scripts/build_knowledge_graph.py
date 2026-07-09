"""지식그래프 멱등 빌드 — 투영(8000 GET) + AI 관계(8002 /analyze) → uploads/_knowledge_graph.json.

재실행 = 동일 결과(멱등). 시각·순회는 이 스냅샷만 읽는다. 증분 갱신은 ⑥ write-back 스펙.
시계 호출 없음 — built_at 은 인자로 받는다(CLI 는 argv 로 주입, 없으면 None).

사용: python scripts/build_knowledge_graph.py "LS 청주사업장"
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import config  # noqa: E402
import kg_store  # noqa: E402

_BASE = os.environ.get("XD_SELF_BASE_URL", "http://127.0.0.1:8000")
_EXTRACT = "http://" + os.environ.get("XD_EXTRACT_ADDR", "127.0.0.1:8002")
_SNAP = Path(config.UPLOADS_DIR) / "_knowledge_graph.json"


def _get(path: str) -> dict | list:
    with urllib.request.urlopen(_BASE + path, timeout=30) as r:  # noqa: S310 (로컬 8000)
        return json.loads(r.read().decode("utf-8"))


def _post(url: str, body: dict) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:  # noqa: S310
        return json.loads(r.read().decode("utf-8"))


# ── 소스 페치(스텁 가능 경계) ─────────────────────────────────
def _fetch_equipment(project: str) -> list:
    d = _get(f"/api/ontology/equipment?project_name={urllib.parse.quote(project)}")
    return d.get("equipment", [])


def _fetch_sheets(project: str) -> list:
    drawings = _get(f"/api/drawings?project_name={urllib.parse.quote(project)}")
    meta = _get(f"/api/sheet-meta?project_name={urllib.parse.quote(project)}&current_only=true&limit=5000")
    by_sid = {m.get("sheet_id"): m for m in meta.get("results", [])}
    out = []
    for dr in drawings:
        if dr.get("conversion_status") != "completed":
            continue
        for s in dr.get("sheets") or []:
            m = by_sid.get(s.get("sheet_id")) or {}
            out.append({"sheet_id": s.get("sheet_id"), "file_id": dr.get("file_id"),
                        "title": s.get("sheet_title") or dr.get("filename"),
                        "tags": m.get("tags") or [], "text_excerpt": (m.get("text_index") or "")[:800]})
    return out


def _fetch_issues(project: str) -> list:
    return _get(f"/api/issues?project_name={urllib.parse.quote(project)}")


def _fetch_tasks(project: str) -> list:
    try:
        return _get(f"/api/tasks?project_name={urllib.parse.quote(project)}")
    except Exception:  # noqa: BLE001 — 작업 없음 프로젝트
        return []


def _fetch_files(project: str) -> list:
    return _get(f"/api/drawings?project_name={urllib.parse.quote(project)}")


def _call_analyze(equipment: list, sheets: list) -> dict:
    slim_eq = [{"tag": e.get("tag"), "type": e.get("type")} for e in equipment]
    slim_sh = [{"sheet_id": s["sheet_id"], "tags": s.get("tags") or [],
                "text_excerpt": s.get("text_excerpt", "")} for s in sheets]
    try:
        return _post(_EXTRACT + "/analyze", {"equipment": slim_eq, "sheets": slim_sh})
    except Exception:  # noqa: BLE001 — 8002 미가동 시 AI 레이어 비움(투영만)
        return {"relations": [], "notes": []}


# ── 빌드 ─────────────────────────────────────────────────────
def _norm(tag: str) -> str:
    return "".join((tag or "").upper().split())


def build_graph(project: str, built_at: str | None = None) -> dict:
    equipment = _fetch_equipment(project)
    sheets = _fetch_sheets(project)
    issues = _fetch_issues(project)
    tasks = _fetch_tasks(project)
    files = _fetch_files(project)

    nodes: dict = {}
    edges: list = []

    def add(node: dict):
        nodes[node["id"]] = node

    for e in equipment:
        add({"id": f"eq:{e['equipment_id']}", "type": "equipment", "ref_id": e["equipment_id"],
             "label": e.get("tag") or e["equipment_id"], "props": {"type": e.get("type", "")}})
    for s in sheets:
        add({"id": f"sh:{s['sheet_id']}", "type": "sheet", "ref_id": s["sheet_id"],
             "label": s.get("title") or s["sheet_id"], "props": {}})
        for t in s.get("tags") or []:
            tag = t.get("tag")
            if not tag:
                continue
            nid = f"tg:{_norm(tag)}"
            add({"id": nid, "type": "tag", "ref_id": _norm(tag), "label": tag, "props": {}})
            edges.append({"src": f"sh:{s['sheet_id']}", "dst": nid, "type": "has_tag",
                          "confidence": float(t.get("confidence", 1.0)), "track": "rule",
                          "evidence": None})
    # appears_on (설비→시트).
    for e in equipment:
        for sid in e.get("sheet_ids") or []:
            if f"sh:{sid}" in nodes:
                edges.append({"src": f"eq:{e['equipment_id']}", "dst": f"sh:{sid}",
                              "type": "appears_on", "confidence": 1.0, "track": "curated", "evidence": None})
    # issues → pinned_to.
    for i in issues:
        iid = i.get("issue_id")
        if not iid:
            continue
        add({"id": f"is:{iid}", "type": "issue", "ref_id": iid,
             "label": i.get("title") or iid, "props": {"status": i.get("status", "")}})
        sid = i.get("sheet_id")
        if sid and f"sh:{sid}" in nodes:
            edges.append({"src": f"is:{iid}", "dst": f"sh:{sid}", "type": "pinned_to",
                          "confidence": 1.0, "track": "rule", "evidence": None})
    # tasks → about.
    for t in tasks:
        tid = t.get("task_id") or t.get("id")
        if not tid:
            continue
        add({"id": f"tk:{tid}", "type": "task", "ref_id": tid,
             "label": t.get("title") or tid, "props": {"status": t.get("status", "")}})
        tgt_issue = t.get("issue_id")
        tgt_sheet = t.get("sheet_id")
        if tgt_issue and f"is:{tgt_issue}" in nodes:
            edges.append({"src": f"tk:{tid}", "dst": f"is:{tgt_issue}", "type": "about",
                          "confidence": 1.0, "track": "rule", "evidence": None})
        elif tgt_sheet and f"sh:{tgt_sheet}" in nodes:
            edges.append({"src": f"tk:{tid}", "dst": f"sh:{tgt_sheet}", "type": "about",
                          "confidence": 1.0, "track": "rule", "evidence": None})
    # files → references (완료 도면의 파일 노드가 그 시트를 참조).
    for f in files:
        fid = f.get("file_id")
        if not fid:
            continue
        add({"id": f"fl:{fid}", "type": "file", "ref_id": fid,
             "label": f.get("filename") or fid, "props": {}})
        for s in f.get("sheets") or []:
            sid = s.get("sheet_id")
            if sid and f"sh:{sid}" in nodes:
                edges.append({"src": f"fl:{fid}", "dst": f"sh:{sid}", "type": "references",
                              "confidence": 1.0, "track": "rule", "evidence": None})

    # ── AI 레이어: 8002 /analyze → relates_to·note ──
    tag_to_eq = {_norm(e.get("tag", "")): f"eq:{e['equipment_id']}" for e in equipment if e.get("tag")}
    ai = _call_analyze(equipment, sheets)
    for r in ai.get("relations", []):
        s_id = tag_to_eq.get(_norm(r.get("src_tag", "")))
        d_id = tag_to_eq.get(_norm(r.get("dst_tag", "")))
        if s_id and d_id and s_id != d_id:  # 무결성: 양끝이 설비 노드여야.
            edges.append({"src": s_id, "dst": d_id, "type": "relates_to",
                          "confidence": float(r.get("confidence", 0.5)), "track": "llm",
                          "evidence": r.get("evidence")})
    for i, note in enumerate(ai.get("notes", [])):
        about = tag_to_eq.get(_norm(note.get("about_tag", "")))
        if not about:
            continue
        # 결정적 note id — 내용 기반 content hash(프로세스 간 안정, 시계·난수 없음).
        _h = hashlib.sha256(f"{note.get('about_tag','')}|{note.get('text','')}".encode("utf-8")).hexdigest()[:16]
        nid = f"nt:{_h}"
        add({"id": nid, "type": "note", "ref_id": None, "label": (note.get("text") or "")[:40],
             "props": {"text": note.get("text", ""), "confidence": float(note.get("confidence", 0.5))}})
        edges.append({"src": nid, "dst": about, "type": "describes",
                      "confidence": float(note.get("confidence", 0.5)), "track": "llm",
                      "evidence": None})

    g = {"nodes": list(nodes.values()), "edges": edges, "built_at": built_at}
    problems = kg_store.check_integrity(g)
    if problems:  # 빌드가 dangling 을 거부(정합성 게이트).
        raise ValueError("지식그래프 무결성 위반: " + "; ".join(problems[:10]))
    return g


def build_and_save(project: str, built_at: str | None = None) -> dict:
    g = build_graph(project, built_at=built_at)
    snap = {"graphs": {}}
    if _SNAP.exists():
        try:
            snap = json.loads(_SNAP.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            snap = {"graphs": {}}
    snap.setdefault("graphs", {})[project] = g
    _SNAP.parent.mkdir(parents=True, exist_ok=True)
    tmp = _SNAP.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, _SNAP)
    return g


if __name__ == "__main__":
    proj = sys.argv[1] if len(sys.argv) > 1 else None
    if not proj:
        print("usage: build_knowledge_graph.py <project_name> [built_at_iso]")
        sys.exit(2)
    stamp = sys.argv[2] if len(sys.argv) > 2 else None
    graph = build_and_save(proj, built_at=stamp)
    print(f"built {proj}: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")
