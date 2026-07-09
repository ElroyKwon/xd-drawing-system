# 지식/관계성 메타 레이어 (읽기 그래프) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 온톨로지(TypeDB 권위)와 물리 분리된 AI 지식그래프(내부 JSON)를 세워, 기존 자산을 참조 투영하고 외부 AI API(8002)가 생성한 설비관계·지식노트를 얹어 순회·근거체인 조회 + 전용 페이지 시각화를 읽기 전용으로 제공한다.

**Architecture:** `uploads/_knowledge_graph.json` 스냅샷(nodes[]+edges[])을 멱등 빌드 스크립트가 굽는다 — 투영 엣지는 8000 GET에서 결정적으로, AI 엣지(relates_to·note)는 8002 사이드카 신규 `/analyze`(외부 AI API, HUMAN_GATE-7, 기본 mock=egress 0)에서. 8000 `routes_kg.py`가 스냅샷을 읽어 순회/경로/근거 API를 제공하고, React 전용 뷰가 xg-web식 canvas force 그래프로 렌더한다.

**Tech Stack:** Python/FastAPI(backend 8000·사이드카 8002), pytest. React+Vite+TypeScript, vitest, HTML5 Canvas(force 레이아웃, 외부 라이브러리 없음 — xg-web `web/nms.js` 패턴 차용).

---

## 불변식 (모든 태스크에서 지킴)

- **TypeDB 원칙**: 지식그래프 SoT = `uploads/_knowledge_graph.json`. TypeDB는 온톨로지(큐레이트)만.
- **AI 사이드카 격리(O12)**: 8002는 backend 모듈 import 0, 8000/데이터와 HTTP만. `kg_*` AI 툴도 8000 HTTP GET만.
- **외부 AI API 필수**: relates_to·note는 8002 provider(실 LLM)가 생성. HUMAN_GATE-7(`XD_EXTRACT_LLM=1`+키), 기본 mock(egress 0, 결정적).
- **정직성(D4)**: 엣지 `confidence`·`track` 노출, 저신뢰·llm은 "미검증" 표기.
- **8000 egress 0 · 회귀 0**(기존 backend 178 · 사이드카 50 유지).

## 노드/엣지 스키마 (전 태스크 공통 계약)

**노드** `{"id", "type", "ref_id", "label", "props"}` — id 접두 규약:
- equipment=`eq:<equipment_id>` · sheet=`sh:<sheet_id>` · issue=`is:<issue_id>` · task=`tk:<task_id>` · file=`fl:<file_id>` · tag=`tg:<NORMTAG>` · note=`nt:<content_hash>`

**엣지** `{"src", "dst", "type", "confidence", "track", "evidence"}` — track ∈ `curated|rule|llm`:
- `appears_on`(eq→sh, curated) · `pinned_to`(is→sh, rule) · `about`(tk→is|sh, rule) · `has_tag`(sh→tg, rule) · `references`(fl→sh, rule) · `relates_to`(eq↔eq, llm) · `describes`(nt→*, llm)

**스냅샷 파일** `uploads/_knowledge_graph.json`: `{"graphs": {"<project_name>": {"nodes": [...], "edges": [...], "built_at": null}}}` — `_ontology.json`처럼 프로젝트 키로 분리(단일 파일). `built_at`은 빌드 시각 문자열(스크립트가 인자로 받아 채움 — 코드 내 시계 호출 금지).

---

## Task 1: §6 온톨로지 overlay 되돌림 (순수 큐레이트 복원)

**Files:**
- Modify: `backend/ontology.py` (remove `_norm_tag` L29-32, `_extracted_overlay` L185-219, `include_extracted` 파라미터·블록 L221-242)
- Modify/Replace: `backend/tests/test_s15_ontology_promote.py`

- [ ] **Step 1: 현재 테스트가 overlay 동작을 검증함을 확인(되돌림 대상 파악)**

Run: `cd backend && python -m pytest tests/test_s15_ontology_promote.py -v`
Expected: PASS (현재 overlay 존재). 이 테스트가 되돌림으로 깨질 것 — Step 5에서 대체.

- [ ] **Step 2: `_extracted_overlay` 부재를 검증하는 새 테스트 작성 (실패 유도)**

`backend/tests/test_s15_ontology_promote.py` 전체를 아래로 교체(파일명은 유지 — 되돌림 회귀 가드로 재활용):

```python
"""단계10 overlay 되돌림 회귀 가드 (지식그래프 트랙으로 방향 수정).

list_equipment 는 순수 큐레이트만 반환한다(추출 태그 승격 없음).
추출 태그의 '설비 노출'은 지식그래프 tag 노드/has_tag 엣지가 담당(kg_store).
"""
import ontology


def test_list_equipment_is_pure_curated(tmp_path, monkeypatch):
    # 미러에 큐레이트 1건만. 추출 태그가 있어도 list_equipment 엔 섞이지 않아야 한다.
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import importlib, config
    importlib.reload(config)
    importlib.reload(ontology)
    st = ontology.OntologyStore()
    st.add_equipment("P1", {"equipment_id": "E1", "tag": "MTR-1", "type": "motor"}, ["s1"])
    items = st.list_equipment("P1")
    assert [e["equipment_id"] for e in items] == ["E1"]
    assert all(e.get("origin", "curated") == "curated" for e in items)


def test_extracted_overlay_removed():
    # overlay 기계가 제거됐는지 API 표면으로 확인(회귀 가드).
    assert not hasattr(ontology.OntologyStore, "_extracted_overlay")
    assert not hasattr(ontology, "_norm_tag")
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `cd backend && python -m pytest tests/test_s15_ontology_promote.py -v`
Expected: FAIL — `test_extracted_overlay_removed` 가 `_extracted_overlay`/`_norm_tag` 존재로 실패.

- [ ] **Step 4: `ontology.py` 에서 overlay만 외과 제거**

`backend/ontology.py` 편집 — 세 부분 삭제:

(a) 모듈함수 `_norm_tag`(L29-32) 통째 삭제.

(b) 메서드 `_extracted_overlay`(L185-219, docstring 포함) 통째 삭제.

(c) `list_equipment` 시그니처·본문을 아래로 교체(순수 큐레이트):

```python
    def list_equipment(self, project: str, sheet_id: Optional[str] = None) -> list:
        if self._driver:
            try:
                items = self._query_equipment(project)
            except Exception as e:  # noqa: BLE001
                logger.error("ontology TypeDB read 실패 → 미러 폴백: %s", e)
                items = [e for e in self._read_mirror()["equipment"] if e["project_name"] == project]
        else:
            items = [e for e in self._read_mirror()["equipment"] if e["project_name"] == project]
        if sheet_id:
            items = [e for e in items if sheet_id in e.get("sheet_ids", [])]
        for e in items:
            e.setdefault("origin", "curated")  # 수동 시드 = 고신뢰 curated.
        items.sort(key=lambda e: e.get("tag", ""))
        return items
```

- [ ] **Step 5: 되돌림 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_s15_ontology_promote.py -v`
Expected: PASS (2 tests).

- [ ] **Step 6: 전체 backend 회귀 확인 (overlay 제거 파급 0)**

Run: `cd backend && python -m pytest -q`
Expected: PASS. 만약 다른 테스트가 `include_extracted` 또는 overlay 결과를 참조하면 그 참조를 제거(순수 큐레이트 기대로 수정). `grep -rn "include_extracted\|_extracted_overlay\|_norm_tag" backend/` 로 잔여 참조 0 확인.

