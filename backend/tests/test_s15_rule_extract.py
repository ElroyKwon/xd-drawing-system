"""S15 단계3: 규칙 트랙 추출 — 태그 추출·신뢰도·정직성·시트번호 오탐 차단.

prompts/20 O4(규칙만으로 text_index+태그 ≥1)·O5(시드 없이 설비 태그)·O11(egress 0, 순수함수).
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402
import rule_extract  # noqa: E402


def test_known_tag_high_confidence():
    tags = rule_extract.extract_tags("생산동력 분전반 PP-380V 결선도 및 PP-440V 계통")
    by = {t["tag"]: t for t in tags}
    assert "PP-380V" in by and "PP-440V" in by
    assert by["PP-380V"]["confidence"] == rule_extract.CONF_KNOWN
    assert by["PP-380V"]["type"] == "panel"
    assert by["PP-380V"]["src"] == "rule"
    assert by["PP-380V"]["evidence"]   # 근거 부착


def test_case_insensitive_matches_canonical():
    tags = rule_extract.extract_tags("panel pp-380v feeder")
    assert [t["tag"] for t in tags] == ["PP-380V"]   # 정규 표기로 복원


def test_prefix_only_medium_confidence():
    # 사전에 없는 새 태그도 prefix로 추론(중신뢰) — 시드 없이 보이게 하는 축(O5).
    tags = rule_extract.extract_tags("신규 분전반 PP-500V 및 차단기 VCB-3.3kV")
    by = {t["tag"]: t for t in tags}
    assert by["PP-500V"]["confidence"] == rule_extract.CONF_PREFIX
    assert by["PP-500V"]["type"] == "panel"
    assert by["VCB-3.3KV"]["type"] == "breaker"


def test_sheet_numbers_not_extracted_as_tags():
    # EE-01-016 같은 시트번호/공종코드는 설비 태그가 아니다(오탐 0).
    tags = rule_extract.extract_tags("도면번호 EE-01-016 A-01-002 단선결선도")
    assert tags == []


def test_dedup_keeps_highest_confidence():
    tags = rule_extract.extract_tags("PP-380V ... PP-380V ... PP-380V")
    assert len([t for t in tags if t["tag"] == "PP-380V"]) == 1


def test_empty_text_no_tags():
    assert rule_extract.extract_tags("") == []
    assert rule_extract.build_text_index("  a\n\n b ") == "a b"


def test_extract_rule_unknown_format():
    r = rule_extract.extract_rule("x.png", "png")
    assert r["tags"] == [] and r["text_index"] == "" and r["source_kind"] == "png"


def test_real_cheongju_pdf_yields_tags_without_seed():
    # O5: 온톨로지 시드와 무관하게, 실제 청주 PDF 텍스트 레이어에서 설비 태그가 나온다.
    index_path = os.path.join(config.UPLOADS_DIR, "_index.json") \
        if isinstance(config.UPLOADS_DIR, str) else str(config.UPLOADS_DIR / "_index.json")
    if not os.path.exists(index_path):
        pytest.skip("실 업로드 데이터 없음(gitignore) — 로컬 전용 통합 검증")
    rows = json.load(open(index_path, encoding="utf-8"))
    hit = None
    for row in rows.values():
        if row.get("file_format") != "pdf":
            continue
        fp = row.get("file_path")
        if not fp or not os.path.exists(fp):
            continue
        r = rule_extract.extract_rule(fp, "pdf", sheet_index=0)
        if r["tags"]:
            hit = r
            break
    if hit is None:
        pytest.skip("텍스트 레이어 있는 PDF를 못 찾음")
    assert len(hit["text_index"]) > 0
    assert all(t["src"] == "rule" for t in hit["tags"])
    assert all(0.0 < t["confidence"] <= 1.0 for t in hit["tags"])


def test_egress_zero_no_network_imports():
    # O11: 규칙 모듈은 외부 네트워크 라이브러리를 import하지 않는다.
    src = open(os.path.join(os.path.dirname(__file__), "..", "rule_extract.py"),
               encoding="utf-8").read()
    for banned in ("import requests", "import httpx", "urllib.request", "import socket"):
        assert banned not in src
