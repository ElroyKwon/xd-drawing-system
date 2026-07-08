# S15 — 업로드 지능화 (백본1) · 메타프롬프트

> **STATUS: FROZEN (2026-07-08, 세션21).** 이 텍스트는 실행·채점의 기준이다. 합격을 위해 도중에 몰래 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).
> 상위 방향: `ROADMAP.md §0 A`. TypeDB 원칙: `ROADMAP.md §0 B (LOCKED)`.

---

## Stage goal

업로드된 도면에서 **본문 텍스트 색인 + 설비 태그를 자동 추출**하고, 그 결과를 **버전을 가로지르는 영속 시트 정체성(`sheet_key`)에 매달아 생명주기 관리**하며, **8000 read API로 노출해 AI 어시스턴트가 그라운딩**하게 한다.

**왜 하는가**: 지금 AI가 근거로 삼는 시트 정보는 `number·title·discipline` 5필드뿐(`backend/ai/tools.py:43-50`)이고, 설비 지식은 `scripts/seed_ontology.py`에 사람이 손으로 넣은 15종이 전부다. **새 도면을 올리면 AI는 그 내용을 영원히 모른다.** 업로드 추출이 만드는 "질의 가능한 표면"이 곧 AI의 답변 천장이다.

---

## Co-design log (2026-07-08 사용자 확정, 8건)

| # | 결정 | 내용 |
|---|---|---|
| D1 | **추출 범위 = 중간** | 기존 5필드 + **시트 본문 텍스트 색인** + **설비 태그 자동추출**(`PP-380V`, `MTR-1`, `VCB`…). 관계/정격/결선(온톨로지 자동구축)은 **범위 외**. |
| D2 | **엔진 = 규칙·LLM 2트랙 + 정규화** | ①규칙기반 추출(결정적) ②LLM 독립 읽기 추출 — **둘 다 독립 수행** → ③분류·정규화 패스가 두 결과를 병합·교정. LLM 트랙은 **플래그(기본 off)**, 없어도 시스템 정상. |
| D3 | **AI 소비 = 둘 다** | 기존 툴 강화(`search` 본문 검색, `get_sheet`/`list_sheets`에 tags·summary) **+** 신규 툴(`get_sheet_content`, `find_sheets_by_equipment`). |
| D4 | **신뢰도 표기** | 태그마다 `confidence`·`src` 저장. 저신뢰 항목을 AI가 인용할 땐 **"자동추출(미검증)"을 반드시 명시**. 골든 이밸에 이 기준 추가. |
| D5 | **모든 시트에 `sheet_key` 발급** | 현재는 패키지 발행 시에만 발급(`routes_package.py:302`). **업로드/변환 완료 시 전 시트에 발급**하도록 확장 + 기존 도면 소급 마이그레이션. |
| D6 | **버전별 메타 전부 보존** | rev마다 추출본을 이력으로 적재. **AI 그라운딩 기본은 `is_current`만**, 과거는 명시 질의 시. (백본3 supersede diff의 재료) |
| D7 | **DWG(DXF) 우선 + PDF 보강** | 같은 `sheet_key`를 PDF·DWG 양쪽에서 추출 시 **DXF 엔티티 텍스트를 권위**로. PDF는 DWG 없는 시트·타이틀블록 보강. **충돌은 버리지 말고 `conflicts[]`에 기록.** |
| D8 | **LLM은 별도 추출 사이드카(8002)** | 8000 본선의 **egress 0 · 킬스위치** 계약 유지. 8000=규칙기반 추출+저장, 8002=LLM 독립 읽기+정규화, 8001=기존 챗(무변경). **8002를 꺼도 규칙기반으로 전부 동작.** |

---

## 작업 원칙

1. **AI 답변 능력에서 역산한다.** 추출 필드를 정할 때 "이 필드가 어떤 질문에 답하게 하는가"를 먼저 쓴다. 답할 질문이 없는 필드는 뽑지 않는다.
2. **정직성이 성능보다 우선.** 자동추출이 틀리면 AI는 *출처까지 달린 거짓*을 말한다. 신뢰도·출처 없는 태그는 AI에 노출하지 않는다. 확신 없으면 "모른다"가 정답.
3. **없어도 도는 구조.** LLM(8002) 없이, TypeDB 없이도 시스템은 100% 동작해야 한다. 둘 다 **부가가치 레이어**다.
4. **기존 코드를 부수지 않는다.** 시트 임베드(`row["sheets"]`)에 추출물을 넣지 않는다 — 재변환 시 소멸한다(`store.py:429-430`). 외부 JSON 조인만.
5. **정체성 권위는 하나.** `sheet_key` 레지스트리를 유일 권위로 두고, S14 `sheet_source.sheet_key`가 이를 참조하게 한다. 두 곳에서 발급하지 않는다.

