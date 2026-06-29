"""시트 메타(번호·제목·공종) 휴리스틱 추출 (S2-a, S2.5 강건화).

타이틀블록 텍스트 휴리스틱. PDF 페이지 텍스트/파일명에서 시트번호·제목·공종을
추정하고, 실패 시 폴백(파일명 → Page N)한다.

S2.5: PDF의 **좌표 기반 라인(text+bbox)** 이 주어지면 타이틀블록 라벨(DWG NO·
DWG. TITLE 등)의 바로 아래/우측 값을 **공간적으로 페어링**해 추출한다. get_text()의
선형화 순서에 의존하던 기존 경로(라벨 다음 N줄)의 양식 종속을 해소한다.

번호 추출 우선순위:
  1) 페이지 텍스트 후보가 파일명 접두 번호와 일치 → 고신뢰(파일명=번호인 단일도면)
  2) (좌표 lines 있으면) 라벨 앵커 공간 페어링 값
  3) 라벨 근처(선형) 도면번호 후보
  4) 파일명에서 추출한 번호
  5) "Page N"
공종은 번호 토큰(EE/E/A/M…) 스캔, 미상은 "G"(기타).
"""
from __future__ import annotations

import os
import re

# 도면번호 후보: 영문 1~4 + (구분) + 숫자그룹(여러 단)
_CAND_RE = re.compile(r"\b([A-Za-z]{1,4}[-_ ]?\d{2,4}(?:[-_]\d{1,4}){0,2})\b")
# 다중 토큰 도면번호(ESS-EE-DWG-003 처럼 영문 그룹이 여러 개 + 숫자 끝단). S2.5 보강.
_MULTI_CAND_RE = re.compile(r"\b([A-Za-z0-9]+(?:[-_][A-Za-z0-9]+){2,6})\b")
# 파일명 선두 번호(언더스코어/공백 앞까지)
_FNAME_RE = re.compile(r"^([A-Za-z]{1,4}-?\d{2,4}(?:-\d{1,4}){0,2})")
# 번호 라벨 키워드(이 토큰 근처 후보를 우선)
_LABEL_RE = re.compile(r"(DWG\.?\s*NO|DRAWING\s*NO|SHEET\s*NO|도면\s*번호|도번)", re.IGNORECASE)
# S2.5 좌표 페어링용 라벨(번호/제목)
_NUM_LABEL_RE = re.compile(r"^\s*(DWG\.?\s*NO|DRAWING\s*NO|SHEET\s*NO|도면\s*번호|도번)\.?\s*$", re.IGNORECASE)
_TITLE_LABEL_RE = re.compile(r"^\s*(DWG\.?\s*TITLE|DRAWING\s*TITLE|SHEET\s*TITLE|도면\s*명)\.?\s*$", re.IGNORECASE)

_DISCIPLINE = {
    "E": ("E", "E (전기)"), "EE": ("E", "E (전기)"), "EL": ("E", "E (전기)"),
    "A": ("A", "A (건축)"), "AR": ("A", "A (건축)"),
    "M": ("M", "M (기계)"), "ME": ("M", "M (기계)"),
    "P": ("P", "P (배관)"), "PL": ("P", "P (배관)"),
    "S": ("S", "S (구조)"), "ST": ("S", "S (구조)"),
    "C": ("C", "C (토목)"), "CV": ("C", "C (토목)"),
}

# 값으로 잡으면 안 되는 타이틀블록 라벨/노이즈어
_VALUE_DENY = {"BUILDING NAME", "PROJECT TITLE", "DRAWING TITLE", "DWG TITLE", "TITLE",
               "SCALE", "DATE", "DESCRIPTION", "REV", "NO", "SHEET", "DWG NO", "DRAWING NO",
               "CHK", "DRN", "APP", "NONE", "도면명", "축척", "DRAWING LIST"}


def _normalize(tok: str) -> str:
    return tok.strip().upper().replace("_", "-").replace(" ", "")


def _filename_number(filename: str) -> str | None:
    stem = os.path.splitext(os.path.basename(filename or ""))[0]
    m = _FNAME_RE.match(stem)
    return _normalize(m.group(1)) if m else None