- [ ] **Step 7: Commit**

```bash
git add backend/ontology.py backend/tests/test_s15_ontology_promote.py
git commit -m "revert(s15): 단계10 overlay 되돌림 — list_equipment 순수 큐레이트 복원

추출 태그 승격(_extracted_overlay) 제거. 추출 태그의 설비 노출은
지식그래프 tag 노드/has_tag 엣지로 이관(후속 태스크). 3렌즈 수리분은 유지.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: ① 지식그래프 스토어 (노드/엣지 로드·조회·무결성)

**Files:**
- Create: `backend/kg_store.py`
- Test: `backend/tests/test_kg_store.py`

스토어는 **읽기·검증 헬퍼**만(쓰기 시드는 Task 3 빌드 스크립트가 담당). 순회 알고리즘(neighbors BFS·path BFS·evidence)도 여기 둔다 — 라우트는 얇게.

- [ ] **Step 1: 실패 테스트 작성 — 로드·노드조회·무결성**

`backend/tests/test_kg_store.py`:

```python
"""지식그래프 스토어 — 로드·조회·순회·참조 무결성."""
import json
import importlib

import pytest


@pytest.fixture()
def kg(tmp_path, monkeypatch):
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import config
    importlib.reload(config)
    import kg_store
    importlib.reload(kg_store)
    snapshot = {
        "graphs": {
            "P1": {
                "built_at": "2026-07-09T00:00:00",
                "nodes": [
                    {"id": "eq:E1", "type": "equipment", "ref_id": "E1", "label": "MTR-1", "props": {}},
                    {"id": "eq:E2", "type": "equipment", "ref_id": "E2", "label": "VCB-1", "props": {}},
                    {"id": "sh:s1", "type": "sheet", "ref_id": "s1", "label": "E-101", "props": {}},
                ],
                "edges": [
                    {"src": "eq:E1", "dst": "sh:s1", "type": "appears_on", "confidence": 1.0, "track": "curated", "evidence": None},
                    {"src": "eq:E1", "dst": "eq:E2", "type": "relates_to", "confidence": 0.6, "track": "llm", "evidence": "같은 시트 공출현"},
                ],
            }
        }
    }
    (tmp_path / "_knowledge_graph.json").write_text(json.dumps(snapshot), encoding="utf-8")
    return kg_store


def test_get_node_with_incident_edges(kg):
    n = kg.get_node("P1", "eq:E1")
    assert n["node"]["label"] == "MTR-1"
    types = sorted(e["type"] for e in n["edges"])
    assert types == ["appears_on", "relates_to"]


def test_get_node_missing_returns_found_false(kg):
    assert kg.get_node("P1", "eq:NOPE") == {"found": False, "id": "eq:NOPE"}


def test_neighbors_depth(kg):
    # depth=1: E1 의 직접 이웃 = sh:s1, eq:E2
    ids = {x["id"] for x in kg.neighbors("P1", "eq:E1", depth=1)["nodes"]}
    assert ids == {"eq:E1", "sh:s1", "eq:E2"}


def test_referential_integrity_flags_dangling(kg):
    # dst 없는 엣지를 넣으면 무결성 검사가 잡는다.
    bad = {"graphs": {"P1": {"nodes": [{"id": "sh:s1", "type": "sheet", "ref_id": "s1", "label": "", "props": {}}],
                             "edges": [{"src": "sh:s1", "dst": "eq:GONE", "type": "has_tag",
                                        "confidence": 1.0, "track": "rule", "evidence": None}], "built_at": None}}}
    problems = kg.check_integrity(bad["graphs"]["P1"])
    assert any("eq:GONE" in p for p in problems)
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `cd backend && python -m pytest tests/test_kg_store.py -v`
Expected: FAIL — `No module named 'kg_store'`.

- [ ] **Step 3: `backend/kg_store.py` 구현**

```python
"""지식그래프 스토어 (읽기·순회·무결성) — SoT는 uploads/_knowledge_graph.json.

TypeDB 와 물리 분리(온톨로지 원칙 LOCKED). 쓰기 시드는 scripts/build_knowledge_graph.py.
순회 알고리즘(neighbors/path BFS·evidence)을 여기 모아 라우트는 얇게 유지한다.
"""
from __future__ import annotations

import json
from collections import deque
from pathlib import Path
from typing import Optional

import config

_PATH = Path(config.UPLOADS_DIR) / "_knowledge_graph.json"


def _load() -> dict:
    if _PATH.exists():
        try:
            return json.loads(_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    return {"graphs": {}}


def _graph(project: str) -> dict:
    return _load().get("graphs", {}).get(project, {"nodes": [], "edges": [], "built_at": None})


def _index(g: dict) -> dict:
    return {n["id"]: n for n in g.get("nodes", [])}


def _incident(g: dict, node_id: str) -> list:
    return [e for e in g.get("edges", []) if e["src"] == node_id or e["dst"] == node_id]


def get_node(project: str, node_id: str) -> dict:
    g = _graph(project)
    n = _index(g).get(node_id)
    if n is None:
        return {"found": False, "id": node_id}
    return {"found": True, "node": n, "edges": _incident(g, node_id)}


def neighbors(project: str, node_id: str, depth: int = 1, types: Optional[list] = None) -> dict:
    """N홉 이웃(순회). depth 상한 5(폭주 방어). types 지정 시 그 노드 타입만 포함."""
    depth = max(1, min(int(depth), 5))
    g = _graph(project)
    idx = _index(g)
    if node_id not in idx:
        return {"found": False, "id": node_id}
    seen = {node_id}
    frontier = {node_id}
    edges_out = []
    for _ in range(depth):
        nxt = set()
        for e in g.get("edges", []):
            for a, b in ((e["src"], e["dst"]), (e["dst"], e["src"])):
                if a in frontier and b not in seen:
                    nxt.add(b)
                    edges_out.append(e)
        seen |= nxt
        frontier = nxt
        if not frontier:
            break
    nodes = [idx[i] for i in seen if i in idx]
    if types:
        nodes = [n for n in nodes if n["type"] in types]
    return {"found": True, "nodes": nodes, "edges": edges_out}


def path(project: str, src: str, dst: str) -> dict:
    """두 노드 최단 경로(BFS, 무방향)."""
    g = _graph(project)
    idx = _index(g)
    if src not in idx or dst not in idx:
        return {"found": False, "from": src, "to": dst}
    adj: dict = {}
    for e in g.get("edges", []):
        adj.setdefault(e["src"], []).append((e["dst"], e))
        adj.setdefault(e["dst"], []).append((e["src"], e))
    q = deque([src])
    prev: dict = {src: None}
    while q:
        cur = q.popleft()
        if cur == dst:
            break
        for nb, e in adj.get(cur, []):
            if nb not in prev:
                prev[nb] = (cur, e)
                q.append(nb)
    if dst not in prev:
        return {"found": True, "from": src, "to": dst, "path": None, "reachable": False}
    chain = []
    node = dst
    while prev[node] is not None:
        cur, e = prev[node]
        chain.append({"edge": e})
        node = cur
    chain.reverse()
    ids = [src] + [c["edge"]["dst"] if c["edge"]["src"] in {p for p in prev} else c["edge"]["src"] for c in chain]
    return {"found": True, "from": src, "to": dst, "reachable": True,
            "hops": len(chain), "edges": [c["edge"] for c in chain]}


def evidence(project: str, node_id: str) -> dict:
    """근거체인 — 노드의 인접 엣지 evidence + 그 노드를 describes 하는 note."""
    g = _graph(project)
    idx = _index(g)
    if node_id not in idx:
        return {"found": False, "id": node_id}
    ev = [{"edge": e["type"], "src": e["src"], "dst": e["dst"],
           "track": e["track"], "confidence": e["confidence"], "evidence": e.get("evidence")}
          for e in _incident(g, node_id) if e.get("evidence")]
    notes = [idx[e["src"]] for e in g.get("edges", [])
             if e["type"] == "describes" and e["dst"] == node_id and e["src"] in idx]
    return {"found": True, "id": node_id, "evidence": ev, "notes": notes}


def subgraph(project: str, scope: Optional[str] = None) -> dict:
    """시각화용 — scope 미지정 시 전체. scope=<node_id> 면 그 노드 2홉 이웃."""
    if scope:
        return neighbors(project, scope, depth=2)
    g = _graph(project)
    return {"found": True, "nodes": g.get("nodes", []), "edges": g.get("edges", []),
            "built_at": g.get("built_at")}


def check_integrity(g: dict) -> list:
    """참조 무결성 — 모든 엣지 src/dst 가 노드로 존재해야. 위반 문자열 목록 반환."""
    ids = {n["id"] for n in g.get("nodes", [])}
    problems = []
    for e in g.get("edges", []):
        for end in ("src", "dst"):
            if e[end] not in ids:
                problems.append(f"dangling {e['type']} {end}={e[end]}")
    return problems
```

