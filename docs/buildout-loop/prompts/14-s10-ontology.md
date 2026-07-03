# S10 — XD 온톨로지 적재 + equipment 바인딩  [STATUS: FROZEN 2026-07-03 · 밤샘 자율=추천안]

> ai-loop 스테이지 계약. GATE-1(온톨로지→S10 연기)의 실현 스테이지. TypeDB 3.7.3 실기동(Docker healthy) 위에 **equipment 온톨로지를 실적재**하고, 도면 시트에 바인딩(`appears_on` = analysis_result의 equipmentEntityId 계승 개념)하며, **사이드카가 이를 그라운딩해 답**하게 한다(XD 차별화). LOOP 결정#2: Study_TypeDB 검증분(01-equipment.tql tag/name/status/discipline 모델) 이식.

## Stage goal / Done-When

xd의 도면이 TypeDB에서 **미러가 아니라 실제 온톨로지 엔티티**로 조회되고, equipment 엔티티가 시트에 바인딩되어 AI가 "이 시트/프로젝트에 어떤 장비가 있나"를 **TypeDB 실쿼리로 그라운딩**해 답한다.

**완료 정의(S10)**:
- (a) **equipment 온톨로지 스키마**: `equipment` 엔티티(equipment_id@key·tag·name·type·status·discipline·project_name) + `appears_on` 관계(equipment↔drawing_sheet). 기존 `xd_drawings` DB에 idempotent `define`로 추가(기존 04-drawings 무파괴).
- (b) **TypeDB 권위 적재+조회**: equipment/binding은 **TypeDB가 SoT**(JSON 미러는 폴백). `list_equipment`/`get_equipment`가 **실제 TypeDB READ 쿼리**로 조회(ConceptRow 파싱) — 하드코딩·미러전용 아님. TypeDB 미가동 시 우아 폴백.
- (c) **8000 조회 라우트**: `GET /api/ontology/equipment?project_name=&sheet_id=` · `GET /api/ontology/equipment/{id}`. 프로젝트 스코프.
- (d) **큐레이트 시드**(정직): `scripts/seed_ontology.py` — 데모 전기도면(단선결선도·BESS)의 대표 장비(변압기·LV패널·차단기·PCS·케이블 등)를 **실제 데모 시트에 바인딩**. 멱등(재실행 안전). "AI 추출"이 아니라 **큐레이트 시드**로 명시(환각 방지, 세션15 순환성 교훈).
- (e) **사이드카 온톨로지 툴**: `list_equipment(project, sheet_id?)`·`get_equipment(equipment_id)`를 `tools.py`+`agent.py`에 등록(총 9종). **오직 8000 HTTP GET**(격리 불변식 유지). AI가 장비 질문을 TypeDB 그라운딩으로 답.
- (f) **데이터 진실성 검증**: TypeDB 실쿼리 카운트 = 8000 라우트 = 시드 정의가 일치. 라이브 스팟체크.
- (g) 격리 불변식(사이드카 backend import 0) + 회귀 0(build·vitest·backend pytest·사이드카 pytest).

## Co-design log (2026-07-03 — 사용자 밤샘 자율승인, AFK=추천안 freeze)

- **(Q1) equipment 출처 = 데모 전기도면 큐레이트 시드**. AI 드로잉 분석(실 추출)은 별도 후속(HUMAN_GATE 성격의 정확도 이슈). S10은 **정직한 큐레이트 시드**로 온톨로지 구조·바인딩·그라운딩을 실증. (Study_TypeDB 테스트데이터 그대로 이식/휴리스틱 추출 미채택 — 데모 도면과 정합되는 큐레이트가 제안서에 가장 설득력.)
- **(Q2) 조회 범위 = TypeDB 권위 + 8000 라우트 + 사이드카 툴**. 온톨로지를 적재만 하지 않고 **AI 그라운딩까지** 연결(XD 고유가치 실증). equipment/binding은 TypeDB SoT(도면 메타는 여전히 JSON 미러 유지 — 무파괴).
- **근거**: de-risk 프로브로 TypeDB equipment insert+READ 파싱 왕복 성공 확인 후 착수.

