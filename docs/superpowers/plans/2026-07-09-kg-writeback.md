# 지식그래프 ⑥ Write-back (relates_to 승격·거부) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사람이 AI 제안 관계(track=llm relates_to)를 confirm(→curated 승격)·reject(→drop)하는 쓰기 경로를, 멱등 재빌드가 지우지 못하는 오버레이 저널 위에 세운다.

**Architecture:** 빌드 스냅샷(`uploads/_knowledge_graph.json`, 기계 사실, 멱등 전량 재생성)은 그대로 두고, 사람 권위를 별도 append-only 저널(`uploads/_kg_overlay.json`)에 쌓는다. `kg_store`가 스냅샷 로드 후 오버레이를 **로드타임 병합**해 모든 읽기 경로(get_node·neighbors·path·evidence·subgraph)에 승격/거부를 반영한다. 쓰기 라우트는 신규 파일 `routes_kg_writeback.py`로 분리(읽기 `routes_kg.py`는 불변). 병합은 읽기 경로에서만 일어나므로 승격이 재빌드에서 생존한다.

**Tech Stack:** Python/FastAPI(backend 8000), pytest. React+Vite+TypeScript, vitest, HTML5 Canvas(엣지 히트테스트). 외부 라이브러리 추가 없음.

**입력 스펙(FROZEN):** `docs/superpowers/specs/2026-07-09-kg-writeback-design.md`

---

## 불변식 (모든 태스크에서 지킴 — 스펙 §8)

- **빌드 멱등 유지**: `scripts/build_knowledge_graph.py`를 **변경하지 않는다**. 재빌드는 여전히 오버레이 없는 순수 스냅샷.
- **track=llm 외 보호**: rule(기계사실)·curated(사람권위) 엣지는 오버레이로 **절대 변경되지 않는다**(테스트로 가드).
- **읽기 API 표면 불변**: 병합은 `kg_store` 내부. `routes_kg.py`의 기존 5 라우트 응답 계약 유지(track이 curated로 바뀌거나 reject 엣지가 빠지는 것 외 형태 동일).
- **8000 egress 0**: 쓰기 라우트는 로컬 파일 I/O만. 외부 호출 없음.
- **TypeDB 물리분리 LOCKED**: 오버레이는 XD 내부 JSON(`uploads/`). 온톨로지·TypeDB 무관.
- **회귀 0**: 세션28 기준선 유지 — 프론트 vitest **135** · 백엔드 tests/ **196**(+1skip) · AI 사이드카 **50** · 8002 extract **8**. 신규 테스트만 추가.

## edge_key 계약 (전 태스크 공통)

- `relates_to`는 **무방향** → `edge_key(a, b) = "{lo}|{hi}|relates_to"` where `lo, hi = sorted([a, b])`. A↔B 동일 키.
- relates_to 외 엣지(has_tag·appears_on·pinned_to·about·references·describes)는 write-back 대상 아님 → 키 생성 안 함.

## 오버레이 스키마 `uploads/_kg_overlay.json` (스펙 §3.1)

```json
{
  "version": 1,
  "graphs": {
    "<project_name>": {
      "overrides": [
        {"edge_key": "eq:E1|eq:E2|relates_to", "action": "confirm", "actor": "khlee", "at": "2026-07-09T13:00:00Z", "reason": null},
        {"edge_key": "eq:E3|eq:E4|relates_to", "action": "reject", "actor": null, "at": null, "reason": "오탐 - 다른 계통"}
      ]
    }
  }
}
```

- **append-only**: 새 override는 리스트 끝에 추가. 기존 항목 수정·삭제 없음.
- **last-write-wins**: 같은 `edge_key`에 override가 여러 개면 **리스트 마지막 항목이 유효**. 되돌림 = 반대 action을 새로 append.
- **시계 없음**: `at`은 API가 요청 시각을 주입(없으면 null 허용). 병합 로직은 `at`을 읽지 않는다(순서는 리스트 위치로 결정).

---

## Task 1: 오버레이 저널 — edge_key 정규화·로드·append (kg_store 확장)

**Files:**
- Modify: `backend/kg_store.py` (신규: `_OVERLAY_PATH`, `edge_key()`, `_load_overlay()`, `_overlay_map()`, `append_override()`)
- Test: `backend/tests/test_kg_overlay.py` (신규)

스토어에 **저널 I/O·키 정규화**만 먼저 추가한다(병합은 Task 2). 쓰기 라우트(Task 3)가 `append_override`를, 병합(Task 2)이 `_overlay_map`을 재사용한다.

- [ ] **Step 1: 실패 테스트 작성 — edge_key 무방향 정규화·append·last-write-wins**

`backend/tests/test_kg_overlay.py`:

```python
"""오버레이 저널 — edge_key 무방향 정규화·append-only·last-write-wins 맵."""
import importlib
import json

import pytest


@pytest.fixture()
def kg(tmp_path, monkeypatch):
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import config
    importlib.reload(config)
    import kg_store
    importlib.reload(kg_store)
    return kg_store


def test_edge_key_is_undirected(kg):
    # A↔B 와 B↔A 는 동일 키(정렬 정규화).
    assert kg.edge_key("eq:E1", "eq:E2") == kg.edge_key("eq:E2", "eq:E1")
    assert kg.edge_key("eq:E1", "eq:E2") == "eq:E1|eq:E2|relates_to"


def test_append_override_is_appendonly(kg, tmp_path):
    k = kg.edge_key("eq:E1", "eq:E2")
    kg.append_override("P1", k, "confirm", actor="khlee", at="2026-07-09T00:00:00Z", reason=None)
    kg.append_override("P1", k, "reject", actor=None, at=None, reason="오탐")
    ov = json.loads((tmp_path / "_kg_overlay.json").read_text(encoding="utf-8"))
    entries = ov["graphs"]["P1"]["overrides"]
    # 두 항목 다 남아있다(append-only, 삭제 없음).
    assert [e["action"] for e in entries] == ["confirm", "reject"]
    assert entries[1]["reason"] == "오탐"


def test_overlay_map_is_last_write_wins(kg):
    k = kg.edge_key("eq:E1", "eq:E2")
    kg.append_override("P1", k, "confirm", actor="a", at=None, reason=None)
    kg.append_override("P1", k, "reject", actor="b", at=None, reason=None)
    m = kg._overlay_map("P1")
    # 같은 키에 confirm→reject 순서 → 마지막(reject)이 유효.
    assert m[k] == "reject"


def test_overlay_map_empty_when_no_file(kg):
    assert kg._overlay_map("P1") == {}
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `cd backend && python -m pytest tests/test_kg_overlay.py -v`
Expected: FAIL — `kg_store` 에 `edge_key`/`append_override`/`_overlay_map` 없음(AttributeError).

- [ ] **Step 3: `kg_store.py` 에 저널 I/O·키 정규화 추가**

`backend/kg_store.py` — `_PATH` 정의(L18) 바로 아래에 오버레이 경로 추가:

```python
_OVERLAY_PATH = Path(config.UPLOADS_DIR) / "_kg_overlay.json"
```

파일 하단(`check_integrity` 뒤)에 함수 추가:

```python
# ── 오버레이 저널 (⑥ write-back) ──────────────────────────────
def edge_key(a: str, b: str) -> str:
    """relates_to 무방향 정규화 키 — A↔B 동일. (relates_to 전용, 다른 엣지 타입엔 쓰지 않음.)"""
    lo, hi = sorted([a, b])
    return f"{lo}|{hi}|relates_to"