- [ ] **Step 4: 실행 — 통과 확인**

Run: `cd backend && python -m pytest tests/test_kg_store.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/kg_store.py backend/tests/test_kg_store.py
git commit -m "feat(kg): ① 지식그래프 스토어 — 로드·순회(neighbors/path/evidence)·무결성

SoT=uploads/_knowledge_graph.json, TypeDB 물리 분리. 읽기·BFS 순회만.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: ② 사이드카 `/analyze` 확장 (외부 AI API — relates_to·note 생성)

**Files:**
- Modify: `backend/extract/provider.py` (add `analyze()` to both providers)
- Modify: `backend/extract/main_extract.py` (add `POST /analyze`)
- Test: `backend/extract/test_extract.py` (append)

계약: `POST /analyze` body `{equipment: [{tag,type}], sheets: [{sheet_id, tags:[{tag}], text_excerpt}]}` → `{relations: [{src_tag, dst_tag, relation, confidence, evidence}], notes: [{about_tag, text, confidence}]}`. mock provider 는 **같은 시트 공출현** 설비쌍을 결정적 relates_to 로(egress 0). 실 LLM 은 HUMAN_GATE-7.

- [ ] **Step 1: 실패 테스트 작성 (사이드카 격리 venv)**

`backend/extract/test_extract.py` 하단에 추가:

```python
def test_analyze_mock_cooccurrence_relations():
    from main_extract import app
    from fastapi.testclient import TestClient
    c = TestClient(app)
    body = {
        "equipment": [{"tag": "MTR-1", "type": "motor"}, {"tag": "VCB-1", "type": "breaker"}],
        "sheets": [{"sheet_id": "s1", "tags": [{"tag": "MTR-1"}, {"tag": "VCB-1"}], "text_excerpt": "VCB-1 feeds MTR-1"}],
    }
    r = c.post("/analyze", json=body)
    assert r.status_code == 200
    data = r.json()
    pairs = {(x["src_tag"], x["dst_tag"]) for x in data["relations"]}
    # 같은 시트 공출현 → 무방향 관계 1개(정렬된 튜플로 결정적).
    assert ("MTR-1", "VCB-1") in pairs or ("VCB-1", "MTR-1") in pairs
    assert all(x["relation"] == "relates_to" for x in data["relations"])
    assert all(0.0 <= x["confidence"] <= 1.0 for x in data["relations"])
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `cd backend/extract && .venv/Scripts/python.exe -m pytest test_extract.py::test_analyze_mock_cooccurrence_relations -v`
Expected: FAIL — `/analyze` 404.

- [ ] **Step 3: provider 에 `analyze()` 추가**

`backend/extract/provider.py` — `MockExtractProvider` 에 메서드 추가:

```python
    def analyze(self, equipment: list, sheets: list) -> dict:
        """결정적 공출현 관계(egress 0). 같은 시트에 함께 나온 설비쌍 → relates_to.
        실 LLM 없이도 그래프를 채워 시각화·테스트가 되게 하는 오프라인 기본값."""
        pair_sheets: dict = {}
        for s in sheets:
            tags = sorted({t.get("tag", "") for t in (s.get("tags") or []) if t.get("tag")})
            for i in range(len(tags)):
                for j in range(i + 1, len(tags)):
                    pair_sheets.setdefault((tags[i], tags[j]), []).append(s.get("sheet_id"))
        relations = [{
            "src_tag": a, "dst_tag": b, "relation": "relates_to",
            "confidence": round(min(0.3 + 0.2 * len(sids), 0.7), 2),
            "evidence": f"같은 시트 공출현: {', '.join(str(x) for x in sids[:3])}",
        } for (a, b), sids in sorted(pair_sheets.items())]
        return {"relations": relations, "notes": []}
```

`OpenAIExtractProvider` 에도 `analyze()` 추가 (실 LLM — HUMAN_GATE-7). 키/게이트 없으면 mock 로 위임하는 것이 아니라, provider 팩토리가 이미 게이트로 mock/openai 를 고르므로 여기선 실 호출만:

```python
    def analyze(self, equipment: list, sheets: list) -> dict:
        """실 LLM 관계·지식 추출 — HUMAN_GATE-7 (실 고객 도면을 외부 전송).
        프롬프트: 설비 목록·시트 태그·본문 발췌를 주고 전원계통 상위/하위 relates_to 와
        wiki 지식노트를 JSON 으로 요청. 결과는 track=llm 으로 표기(정직성)."""
        import json as _json
        prompt = (
            "다음 설비·시트에서 설비 간 전원계통/상하위 관계(relates_to)와 "
            "지식노트(notes)를 JSON 으로 추출. "
            "형식: {\"relations\":[{\"src_tag\",\"dst_tag\",\"relation\":\"relates_to\","
            "\"confidence\":0~1,\"evidence\"}],\"notes\":[{\"about_tag\",\"text\",\"confidence\"}]}\n"
            f"설비: {_json.dumps(equipment, ensure_ascii=False)}\n"
            f"시트: {_json.dumps(sheets, ensure_ascii=False)[:6000]}"
        )
        raw = self._complete(prompt)  # 기존 실 LLM 호출 경로 재사용
        try:
            data = _json.loads(raw)
        except Exception:  # noqa: BLE001 — 모델이 비정형 반환 시 빈 결과(정직)
            return {"relations": [], "notes": []}
        return {"relations": data.get("relations", []), "notes": data.get("notes", [])}
```

> 주의: `OpenAIExtractProvider` 에 실 호출 헬퍼(`self._complete`)가 없으면, 기존 `read()` 가 쓰는 LLM 호출부를 작은 `_complete(prompt)->str` 로 추출해 공유한다(read/analyze 공용). 이 리팩터가 read 동작을 바꾸지 않는지 기존 사이드카 테스트로 확인.

- [ ] **Step 4: `main_extract.py` 에 `POST /analyze` 라우트 추가**

