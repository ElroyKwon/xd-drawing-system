# -*- coding: utf-8 -*-
"""S2.5 멀티페이지 스케일 강건화 — 시트 메타 좌표 라벨앵커 추출 단위 테스트.

제주 BESS 양식(DWG NO/DWG. TITLE 라벨 바로 아래 값, 번호 ESS-EE-DWG-003)을
합성 좌표 lines로 재현해 라벨앵커·다중토큰 공종·멀티페이지 제목·폴백을 검증한다.
"""
from sheet_meta import extract_sheet_meta, _discipline


def _line(text, x0, y0, x1, y1):
    return {"text": text, "x0": x0, "y0": y0, "x1": x1, "y1": y1}


# 제주 양식 타이틀블록(우하단) 재현: 라벨 위에, 값은 바로 아래.
def _jeju_lines(number="ESS-EE-DWG-003", title="SINGLE LINE DIAGRAM-2"):
    return [
        _line("PROJECT TITLE", 632, 757, 700, 763),
        _line("한림그린에너지 BESS 발전소", 648, 776, 760, 785),
        _line("DWG. TITLE", 868, 757, 897, 763),
        _line(title, 884, 776, 1000, 785),
        _line("DWG NO", 1041, 758, 1058, 763),
        _line(number, 1066, 768, 1127, 776),
        _line("DATE", 1041, 792, 1058, 797),
        _line("2025.03.24", 1069, 793, 1113, 802),
    ]


def test_label_anchor_number_below_label():
    """DWG NO 라벨 바로 아래의 값을 번호로 추출(좌표 페어링)."""
    meta = extract_sheet_meta("", "전기도면.pdf", 4, lines=_jeju_lines(),
                              page_size=(1191, 842), multipage=True)
    assert meta["number"] == "ESS-EE-DWG-003"
    assert meta["meta_source"] == "title-block-xy"


def test_label_anchor_title():
    """DWG. TITLE 라벨 아래의 도면명을 제목으로 추출."""
    meta = extract_sheet_meta("", "전기도면.pdf", 4, lines=_jeju_lines(title="BATTERY실 소내 전력 단선도"),
                              page_size=(1191, 842), multipage=True)
    assert meta["title"] == "BATTERY실 소내 전력 단선도"


def test_multitoken_discipline_from_middle_token():
    """ESS-EE-DWG-003의 중간 토큰 EE를 전기(E)로 판정."""
    assert _discipline("ESS-EE-DWG-003") == ("E", "E (전기)")
    meta = extract_sheet_meta("", "전기도면.pdf", 4, lines=_jeju_lines(),
                              page_size=(1191, 842), multipage=True)
    assert meta["discipline_code"] == "E"


def test_multipage_title_not_filename_stem():
    """멀티페이지에서는 파일명 stem이 아니라 페이지별 도면명을 제목으로."""
    meta = extract_sheet_meta("", "제주 BESS 전기도면 일식.pdf", 4,
                              lines=_jeju_lines(title="옥외 배치도"),
                              page_size=(1191, 842), multipage=True)
    assert meta["title"] == "옥외 배치도"
    assert "제주" not in meta["title"]


def test_fallback_page_n_when_no_titleblock():
    """타이틀블록 라벨/값이 없으면 'Page N' 폴백(무성 오작동 금지)."""
    cover = [_line("ELECTRICAL DRAWING", 400, 300, 700, 330)]
    meta = extract_sheet_meta("ELECTRICAL DRAWING", "제주 BESS.pdf", 0,
                              lines=cover, page_size=(1191, 842), multipage=True)
    assert meta["number"] == "Page 1"
    assert meta["meta_source"] == "page-index"


def test_s2_regression_filename_number_single_file():
    """청주 단일파일 경로(파일명=번호) 회귀: lines 없이 파일명에서 번호·공종."""
    meta = extract_sheet_meta("EE-01-006 6.6kV 변전설비 단선결선도", "EE-01-006_변전설비.pdf", 0)
    assert meta["number"] == "EE-01-006"
    assert meta["discipline_code"] == "E"
    # 단일파일 제목은 파일명 stem 우선(S2 동작 보존)
    assert meta["title"].startswith("EE-01-006")


def test_value_below_skips_label_noise():
    """값 자리에 라벨/노이즈(NONE 등)만 있으면 채택하지 않는다."""
    lines = [
        _line("DWG NO", 1041, 758, 1058, 763),
        _line("NONE", 1043, 768, 1070, 776),   # 라벨 바로 아래 노이즈 → 거부
        _line("EE-DWG-100", 1066, 775, 1127, 783),  # 그 아래 진짜 번호 → 채택
    ]
    meta = extract_sheet_meta("", "x.pdf", 0, lines=lines, page_size=(1191, 842), multipage=True)
    assert meta["number"] == "EE-DWG-100"


def test_storage_bytes_sums_file_dir(tmp_path):
    """_storage_bytes: 도면 디렉토리 전체(원본+파생) 합산. (S2.5 용량 가시화 F7)"""
    from routes_drawing import _storage_bytes
    base = tmp_path / "proj" / "fid"
    (base / "sheets").mkdir(parents=True)
    (base / "original.pdf").write_bytes(b"x" * 1000)
    (base / "sheets" / "s1.png").write_bytes(b"y" * 500)
    (base / "sheets" / "s2.png").write_bytes(b"z" * 300)
    row = {"file_path": str(base / "original.pdf")}
    assert _storage_bytes(row) == 1800


def test_storage_bytes_missing_path():
    from routes_drawing import _storage_bytes
    assert _storage_bytes({}) == 0


def test_single_file_title_keeps_filename_stem_even_with_lines():
    """MAJOR-1 회귀: 단일파일(multipage=False)은 좌표 DWG TITLE 값이 있어도 제목=파일명 stem 유지(S2 보존)."""
    lines = [
        _line("DWG. TITLE", 868, 757, 897, 763),
        _line("좌표에서 뽑힌 도면명", 884, 776, 1000, 785),
    ]
    meta = extract_sheet_meta("", "EE-01-006_변전설비_단선결선도.pdf", 0,
                              lines=lines, page_size=(1191, 842), multipage=False)
    assert meta["title"].startswith("EE-01-006")
    assert meta["title"] != "좌표에서 뽑힌 도면명"


def test_date_not_picked_as_number():
    """MINOR-4 회귀: DWG NO 라벨 아래에 날짜만 있으면 번호로 채택하지 않고 폴백."""
    lines = [
        _line("DWG NO", 1041, 758, 1058, 763),
        _line("2025-03-24", 1066, 768, 1127, 776),  # 날짜 → 거부
    ]
    meta = extract_sheet_meta("", "x.pdf", 6,
                              lines=lines, page_size=(1191, 842), multipage=True)
    assert meta["number"] == "Page 7"