def _looks_like_number(tok: str) -> bool:
    """도면번호스러운가: 숫자 포함 + 영숫자/하이픈 구성 + 라벨/노이즈 아님."""
    t = tok.strip()
    if not t or t.upper() in _VALUE_DENY:
        return False
    # 순수 날짜(2025-03-24, 2025.03.24)는 번호로 둔갑 금지(타이틀블록 DATE칸 오염 방지).
    if re.fullmatch(r"\d{4}[-./]\d{1,2}[-./]\d{1,2}", t):
        return False
    if not any(c.isdigit() for c in t):
        return False
    return bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9\-_./]{1,40}", t))


def _candidates(text: str) -> list[str]:
    out = []
    for t in _CAND_RE.findall(text or ""):
        if any(c.isdigit() for c in t):
            out.append(_normalize(t))
    return out


def _near_label_number(text: str) -> str | None:
    """라벨(DWG/SHEET/도면번호) 근처의 도면번호 후보(선형 텍스트 폴백).

    라벨 다음 줄들엔 장비태그(TR-005 등) 노이즈가 섞일 수 있으므로,
    공종 접두가 인식되는 후보(진짜 도면번호)를 우선 채택하고 없으면 첫 후보로 폴백한다.
    """
    lines = (text or "").splitlines()
    for i, line in enumerate(lines):
        if _LABEL_RE.search(line):
            near: list[str] = []
            for j in (i, i + 1, i + 2):
                if 0 <= j < len(lines):
                    near.extend(_candidates(lines[j]))
            if near:
                known = [c for c in near if _discipline(c)[0] != "G"]
                return known[0] if known else near[0]
    return None


# ---------------------------------------------------------------------------
# S2.5: 좌표 기반 라벨-값 공간 페어링
# ---------------------------------------------------------------------------

def _bbox(line: dict) -> tuple[float, float, float, float]:
    return (float(line["x0"]), float(line["y0"]), float(line["x1"]), float(line["y1"]))


def _spatial_value(lines: list[dict], label_re: re.Pattern, value_ok, page_size=None) -> str | None:
    """라벨 라인을 찾아 그 바로 아래/우측의 값 라인을 공간적으로 페어링.

    - lines: [{"text","x0","y0","x1","y1"}, ...]
    - 라벨이 여러 개면 우하단(타이틀블록) 영역을 우선한다.
    - 값 후보는 value_ok(text)를 통과하는 가장 가까운 아래/우측 라인.
    """
    labels = [ln for ln in lines if label_re.match((ln.get("text") or "").strip())]
    if not labels:
        return None
    # 타이틀블록은 보통 우하단 → y0(아래)·x0(오른쪽) 큰 라벨 우선.
    labels.sort(key=lambda ln: (float(ln["y0"]), float(ln["x0"])), reverse=True)
    for lab in labels:
        lx0, ly0, lx1, ly1 = _bbox(lab)
        lh = max(ly1 - ly0, 4.0)
        best = None
        best_dist = None
        for ln in lines:
            if ln is lab:
                continue
            txt = (ln.get("text") or "").strip()
            if not txt or not value_ok(txt):
                continue
            x0, y0, x1, y1 = _bbox(ln)
            # 아래: 라벨 하단보다 아래에서 시작, 수평으로 겹치거나 근접(라벨 좌측 기준 ±)
            below = y0 >= ly1 - lh * 0.5 and y0 <= ly1 + lh * 3.0 and x1 >= lx0 - lh and x0 <= lx1 + lh * 8
            # 우측: 같은 행 높이에서 라벨 오른쪽
            right = x0 >= lx1 - lh * 0.5 and y0 <= ly1 + lh * 0.6 and y1 >= ly0 - lh * 0.6
            if not (below or right):
                continue
            # 거리(라벨 좌상단 기준). 아래 우선 가중.
            dist = abs(y0 - ly1) + abs(x0 - lx0) * (0.5 if below else 1.0)
            if best_dist is None or dist < best_dist:
                best, best_dist = txt, dist
        if best:
            return best
    return None


def _spatial_number(lines: list[dict], page_size=None) -> str | None:
    val = _spatial_value(lines, _NUM_LABEL_RE, _looks_like_number, page_size)
    return _normalize(val) if val else None


def _spatial_title(lines: list[dict], page_size=None) -> str | None:
    def ok(t: str) -> bool:
        t = t.strip()
        return len(t) > 2 and t.upper() not in _VALUE_DENY and not _NUM_LABEL_RE.match(t)
    val = _spatial_value(lines, _TITLE_LABEL_RE, ok, page_size)
    return val[:80] if val else None