```python
class AnalyzeRequest(BaseModel):
    equipment: list[dict] = []
    sheets: list[dict] = []


@app.post("/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    """설비관계(relates_to)·지식노트 생성 — 외부 AI API 경유(provider).

    격리 유지: backend import 0, 코퍼스는 HTTP body 로 받는다(8000 이 build 스크립트에서
    수집해 POST). mock provider 는 공출현 결정적 관계(egress 0), 실 LLM 은 HUMAN_GATE-7.
    """
    provider = make_extract_provider()
    out = provider.analyze(req.equipment, req.sheets)
    return {
        "relations": out.get("relations", []),
        "notes": out.get("notes", []),
        "analyzer": {"llm_model": provider.name},
    }
```

- [ ] **Step 5: 실행 — 통과 확인 + 사이드카 격리 회귀**

Run: `cd backend/extract && .venv/Scripts/python.exe -m pytest -v`
Expected: PASS (기존 7 + 신규 1). 격리 guard 테스트도 통과(backend import 0 유지).

- [ ] **Step 6: Commit**

```bash
git add backend/extract/provider.py backend/extract/main_extract.py backend/extract/test_extract.py
git commit -m "feat(kg): ② 8002 /analyze — 외부 AI API 로 relates_to·note 생성

mock=공출현 결정적 관계(egress 0), 실 LLM=HUMAN_GATE-7. 격리 유지.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: ② 멱등 빌드 스크립트 (투영 + 8002 호출 → 스냅샷)

**Files:**
- Create: `scripts/build_knowledge_graph.py`
- Test: `backend/tests/test_kg_build.py`

빌드는 8000 GET(투영) + 8002 POST(/analyze)를 조합해 `uploads/_knowledge_graph.json` 을 굽는다. 테스트는 8000/8002 호출을 스텁으로 대체해 결정적으로 검증(실 서버 불필요).

- [ ] **Step 1: 실패 테스트 작성 — 투영 + AI 관계 병합 + 무결성**

`backend/tests/test_kg_build.py`:

```python
"""지식그래프 빌드 — 투영 노드/엣지 + AI relates_to 병합, 참조 무결성."""
import importlib

import pytest


@pytest.fixture()
def build_mod(tmp_path, monkeypatch):
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import config
    importlib.reload(config)
    import sys, pathlib
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts"))
    import build_knowledge_graph as b
    importlib.reload(b)
    return b


def test_build_projects_and_merges_relations(build_mod, monkeypatch):
    b = build_mod
    # 8000/8002 접근을 스텁으로.
    monkeypatch.setattr(b, "_fetch_equipment", lambda p: [
        {"equipment_id": "E1", "tag": "MTR-1", "type": "motor", "sheet_ids": ["s1"]},
        {"equipment_id": "E2", "tag": "VCB-1", "type": "breaker", "sheet_ids": ["s1"]}])
    monkeypatch.setattr(b, "_fetch_sheets", lambda p: [{"sheet_id": "s1", "title": "E-101", "tags": [{"tag": "MTR-1"}, {"tag": "VCB-1"}]}])
    monkeypatch.setattr(b, "_fetch_issues", lambda p: [])
    monkeypatch.setattr(b, "_fetch_tasks", lambda p: [])
    monkeypatch.setattr(b, "_fetch_files", lambda p: [])
    monkeypatch.setattr(b, "_call_analyze", lambda eq, sh: {
        "relations": [{"src_tag": "MTR-1", "dst_tag": "VCB-1", "relation": "relates_to",
                       "confidence": 0.5, "evidence": "같은 시트"}], "notes": []})
    g = b.build_graph("P1", built_at="2026-07-09T00:00:00")
    ids = {n["id"] for n in g["nodes"]}
    assert {"eq:E1", "eq:E2", "sh:s1", "tg:MTR-1", "tg:VCB-1"} <= ids
    etypes = sorted({e["type"] for e in g["edges"]})
    assert "appears_on" in etypes and "has_tag" in etypes and "relates_to" in etypes
    # AI 관계는 track=llm.
    rel = [e for e in g["edges"] if e["type"] == "relates_to"][0]
    assert rel["track"] == "llm" and rel["src"] == "eq:E1" and rel["dst"] == "eq:E2"
    # 무결성 위반 0.
    import kg_store
    assert kg_store.check_integrity(g) == []


def test_build_persists_snapshot(build_mod, monkeypatch, tmp_path):
    b = build_mod
    for fn in ("_fetch_equipment", "_fetch_sheets", "_fetch_issues", "_fetch_tasks", "_fetch_files"):
        monkeypatch.setattr(b, fn, lambda p: [])
    monkeypatch.setattr(b, "_call_analyze", lambda eq, sh: {"relations": [], "notes": []})
    b.build_and_save("P1", built_at="2026-07-09T00:00:00")
    import json
    snap = json.loads((tmp_path / "_knowledge_graph.json").read_text(encoding="utf-8"))
    assert "P1" in snap["graphs"]
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `cd backend && python -m pytest tests/test_kg_build.py -v`
Expected: FAIL — `No module named 'build_knowledge_graph'`.

- [ ] **Step 3: `scripts/build_knowledge_graph.py` 구현**

```python
"""지식그래프 멱등 빌드 — 투영(8000 GET) + AI 관계(8002 /analyze) → uploads/_knowledge_graph.json.

재실행 = 동일 결과(멱등). 시각·순회는 이 스냅샷만 읽는다. 증분 갱신은 ⑥ write-back 스펙.
시계 호출 없음 — built_at 은 인자로 받는다(CLI 는 argv 로 주입, 없으면 None).

사용: python scripts/build_knowledge_graph.py "LS 청주사업장"
"""
from __future__ import annotations

import json
import os
import sys
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

    tag_by_norm: dict = {}
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
            tag_by_norm.setdefault(_norm(tag), tag)
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
        # 결정적 note id — 내용 기반(시계·난수 없음).
        nid = f"nt:{abs(hash((note.get('about_tag'), note.get('text')))) % (10**10)}"
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
    import urllib.parse  # noqa: E402
    proj = sys.argv[1] if len(sys.argv) > 1 else None
    if not proj:
        print("usage: build_knowledge_graph.py <project_name> [built_at_iso]")
        sys.exit(2)
    stamp = sys.argv[2] if len(sys.argv) > 2 else None
    graph = build_and_save(proj, built_at=stamp)
    print(f"built {proj}: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges")
```

> `urllib.parse` 는 상단 import 에 추가(위 `_fetch_*` 가 사용). `import urllib.parse` 를 파일 상단 import 블록에 넣는다.

- [ ] **Step 4: 실행 — 통과 확인**

