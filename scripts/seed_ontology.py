"""S10 온톨로지 큐레이트 시드 — 데모 전기도면에 대표 장비를 TypeDB에 적재·바인딩.

정직 표기: 이 장비들은 **AI 추출이 아니라 큐레이트 시드**(구조·바인딩·그라운딩 실증용).
멱등: 프로젝트 equipment 전량 삭제 후 재적재. 런타임에 8000 store에서 실제 시트를 조회해
전기(E) 시트에 바인딩하므로 sheet_id 하드코딩 없음.

사용: backend/.venv/Scripts/python.exe scripts/seed_ontology.py
"""
import os
import sys
from pathlib import Path

# 시드는 TypeDB 권위에 직접 쓴다(서버는 미러 읽기라 이 플래그 없음).
os.environ["XD_ONTOLOGY_DIRECT_TYPEDB"] = "1"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from store import get_store  # noqa: E402
from ontology import get_ontology  # noqa: E402

PROJECT = "Study_Project"


def _sheets_for(project: str):
    """(전기 단선결선도 시트ids, BESS 시트ids) — 실제 store에서 조회."""
    store = get_store()
    drawings = store.list_drawings(project)
    single_line, bess = [], []
    for f in drawings:
        fn = f.get("filename", "")
        for s in f.get("sheets") or []:
            sid = s.get("sheet_id")
            if not sid:
                continue
            disc = (s.get("discipline_code") or "").upper()
            if "BESS" in fn or "제주" in fn:
                bess.append(sid)
            elif disc == "E" or "단선결선도" in fn or "결선" in fn or "EE-01" in fn:
                single_line.append(sid)
    return single_line, bess


# 큐레이트 장비 정의 — 6.6kV 변전설비 단선결선도 + BESS. (tag/name/type/status/discipline)
SINGLE_LINE_EQUIP = [
    {"equipment_id": "EQ-TR-01", "tag": "TR-01", "name": "주변압기 6.6kV/380V", "type": "transformer", "status": "ACTIVE", "discipline": "E"},
    {"equipment_id": "EQ-TR-02", "tag": "TR-02", "name": "예비변압기", "type": "transformer", "status": "STANDBY", "discipline": "E"},
    {"equipment_id": "EQ-VCB-01", "tag": "VCB-01", "name": "진공차단기 6.6kV", "type": "breaker", "status": "ACTIVE", "discipline": "E"},
    {"equipment_id": "EQ-ACB-01", "tag": "ACB-01", "name": "기중차단기 저압", "type": "breaker", "status": "ACTIVE", "discipline": "E"},
    {"equipment_id": "EQ-LV-01", "tag": "LV-01", "name": "저압배전반", "type": "panel", "status": "ACTIVE", "discipline": "E"},
    {"equipment_id": "EQ-CBL-01", "tag": "CBL-01", "name": "6.6kV 인입케이블", "type": "cable", "status": "ACTIVE", "discipline": "E"},
]
BESS_EQUIP = [
    {"equipment_id": "EQ-PCS-01", "tag": "PCS-01", "name": "전력변환장치 1호", "type": "pcs", "status": "ACTIVE", "discipline": "E"},
    {"equipment_id": "EQ-PCS-02", "tag": "PCS-02", "name": "전력변환장치 2호", "type": "pcs", "status": "ACTIVE", "discipline": "E"},
    {"equipment_id": "EQ-BAT-01", "tag": "BAT-01", "name": "배터리 랙 A", "type": "battery", "status": "ACTIVE", "discipline": "E"},
    {"equipment_id": "EQ-BAT-02", "tag": "BAT-02", "name": "배터리 랙 B", "type": "battery", "status": "FAULT", "discipline": "E"},
]


def main():
    ont = get_ontology()
    print(f"ontology backend = {ont.backend}")
    single_line, bess = _sheets_for(PROJECT)
    print(f"단선결선도 시트 {len(single_line)}개, BESS 시트 {len(bess)}개")

    removed = ont.clear_project(PROJECT)
    # 프로브 잔여 정리.
    for pid in ("EQ-probe-1",):
        e = ont.get_equipment(pid)
        if e:
            ont.clear_project(e["project_name"])
    print(f"기존 equipment {removed}건 삭제(멱등)")

    n = 0
    for eq in SINGLE_LINE_EQUIP:
        ont.add_equipment(PROJECT, eq, single_line)
        n += 1
    for eq in BESS_EQUIP:
        ont.add_equipment(PROJECT, eq, bess)
        n += 1
    print(f"큐레이트 장비 {n}건 적재 완료")

    got = ont.list_equipment(PROJECT)
    print(f"검증: list_equipment({PROJECT}) = {len(got)}건")
    for e in got[:3]:
        print(f"  {e['tag']} {e['name']} → 시트 {len(e['sheet_ids'])}개 바인딩")


if __name__ == "__main__":
    main()