def _load_overlay() -> dict:
    if _OVERLAY_PATH.exists():
        try:
            return json.loads(_OVERLAY_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            logger.error("오버레이 저널 파싱 실패(%s) → 빈 오버레이 반환", _OVERLAY_PATH)
    return {"version": 1, "graphs": {}}


def _overlay_map(project: str) -> dict:
    """프로젝트 오버레이를 {edge_key: action} 로 축약(last-write-wins).

    같은 edge_key 에 override 가 여러 개면 리스트 마지막 항목이 유효.
    """
    overrides = _load_overlay().get("graphs", {}).get(project, {}).get("overrides", [])
    m: dict = {}
    for o in overrides:  # 리스트 순서대로 덮어쓰기 → 마지막이 이김.
        m[o["edge_key"]] = o["action"]
    return m


def append_override(project: str, key: str, action: str,
                    actor: Optional[str] = None, at: Optional[str] = None,
                    reason: Optional[str] = None) -> dict:
    """오버레이 저널에 override 1건 append(기존 항목 불변). 저장 후 그 항목 반환."""
    data = _load_overlay()
    graphs = data.setdefault("graphs", {})
    proj = graphs.setdefault(project, {"overrides": []})
    entry = {"edge_key": key, "action": action, "actor": actor, "at": at, "reason": reason}
    proj.setdefault("overrides", []).append(entry)
    _OVERLAY_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = _OVERLAY_PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    import os
    os.replace(tmp, _OVERLAY_PATH)
    return entry
```

> `os` 는 상단 import 에 없으면 파일 상단 import 블록(`import json` 옆)에 `import os` 를 추가한다. (`_load`·`_graph` 는 `os` 를 안 쓰지만 `append_override` 원자적 쓰기에 필요.)

- [ ] **Step 4: 실행 — 통과 확인**

Run: `cd backend && python -m pytest tests/test_kg_overlay.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/kg_store.py backend/tests/test_kg_overlay.py
git commit -m "feat(kg): ⑥ 오버레이 저널 — edge_key 정규화·append-only·last-write-wins

relates_to 무방향 키(A↔B 동일). _kg_overlay.json 원자적 append.
병합은 다음 태스크. 빌드 스냅샷 불변.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 로드타임 병합 — confirm→curated·reject→drop·비-llm 보호·재빌드 생존

**Files:**
- Modify: `backend/kg_store.py` (신규 `_merge()`·`_merged_graph()`, 읽기 5경로를 `_merged_graph` 로 배선)
- Test: `backend/tests/test_kg_merge.py` (신규)

**핵심**: 현재 `_graph(project)`는 순수 스냅샷을 반환하며 모든 읽기가 이를 통과한다. `_graph` 는 **그대로 두고**(Task 3 검증이 순수 스냅샷을 봐야 함), 새 `_merged_graph`를 만들어 읽기 5경로(get_node·neighbors·path·evidence·subgraph)만 그쪽으로 돌린다.

- [ ] **Step 1: 실패 테스트 작성 — 병합 4규칙 + 재빌드 생존 + dangling 무시**

`backend/tests/test_kg_merge.py`:

```python
"""로드타임 병합 — confirm→curated·reject→drop·비llm 보호·dangling 무시·재빌드 생존."""
import importlib
import json

import pytest

_SNAP = {
    "graphs": {
        "P1": {
            "built_at": "2026-07-09T00:00:00",
            "nodes": [
                {"id": "eq:E1", "type": "equipment", "ref_id": "E1", "label": "MTR-1", "props": {}},
                {"id": "eq:E2", "type": "equipment", "ref_id": "E2", "label": "VCB-1", "props": {}},
                {"id": "eq:E3", "type": "equipment", "ref_id": "E3", "label": "TR-1", "props": {}},
                {"id": "sh:s1", "type": "sheet", "ref_id": "s1", "label": "E-101", "props": {}},
            ],
            "edges": [
                {"src": "eq:E1", "dst": "sh:s1", "type": "appears_on", "confidence": 1.0, "track": "curated", "evidence": None},
                {"src": "eq:E1", "dst": "eq:E2", "type": "relates_to", "confidence": 0.6, "track": "llm", "evidence": "공출현"},
                {"src": "eq:E2", "dst": "eq:E3", "type": "relates_to", "confidence": 0.5, "track": "llm", "evidence": "공출현2"},
            ],
        }
    }
}


@pytest.fixture()
def kg(tmp_path, monkeypatch):
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import config
    importlib.reload(config)
    import kg_store
    importlib.reload(kg_store)
    (tmp_path / "_knowledge_graph.json").write_text(json.dumps(_SNAP), encoding="utf-8")
    return kg_store


def _rel(g, a, b):
    return [e for e in g["edges"] if e["type"] == "relates_to"
            and {e["src"], e["dst"]} == {a, b}]


def test_confirm_promotes_llm_to_curated(kg):
    kg.append_override("P1", kg.edge_key("eq:E1", "eq:E2"), "confirm", actor="k", at=None, reason=None)
    g = kg._merged_graph("P1")
    edge = _rel(g, "eq:E1", "eq:E2")[0]
    assert edge["track"] == "curated"


def test_reject_drops_edge(kg):
    kg.append_override("P1", kg.edge_key("eq:E2", "eq:E3"), "reject", actor=None, at=None, reason="오탐")
    g = kg._merged_graph("P1")
    assert _rel(g, "eq:E2", "eq:E3") == []


def test_curated_edge_is_protected(kg):
    # appears_on(curated) 에 대해 (있을 수 없는) override 가 있어도 무시 — 비llm 보호.
    kg.append_override("P1", "eq:E1|sh:s1|relates_to", "reject", actor=None, at=None, reason=None)
    g = kg._merged_graph("P1")
    assert any(e["type"] == "appears_on" and e["track"] == "curated" for e in g["edges"])


def test_dangling_override_is_ignored(kg):
    # 스냅샷에 없는 edge_key → 조용히 무시(로드 실패 아님).
    kg.append_override("P1", "eq:GONE|eq:X|relates_to", "confirm", actor=None, at=None, reason=None)
    g = kg._merged_graph("P1")  # 예외 없이 로드.
    assert len(g["nodes"]) == 4


def test_promotion_survives_rebuild(kg, tmp_path):
    # confirm 후 스냅샷을 순수 재생성(오버레이 미포함) → 병합은 여전히 curated.
    kg.append_override("P1", kg.edge_key("eq:E1", "eq:E2"), "confirm", actor="k", at=None, reason=None)
    (tmp_path / "_knowledge_graph.json").write_text(json.dumps(_SNAP), encoding="utf-8")  # 순수 재빌드 모사.
    g = kg._merged_graph("P1")
    assert _rel(g, "eq:E1", "eq:E2")[0]["track"] == "curated"


def test_read_paths_see_merge(kg):
    # 공개 읽기 API(neighbors)도 reject 를 반영한다(내부 _merged_graph 배선 확인).
    kg.append_override("P1", kg.edge_key("eq:E2", "eq:E3"), "reject", actor=None, at=None, reason=None)
    r = kg.neighbors("P1", "eq:E2", depth=1)
    ids = {n["id"] for n in r["nodes"]}
    assert "eq:E3" not in ids  # reject 로 E2–E3 관계 사라짐 → E3 이웃 아님.
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `cd backend && python -m pytest tests/test_kg_merge.py -v`
Expected: FAIL — `_merged_graph` 없음(AttributeError).

- [ ] **Step 3: `kg_store.py` 에 `_merge`·`_merged_graph` 추가하고 읽기 5경로 배선**

(a) Task 1에서 추가한 오버레이 함수 블록 뒤에 병합 함수 추가:

```python
def _merge(g: dict, omap: dict) -> dict:
    """스냅샷 그래프 g 에 오버레이 맵(omap: {edge_key: action})을 적용한 병합 그래프 반환.

    규칙(스펙 §4):
      - track != 'llm' → 무시(rule·curated 보호).
      - track == 'llm' + override 없음 → 그대로.
      - track == 'llm' + confirm → track 을 'curated' 로 치환.
      - track == 'llm' + reject → 결과에서 제외(drop).
      - dangling override(어느 엣지와도 안 맞음) → 조용히 무시(로그 경고).
    스냅샷 파일 자체는 변경하지 않는다(병합은 읽기 경로 메모리에서만).
    """
    out_edges = []
    matched = set()
    for e in g.get("edges", []):
        if e.get("track") != "llm":
            out_edges.append(e)
            continue
        key = edge_key(e["src"], e["dst"])
        action = omap.get(key)
        if action is None:
            out_edges.append(e)
        elif action == "confirm":
            matched.add(key)
            out_edges.append({**e, "track": "curated"})
        elif action == "reject":
            matched.add(key)
            # drop — 결과 목록에서 제외.
        else:  # 알 수 없는 action → 안전하게 원본 유지.
            out_edges.append(e)
    dangling = set(omap) - matched
    if dangling:
        logger.warning("오버레이 dangling override 무시(%d건): %s",
                       len(dangling), ", ".join(sorted(dangling)[:5]))
    return {**g, "edges": out_edges}


def _merged_graph(project: str) -> dict:
    """순수 스냅샷(_graph) + 오버레이 병합 — 모든 읽기 경로의 단일 진입점."""
    return _merge(_graph(project), _overlay_map(project))
```

(b) 읽기 5함수의 `_graph(project)` 호출을 `_merged_graph(project)` 로 교체 — **정확히 아래 5곳**:

- `get_node`(L43): `g = _graph(project)` → `g = _merged_graph(project)`
- `neighbors`(L53): `g = _graph(project)` → `g = _merged_graph(project)`
- `path`(L80): `g = _graph(project)` → `g = _merged_graph(project)`
- `evidence`(L113): `g = _graph(project)` → `g = _merged_graph(project)`
- `subgraph`(L129): `g = _graph(project)` → `g = _merged_graph(project)`

> `_graph` 자체는 **바꾸지 않는다**(순수 스냅샷 반환 유지 — Task 3 쓰기 검증이 이걸 본다). `neighbors`·`subgraph` 는 다른 읽기함수를 재호출하지 않고 직접 `g` 를 쓰므로 5곳 모두 개별 교체 필요.

- [ ] **Step 4: 실행 — 통과 확인**

Run: `cd backend && python -m pytest tests/test_kg_merge.py -v`
Expected: PASS (6 tests).

- [ ] **Step 5: 읽기 트랙 회귀 확인 (병합 배선이 기존 조회를 안 깼는지)**

Run: `cd backend && python -m pytest tests/test_kg_store.py tests/test_kg_routes.py tests/test_kg_ai_tools.py -v`
Expected: PASS. 오버레이 파일이 없을 때 `_overlay_map` 는 `{}` → 병합이 no-op → 기존 동작 동일.

- [ ] **Step 6: Commit**

```bash
git add backend/kg_store.py backend/tests/test_kg_merge.py
git commit -m "feat(kg): ⑥ 로드타임 병합 — confirm→curated·reject→drop, 비llm 보호

읽기 5경로를 _merged_graph 로 배선. 병합은 메모리에서만 → 스냅샷 불변,
승격이 재빌드 생존. dangling override 무시(경고). 오버레이 없으면 no-op.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 쓰기 라우트 `routes_kg_writeback.py` (confirm·reject) + main 등록

**Files:**
- Create: `backend/routes_kg_writeback.py`
- Modify: `backend/main.py` (import + include_router)
- Test: `backend/tests/test_kg_writeback_routes.py` (신규)

읽기 `routes_kg.py`는 불변. 쓰기는 신규 파일로 격리. 검증은 **순수 스냅샷**(`kg_store._graph`)에서 relates_to 엣지 존재 + `track=="llm"` 확인 → 아니면 400.

- [ ] **Step 1: 실패 테스트 작성 — confirm/reject 200 + 검증 400 + actor 기록**

`backend/tests/test_kg_writeback_routes.py`:

```python
"""쓰기 라우트 — confirm/reject 성공, 비llm/부재 엣지 400, X-Actor 기록."""
import importlib
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_SNAP = {"graphs": {"P1": {"built_at": None,
    "nodes": [
        {"id": "eq:E1", "type": "equipment", "ref_id": "E1", "label": "MTR-1", "props": {}},
        {"id": "eq:E2", "type": "equipment", "ref_id": "E2", "label": "VCB-1", "props": {}},
        {"id": "sh:s1", "type": "sheet", "ref_id": "s1", "label": "E-101", "props": {}}],
    "edges": [
        {"src": "eq:E1", "dst": "sh:s1", "type": "appears_on", "confidence": 1.0, "track": "curated", "evidence": None},
        {"src": "eq:E1", "dst": "eq:E2", "type": "relates_to", "confidence": 0.6, "track": "llm", "evidence": "공출현"}]}}}


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import config
    importlib.reload(config)
    (tmp_path / "_knowledge_graph.json").write_text(json.dumps(_SNAP), encoding="utf-8")
    import kg_store
    importlib.reload(kg_store)
    import routes_kg_writeback
    importlib.reload(routes_kg_writeback)
    app = FastAPI()
    app.include_router(routes_kg_writeback.router)
    return TestClient(app), tmp_path


def test_confirm_promotes_and_records_actor(client):
    c, tmp = client
    r = c.post("/api/kg/edge/confirm", json={"project_name": "P1", "src": "eq:E1", "dst": "eq:E2"},
               headers={"X-Actor": "khlee"})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True and body["new_track"] == "curated"
    assert body["edge_key"] == "eq:E1|eq:E2|relates_to"
    ov = json.loads((tmp / "_kg_overlay.json").read_text(encoding="utf-8"))
    entry = ov["graphs"]["P1"]["overrides"][-1]
    assert entry["action"] == "confirm" and entry["actor"] == "khlee"
    assert entry["at"] is not None  # API 가 요청 시각 주입.


def test_confirm_is_undirected(client):
    c, _ = client
    # src/dst 뒤집어 보내도 같은 엣지로 인식(정규화 키).
    r = c.post("/api/kg/edge/confirm", json={"project_name": "P1", "src": "eq:E2", "dst": "eq:E1"})
    assert r.status_code == 200 and r.json()["edge_key"] == "eq:E1|eq:E2|relates_to"


def test_reject_hides_edge(client):
    c, _ = client
    r = c.post("/api/kg/edge/reject", json={"project_name": "P1", "src": "eq:E1", "dst": "eq:E2", "reason": "오탐"})
    assert r.status_code == 200 and r.json()["hidden"] is True


def test_confirm_nonexistent_edge_400(client):
    c, _ = client
    r = c.post("/api/kg/edge/confirm", json={"project_name": "P1", "src": "eq:E1", "dst": "eq:NOPE"})
    assert r.status_code == 400


def test_confirm_non_llm_edge_400(client):
    c, _ = client
    # appears_on(curated) 은 relates_to 도 아니고 llm 도 아님 → 400.
    r = c.post("/api/kg/edge/confirm", json={"project_name": "P1", "src": "eq:E1", "dst": "sh:s1"})
    assert r.status_code == 400


def test_actor_optional(client):
    c, tmp = client
    r = c.post("/api/kg/edge/reject", json={"project_name": "P1", "src": "eq:E1", "dst": "eq:E2"})
    assert r.status_code == 200
    ov = json.loads((tmp / "_kg_overlay.json").read_text(encoding="utf-8"))
    assert ov["graphs"]["P1"]["overrides"][-1]["actor"] is None
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `cd backend && python -m pytest tests/test_kg_writeback_routes.py -v`
Expected: FAIL — `No module named 'routes_kg_writeback'`.

- [ ] **Step 3: `backend/routes_kg_writeback.py` 구현**

```python
"""지식그래프 쓰기 라우트 (⑥ write-back) — relates_to 승격 확인·오탐 거부.

읽기 routes_kg.py 와 분리(격리 경계 명확화). 8000 egress 0 — 로컬 파일 쓰기만.
검증은 순수 스냅샷(kg_store._graph)에서 relates_to 엣지 존재 + track=='llm' 확인.
actor 는 X-Actor 헤더 옵셔널(인증 강제는 GATE-6 이연). at 은 요청 시각 주입.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import kg_store

router = APIRouter(prefix="/api/kg/edge", tags=["knowledge-graph-writeback"])


class EdgeRef(BaseModel):
    project_name: str
    src: str
    dst: str
    reason: Optional[str] = None


def _require_llm_relates_to(project: str, src: str, dst: str) -> str:
    """순수 스냅샷에서 정규화 키의 relates_to 엣지가 존재하고 track=='llm' 인지 검증.

    성공 시 edge_key 반환, 아니면 400. (승격 대상은 오직 AI 제안 relates_to.)
    """
    key = kg_store.edge_key(src, dst)
    g = kg_store._graph(project)  # 순수 스냅샷(병합 전).
    for e in g.get("edges", []):
        if e.get("type") == "relates_to" and kg_store.edge_key(e["src"], e["dst"]) == key:
            if e.get("track") != "llm":
                raise HTTPException(400, f"승격 대상 아님(track={e.get('track')}): {key}")
            return key
    raise HTTPException(400, f"relates_to(llm) 엣지 없음: {key}")


@router.post("/confirm")
def confirm(ref: EdgeRef, x_actor: Optional[str] = Header(default=None)) -> dict:
    """AI 제안 relates_to(track=llm)를 사람이 확인 → curated 승격(오버레이 append)."""
    key = _require_llm_relates_to(ref.project_name, ref.src, ref.dst)
    at = datetime.now(timezone.utc).isoformat()
    kg_store.append_override(ref.project_name, key, "confirm", actor=x_actor, at=at, reason=None)
    return {"ok": True, "edge_key": key, "new_track": "curated"}


@router.post("/reject")
def reject(ref: EdgeRef, x_actor: Optional[str] = Header(default=None)) -> dict:
    """AI 제안 relates_to(track=llm)를 오탐 판정 → 뷰/순회에서 drop(오버레이 append)."""
    key = _require_llm_relates_to(ref.project_name, ref.src, ref.dst)
    at = datetime.now(timezone.utc).isoformat()
    kg_store.append_override(ref.project_name, key, "reject", actor=x_actor, at=at, reason=ref.reason)
    return {"ok": True, "edge_key": key, "hidden": True}
```

> `datetime.now` 는 API 경계에서 `at` 주입용(스펙 §3.1 "API 가 요청 시각을 주입"). `kg_store`·빌드 스크립트의 시계 호출 금지 규약과 배치되지 않는다 — 병합 로직은 `at` 을 읽지 않고, 저널의 순서는 리스트 위치로 결정.

- [ ] **Step 4: `main.py` 에 라우터 등록**

`backend/main.py` L27 근처(`from routes_kg import router as kg_router` 다음 줄)에 import 추가:

```python
from routes_kg_writeback import router as kg_writeback_router
```

L58(`app.include_router(kg_router)`) 바로 다음 줄에 include 추가:

```python
app.include_router(kg_writeback_router)
```

- [ ] **Step 5: 실행 — 통과 + 백엔드 전체 회귀**

Run: `cd backend && python -m pytest tests/test_kg_writeback_routes.py -v && python -m pytest -q`
Expected: 신규 6 PASS · 백엔드 전체 회귀 0(196 + 신규들, +1skip 유지).

- [ ] **Step 6: Commit**

```bash
git add backend/routes_kg_writeback.py backend/main.py backend/tests/test_kg_writeback_routes.py
git commit -m "feat(kg): ⑥ 쓰기 라우트 confirm/reject — 순수 스냅샷 검증·X-Actor·egress0

relates_to(llm)만 대상, 정규화 키 무방향. 비llm/부재 엣지 400.
읽기 routes_kg.py 불변, 신규 파일 격리. main 등록.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 프론트 API 클라이언트 — `confirmEdge`·`rejectEdge` (POST)

**Files:**
- Modify: `src/api/kg.ts` (POST 헬퍼 2개 추가)
- Test: `src/api/kg.test.ts` (append)

- [ ] **Step 1: 실패 테스트 작성 — POST URL·body·응답 파싱**

`src/api/kg.test.ts` 하단에 추가(기존 import 에 `confirmEdge, rejectEdge` 추가):

```typescript
import { confirmEdge, rejectEdge } from "./kg";

describe("kg writeback api", () => {
  it("confirmEdge 는 /api/kg/edge/confirm 로 project/src/dst 를 POST 한다", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, edge_key: "eq:E1|eq:E2|relates_to", new_track: "curated" }),
        { status: 200 }));
    const out = await confirmEdge("P1", "eq:E1", "eq:E2");
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain("/api/kg/edge/confirm");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ project_name: "P1", src: "eq:E1", dst: "eq:E2" });
    expect(out.new_track).toBe("curated");
  });

  it("rejectEdge 는 reason 을 body 에 실어 POST 하고 hidden 을 돌려준다", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, edge_key: "eq:E2|eq:E3|relates_to", hidden: true }),
        { status: 200 }));
    const out = await rejectEdge("P1", "eq:E2", "eq:E3", "오탐");
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain("/api/kg/edge/reject");
    expect(JSON.parse(String(init?.body)).reason).toBe("오탐");
    expect(out.hidden).toBe(true);
  });

  it("실패 응답은 throw 한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 400 }));
    await expect(confirmEdge("P1", "eq:E1", "sh:s1")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npm test -- src/api/kg.test.ts`
Expected: FAIL — `confirmEdge`/`rejectEdge` export 없음.

- [ ] **Step 3: `src/api/kg.ts` 에 POST 헬퍼 추가**

파일 하단에 추가(기존 `jsonOrThrow`·`BACKEND_BASE` 재사용):

```typescript
export type ConfirmResult = { ok: boolean; edge_key: string; new_track: "curated" };
export type RejectResult = { ok: boolean; edge_key: string; hidden: boolean };

async function postJson<T>(path: string, body: unknown, what: string): Promise<T> {
  const res = await fetch(`${BACKEND_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res, what);
}

/** AI 제안 relates_to(llm)를 확인 → curated 승격. */
export async function confirmEdge(projectName: string, src: string, dst: string): Promise<ConfirmResult> {
  return postJson("/api/kg/edge/confirm", { project_name: projectName, src, dst }, "관계 확인");
}

/** AI 제안 relates_to(llm)를 오탐 거부 → 뷰에서 숨김. */
export async function rejectEdge(projectName: string, src: string, dst: string, reason?: string): Promise<RejectResult> {
  return postJson("/api/kg/edge/reject", { project_name: projectName, src, dst, reason }, "관계 거부");
}
```

- [ ] **Step 4: 실행 — 통과 확인**

Run: `npm test -- src/api/kg.test.ts`
Expected: PASS (기존 + 신규 3).

- [ ] **Step 5: Commit**

```bash
git add src/api/kg.ts src/api/kg.test.ts
git commit -m "feat(kg): ⑥ 프론트 confirmEdge/rejectEdge — POST 쓰기 클라이언트

BACKEND_BASE·jsonOrThrow 재사용. 실패 시 throw.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: UI — 엣지 히트테스트 + confirm/reject 버튼 + refetch

**Files:**
- Modify: `src/KnowledgeGraphView.tsx` (엣지 선택 상태·히트테스트·조건부 버튼·refetch)
- Test: `src/KnowledgeGraphView.test.tsx` (append)

현재 뷰는 **노드 클릭만** 인스펙트한다(L80~89 `onCanvasClick`, `selected: KgNode`). 여기에 **엣지 선택**을 더한다: 클릭 시 노드 우선, 노드 미적중이면 가장 가까운 엣지 선분 검출. 선택 엣지가 `track=="llm"` 이면 `[확인] [거부]` 버튼 노출 → 호출 후 그래프 refetch.

- [ ] **Step 1: 실패 테스트 작성 — llm 엣지 선택 시 버튼 노출·confirm 호출·refetch**

`src/KnowledgeGraphView.test.tsx` 하단에 추가.

> jsdom canvas 는 좌표 히트테스트가 불가하므로, 테스트는 **버튼 렌더 조건과 핸들러 배선**을 검증한다. 이를 위해 컴포넌트는 선택 엣지가 llm 일 때 `data-testid="edge-actions"` 컨테이너와 `확인`/`거부` 버튼을 렌더하고, 클릭 시 `confirmEdge`/`rejectEdge`(모킹)를 부른 뒤 `fetchGraph` 를 다시 부른다. 엣지 선택을 테스트에서 강제하기 위해 히트테스트를 순수함수 `pickEdge` 로 분리(export)하고, 컴포넌트는 노출된 테스트훅 없이도 `pickEdge` 로 선택한다. 아래 테스트는 `pickEdge` 순수함수 + api 모킹으로 버튼 흐름을 검증한다.

```typescript
import { pickEdge } from "./KnowledgeGraphView";
import * as kgApi from "./api/kg";

const llmGraph = () =>
  new Response(JSON.stringify({
    nodes: [{ id: "eq:E1", type: "equipment", ref_id: "E1", label: "MTR-1", props: {} },
            { id: "eq:E2", type: "equipment", ref_id: "E2", label: "VCB-1", props: {} }],
    edges: [{ src: "eq:E1", dst: "eq:E2", type: "relates_to", confidence: 0.6, track: "llm", evidence: "공출현" }],
  }), { status: 200 });

describe("KnowledgeGraphView edge write-back", () => {
  it("pickEdge 는 선분에 가까운 점에서 엣지를 고르고 먼 점에선 null", () => {
    const pos = { "eq:E1": { x: 0, y: 0 }, "eq:E2": { x: 100, y: 0 } };
    const edges = [{ src: "eq:E1", dst: "eq:E2", type: "relates_to", confidence: 0.6, track: "llm" as const, evidence: null }];
    expect(pickEdge(edges, pos, 50, 2)?.src).toBe("eq:E1");  // 선분 위 근처.
    expect(pickEdge(edges, pos, 50, 80)).toBeNull();          // 선분에서 멂.
  });

  it("llm 엣지 선택 시 확인/거부 버튼이 뜨고, 확인은 confirmEdge 후 그래프를 재조회한다", async () => {
    const { render, screen, waitFor, fireEvent } = await import("@testing-library/react");
    const confirmSpy = vi.spyOn(kgApi, "confirmEdge").mockResolvedValue(
      { ok: true, edge_key: "eq:E1|eq:E2|relates_to", new_track: "curated" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(llmGraph());

    const KnowledgeGraphView = (await import("./KnowledgeGraphView")).default;
    render(<KnowledgeGraphView projectName="P1" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/엣지 1/)).toBeInTheDocument());

    // 캔버스 클릭을 엣지 중점 좌표로 발생 → llm 엣지 선택.
    const canvas = document.querySelector("canvas")!;
    fireEvent.click(canvas, { clientX: 0, clientY: 0 });  // 좌표는 getBoundingClientRect 0 기준.

    await waitFor(() => expect(screen.queryByTestId("edge-actions")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /확인/ }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith("P1", "eq:E1", "eq:E2"));
  });
});
```

> 위 두 번째 테스트는 canvas 좌표 히트가 jsdom 에서 불안정할 수 있다. 히트가 안 잡히면 `pickEdge` 단위테스트(첫 번째)가 선택 로직을 보증하고, 버튼→api→refetch 흐름은 **컴포넌트가 선택 엣지를 상태로 갖는다는 전제**로 검증한다. 구현에서 `onCanvasClick` 이 노드 미적중 시 `pickEdge` 결과를 `selectedEdge` 상태에 넣도록 배선하면 첫 테스트만으로도 회귀 가드가 성립한다. 두 번째 테스트가 환경상 불안정하면 `pickEdge` 로 선택 상태를 만들 수 있는 최소 훅(예: 초기 좌표 클릭)만 유지하고, 나머지는 스킵 없이 통과하도록 좌표를 엣지 중점(`(x1+x2)/2,(y1+y2)/2`)으로 맞춘다.

- [ ] **Step 2: 실행 — 실패 확인**

Run: `npm test -- src/KnowledgeGraphView.test.tsx`
Expected: FAIL — `pickEdge` export 없음.

- [ ] **Step 3: `KnowledgeGraphView.tsx` — 히트테스트 순수함수 + 엣지 선택·버튼·refetch**

(a) 파일 상단(컴포넌트 밖)에 `pickEdge` 순수함수 export 추가. import 에 `confirmEdge, rejectEdge`, `KgEdge` 추가:

```typescript
import { confirmEdge, fetchGraph, rejectEdge, type KgEdge, type KgGraph, type KgNode } from "./api/kg";
import { layout, type Pos } from "./kgForce";

/** 점(px,py)에서 임계거리 안에 있는 가장 가까운 엣지 선분을 고른다(없으면 null). */
export function pickEdge(edges: KgEdge[], pos: Pos, px: number, py: number, threshold = 6): KgEdge | null {
  let best: KgEdge | null = null;
  let bestD = threshold;
  for (const e of edges) {
    const a = pos[e.src], b = pos[e.dst];
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + t * dx, cy = a.y + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}
```

(b) 상태에 `selectedEdge` 추가하고, 로드 리셋에 포함:

```typescript
  const [selected, setSelected] = useState<KgNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<KgEdge | null>(null);
```

`useEffect` 로드 블록의 리셋에 `setSelectedEdge(null);` 한 줄 추가(`setSelected(null);` 옆).

(c) 그래프 refetch 를 재사용 가능한 함수로: `useEffect` 안의 `fetchGraph(...)` 로직을 `reload()` 콜백으로 추출(선택 상태는 유지하되 엣지 재조회):

```typescript
  const reload = () => {
    fetchGraph(projectName)
      .then((g) => setGraph(g))
      .catch((e) => setError(String(e)));
  };
```

(초기 `useEffect` 는 기존대로 두되, confirm/reject 성공 후 `reload()` 호출.)

(d) `onCanvasClick` 을 노드 우선·엣지 차선으로 교체:

```typescript
  function onCanvasClick(ev: React.MouseEvent<HTMLCanvasElement>) {
    if (!graph) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    const hitNode = graph.nodes.find((nd) => {
      const p = pos[nd.id];
      return p && Math.hypot(p.x - x, p.y - y) <= 8;
    });
    if (hitNode) { setSelected(hitNode); setSelectedEdge(null); return; }
    setSelected(null);
    setSelectedEdge(pickEdge(graph.edges, pos, x, y));
  }
```

(e) confirm/reject 핸들러 추가:

```typescript
  async function onConfirm() {
    if (!selectedEdge) return;
    await confirmEdge(projectName, selectedEdge.src, selectedEdge.dst);
    setSelectedEdge(null);
    reload();
  }

  async function onReject() {
    if (!selectedEdge) return;
    await rejectEdge(projectName, selectedEdge.src, selectedEdge.dst);
    setSelectedEdge(null);
    reload();
  }
```

(f) 헤더 카운트에 엣지 수 추가(테스트가 `/엣지 1/` 를 기다림) — 기존 `노드 {graph.nodes.length} · 엣지 {graph.edges.length}` 가 이미 있으므로 확인만(L104~108 이미 존재). 없으면 추가.

(g) 인스펙트 aside 아래에 엣지 액션 패널 추가:

```tsx
      {selectedEdge && (
        <aside className="kg-inspect" data-testid="edge-selected">
          <strong>{selectedEdge.src} ↔ {selectedEdge.dst}</strong> <em>{selectedEdge.type}</em>
          <div>track: {selectedEdge.track}{selectedEdge.track === "llm" ? " (미검증)" : ""}</div>
          {selectedEdge.evidence && <div>근거: {selectedEdge.evidence}</div>}
          {selectedEdge.track === "llm" && (
            <div data-testid="edge-actions" style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button type="button" onClick={onConfirm}>확인(승격)</button>
              <button type="button" onClick={onReject}>거부(숨김)</button>
            </div>
          )}
        </aside>
      )}
```

- [ ] **Step 4: 실행 — 통과 확인**

Run: `npm test -- src/KnowledgeGraphView.test.tsx`
Expected: PASS(기존 2 + 신규). 두 번째 테스트의 canvas 좌표 히트가 불안정하면 Step 1 노트대로 엣지 중점 좌표(`(0+100)/2, (0+0)/2` = 50,0 이 아니라 실제 layout 좌표)로 맞추거나, `pickEdge` 단위테스트로 선택 로직을 보증하고 버튼 흐름은 상태 주입으로 검증한다. **스킵 금지** — 통과하는 형태로 조정.

- [ ] **Step 5: 프론트 전체 회귀 + 빌드 + 타입체크**

Run: `npm test && npm run build`
Expected: vitest 135 + 신규 PASS, `tsc` clean, Vite 빌드 GREEN.

- [ ] **Step 6: Commit**

```bash
git add src/KnowledgeGraphView.tsx src/KnowledgeGraphView.test.tsx
git commit -m "feat(kg): ⑥ UI 엣지 write-back — 히트테스트·llm 확인/거부 버튼·refetch

pickEdge 순수함수(선분 최근접). llm 점선 엣지 선택 시만 버튼 노출,
confirm→curated·reject→숨김 즉시 육안(그래프 재조회).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 시연용 시드 스크립트 `seed_demo_llm_edge.py` (relates_to(llm)=0 대응)

**Files:**
- Create: `scripts/seed_demo_llm_edge.py`
- Test: `backend/tests/test_kg_seed_demo.py` (신규)

relates_to(llm)=0 현실이라 UI·통합 스모크가 볼 llm 엣지가 없다. 시드 스크립트가 스냅샷의 두 설비 노드 사이에 **relates_to(track=llm) 엣지 1개**를 주입한다. 실데이터 아님 명시(`props.demo_seed=true`). 재빌드하면 사라진다(정상 — 시연 후 청소).

- [ ] **Step 1: 실패 테스트 작성 — 두 설비 노드 사이 llm 엣지 주입**

`backend/tests/test_kg_seed_demo.py`:

```python
"""시연 시드 — 스냅샷 두 설비 노드 사이 relates_to(llm, demo_seed) 엣지 1개 주입."""
import importlib
import json
import pathlib
import sys

import pytest

_SNAP = {"graphs": {"P1": {"built_at": None,
    "nodes": [
        {"id": "eq:E1", "type": "equipment", "ref_id": "E1", "label": "MTR-1", "props": {}},
        {"id": "eq:E2", "type": "equipment", "ref_id": "E2", "label": "VCB-1", "props": {}}],
    "edges": []}}}


@pytest.fixture()
def seed_mod(tmp_path, monkeypatch):
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import config
    importlib.reload(config)
    (tmp_path / "_knowledge_graph.json").write_text(json.dumps(_SNAP), encoding="utf-8")
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts"))
    import seed_demo_llm_edge as s
    importlib.reload(s)
    return s, tmp_path


def test_seed_injects_llm_relates_to(seed_mod):
    s, tmp = seed_mod
    s.seed("P1")
    snap = json.loads((tmp / "_knowledge_graph.json").read_text(encoding="utf-8"))
    edges = snap["graphs"]["P1"]["edges"]
    rel = [e for e in edges if e["type"] == "relates_to"]
    assert len(rel) == 1
    e = rel[0]
    assert e["track"] == "llm"
    assert e["props"]["demo_seed"] is True
    assert {e["src"], e["dst"]} == {"eq:E1", "eq:E2"}


def test_seed_idempotent(seed_mod):
    # 두 번 시드해도 demo_seed 엣지는 1개(중복 주입 방지).
    s, tmp = seed_mod
    s.seed("P1")
    s.seed("P1")
    snap = json.loads((tmp / "_knowledge_graph.json").read_text(encoding="utf-8"))
    rel = [e for e in snap["graphs"]["P1"]["edges"] if e["type"] == "relates_to"]
    assert len(rel) == 1
```

- [ ] **Step 2: 실행 — 실패 확인**

Run: `cd backend && python -m pytest tests/test_kg_seed_demo.py -v`
Expected: FAIL — `No module named 'seed_demo_llm_edge'`.

- [ ] **Step 3: `scripts/seed_demo_llm_edge.py` 구현**

```python
"""시연 전용 시드 — 개발 스냅샷에 relates_to(track=llm) 엣지 1개 주입.

⚠️ 실데이터 아님. relates_to(llm)=0(설비 큐레이트태그 ∩ 시트 추출태그 겹침 0) 현실에서
write-back UI·통합 스모크가 볼 llm 엣지를 만들기 위한 개발 편의 스크립트다.
주입 엣지는 props.demo_seed=true 로 표식. 재빌드하면 사라진다(정상 — 시연 후 청소).
mock확장/GATE-7 트랙이 실 relates_to 를 공급하면 이 시드는 불필요.

사용: python scripts/seed_demo_llm_edge.py <project_name>
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import config  # noqa: E402

_SNAP = Path(config.UPLOADS_DIR) / "_knowledge_graph.json"


def seed(project: str) -> dict:
    """지정 프로젝트의 앞선 두 설비 노드 사이에 demo relates_to(llm) 엣지 1개 주입(멱등)."""
    snap = json.loads(_SNAP.read_text(encoding="utf-8"))
    g = snap.get("graphs", {}).get(project)
    if not g:
        raise SystemExit(f"프로젝트 없음: {project} (먼저 build_knowledge_graph.py 실행)")
    eqs = [n for n in g["nodes"] if n["type"] == "equipment"]
    if len(eqs) < 2:
        raise SystemExit(f"설비 노드 2개 미만 — 시드 불가(project={project})")
    a, b = eqs[0]["id"], eqs[1]["id"]
    # 멱등: 이미 demo_seed 엣지가 있으면 재주입 안 함.
    for e in g["edges"]:
        if e["type"] == "relates_to" and (e.get("props") or {}).get("demo_seed"):
            print(f"이미 시드됨: {e['src']}↔{e['dst']}")
            return snap
    g["edges"].append({
        "src": a, "dst": b, "type": "relates_to", "confidence": 0.55, "track": "llm",
        "evidence": "[DEMO SEED] 시연용 AI 제안 관계(실데이터 아님)",
        "props": {"demo_seed": True},
    })
    tmp = _SNAP.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, _SNAP)
    print(f"시드 주입: {a} ↔ {b} (relates_to, llm, demo_seed)")
    return snap


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: seed_demo_llm_edge.py <project_name>")
        sys.exit(2)
    seed(sys.argv[1])