---

## 제약 · 하네스 (scope)

### 반드시 지킬 불변식
- **8000 egress 0**: 본선은 외부 네트워크 호출을 하지 않는다. 자동검사(정적 grep/AST)로 채점.
- **`backend/extract/`(8002) 격리**: 기존 `backend/*` 모듈 **import 0**(AST 검사). 8000과는 **HTTP로만** 대화한다(도면 파일도 8000에서 GET).
- **`backend/ai/`(8001) 무변경 격리**: 사이드카는 여전히 **8000을 HTTP GET만** 한다. 8001이 8002를 호출하지 않는다.
- **TypeDB 원칙(LOCKED)**: 추출 결과의 SoT는 내부 JSON. TypeDB 연결됐을 때만 동기. TypeDB를 필수 의존으로 만들지 않는다.
- **회귀 0**: 기존 `npm build` · vitest(현 128) · backend pytest(현 125) · 사이드카 pytest(현 39) GREEN 유지.

### 건드려도 되는 것
`backend/store.py`(신규 CRUD 추가), `backend/conversion.py`(추출 훅), `backend/sheet_meta.py`(규칙 트랙 확장), `backend/routes_*.py`(신규 read API), `backend/ai/tools.py`·`agent.py`(툴 강화/신설), `backend/ai/eval/golden.json`, 신규 `backend/extract/`, 신규 `scripts/migrate_sheet_keys.py`.

### 절대 건드리지 않는 것
`row["sheets"]` 스키마(임베드 금지), `backend/ai/client.py` 격리 계약, `reference/`, 기존 이슈·마크업·측정 엔티티.

---

## 데이터 모델 (계약)

### `_sheet_keys.json` (신설) — 시트 정체성 레지스트리 · 유일 권위
```json
{ "sk-a91f": { "project_name": "LS 청주사업장",
               "version_set_id": "vs-…" | null,
               "sheet_number": "EE-01-016",
               "created_at": "…" } }
```
- **발급 규칙**: 변환 완료 시 시트마다 조회 → 같은 `(project_name, version_set_id, sheet_number)`가 있으면 **계승**, 없으면 신규 발급.
- `version_set_id`가 없는 단일 업로드는 `(project_name, file_id, sheet_number)`로 계승 판정.
- S14 `publish`의 `inherit_sheet_key`는 이 레지스트리를 통해서만 계승한다.

### `_sheet_meta.json` (신설) — 버전별 추출본 (이력 보존)
```json
{ "sm-…": {
  "meta_id": "sm-…", "project_name": "…",
  "sheet_key": "sk-a91f",          // 생명주기 축 (버전 가로지름)
  "file_id": "…", "sheet_index": 3, // 안정 좌표 (sheet_id는 재변환 시 휘발)
  "sheet_id": "…",                  // 현 변환 기준 딥링크 편의
  "content_hash": "sha256:…",       // 동일 해시면 재추출 스킵
  "source_kind": "dxf" | "pdf",     // D7 권위 판정용
  "is_current": true,               // AI 기본 그라운딩 대상
  "text_index": "PANEL BOARD P-A-3PP …",
  "tags": [ { "tag": "PP-380V", "type": "분전반",
              "confidence": 0.92, "src": "rule|llm|merged",
              "evidence": "타이틀블록 텍스트 …" } ],
  "summary": "…" | null,
  "conflicts": [ { "field": "tag", "dxf": "PP-380V", "pdf": "PP-38OV", "resolved": "PP-380V" } ],
  "extractor": { "rule_version": "1", "llm_model": "gpt-5.5" | null },
  "extracted_at": "…" } }
```

### 신규 8000 read API (사이드카가 GET으로만 소비)
- `GET /api/sheet-meta?project_name=&sheet_key=&sheet_id=&current_only=true`
- `GET /api/sheet-meta/search?project_name=&q=` — 본문 색인 검색
- `GET /api/sheet-meta/by-equipment?project_name=&tag=` — 태그 역방향 조회

