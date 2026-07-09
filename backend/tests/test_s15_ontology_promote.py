"""단계10 overlay 되돌림 회귀 가드 (지식그래프 트랙으로 방향 수정).

list_equipment 는 순수 큐레이트만 반환한다(추출 태그 승격 없음).
추출 태그의 '설비 노출'은 지식그래프 tag 노드/has_tag 엣지가 담당(kg_store).
"""
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # backend/

import config  # noqa: E402
import ontology  # noqa: E402


def _fresh(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "UPLOADS_DIR", tmp_path)  # 자동 복원 — config 전역 누출 방지
    monkeypatch.setattr(config, "STORE_BACKEND", "json")
    monkeypatch.delenv("XD_ONTOLOGY_DIRECT_TYPEDB", raising=False)
    import store as store_mod
    importlib.reload(store_mod)
    importlib.reload(ontology)  # _MIRROR_PATH 재계산 + _singleton 리셋
    return store_mod.get_store(), ontology.get_ontology()


def _seed_meta(s, tags, sheet_id="F1_s0", ch="sha256:a"):
    s.upsert_sheet_meta(
        sheet_key="sk1", project_name="P1", file_id="F1", sheet_index=0,
        sheet_id=sheet_id, source_kind="pdf", content_hash=ch,
        text_index="idx", tags=tags)


def test_list_equipment_is_pure_curated(tmp_path, monkeypatch):
    # 큐레이트 1건 + 추출 태그 시드. 옛 overlay 였다면 추출 태그가 설비로 승격됐다.
    # 되돌림 후에는 list_equipment 가 큐레이트(E1)만 반환해야 한다(행동 검증).
    s, ont = _fresh(tmp_path, monkeypatch)
    ont.add_equipment("P1", {"equipment_id": "E1", "tag": "MTR-1", "type": "motor"}, ["s1"])
    _seed_meta(s, [{"tag": "PP-380V", "type": "분전반", "confidence": 0.65, "src": "rule"},
                   {"tag": "VCB-9", "type": "", "confidence": 0.65, "src": "rule"}])
    items = ont.list_equipment("P1")
    assert [e["equipment_id"] for e in items] == ["E1"]         # 큐레이트만
    tags = {e["tag"] for e in items}
    assert "PP-380V" not in tags and "VCB-9" not in tags        # 추출 태그 미승격
    assert all(e.get("origin", "curated") == "curated" for e in items)


def test_extracted_overlay_removed():
    # overlay 기계가 제거됐는지 API 표면으로 확인(회귀 가드).
    assert not hasattr(ontology.OntologyStore, "_extracted_overlay")
    assert not hasattr(ontology, "_norm_tag")