```

> **주의**: 시드 엣지 스키마는 빌드 엣지와 동형이되 `props` 키를 추가로 갖는다. `kg_store.check_integrity` 는 src/dst 노드 존재만 보므로(props 무관) 통과. 병합 로직은 이 엣지도 track=llm 이므로 confirm/reject 대상이 된다(정상).

- [ ] **Step 4: 실행 — 통과 확인**

Run: `cd backend && python -m pytest tests/test_kg_seed_demo.py -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/seed_demo_llm_edge.py backend/tests/test_kg_seed_demo.py
git commit -m "feat(kg): ⑥ 시연 시드 — relates_to(llm) 엣지 1개 주입(demo_seed, 멱등)

relates_to(llm)=0 현실 대응. 실데이터 아님(props.demo_seed). 재빌드로 청소.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 통합 스모크 + 회귀 게이트 + 진행 문서 갱신

**Files:**
- Create: `backend/tests/test_kg_writeback_smoke.py` (신규)
- Create: `evidence/kg-writeback-smoke-260709.txt` (스모크 증빙)
- Modify: `docs/buildout-loop/PROGRESS.md` (세션30 블록)

스펙 §10 "통합 스모크": 시드 llm 엣지 → confirm → 조회에서 curated 확인 → 다른 엣지 reject → 조회에서 사라짐. 실 서버 없이 `kg_store` + 시드 함수 + 쓰기 라우트 TestClient 로 in-process 검증.

