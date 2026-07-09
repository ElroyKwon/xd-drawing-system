# backend/extract — LLM 추출 사이드카(8002). 기존 8000 backend와 완전 격리.
# 이 패키지는 backend 모듈(store/config/rule_extract/routes_*/...)을 import하지 않는다
# (격리 불변식, S15 D8 · O12). 8000과는 HTTP로만 대화한다(도면 파일도 8000에서 GET).
# 킬스위치 XD_EXTRACT_LLM=0(기본)이면 8000은 이 사이드카를 호출하지 않는다.