Run: `cd backend && python -m pytest tests/test_kg_build.py -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/build_knowledge_graph.py backend/tests/test_kg_build.py
git commit -m "feat(kg): ② 멱등 빌드 — 투영(8000)+AI관계(8002)→_knowledge_graph.json

무결성 게이트로 dangling 거부. built_at 인자 주입(시계 호출 0).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: ③ 조회 API (`routes_kg.py`) + main 등록

**Files:**
- Create: `backend/routes_kg.py`
- Modify: `backend/main.py` (import + include_router)
- Test: `backend/tests/test_kg_routes.py`

- [ ] **Step 1: 실패 테스트 작성 — 5 엔드포인트**

`backend/tests/test_kg_routes.py`:

```python
"""지식그래프 조회 라우트 — node/neighbors/path/evidence/graph."""
import importlib
import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import config
    importlib.reload(config)
    snapshot = {"graphs": {"P1": {"built_at": "2026-07-09T00:00:00",
        "nodes": [
            {"id": "eq:E1", "type": "equipment", "ref_id": "E1", "label": "MTR-1", "props": {}},
            {"id": "eq:E2", "type": "equipment", "ref_id": "E2", "label": "VCB-1", "props": {}},
            {"id": "sh:s1", "type": "sheet", "ref_id": "s1", "label": "E-101", "props": {}}],
        "edges": [
            {"src": "eq:E1", "dst": "sh:s1", "type": "appears_on", "confidence": 1.0, "track": "curated", "evidence": None},
            {"src": "eq:E1", "dst": "eq:E2", "type": "relates_to", "confidence": 0.6, "track": "llm", "evidence": "공출현"}]}}}
    (tmp_path / "_knowledge_graph.json").write_text(json.dumps(snapshot), encoding="utf-8")
    import kg_store
    importlib.reload(kg_store)
    import routes_kg
    importlib.reload(routes_kg)
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(routes_kg.router)
    return TestClient(app)


def test_node(client):
    r = client.get("/api/kg/node/eq:E1?project_name=P1")
    assert r.status_code == 200 and r.json()["node"]["label"] == "MTR-1"


def test_neighbors(client):
    r = client.get("/api/kg/neighbors?project_name=P1&id=eq:E1&depth=1")
    ids = {n["id"] for n in r.json()["nodes"]}
    assert ids == {"eq:E1", "sh:s1", "eq:E2"}


def test_path(client):
    r = client.get("/api/kg/path?project_name=P1&from=sh:s1&to=eq:E2")
    assert r.json()["reachable"] is True and r.json()["hops"] == 2


def test_evidence(client):
    r = client.get("/api/kg/evidence?project_name=P1&id=eq:E2")
    ev = r.json()["evidence"]
    assert any(e["evidence"] == "공출현" and e["track"] == "llm" for e in ev)


def test_graph_full(client):
    r = client.get("/api/kg/graph?project_name=P1")
    assert len(r.json()["nodes"]) == 3 and len(r.json()["edges"]) == 2
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `cd backend && python -m pytest tests/test_kg_routes.py -v`
Expected: FAIL — `No module named 'routes_kg'`.

- [ ] **Step 3: `backend/routes_kg.py` 구현**

```python
"""지식그래프 조회 라우트 (읽기 전용) — 스냅샷 순회. 쓰기 없음(⑥ write-back 이연).

GET /api/kg/node/{id}      : 노드 + 인접 엣지
GET /api/kg/neighbors      : N홉 이웃(depth 상한)
GET /api/kg/path           : 두 노드 최단 경로
GET /api/kg/evidence       : 근거체인(엣지 evidence + describes 노트)
GET /api/kg/graph          : 시각화용 서브그래프(scope 필터)
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

import kg_store

router = APIRouter(prefix="/api/kg", tags=["knowledge-graph"])


@router.get("/node/{node_id}")
def node(node_id: str, project_name: str = Query(...)):
    r = kg_store.get_node(project_name, node_id)
    if not r.get("found"):
        raise HTTPException(404, f"노드 없음: {node_id}")
    return r


@router.get("/neighbors")
def neighbors(project_name: str = Query(...), id: str = Query(...),
             depth: int = 1, types: Optional[str] = None):
    type_list = [t for t in (types or "").split(",") if t] or None
    r = kg_store.neighbors(project_name, id, depth=depth, types=type_list)
    if not r.get("found"):
        raise HTTPException(404, f"노드 없음: {id}")
    return r


@router.get("/path")
def path(project_name: str = Query(...), **_):
    # from 은 파이썬 예약어 — 쿼리 파싱을 수동으로.
    raise HTTPException(500, "unreachable")  # 아래 실제 시그니처로 대체
```

> `from` 이 파이썬 예약어라 FastAPI 파라미터로 직접 못 쓴다. `path` 핸들러는 `Query(alias="from")` 로 받는다 — 위 스텁을 아래로 교체:

```python
@router.get("/path")
def path(project_name: str = Query(...),
         src: str = Query(..., alias="from"),
         dst: str = Query(..., alias="to")):
    r = kg_store.path(project_name, src, dst)
    if not r.get("found"):
        raise HTTPException(404, "노드 없음")
    return r


@router.get("/evidence")
def evidence(project_name: str = Query(...), id: str = Query(...)):
    r = kg_store.evidence(project_name, id)
    if not r.get("found"):
        raise HTTPException(404, f"노드 없음: {id}")
    return r


@router.get("/graph")
def graph(project_name: str = Query(...), scope: Optional[str] = None):
    return kg_store.subgraph(project_name, scope)
```

- [ ] **Step 4: `main.py` 에 라우터 등록**

`backend/main.py` — ontology_router import 근처에 추가하고 include:

```python
from routes_kg import router as kg_router
# ... include 블록(L56 ontology 다음)에:
app.include_router(kg_router)
```

- [ ] **Step 5: 실행 — 통과 + 전체 회귀**

Run: `cd backend && python -m pytest tests/test_kg_routes.py -v && python -m pytest -q`
Expected: 신규 5 PASS · 전체 회귀 0(178 + 신규들).

- [ ] **Step 6: Commit**

```bash
git add backend/routes_kg.py backend/main.py backend/tests/test_kg_routes.py
git commit -m "feat(kg): ③ 조회 API — node/neighbors/path/evidence/graph (읽기 전용)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: ③ AI 툴 (`kg_neighbors`·`kg_path`·`kg_evidence`) — 8000 GET만

**Files:**
- Modify: `backend/ai/tools.py` (add 3 함수)
- Modify: `backend/ai/agent.py` (TOOLS_SCHEMA + _dispatch + 시스템 지침 한 줄)
- Test: `backend/tests/test_kg_ai_tools.py`

- [ ] **Step 1: 실패 테스트 작성 — 툴이 8000 GET 만 사용**

`backend/tests/test_kg_ai_tools.py`:

```python
"""kg_* AI 툴 — 8000 HTTP GET 만(격리). client.get 를 스텁으로 계약 검증."""
import importlib


def test_kg_neighbors_calls_backend_get(monkeypatch):
    import ai.tools as tools
    importlib.reload(tools)
    calls = {}
    def fake_get(path, params=None):
        calls["path"] = path
        calls["params"] = params
        return {"found": True, "nodes": [{"id": "eq:E1"}], "edges": []}
    monkeypatch.setattr(tools, "get", fake_get)
    out = tools.kg_neighbors("P1", "eq:E1", depth=2)
    assert calls["path"] == "/api/kg/neighbors"
    assert calls["params"]["id"] == "eq:E1" and calls["params"]["depth"] == 2
    assert out["nodes"][0]["id"] == "eq:E1"
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `cd backend && python -m pytest tests/test_kg_ai_tools.py -v`
Expected: FAIL — `tools` 에 `kg_neighbors` 없음.

- [ ] **Step 3: `ai/tools.py` 에 3 함수 추가**