- [ ] **Step 1: 통합 스모크 테스트 작성**

`backend/tests/test_kg_writeback_smoke.py`:

```python
"""통합 스모크(스펙 §10) — 시드 → confirm(→curated) → reject(→drop) 왕복.

in-process: 스냅샷에 두 llm 엣지를 직접 깔고, 쓰기 라우트 TestClient 로 confirm/reject,
kg_store 병합 조회로 결과 육안 대체(curated 확인·drop 확인).
"""
import importlib
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_SNAP = {"graphs": {"P1": {"built_at": None,
    "nodes": [
        {"id": "eq:E1", "type": "equipment", "ref_id": "E1", "label": "MTR-1", "props": {}},
        {"id": "eq:E2", "type": "equipment", "ref_id": "E2", "label": "VCB-1", "props": {}},
        {"id": "eq:E3", "type": "equipment", "ref_id": "E3", "label": "TR-1", "props": {}}],
    "edges": [
        {"src": "eq:E1", "dst": "eq:E2", "type": "relates_to", "confidence": 0.6, "track": "llm", "evidence": "공출현A"},
        {"src": "eq:E2", "dst": "eq:E3", "type": "relates_to", "confidence": 0.5, "track": "llm", "evidence": "공출현B"}]}}}


@pytest.fixture()
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("XD_UPLOADS_DIR", str(tmp_path))
    import config
    importlib.reload(config)
    (tmp_path / "_knowledge_graph.json").write_text(json.dumps(_SNAP), encoding="utf-8")
    import kg_store
    importlib.reload(kg_store)
    import routes_kg_writeback
    importlib.reload(routes_kg_writeback)
    app = FastAPI()
    app.include_router(routes_kg_writeback.router)
    return TestClient(app), kg_store


def test_confirm_then_reject_roundtrip(env):
    c, kg = env
    # 1) E1–E2 confirm → 병합 조회에서 curated.
    assert c.post("/api/kg/edge/confirm", json={"project_name": "P1", "src": "eq:E1", "dst": "eq:E2"}).status_code == 200
    g = kg._merged_graph("P1")
    e12 = [e for e in g["edges"] if {e["src"], e["dst"]} == {"eq:E1", "eq:E2"}][0]
    assert e12["track"] == "curated"
    # 2) E2–E3 reject → 병합 조회에서 사라짐.
    assert c.post("/api/kg/edge/reject", json={"project_name": "P1", "src": "eq:E2", "dst": "eq:E3"}).status_code == 200
    g2 = kg._merged_graph("P1")
    assert [e for e in g2["edges"] if {e["src"], e["dst"]} == {"eq:E2", "eq:E3"}] == []
    # 3) 되돌림: E2–E3 confirm 재-append → last-write-wins 로 다시 보임(curated).
    assert c.post("/api/kg/edge/confirm", json={"project_name": "P1", "src": "eq:E2", "dst": "eq:E3"}).status_code == 200
    g3 = kg._merged_graph("P1")
    e23 = [e for e in g3["edges"] if {e["src"], e["dst"]} == {"eq:E2", "eq:E3"}]
    assert len(e23) == 1 and e23[0]["track"] == "curated"
```

