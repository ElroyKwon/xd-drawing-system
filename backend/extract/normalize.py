"""분류·정규화 패스 (S15 D2 ③) — 격리(순수 표준 라이브러리만).

규칙 트랙(8000)이 뽑은 rule_tags 와 LLM 트랙(8002 provider)이 독립적으로 뽑은
llm_tags 를 병합·교정한다.

**손실 방지 원칙(sheet_merge 와 동일)**: OCR 혼동 접기(O↔0, I·L↔1)는 서로 다른 설비를
붕괴시킬 수 있으므로(PL-1 vs PI-1 → 둘 다 canon "P1-1"), **트랙 내부에는 적용하지 않는다**
(표시 정규화 `_norm` 만: 대문자·공백제거). OCR 접기 `canon` 은 **rule↔llm 교차 병합**에서만
써서 두 트랙이 같은 설비를 다르게 읽은 경우를 합치고, 그 원 표기 충돌은 conflicts[] 에 남긴다.

이 모듈은 backend 모듈을 import하지 않는다(격리 불변식).
"""
from __future__ import annotations

import re

_WS = re.compile(r"\s+")
_CONFUSE = str.maketrans({"O": "0", "I": "1", "L": "1"})


def _norm(tag: str) -> str:
    """표시/그룹 키 — 대문자·공백제거. OCR 혼동 접기는 하지 않는다(트랙 내부 무손실)."""
    return _WS.sub("", (tag or "").upper())


def canon(tag: str) -> str:
    """cross-source 매칭 전용 — `_norm` 위에 OCR 혼동(O↔0, I·L↔1) 접기.

    서로 다른 설비를 붕괴시킬 수 있어 트랙 내부엔 쓰지 않고, rule↔llm 교차 병합에서만 쓴다.
    """
    return _norm(tag).translate(_CONFUSE)


def normalize(rule_tags: list[dict], llm_tags: list[dict]) -> tuple[list[dict], list[dict]]:
    """rule_tags + llm_tags → (병합 태그[], conflicts[]).

    - 트랙 내부는 `_norm`(OCR 접기 없음)으로만 묶어 **서로 다른 설비 유실을 막는다**.
    - rule 이 권위. llm 은 정확 표기가 같으면 병합, 아니면 `canon`으로 rule 과 교차매칭해
      OCR 변형이면 흡수(원 표기 충돌은 conflicts[] 기록), 매칭 없으면 신규 태그로 추가.
    - src: 한 트랙만 관여=rule|llm, 둘 다=merged. confidence 는 최대값, 대표 표기는 고신뢰.
    """
    out: dict = {}       # _norm(tag) -> entry
    conflicts: list[dict] = []

    def _add(t: dict, src: str) -> None:
        k = _norm(t.get("tag", ""))
        if not k:
            return
        conf = float(t.get("confidence", 0.0))
        e = out.get(k)
        if e is None:
            out[k] = {"tag": t.get("tag", ""), "type": t.get("type", ""),
                      "confidence": conf, "srcs": {src}, "evidence": t.get("evidence", "")}
            return
        if conf > e["confidence"]:                       # 대표 표기 = 고신뢰
            e["tag"] = t.get("tag", "")
            e["confidence"] = conf
        e["type"] = e["type"] or t.get("type", "")
        e["srcs"].add(src)
        e["evidence"] = e["evidence"] or t.get("evidence", "")

    # 1) rule 트랙 전량(무손실 — canon 접기 없음).
    for t in rule_tags or []:
        _add(t, "rule")

    # 2) rule canon 역인덱스(cross-source OCR 변형 매칭용). 첫 항목만.
    rule_canon: dict = {}
    for k, e in out.items():
        rule_canon.setdefault(canon(e["tag"]), k)

    # 3) llm 트랙 병합.
    for t in llm_tags or []:
        tag = t.get("tag", "")
        k = _norm(tag)
        if not k:
            continue
        if k in out:                                     # 정확히 같은 표기 → 병합
            _add(t, "llm")
            continue
        base_k = rule_canon.get(canon(tag))
        if base_k is not None:                           # cross-source OCR 변형 → 흡수 + 충돌 기록
            base = out[base_k]
            conflicts.append({"field": "tag", "resolved": base["tag"],
                              "dropped": tag, "reason": "canon-fold"})
            base["srcs"].add("llm")
            base["confidence"] = max(base["confidence"], float(t.get("confidence", 0.0)))
        else:                                            # 신규 llm 태그
            _add(t, "llm")

    result: list[dict] = []
    for e in out.values():
        srcs = e.pop("srcs")
        e["src"] = "merged" if len(srcs) > 1 else next(iter(srcs))
        result.append(e)
    result.sort(key=lambda t: (-t["confidence"], t["tag"]))
    return result, conflicts