### 8002 추출 사이드카 계약
- `POST /extract` ← 8000이 호출(localhost). body: `{file_url, source_kind, rule_tags[], text_index}`
- 8002는 `file_url`을 **8000에서 GET**해 LLM 독립 읽기 → 분류·정규화 → `{tags[], summary, conflicts[]}` 반환.
- 킬스위치 `XD_EXTRACT_LLM=0`(**기본**) → 8000은 8002를 호출하지 않고 규칙기반 결과만 저장.
- provider=mock이면 egress 0.

---

## 수행 단계

1. **`sheet_key` 레지스트리 + 발급**(D5) → verify: 새 업로드 시 전 시트에 키 발급, 같은 시트번호 재업로드 시 **계승**됨을 pytest로 확인.
2. **소급 마이그레이션 스크립트**(`scripts/migrate_sheet_keys.py`, 멱등) → verify: 청주 40장 전 시트에 키 부여, 2회 실행해도 키 불변.
3. **규칙 트랙 추출**(8000, egress 0): PDF=PyMuPDF 텍스트+좌표, DXF=ezdxf TEXT/MTEXT/ATTRIB → `text_index` + 태그(정규식 + 설비명 사전; `seed_ontology.py` EQUIPMENT를 사전 시드로 재사용) → verify: 시드 없이 청주 도면에서 `PP-380V` 등 태그 추출.
4. **`_sheet_meta.json` CRUD + 이력**(D6) → verify: 새 버전 업로드 시 이전 rev 레코드 보존, 신규만 `is_current=true`.
5. **8002 추출 사이드카 신설**(D8): `backend/extract/`, 자체 venv, LLM 독립 읽기 + 분류·정규화 패스 → verify: **격리 AST 검사 import 0**, 8002 정지 상태에서 업로드해도 규칙기반 추출 정상.
6. **DWG↔PDF 병합**(D7): 같은 `sheet_key`의 dxf·pdf 추출본을 DXF 우선 병합, 충돌 `conflicts[]` 기록 → verify: 충돌 케이스 pytest.
7. **8000 read API 3종 신설** → verify: 라이브 GET 200 + 스키마.
8. **AI 툴 강화·신설**(D3): `search` 본문 색인 포함, `get_sheet`/`list_sheets`에 tags·summary, 신규 `get_sheet_content`·`find_sheets_by_equipment` → verify: 사이드카 pytest + 실 gpt-5.5 라이브.
9. **신뢰도 정직성**(D4): 시스템 프롬프트에 "저신뢰(`confidence < 0.7`) 태그 인용 시 '자동추출(미검증)' 명시" 지침 + **골든 이밸 문항 추가** → verify: 이밸 통과.
   > **임계값 조정(2026-07-08, 세션25, 사용자 승인)**: `< 0.6` → `< 0.7`. 근거: 규칙 트랙은 사전확정 0.92·prefix추론 0.65 두 신뢰도만 생성하고 실 청주 태그는 100%가 0.65(prefix추론=사전 미매칭). 0.6 임계값은 그 바로 아래라 정직성 플래그가 **실 데이터에서 절대 발화되지 않아** O9가 공허해짐. 의미선(사전확정 신뢰 vs prefix추론 미검증)에 맞춰 0.7로 올려 prefix추론(0.65)을 "미검증"으로 잡음. AskUserQuestion 승인 = HUMAN_GATE 해제.
10. **온톨로지 연결**: 추출 태그를 `/api/ontology/equipment` 표면으로 승격(수동 시드는 고신뢰 curated overlay로 유지). TypeDB 연결 시 동기, 없으면 내부 JSON만 → verify: TypeDB 끈 상태·켠 상태 둘 다 동작.
11. **회귀 게이트** + **독립 3렌즈 검수**(백엔드 적대 · 프론트/AI 소비 · Done-When 비평) → 발견 전량 수리 + 회귀.

---

## 성공 기준 (acceptance checklist — 항목별 객관 판정)