- [ ] **Step 2: 실행 — 통과 확인**

Run: `cd backend && python -m pytest tests/test_kg_writeback_smoke.py -v`
Expected: PASS (1 test, 3 단계).

- [ ] **Step 3: 전체 회귀 게이트 — 4 스위트 (스펙 §8-5)**

각각 실행하고 카운트를 증빙 파일에 적는다:

```bash
cd backend && python -m pytest -q                          # 기대: 196 + 신규(overlay4·merge6·writeback6·seed2·smoke1 = +19) PASS, +1skip 유지
cd backend/extract && .venv/Scripts/python.exe -m pytest   # 기대: 8 PASS (write-back 은 8002 미변경 → 불변)
cd backend/ai && .venv/Scripts/python.exe -m pytest        # 기대: 50 PASS (AI 사이드카 불변)
npm test                                                   # 기대: 135 + 신규(api3·view N) PASS
npm run build                                              # 기대: tsc clean + Vite GREEN
```

> extract(8002)·ai 사이드카는 이 트랙에서 변경하지 않았으므로 **정확히 8·50 불변**이어야 한다(변동 시 회귀 — 조사).

- [ ] **Step 4: 스모크 증빙 파일 작성**

`evidence/kg-writeback-smoke-260709.txt` — Step 3 각 스위트의 실제 출력 마지막 줄(예: `196 passed, 1 skipped`)과 통합 스모크 결과를 붙여 넣는다. 형식은 세션28 `evidence/kg-integration-smoke-260709.txt` 계승. 최소 포함:

```
# ⑥ write-back 통합 스모크 (2026-07-09, 세션30)
backend tests/     : <붙여넣기>
backend/extract    : 8 passed
backend/ai         : 50 passed
frontend vitest    : <붙여넣기>
npm run build      : <PASS/FAIL>
통합 스모크        : test_confirm_then_reject_roundtrip PASS (confirm→curated, reject→drop, 되돌림→curated)
```

- [ ] **Step 5: `PROGRESS.md` 세션30 블록 추가**

`docs/buildout-loop/PROGRESS.md` 최신 세션 블록 위(또는 관례 위치)에 추가:

```markdown
## 세션30 (2026-07-09) — ⑥ write-back 구현 (relates_to 승격·거부)

**입력**: FROZEN 스펙 `specs/2026-07-09-kg-writeback-design.md`, 계획 `plans/2026-07-09-kg-writeback.md`.

**산출**(Task 1~7, subagent-driven):
- `kg_store.py`: 오버레이 저널(edge_key 무방향 정규화·append-only·last-write-wins) + 로드타임 병합(_merge/_merged_graph, confirm→curated·reject→drop·비llm 보호·dangling 무시). 읽기 5경로 배선.
- `routes_kg_writeback.py`(신규): POST confirm/reject, 순수 스냅샷 검증(relates_to+track=llm), X-Actor 옵셔널, at 주입, egress 0. main 등록.
- 프론트: `api/kg.ts` confirmEdge/rejectEdge(POST), `KnowledgeGraphView.tsx` 엣지 히트테스트(pickEdge)·llm 확인/거부 버튼·refetch.
- `scripts/seed_demo_llm_edge.py`(신규): relates_to(llm)=0 대응 시연 시드(demo_seed, 멱등).

**검증**: backend tests/ <N>·extract 8·ai 50·frontend vitest <N>·build GREEN. 통합 스모크 `evidence/kg-writeback-smoke-260709.txt`.

**불변식 사수**: 빌드 스크립트 무변경(멱등 유지) · 승격 재빌드 생존(병합은 읽기 메모리에서만) · rule/curated 보호 · 8000 egress 0.

**스코프 밖(이연)**: 증분 재빌드(YAGNI)·수동 엣지 추가·note 편집·실인증(GATE-6)·mock확장/GATE-7 실 relates_to·⑤ 라우팅.
```

