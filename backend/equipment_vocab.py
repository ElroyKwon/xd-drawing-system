"""S15 규칙 트랙 설비 어휘 — 8000 자립(egress 0, scripts/ 미의존).

`scripts/seed_ontology.py`의 큐레이트 장비(LS 청주 전기계통 15종)와 **같은 태그·타입**을
런타임 사전으로 둔다. seed_ontology를 import하면 모듈 top에서 TypeDB 환경변수를 세팅하는
부작용이 있어 재사용 대신 어휘를 여기에 시드한다(둘의 출처는 동일한 청주 전기계통).
"""

# prefix → (type, 한글 라벨). 규칙 후보 생성 + 타입 추론용.
TYPE_PREFIXES: dict[str, tuple[str, str]] = {
    "INC": ("incomer", "수전"),
    "VCB": ("breaker", "진공차단기"),
    "ACB": ("breaker", "기중차단기"),
    "MCCB": ("breaker", "배선용차단기"),
    "MCC": ("panel", "전동기제어반"),
    "MTR": ("transformer", "변압기"),
    "TR": ("transformer", "변압기"),
    "PP": ("panel", "분전반"),
    "MDB": ("panel", "주배전반"),
    "LV": ("panel", "저압배전반"),
    "CBL": ("cable", "케이블"),
}

# 큐레이트 확정 태그(고신뢰). (type, name). 청주 전기계통 15종 = seed_ontology와 동일 출처.
KNOWN_TAGS: dict[str, tuple[str, str]] = {
    "INC-22.9kV": ("incomer", "22.9kV 특고압 수전 인입"),
    "VCB-22.9kV": ("breaker", "22.9kV 수전 진공차단기"),
    "MTR-1": ("transformer", "주변압기 22.9kV/6.6kV"),
    "VCB-6.6kV": ("breaker", "6.6kV 진공차단기"),
    "TR-A1": ("transformer", "6.6kV/380V 변압기 (A동)"),
    "TR-R1": ("transformer", "6.6kV/380V 변압기 (R-Center)"),
    "TR-INV": ("transformer", "6.6kV 변압기 (인버터 시험센터)"),
    "ACB-LV": ("breaker", "저압 기중차단기"),
    "LV-MAIN": ("panel", "저압 주배전반 (380V)"),
    "PP-M": ("panel", "동력 주분전반"),
    "PP-220V": ("panel", "생산동력 분전반 (3Ø 220V)"),
    "PP-380V": ("panel", "생산동력 분전반 (3Ø 380V)"),
    "PP-440V": ("panel", "생산동력 분전반 (3Ø 440V)"),
    "CBL-22.9kV": ("cable", "22.9kV 인입 간선 케이블"),
    "CBL-6.6kV": ("cable", "6.6kV 배전 간선 케이블"),
}