```python
def kg_neighbors(project: str, id: str, depth: int = 1, types: Optional[str] = None) -> dict:
    """GET /api/kg/neighbors — 지식그래프 N홉 이웃(설비관계·자산 링크 순회).

    노드 id 접두: eq:설비 sh:시트 is:이슈 tk:작업 fl:파일 tg:태그 nt:노트.
    엣지 track=llm/relates_to 는 AI 추출(미검증) — 인용 시 밝힐 것. 자산 본문은
    get_sheet_content, 태그 역조회는 find_sheets_by_equipment 로 구분해 쓴다.
    """
    params = {"project_name": project, "id": id, "depth": depth}
    if types:
        params["types"] = types
    return get("/api/kg/neighbors", params=params)


def kg_path(project: str, src: str, dst: str) -> dict:
    """GET /api/kg/path — 두 노드 최단 경로(관계 경로추적). from/to 는 노드 id."""
    return get("/api/kg/path", params={"project_name": project, "from": src, "to": dst})


def kg_evidence(project: str, id: str) -> dict:
    """GET /api/kg/evidence — 근거체인(엣지 evidence + describes 노트). track/confidence 동반."""
    return get("/api/kg/evidence", params={"project_name": project, "id": id})
```

- [ ] **Step 4: `ai/agent.py` — 스키마·디스패치·지침 배선**

(a) `TOOLS_SCHEMA` 리스트(L41~)에 3 항목 추가:

```python
    {"type": "function", "function": {
        "name": "kg_neighbors",
        "description": "지식그래프에서 한 노드의 N홉 이웃(설비관계·자산 링크)을 순회한다. 노드 id 접두 eq:설비 sh:시트 is:이슈 tk:작업 fl:파일 tg:태그 nt:노트. relates_to·track=llm 은 AI 추출(미검증). depth 상한 5.",
        "parameters": {"type": "object", "properties": {
            "id": {"type": "string"}, "depth": {"type": "integer"},
            "types": {"type": "string", "description": "쉼표구분 노드타입 필터(선택)"}},
            "required": ["id"]}}},
    {"type": "function", "function": {
        "name": "kg_path",
        "description": "지식그래프에서 두 노드 최단 경로(관계 경로추적). from/to 는 노드 id.",
        "parameters": {"type": "object", "properties": {
            "from": {"type": "string"}, "to": {"type": "string"}}, "required": ["from", "to"]}}},
    {"type": "function", "function": {
        "name": "kg_evidence",
        "description": "지식그래프 노드의 근거체인(엣지 evidence + describes 노트)을 track·confidence 와 함께 조회. 저신뢰·llm 은 '미검증'으로 밝혀 인용.",
        "parameters": {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]}}},
```

(b) `_dispatch`(L261~)에 분기 추가:

```python
    if name == "kg_neighbors":
        return tools.kg_neighbors(project, args.get("id", ""), args.get("depth", 1), args.get("types"))
    if name == "kg_path":
        return tools.kg_path(project, args.get("from", ""), args.get("to", ""))
    if name == "kg_evidence":
        return tools.kg_evidence(project, args.get("id", ""))
```

(c) 시스템 지침(L29 부근 문자열)에 한 문장 추가:

```
"설비 간 관계·경로·근거체인은 지식그래프 툴(kg_neighbors·kg_path·kg_evidence)로 순회하세요. "
"relates_to·track=llm 은 AI 추출(미검증)이므로 인용 시 '자동추론(미검증)'으로 밝힙니다. "
```

- [ ] **Step 5: 실행 — 통과 + AI 회귀**

Run: `cd backend && python -m pytest tests/test_kg_ai_tools.py -v && python -m pytest tests/ -q -k "ai or agent or tools"`
Expected: 신규 PASS · AI 테스트 회귀 0.

- [ ] **Step 6: Commit**

```bash
git add backend/ai/tools.py backend/ai/agent.py backend/tests/test_kg_ai_tools.py
git commit -m "feat(kg): ③ kg_* AI 툴 — 지식그래프 순회(8000 GET만, 격리 유지)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: ④ 프론트 API 클라이언트 (`src/api/kg.ts`)

**Files:**
- Create: `src/api/kg.ts`
- Test: `src/api/kg.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/api/kg.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchGraph, fetchNeighbors } from "./kg";

afterEach(() => vi.restoreAllMocks());

describe("kg api", () => {
  it("fetchGraph 는 project_name 쿼리로 /api/kg/graph 를 부른다", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ nodes: [{ id: "eq:E1" }], edges: [] }), { status: 200 }));
    const g = await fetchGraph("P1");
    expect(spy.mock.calls[0][0]).toContain("/api/kg/graph?project_name=P1");
    expect(g.nodes[0].id).toBe("eq:E1");
  });

  it("fetchNeighbors 는 id·depth 를 넘긴다", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ found: true, nodes: [], edges: [] }), { status: 200 }));
    await fetchNeighbors("P1", "eq:E1", 2);
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("id=eq%3AE1");
    expect(url).toContain("depth=2");
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npx vitest run src/api/kg.test.ts`
Expected: FAIL — `./kg` 없음.

- [ ] **Step 3: `src/api/kg.ts` 구현**

기존 `src/api/*.ts` 의 fetch 관례(base URL·에러 처리)를 먼저 열어 맞춘다(예: `src/api/drawings.ts`). 없으면 아래 최소형:

```typescript
export type KgNode = { id: string; type: string; ref_id: string | null; label: string; props: Record<string, unknown> };
export type KgEdge = { src: string; dst: string; type: string; confidence: number; track: "curated" | "rule" | "llm"; evidence: string | null };
export type KgGraph = { nodes: KgNode[]; edges: KgEdge[]; built_at?: string | null };

const BASE = ""; // 동일 오리진(vite proxy) — 기존 api 파일과 동일 규약으로 맞출 것

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error(`kg api ${r.status}: ${path}`);
  return (await r.json()) as T;
}

export function fetchGraph(project: string, scope?: string): Promise<KgGraph> {
  const q = new URLSearchParams({ project_name: project });
  if (scope) q.set("scope", scope);
  return getJson<KgGraph>(`/api/kg/graph?${q.toString()}`);
}

export function fetchNeighbors(project: string, id: string, depth = 1): Promise<KgGraph & { found: boolean }> {
  const q = new URLSearchParams({ project_name: project, id, depth: String(depth) });
  return getJson(`/api/kg/neighbors?${q.toString()}`);
}
```

- [ ] **Step 4: 실행 — 통과 확인**

Run: `npx vitest run src/api/kg.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/api/kg.ts src/api/kg.test.ts
git commit -m "feat(kg): ④ 프론트 지식그래프 API 클라이언트

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: ④ 전용 뷰 (`KnowledgeGraphView.tsx`) — canvas force 그래프

**Files:**
- Create: `src/KnowledgeGraphView.tsx`
- Create: `src/kgForce.ts` (순수 force 레이아웃 — 테스트 가능하게 분리)
- Test: `src/kgForce.test.ts`, `src/KnowledgeGraphView.test.tsx`

xg-web `web/nms.js` 의 `forceLayout(nodes, links, W, H, iters)`(L184) 를 TypeScript 순수함수로 이식. 렌더는 Canvas. 시계·난수 없이 결정적(초기 좌표는 인덱스 기반 원형 배치 — `Math.random()` 대신 `i` 로 각도).

- [ ] **Step 1: force 레이아웃 실패 테스트**

`src/kgForce.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { layout } from "./kgForce";

describe("kgForce", () => {
  it("결정적: 같은 입력 → 같은 좌표(시계·난수 없음)", () => {
    const nodes = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const edges = [{ src: "a", dst: "b" }, { src: "b", dst: "c" }];
    const a = layout(nodes, edges, 800, 600, 50);
    const b = layout(nodes, edges, 800, 600, 50);
    expect(a).toEqual(b);
    expect(a.a.x).toBeGreaterThan(0);
  });

  it("연결된 노드는 무한대로 흩어지지 않는다(경계 내)", () => {
    const nodes = [{ id: "a" }, { id: "b" }];
    const pos = layout(nodes, [{ src: "a", dst: "b" }], 800, 600, 100);
    for (const id of ["a", "b"]) {
      expect(pos[id].x).toBeGreaterThanOrEqual(0);
      expect(pos[id].x).toBeLessThanOrEqual(800);
    }
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npx vitest run src/kgForce.test.ts`
Expected: FAIL — `./kgForce` 없음.

- [ ] **Step 3: `src/kgForce.ts` 구현 (xg-web forceLayout 이식, 결정적)**

```typescript
export type FNode = { id: string };
export type FEdge = { src: string; dst: string };
export type Pos = Record<string, { x: number; y: number }>;

/** 결정적 force-directed 레이아웃(반발+스프링+중심). 난수 없음 — 초기 좌표는 원형 배치.
 *  xg-web web/nms.js forceLayout 이식(Obsidian식). */