## Instruction (수행 단계)

1. **스키마** `backend/schema/05-ontology.tql`: equipment 엔티티 + appears_on 관계. `TypeDBDrawingStore._ensure_db` 또는 온톨로지 모듈이 기존 DB에 idempotent define 적용(존재 시 무해).
2. **`backend/ontology.py`**: OntologyStore — `ensure_schema`·`add_equipment(project, equip, sheet_ids)`(insert + appears_on 바인딩, TypeDB write + JSON 미러)·`list_equipment(project, sheet_id?)`(TypeDB READ 쿼리, 폴백 미러)·`get_equipment(id)`. TypeDB 미가동 시 JSON 미러(`_ontology.json`) 폴백.
3. **8000 라우트** `backend/routes_ontology.py`: 위 (c). `main.py` include_router.
4. **시드** `scripts/seed_ontology.py`: 데모 프로젝트별 큐레이트 전기장비 + 실제 시트 바인딩. 멱등(프로젝트 기존 equipment 삭제 후 재적재). 프로브 잔여(EQ-probe-*) 정리 포함.
5. **사이드카 툴** `backend/ai/tools.py`+`agent.py`: `list_equipment`·`get_equipment`(8000 GET). TOOLS_SCHEMA·_dispatch·_summarize 등록. 시스템 프롬프트에 장비 질문 라우팅 지침.
6. **검증**: 라이브 — 8000 라우트가 TypeDB 실데이터 반환, 사이드카가 "이 프로젝트 장비 목록"에 TypeDB 그라운딩 답(mock/실 스팟). 진실성 카운트 일치. 회귀 0 + 격리(사이드카 import 0·기존 backend diff는 신규 라우트/스키마/스토어만).

## Acceptance checklist (별도 검증팀 채점 — freeze)

- **O1** — `05-ontology.tql` equipment+appears_on 스키마가 기존 `xd_drawings` DB에 무파괴 적용(04-drawings 엔티티 보존).
- **O2** — equipment/binding이 **TypeDB에 실적재**(insert 후 TypeDB READ로 조회 가능), 하드코딩 아님.
- **O3** — `list_equipment`/`get_equipment`가 **실제 TypeDB READ 쿼리**(ConceptRow 파싱)로 반환, 미러전용 아님. TypeDB 미가동 시 우아 폴백.
- **O4** — `GET /api/ontology/equipment`(project·sheet 필터)·`/{id}` 라이브 200, 프로젝트 스코프.
- **O5** — `seed_ontology.py` 멱등, 데모 장비가 **실제 데모 시트에 바인딩**, 큐레이트 시드로 정직 표기(AI추출 아님).
- **O6** — 사이드카 `list_equipment`·`get_equipment` 8000 GET 그라운딩(격리 import 0), AI가 장비 질문에 TypeDB 근거 답(환각 시 '없음').
- **O7** — 데이터 진실성: TypeDB 쿼리 카운트 = 8000 라우트 = 시드 정의 일치(라이브 대조).
- **O8** — 회귀 0(build·vitest·backend pytest·사이드카 pytest) + 격리 불변식 유지.

## Out of scope (의도적으로 하지 않음)

- **AI 드로잉 실분석·자동 장비추출** — 정확도 게이트 성격, 별도 후속. S10은 큐레이트 시드.
- **온톨로지 프론트 UI(그래프 뷰 등)** — 백엔드+AI 그라운딩까지. 프론트 시각화는 후속.
- **spaces/relations 전체 온톨로지 이식** — equipment+시트바인딩 슬라이스만(차별화 실증 최소).
- **도면 메타(file/sheet)를 JSON→TypeDB 권위 이전** — 무파괴 위해 미러 유지. equipment만 TypeDB SoT.
