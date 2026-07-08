"""S15 단계3 — 규칙 트랙 추출(8000, egress 0).

PDF(PyMuPDF)·DXF(ezdxf) 텍스트에서 본문 색인(text_index) + 설비 태그를 결정적으로 추출.
외부 네트워크 호출 없음. 설비 어휘는 equipment_vocab(청주 전기계통 시드).

정직성(prompts/20 D4): 사전 확정 태그=고신뢰(0.92), prefix 추론=중신뢰(0.65).
src는 항상 "rule"(LLM 병합은 8002/단계6 몫). 각 태그에 evidence(근거 텍스트) 부착.
"""
from __future__ import annotations

import re

from equipment_vocab import KNOWN_TAGS, TYPE_PREFIXES

_KNOWN_CI = {k.upper(): (k, t, n) for k, (t, n) in KNOWN_TAGS.items()}
_PREFIXES = sorted(TYPE_PREFIXES, key=len, reverse=True)
# PREFIX-SUFFIX 복합 태그만 추출(맨-prefix는 노이즈라 제외). prefix는 큐레이트 집합으로 한정
# → 시트번호(EE-01-016 등)·일반어 오탐 차단.
_TAG_RE = re.compile(
    r"\b(" + "|".join(_PREFIXES) + r")-([A-Za-z0-9][A-Za-z0-9.]{0,9})",
    re.IGNORECASE,
)
_WS = re.compile(r"\s+")
_TEXT_INDEX_CAP = 20000

CONF_KNOWN = 0.92
CONF_PREFIX = 0.65


def build_text_index(text: str) -> str:
    """공백 정규화 + 상한. 본문 색인(검색·AI 그라운딩용)."""
    idx = _WS.sub(" ", (text or "").strip())
    return idx[:_TEXT_INDEX_CAP]


def _evidence(text: str, start: int, end: int, pad: int = 30) -> str:
    snippet = text[max(0, start - pad):min(len(text), end + pad)]
    return _WS.sub(" ", snippet).strip()


def _classify(prefix: str, token_upper: str) -> tuple[str, str, str, float]:
    known = _KNOWN_CI.get(token_upper)
    if known:
        canon, typ, name = known
        return canon, typ, name, CONF_KNOWN
    typ, _label = TYPE_PREFIXES.get(prefix.upper(), ("unknown", ""))
    return token_upper, typ, "", CONF_PREFIX


def extract_tags(text: str) -> list[dict]:
    """설비 태그 목록(신뢰도 내림차순, 태그 중복 제거·최고신뢰 유지)."""
    if not text:
        return []
    found: dict[str, dict] = {}
    for m in _TAG_RE.finditer(text):
        prefix = m.group(1)
        token = m.group(0).replace(" ", "").rstrip(".")
        canon, typ, name, conf = _classify(prefix, token.upper())
        key = canon.upper()
        prev = found.get(key)
        if prev is None or conf > prev["confidence"]:
            found[key] = {
                "tag": canon, "type": typ, "name": name,
                "confidence": conf, "src": "rule",
                "evidence": _evidence(text, m.start(), m.end()),
            }
    return sorted(found.values(), key=lambda t: (-t["confidence"], t["tag"]))


# --- 파일 리더 ---

def extract_pdf_sheet(pdf_path: str, sheet_index: int = 0) -> str:
    import fitz  # PyMuPDF
    doc = fitz.open(pdf_path)
    try:
        if sheet_index < 0 or sheet_index >= doc.page_count:
            return ""
        return doc[sheet_index].get_text()
    finally:
        doc.close()


def _entity_text(e) -> str:
    try:
        dt = e.dxftype()
        if dt == "MTEXT":
            return e.plain_text() if hasattr(e, "plain_text") else e.text
        if dt in ("TEXT", "ATTRIB", "ATTDEF"):
            return e.dxf.text
    except Exception:  # noqa: BLE001
        return ""
    return ""


def extract_dxf_layout(dxf_path: str, layout_name: str | None = None) -> str:
    """DXF TEXT/MTEXT/ATTRIB 문자열. layout 지정 시 그 paperspace + modelspace(공용)."""
    import ezdxf
    doc = ezdxf.readfile(dxf_path)
    parts: list[str] = []
    spaces = []
    if layout_name:
        try:
            spaces.append(doc.layout(layout_name))
        except Exception:  # noqa: BLE001
            pass
    spaces.append(doc.modelspace())
    seen_ids = set()
    for sp in spaces:
        if id(sp) in seen_ids:
            continue
        seen_ids.add(id(sp))
        for e in sp:
            t = _entity_text(e)
            if t and t.strip():
                parts.append(t.strip())
    return "\n".join(parts)


def extract_rule(file_path: str, file_format: str, *, sheet_index: int = 0,
                 layout_name: str | None = None) -> dict:
    """단일 시트의 규칙 추출 결과: {text_index, tags, source_kind}."""
    fmt = (file_format or "").lower()
    if fmt == "pdf":
        text, source_kind = extract_pdf_sheet(file_path, sheet_index), "pdf"
    elif fmt in ("dxf", "dwg"):
        text, source_kind = extract_dxf_layout(file_path, layout_name), "dxf"
    else:
        text, source_kind = "", fmt or "unknown"
    return {
        "text_index": build_text_index(text),
        "tags": extract_tags(text),
        "source_kind": source_kind,
    }