export function layout(nodes: FNode[], edges: FEdge[], W: number, H: number, iters = 200): Pos {
  const n = nodes.length;
  const pos: Pos = {};
  nodes.forEach((nd, i) => {
    const ang = (2 * Math.PI * i) / Math.max(1, n);
    pos[nd.id] = { x: W / 2 + Math.cos(ang) * (Math.min(W, H) / 3),
                   y: H / 2 + Math.sin(ang) * (Math.min(W, H) / 3) };
  });
  const k = Math.sqrt((W * H) / Math.max(1, n));
  for (let it = 0; it < iters; it++) {
    const disp: Pos = {};
    nodes.forEach((nd) => (disp[nd.id] = { x: 0, y: 0 }));
    // 반발(모든 쌍).
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos[nodes[i].id], b = pos[nodes[j].id];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (k * k) / d;
        dx /= d; dy /= d;
        disp[nodes[i].id].x += dx * f; disp[nodes[i].id].y += dy * f;
        disp[nodes[j].id].x -= dx * f; disp[nodes[j].id].y -= dy * f;
      }
    }
    // 스프링(엣지).
    for (const e of edges) {
      const a = pos[e.src], b = pos[e.dst];
      if (!a || !b) continue;
      let dx = a.x - b.x, dy = a.y - b.y;
      let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d * d) / k;
      dx /= d; dy /= d;
      disp[e.src].x -= dx * f; disp[e.src].y -= dy * f;
      disp[e.dst].x += dx * f; disp[e.dst].y += dy * f;
    }
    const t = (1 - it / iters) * (k / 2);
    for (const nd of nodes) {
      const dp = disp[nd.id];
      const dl = Math.sqrt(dp.x * dp.x + dp.y * dp.y) || 0.01;
      const p = pos[nd.id];
      p.x += (dp.x / dl) * Math.min(dl, t);
      p.y += (dp.y / dl) * Math.min(dl, t);
      p.x = Math.max(0, Math.min(W, p.x));
      p.y = Math.max(0, Math.min(H, p.y));
    }
  }
  return pos;
}
```

- [ ] **Step 4: 실행 — 통과 확인**

Run: `npx vitest run src/kgForce.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: `KnowledgeGraphView.tsx` 렌더 테스트(로딩→그래프)**

`src/KnowledgeGraphView.test.tsx`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import KnowledgeGraphView from "./KnowledgeGraphView";

afterEach(() => vi.restoreAllMocks());

describe("KnowledgeGraphView", () => {
  it("그래프를 불러와 노드 수·범례를 표시한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      nodes: [{ id: "eq:E1", type: "equipment", ref_id: "E1", label: "MTR-1", props: {} },
              { id: "sh:s1", type: "sheet", ref_id: "s1", label: "E-101", props: {} }],
      edges: [{ src: "eq:E1", dst: "sh:s1", type: "appears_on", confidence: 1, track: "curated", evidence: null }],
    }), { status: 200 }));
    render(<KnowledgeGraphView projectName="P1" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/노드 2/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 6: 실행 — 실패 확인**

Run: `npx vitest run src/KnowledgeGraphView.test.tsx`
Expected: FAIL — 컴포넌트 없음.

- [ ] **Step 7: `src/KnowledgeGraphView.tsx` 구현**

기존 뷰(`BuildSheetsView.tsx`)의 헤더·뒤로가기·스타일 관례를 먼저 확인해 맞춘다. Canvas 에 `kgForce.layout` 결과를 그리고, 노드 색=type·엣지 스타일=track(curated 실선·llm 점선·저신뢰 흐리게), 클릭 시 콘솔·딥링크 훅.

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchGraph, KgGraph, KgNode } from "./api/kg";
import { layout, Pos } from "./kgForce";

const TYPE_COLOR: Record<string, string> = {
  equipment: "#2563eb", sheet: "#059669", issue: "#dc2626",
  task: "#d97706", file: "#6b7280", tag: "#7c3aed", note: "#0891b2",
};

export default function KnowledgeGraphView({ projectName, onBack }: { projectName: string; onBack: () => void }) {
  const [graph, setGraph] = useState<KgGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KgNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const W = 900, H = 640;

  useEffect(() => {
    let live = true;
    fetchGraph(projectName)
      .then((g) => { if (live) setGraph(g); })
      .catch((e) => { if (live) setError(String(e)); });
    return () => { live = false; };
  }, [projectName]);

  const pos: Pos = useMemo(
    () => (graph ? layout(graph.nodes, graph.edges, W, H, 200) : {}),
    [graph]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !graph) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    // 엣지.
    for (const e of graph.edges) {
      const a = pos[e.src], b = pos[e.dst];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = e.track === "llm" ? "rgba(120,120,120,0.5)" : "rgba(60,60,60,0.7)";
      ctx.setLineDash(e.track === "llm" ? [4, 4] : []); // llm=점선(미검증)
      ctx.lineWidth = e.confidence < 0.7 ? 0.6 : 1.2;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // 노드.
    for (const nd of graph.nodes) {
      const p = pos[nd.id];
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = TYPE_COLOR[nd.type] || "#374151";
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.font = "11px sans-serif";
      ctx.fillText(nd.label, p.x + 8, p.y + 3);
    }
  }, [graph, pos]);

  function onClick(ev: React.MouseEvent<HTMLCanvasElement>) {
    if (!graph) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    const hit = graph.nodes.find((nd) => {
      const p = pos[nd.id];
      return p && Math.hypot(p.x - x, p.y - y) <= 8;
    });
    setSelected(hit || null);
  }

  return (
    <div className="kg-view">
      <header className="kg-header">
        <button type="button" onClick={onBack}>← 뒤로</button>
        <h2>지식그래프 — {projectName}</h2>
        {graph && <span>노드 {graph.nodes.length} · 엣지 {graph.edges.length}</span>}
      </header>
      {error && <p role="alert">불러오기 실패: {error}</p>}
      <div className="kg-legend">
        {Object.entries(TYPE_COLOR).map(([t, c]) => (
          <span key={t} style={{ color: c }}>● {t}</span>
        ))}
        <span>— curated 실선 · llm 점선(미검증)</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} onClick={onClick}
              style={{ border: "1px solid #e5e7eb", cursor: "pointer" }} />
      {selected && (
        <aside className="kg-inspect">
          <strong>{selected.label}</strong> <em>{selected.type}</em>
          {selected.ref_id && <div>ref: {selected.ref_id}</div>}
        </aside>
      )}
    </div>
  );
}
```

- [ ] **Step 8: 실행 — 통과 확인**

Run: `npx vitest run src/KnowledgeGraphView.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/kgForce.ts src/kgForce.test.ts src/KnowledgeGraphView.tsx src/KnowledgeGraphView.test.tsx
git commit -m "feat(kg): ④ 전용 뷰 — canvas force 그래프(xg-web 이식, 결정적)

