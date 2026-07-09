"""분류·정규화 패스 (S15 D2 ③) — 격리(순수 표준 라이브러리만).

규칙 트랙(8000)이 뽑은 rule_tags 와 LLM 트랙(8002 provider)이 독립적으로 뽑은
llm_tags 를 병합·교정한다. 두 트랙이 같은 설비를 다르게 표기(OCR 혼동 등)한 경우
정규형으로 접되, 원 표기 충돌은 버리지 않고 conflicts[] 에 남긴다(D4·D7 정신).

이 모듈은 backend 모듈을 import하지 않는다(격리 불변식). sheet_merge._canon 과
동일한 OCR 혼동 규칙을 쓰지만 코드는 복제하지 않고 여기 자체 보유한다(격리 우선).
"""
from __future__ import annotations

import re

_WS = re.compile(r"\s+")
# OCR/판독 혼동 접기: 문자 O↔숫자 0, 문자 I·L↔숫자 1 을 정규형에서 동일 취급.
_CONFUSE = str.maketrans({"O": "0", "I": "1", "L": "1"})


def canon(tag: str) -> str:
    """태그 정규형: 대문자화·공백제거·OCR 혼동 접기. 비교 전용(표시엔 원문 유지)."""
    t = _WS.sub("", (tag or "").upper())
    return t.translate(_CONFUSE)


def _better(a: dict, b: dict) -> dict:
    """같은 정규형 태그 두 개 중 신뢰도 높은 쪽을 대표로. 동률이면 a 유지."""
    return a if a.get("confidence", 0) >= b.get("confidence", 0) else b


def normalize(rule_tags: list[dict], llm_tags: list[dict]) -> tuple[list[dict], list[dict]]:
    """rule_tags + llm_tags → (병합 태그[], conflicts[]).

    - 정규형(canon)이 같으면 한 태그로 병합. src 는 관여한 트랙 합성(rule|llm|merged).
    - confidence 는 두 트랙 최대값. 대표 표기는 신뢰도 높은 쪽 원문.
    - 정규형은 같은데 원 표기가 다르면(예 PP-380V vs PP-38OV) conflicts[] 기록.
    """
    groups: dict[str, dict] = {}
    conflicts: list[dict] = []
    for src_name, tags in (("rule", rule_tags or []), ("llm", llm_tags or [])):
        for t in tags:
            tag = t.get("tag", "")
            if not tag:
                continue
            key = canon(tag)
            entry = groups.get(key)
            norm = {
                "tag": tag,
                "type": t.get("type", ""),
                "confidence": float(t.get("confidence", 0.0)),
                "srcs": {src_name},
                "evidence": t.get("evidence", ""),
            }
            if entry is None:
                groups[key] = norm
                continue
            # 원 표기가 다른데 정규형이 같다 → 충돌 기록(대표는 신뢰도 높은 쪽).
            if entry["tag"] != tag:
                hi, lo = (entry, norm) if entry["confidence"] >= norm["confidence"] else (norm, entry)
                conflicts.append({
                    "field": "tag", "resolved": hi["tag"], "dropped": lo["tag"],
                    "reason": "canon-fold",
                })
            merged_repr = _better(entry, norm)
            entry["tag"] = merged_repr["tag"]
            entry["type"] = merged_repr["type"] or entry["type"]
            entry["confidence"] = max(entry["confidence"], norm["confidence"])
            entry["srcs"] |= norm["srcs"]
            entry["evidence"] = entry["evidence"] or norm["evidence"]

    out: list[dict] = []
    for e in groups.values():
        srcs = e.pop("srcs")
        e["src"] = "merged" if len(srcs) > 1 else next(iter(srcs))
        out.append(e)
    out.sort(key=lambda t: (-t["confidence"], t["tag"]))
    return out, conflicts