| # | 기준 | 판정 방법 |
|---|---|---|
| **O1** | 새 PDF 업로드 → 변환 완료 시 전 시트에 `sheet_key` 발급 | pytest + 라이브 업로드 후 `_sheet_keys.json` 확인 |
| **O2** | 같은 시트번호로 새 버전 업로드 → `sheet_key` **계승**(동일 키) | pytest |
| **O3** | 기존 청주 40장 소급 마이그레이션 완료, 2회 실행 멱등 | 스크립트 2회 실행 → 키 diff 0 |
| **O4** | 규칙 트랙만으로(8002 정지, LLM off) `text_index` + 태그 ≥1개 추출 | 8002 미기동 상태 라이브 업로드 |
| **O5** | **시드 없이** 새 도면의 설비 태그가 AI에 보인다 | `seed_ontology.py` 미실행 프로젝트에서 `find_sheets_by_equipment` 응답 |
| **O6** | 새 버전 업로드 시 이전 rev 추출본 **보존**, `is_current`는 최신 1개 | pytest + JSON 확인 |
| **O7** | AI 기본 답변은 `is_current` 기준. 과거 rev는 명시 질의 시만 | 라이브 챗 2문항 |
| **O8** | DXF·PDF 충돌 시 **DXF 채택 + `conflicts[]` 기록**(버리지 않음) | pytest 충돌 케이스 |
| **O9** | 저신뢰 태그(`confidence < 0.7`, 세션25 승인 조정)를 AI가 인용할 때 **"자동추출(미검증)" 명시** | 골든 이밸 신규 문항 PASS |
| **O10** | 없는 설비를 물으면 여전히 **"없음"** (환각 0 유지) | 기존 환각 적대 문항 전부 PASS |
| **O11** | **8000 egress 0** — 본선에 외부 네트워크 호출 없음 | 정적 grep/AST 검사 |
| **O12** | **`backend/extract/` 격리** — 기존 backend 모듈 import 0 | AST 검사 |
| **O13** | **TypeDB 없이 전부 동작**, 연결 시 온톨로지 동기 | TypeDB off/on 2회 e2e |
| **O14** | 회귀 0: build · vitest(≥128) · backend pytest(≥125) · 사이드카 pytest(≥39) GREEN | CI 게이트 |
| **O15** | 독립 3렌즈 검수 발견 BLOCKER/MAJOR **전량 수리 + 회귀 테스트** | 검수 리포트 + 커밋 |

**전부 MET이어야 S15 DONE.** NARROWED/UNMET은 `HUMAN_GATE.md`에 기록하고 정지·보고.

---

## Inputs (파일 지도)

- 현 추출: `backend/sheet_meta.py`(규칙 휴리스틱), `backend/conversion.py:204-232`(PDF), `:126-180`(DXF)
- 저장: `backend/store.py:422-437`(⚠️ sheets 통째 교체), `:440-462`(버전세트), `:946-1019`(S14 package/sheet_source)
- 시트 정체성: `backend/routes_package.py:289-302`(현 sheet_key 발급/계승)
- AI: `backend/ai/tools.py`(툴 7종), `backend/ai/agent.py`(TOOLS_SCHEMA·프롬프트), `backend/ai/eval/golden.json`
- 온톨로지: `backend/ontology.py`(선택적 TypeDB·JSON 미러), `scripts/seed_ontology.py`(수동 시드 15종 → 사전 시드로 재사용)

---

## 범위 외 (out of scope — 의도적으로 하지 않음)

- **관계/정격/결선 추출**(설비 간 그래프 자동구축) — D1에서 "최대" 옵션 배제. 후속.
- **스캔 PDF OCR / 비전 모델** — 텍스트 레이어 없는 PDF는 이번 범위 밖(태그 0으로 정직 처리).
- **supersede diff · 이슈↔해결버전 연결 · 종결 검증게이트** — 백본3(S14 Phase 2). 단 본 스테이지의 `sheet_key` + 버전별 메타 이력이 그 **토대**를 깐다.
- **사람 검수 UI** — D4에서 "신뢰도 표기"만 채택(검수 워크플로 미채택). 후속 여지.
- **DWG→PDF 자동변환**, 이메일 알림, 실 인증 — 별도 트랙.
- **대량 LLM egress 실운영** — `XD_EXTRACT_LLM=1`로 실제 고객 도면을 외부 LLM에 대량 전송하는 것은 **HUMAN_GATE-7**. 기본 off로 구현만 한다.