노드 색=type, 엣지 track=curated 실선·llm 점선(미검증), 클릭 인스펙트.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: ④ App.tsx 네비 배선 + 전체 검증

**Files:**
- Modify: `src/App.tsx` (activeView 유니온에 "knowledge-graph" 추가, 탭 버튼, 렌더 분기)
- Test: `src/App.test.tsx` (탭 존재·전환 최소 검증 추가)

- [ ] **Step 1: App 에 지식그래프 탭 실패 테스트 추가**

`src/App.test.tsx` 에 케이스 추가(기존 파일 관례에 맞춰):

```typescript
it("지식그래프 탭이 있고 클릭하면 뷰로 전환된다", async () => {
  // fetch 스텁(빈 그래프).
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ nodes: [], edges: [] }), { status: 200 }));
  render(<App /* 기존 테스트가 넘기는 초기 props 동일하게 */ />);
  const tab = screen.getByRole("tab", { name: /지식그래프/ });
  fireEvent.click(tab);
  expect(await screen.findByText(/지식그래프 —/)).toBeInTheDocument();
});
```

> 기존 `App.test.tsx` 가 App 에 넘기는 초기 props(projects 등)를 그대로 재사용한다. import(`fireEvent`·`screen`)도 파일 상단 관례에 맞춘다.

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL — "지식그래프" 탭 없음.

- [ ] **Step 3: `App.tsx` 배선**

(a) import 추가: `import KnowledgeGraphView from "./KnowledgeGraphView";`

(b) `activeView` 유니온 타입(L157~)에 `| "knowledge-graph"` 추가.

(c) 렌더 분기 추가(다른 `if (activeView === ...)` 블록 근처, L344 build-sheets 다음):

```tsx
  if (activeView === "knowledge-graph") {
    return (
      <KnowledgeGraphView
        projectName={projects.find((p) => p.id === selectedProjectId)?.name ?? projects[0].name}
        onBack={() => setActiveView("projects")}
      />
    );
  }
```

(d) `<nav className="tabs">`(L369) 에 버튼 추가:

```tsx
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "knowledge-graph"}
            onClick={() => setActiveView("knowledge-graph")}
          >
            지식그래프
          </button>
```

- [ ] **Step 4: 실행 — 통과 + 프론트 전체 회귀**

Run: `npx vitest run`
Expected: 신규 PASS · 기존 128 회귀 0.

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: GREEN (타입 에러 0).

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(kg): ④ App 네비 배선 — 지식그래프 전용 탭

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 통합 검증 (실 데이터 빌드 + e2e + 회귀 종합)

**Files:** (없음 — 검증·증빙만)

- [ ] **Step 1: 실 프로젝트로 그래프 빌드**

8000 기동 상태에서(8002 는 mock 기본 = egress 0):

```bash
cd backend && python main.py   # 별 터미널, 8000
# 8002 사이드카 기동(mock): cd backend/extract && .venv/Scripts/python.exe -m uvicorn main_extract:app --port 8002
python scripts/build_knowledge_graph.py "LS 청주사업장" 2026-07-09T00:00:00
```

Expected: `built LS 청주사업장: N nodes, M edges` (N>0). `uploads/_knowledge_graph.json` 에 스냅샷 존재.

- [ ] **Step 2: 조회 API 스모크**

```bash
curl "http://127.0.0.1:8000/api/kg/graph?project_name=LS%20청주사업장" | python -m json.tool | head
```

Expected: nodes·edges 채워짐. relates_to 엣지 track="llm".

- [ ] **Step 3: 브라우저 e2e — 전용 뷰 렌더(콘솔0)**

앱 dev 서버(`npm run dev`)에서 프로젝트 선택 → "지식그래프" 탭. force 그래프 렌더 확인. 브라우저 콘솔 에러 0(chrome-devtools MCP `list_console_messages`).

- [ ] **Step 4: 전 스위트 회귀 종합**

```bash
cd backend && python -m pytest -q                                   # backend(178 + kg 신규)
cd backend/extract && .venv/Scripts/python.exe -m pytest -q          # 사이드카(50/자체7 + analyze)
cd ../../ && npx vitest run && npm run build                         # 프론트(128 + kg) + build
```

Expected: 전부 GREEN. 회귀 0.

- [ ] **Step 5: 증빙 기록 + PROGRESS 갱신**

`docs/buildout-loop/PROGRESS.md` 에 세션 블록 추가(구현 완료·검증 수치). `evidence/` 관례 있으면 스모크 출력 저장.

- [ ] **Step 6: Commit**

```bash
git add docs/buildout-loop/PROGRESS.md evidence/
git commit -m "chore(kg): 통합 검증 — 실 빌드+e2e+회귀 종합, 읽기 그래프 ①②③④ 완료

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (계획 vs 스펙)

**1. 스펙 커버리지**
- §2 데이터 모델(노드/엣지 스키마·track) → Task 2·4 계약. ✅
- §2③ relates_to 승격(모델·표기만, 쓰기 이연) → track=llm 시드(Task 4) + 뷰 점선/저신뢰(Task 8), 확인 쓰기 없음. ✅
- §3 통합 스냅샷·멱등 재빌드 → Task 4. ✅
- §3b 외부 AI API(8002 /analyze) → Task 3. ✅
- §4 조회 API 5종 + kg_* 툴 → Task 5·6. ✅
- §5 전용 페이지 force(xg-web 차용) → Task 7·8·9. ✅
- §6 overlay 되돌림 → Task 1. ✅
- §7 테스트(스토어·조회·사이드카·격리·시각화) → 각 태스크 TDD + Task 10 종합. ✅
- §8 불변식(TypeDB·격리·외부AI·정직성·egress0) → 태스크 전반 가드. ✅

**2. 플레이스홀더 스캔**: "적절히 처리" 류 없음. `src/api/kg.ts` BASE·`App.test.tsx` 초기 props 는 "기존 파일 관례 확인" 지시 + 최소 동작 코드 동봉(추정 아님). ✅

**3. 타입 일관성**: 노드 id 접두(eq:/sh:/is:/tk:/fl:/tg:/nt:) 전 태스크 동일. `kg_store` 함수명(get_node·neighbors·path·evidence·subgraph·check_integrity)이 라우트·빌드·테스트에서 일치. `KgGraph`/`KgNode`/`KgEdge` 타입이 kg.ts→KnowledgeGraphView 일치. `layout()` 시그니처 kgForce↔뷰 일치. ✅

**주의(구현자용)**: `OpenAIExtractProvider.analyze` 의 `self._complete` 는 기존 provider 실 호출부에서 추출·공유해야 함(Task 3 Step 3 주). read 동작 불변을 기존 사이드카 테스트로 확인할 것. 실 LLM 경로는 HUMAN_GATE-7 이라 mock 로 CI 통과가 기본이며, 실 호출 검증은 게이트 열 때 수동.