- [ ] **Step 6: Commit**

```bash
git add backend/tests/test_kg_writeback_smoke.py evidence/kg-writeback-smoke-260709.txt docs/buildout-loop/PROGRESS.md
git commit -m "test(kg): ⑥ write-back 통합 스모크 + 회귀 게이트 + PROGRESS 세션30

confirm→curated·reject→drop·되돌림 왕복 in-process 검증. 4스위트 회귀 0 증빙.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review — 스펙 커버리지 대조

| 스펙 조항 | 구현 태스크 |
|---|---|
| §1 W1 메커니즘만(데이터 불문) | 전 태스크 — 임의 llm 엣지 대상, 실데이터 무관 |
| §1 W2 오버레이 저널 + 로드타임 병합 | Task 1(저널) + Task 2(병합) |
| §1 W3 confirm + reject 2동작 | Task 3(라우트) · Task 5(UI 버튼) |
| §1 W4 track=llm 에만 적용 | Task 2 `_merge` 비-llm 보호 + Task 3 검증 400 |
| §1 W5 reject=drop, 저널 기록 남김 | Task 2(drop) + Task 1(append-only) |
| §1 W6 최소 UI(클릭→버튼→육안) | Task 5 |
| §1 W7 시드 스크립트 | Task 6 |
| §1 W8 증분 재빌드 스코프 밖 | 미구현(의도적) |
| §1 W9 X-Actor 옵셔널 | Task 3 Header |
| §2 2층 분리(빌드/오버레이) | Task 2 — 빌드 스크립트 무변경 |
| §3.1 오버레이 스키마 | Task 1 `append_override` |
| §3.2 edge_key 무방향 | Task 1 `edge_key` + Task 3/5 정규화 |
| §3.3 track 상태(rejected=drop) | Task 2 |
| §4 병합 4규칙 + dangling 무시 | Task 2 `_merge` |
| §5 API 표면(confirm/reject, 400, actor, egress0) | Task 3 |
| §6 UI(히트테스트·조건부버튼·refetch) | Task 5 |
| §7 시연 시드(demo_seed, 재빌드로 청소) | Task 6 |
| §8 HARD 불변식(멱등·보호·읽기표면·egress·회귀0) | 전 태스크 + Task 7 게이트 |
| §10 테스트 전략(백엔드·프론트·통합) | Task 1~7 각 테스트 + Task 7 스모크 |

**갭 점검**: §4 "check_integrity 가 dangling override 를 경고 리포트" → 본 계획은 `_merge` 가 `logger.warning` 으로 경고(로드 실패 없음)로 충족. `check_integrity` 시그니처(그래프 dict)는 불변 유지(기존 호출자 보호) — 스펙 의도("경고하되 로드 실패 아님")는 병합 경고 로그로 만족. 이 편차는 설계상 안전.

**타입 일관성**: `edge_key(a,b)`·`append_override`·`_overlay_map`·`_merge`·`_merged_graph`(백엔드), `confirmEdge`/`rejectEdge`/`ConfirmResult`/`RejectResult`(프론트), `pickEdge`(UI) — 태스크 간 시그니처 일치 확인.

**플레이스홀더 스캔**: TBD/TODO 없음. 각 코드 스텝 완전 코드 포함.