def _discipline(number: str) -> tuple[str, str]:
    """번호 토큰을 스캔해 공종 판정(EE/E/A/M…). 다중토큰(ESS-EE-DWG) 대응."""
    tokens = [t for t in re.split(r"[-_ .]", (number or "").upper()) if t]
    # 1) 명시 공종 토큰 우선(EE 등 2글자 코드 → 단일글자 순)
    for t in tokens:
        if t in _DISCIPLINE:
            return _DISCIPLINE[t]
    # 2) 첫 영문 토큰의 선두 글자 폴백
    for t in tokens:
        if t[0].isalpha():
            if t in _DISCIPLINE:
                return _DISCIPLINE[t]
            if t[0] in _DISCIPLINE:
                return _DISCIPLINE[t[0]]
            break
    return ("G", "G (기타)")


# 제목으로 잡으면 안 되는 타이틀블록 라벨어(누수 방지)
_TITLE_DENY = {"BUILDING NAME", "PROJECT TITLE", "DRAWING TITLE", "TITLE", "SCALE", "DATE",
               "DESCRIPTION", "REV", "NO", "SHEET", "도면명", "축척"}


def _title(text: str, filename: str, *, multipage: bool = False) -> str:
    """제목 추출. 단일파일은 파일명 stem 우선(서술적). 멀티페이지는 라벨 근처 도면명 우선."""
    stem = os.path.splitext(os.path.basename(filename or ""))[0].strip()
    if stem and not multipage:
        return stem[:80]
    lines = [l.strip() for l in (text or "").splitlines() if l.strip()]
    title_label = re.compile(r"(DRAWING\s*TITLE|도면\s*명|TITLE)", re.IGNORECASE)
    for i, line in enumerate(lines):
        if title_label.search(line):
            for j in (i + 1, i + 2):
                if j < len(lines) and lines[j].upper() not in _TITLE_DENY and len(lines[j]) > 2:
                    return lines[j][:80]
    if stem:
        return stem[:80]
    return "Untitled"


def discipline_from_filename(filename: str) -> tuple[str, str]:
    """파일명 선두 번호의 공종 접두로 (code, label) 판정. 미상은 기타."""
    fnum = _filename_number(filename)
    return _discipline(fnum) if fnum else ("G", "G (기타)")


def extract_sheet_meta(text: str, filename: str, page_index: int, *,
                       lines: list[dict] | None = None,
                       page_size: tuple[float, float] | None = None,
                       multipage: bool = False) -> dict:
    """페이지 텍스트(+선택 좌표 lines)+파일명+페이지인덱스 → 시트 메타.

    lines가 주어지면 좌표 기반 라벨 앵커(S2.5)를 우선 시도하고, 실패 시 텍스트 휴리스틱(S2)으로 폴백한다.
    반환: {number, title, discipline_code, discipline_label, meta_source}
    """
    fnum = _filename_number(filename)
    cands = _candidates(text)
    # 다중 토큰 후보(ESS-EE-DWG-003)도 보강 — 공종 토큰을 가진 것 우선.
    multi = [_normalize(t) for t in _MULTI_CAND_RE.findall(text or "") if _looks_like_number(t)]

    number = None
    source = "page-index"
    if fnum and fnum in cands:
        number, source = fnum, "filename+page"            # 고신뢰
    elif lines and (sp := _spatial_number(lines, page_size)):
        number, source = sp, "title-block-xy"             # S2.5 좌표 앵커
    elif (lbl := _near_label_number(text)):
        number, source = lbl, "title-block"
    elif fnum:
        number, source = fnum, "filename"
    elif multi:
        known = [c for c in multi if _discipline(c)[0] != "G"]
        number, source = (known[0] if known else multi[0]), "candidate"
    if not number:
        number = f"Page {page_index + 1}"

    # 제목: 멀티페이지만 좌표 앵커 우선(단일파일은 파일명 stem 우선=S2 동작 보존, F4 회귀 방지).
    title = None
    if lines and multipage:
        title = _spatial_title(lines, page_size)
    if not title:
        title = _title(text, filename, multipage=multipage)

    # 공종: 실 번호를 찾았을 때만 번호 토큰으로 판정. page-index 폴백이면 파일명에서.
    code, label = _discipline(number) if source != "page-index" else _discipline(fnum or "")
    return {
        "number": number,
        "title": title,
        "discipline_code": code,
        "discipline_label": label,
        "meta_source": source,
    }
