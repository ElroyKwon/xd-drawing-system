"""8002 추출 사이드카 자체 테스트 (extract/.venv 에서 실행, 격리).

    cd backend/extract && .venv/Scripts/python.exe -m pytest
"""
import os

from fastapi.testclient import TestClient

from main_extract import app
from normalize import canon, normalize
from provider import MockExtractProvider, make_extract_provider

client = TestClient(app)


def test_canon_folds_ocr_confusion():
    # O↔0, I·L↔1 접기 → 같은 정규형.
    assert canon("PP-380V") == canon("PP-38OV")
    assert canon("MTR-1") == canon("MTR-I") == canon("MTR-L")


def test_normalize_merges_and_records_conflict():
    rule = [{"tag": "PP-380V", "type": "분전반", "confidence": 0.92, "src": "rule"}]
    llm = [{"tag": "PP-38OV", "type": "", "confidence": 0.7, "src": "llm"},
           {"tag": "MTR-1", "type": "", "confidence": 0.7, "src": "llm"}]
    tags, conflicts = normalize(rule, llm)
    by = {t["tag"]: t for t in tags}
    # PP-380V·PP-38OV 는 canon 동일 → 1건으로 병합, 대표=고신뢰 PP-380V, src=merged.
    assert "PP-380V" in by and "PP-38OV" not in by
    assert by["PP-380V"]["src"] == "merged"
    assert by["PP-380V"]["confidence"] == 0.92
    # llm 단독 MTR-1 은 추가 보존.
    assert by["MTR-1"]["src"] == "llm"
    # canon-fold 충돌은 버리지 않고 기록.
    assert any(c["dropped"] == "PP-38OV" and c["resolved"] == "PP-380V" for c in conflicts)


def test_normalize_keeps_distinct_same_source_tags():
    # PL-1 과 PI-1 은 canon 이 같지만(P1-1) 서로 다른 설비 — 같은 트랙 내부에서 유실되면 안 됨.
    rule = [{"tag": "PL-1", "confidence": 0.9, "src": "rule"},
            {"tag": "PI-1", "confidence": 0.8, "src": "rule"}]
    tags, conflicts = normalize(rule, [])
    assert {t["tag"] for t in tags} == {"PL-1", "PI-1"}   # 둘 다 보존
    assert conflicts == []                                # 트랙 내부는 접지 않음 → 충돌 기록 없음


def test_mock_provider_is_deterministic_offline():
    prov = MockExtractProvider()
    r1 = prov.read("PANEL BOARD PP-380V FEEDS MTR-1 VCB", "pdf")
    r2 = prov.read("PANEL BOARD PP-380V FEEDS MTR-1 VCB", "pdf")
    assert r1 == r2  # 결정적(egress 0)
    tags = {t["tag"] for t in r1["llm_tags"]}
    assert "PP-380V" in tags and "MTR-1" in tags
    assert "PANEL" not in tags  # 스톱워드 제외
    # O9 정합: mock LLM 은 미검증 신뢰(<0.7) → AI 가 "자동추출(미검증)"으로 명시하게 됨.
    assert all(t["confidence"] < 0.7 for t in r1["llm_tags"])
    assert r1["summary"] and "설비 후보" in r1["summary"]


def test_default_provider_is_mock_when_llm_off(monkeypatch):
    monkeypatch.delenv("XD_EXTRACT_LLM", raising=False)
    assert make_extract_provider().name == "mock"
    monkeypatch.setenv("XD_EXTRACT_LLM", "0")
    assert make_extract_provider().name == "mock"


def test_health_reports_provider_and_gate(monkeypatch):
    monkeypatch.delenv("XD_EXTRACT_LLM", raising=False)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["provider"] == "mock"
    assert body["llm_enabled"] is False


def test_extract_endpoint_merges_rule_and_llm():
    payload = {
        "source_kind": "pdf",
        "text_index": "PANEL BOARD PP-380V FEEDS MTR-1",
        "rule_tags": [{"tag": "PP-380V", "type": "분전반", "confidence": 0.92, "src": "rule"}],
    }
    r = client.post("/extract", json=payload)
    assert r.status_code == 200
    body = r.json()
    by = {t["tag"]: t for t in body["tags"]}
    assert by["PP-380V"]["src"] == "merged"   # rule + llm 둘 다 봤다
    assert "MTR-1" in by                        # llm 이 보강
    assert body["summary"]
    assert body["extractor"]["llm_model"] == "mock"
