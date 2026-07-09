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
