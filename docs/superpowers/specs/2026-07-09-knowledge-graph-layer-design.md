# 지식/관계성 메타 레이어 — 설계 (브레인스토밍 진행 중 · 2026-07-09)

> **STATUS: 브레인스토밍 진행 중 — 설계 §1·§2 제시 후 사용자 승인 대기 중 세션 종료.**
> 다음 세션은 이 문서를 읽고 `brainstorming` 스킬을 재장착해 **§1·§2 승인부터** 이어간다.
> 정식 스펙(FROZEN) 아님. 확정 결정 + 설계 초안 + 재개점을 담은 handoff.
> HARD-GATE 준수: 설계 승인 전 구현 금지 — 이번 세션 코드 변경 없음(문서만).

---

## 0. 왜 이 트랙이 생겼나 (사용자 방향 재정의)

세션26에서 S15 단계5·10·O7 + 3렌즈 수리를 마친 뒤, 사용자가 **단계10의 방향 자체를 재정의**했다.

- 기존 단계10 = "추출 태그를 `/api/ontology/equipment` 표면으로 **승격**(overlay)" → 커밋 `f0782d9`로 구현됨(`ontology._extracted_overlay`).
- **사용자 재정의**: "온톨로지로 승격하기보다는 관계성 메타 정보만 따로 관리하고 싶어. 온톨로지는 TypeDB로 큐레이트 권위 그대로 두고, AI가 별개로 분석한 결과물(관계성·wiki·지식)은 분리된 레이어로. 결국 에이전틱 AI의 자료 소스로 활용하기 위한 준비."
- 즉 **온톨로지(권위)와 AI 분석물(추출·관계·지식)을 물리적으로 분리**하고, 후자를 **에이전틱 AI가 깊이 활용할 지식그래프**로 짓는다.

→ 이 트랙은 `ROADMAP.md §0 A`(S15 백본1)의 연장이자 방향 수정. `prompts/20` 단계10("승격")은 **폐기 방향**이며, 이 문서가 대체 설계다. (단계10 코드 `_extracted_overlay`는 §6에서 되돌린다.)

---

## 1. 공동설계 확정 사항 (AskUserQuestion 답변, 세션26)

| # | 질문 | 사용자 확정 |
|---|---|---|
| C1 | 레이어가 담을 범위 | **둘 다 + wiki 지식노트** = 설비관계 그래프 + 도면 자산 크로스링크 + AI wiki 지식노트 (풀 지식레이어) |
| C2 | 저장 뼈대 | **XD 내부 지식 스토어(JSON)** — 온톨로지(TypeDB)와 물리 분리. TypeDB 원칙(외부·선택) 준수. + 추가 주문: "그래프 시각화로 지식을 모두 보고 조회, **딥한 AI를 위한 딥한 설계** 필요" |
| C3 | 에이전틱 AI 활용 방식 | **4개 전부**: ①그래프 순회·경로추적 ②근거체인 조회 ③서비스·툴 라우팅 ④지식 축적·자기확장(write) |
| C4 | decompose 첫 스펙 | **A. 읽기 그래프 먼저** = ①②③④(스토어+시드+순회/근거조회+시각화) 읽기전용. ⑤서비스라우팅·⑥자기확장(write)은 다음 스펙 |
| C5 | 시각화 위치(세션 종료 시 추가 주문) | **도면관리 시스템 UI 안에서** 분석 지식을 시각화해 보고 싶다(별도 앱 아님 — 기존 프론트에 통합 뷰) |

### 전체 그림 (6 조각) — C4에서 첫 스펙은 ①②③④
```
① 노드/엣지 스토어 (JSON)      ← 토대
② 기존 자산 시드              ← 설비·시트·이슈·작업·문서·태그를 그래프로
③ 순회·경로추적 + 근거체인 조회 API
④ 그래프 시각화 (force 그래프, 도면관리 UI 통합)  ← C5
─────────────── 첫 스펙 경계 ───────────────
⑤ 서비스·툴 라우팅 인덱스        ← 다음 스펙
⑥ AI 자기확장 (write-back, 정합성·검증 게이트)  ← 다음 스펙
```

---

## 2. 설계 §1·§2 (제시 완료, **승인 대기**)

### §1. 아키텍처 — 두 레이어 명확 분리

```
┌─ 온톨로지 (TypeDB, 큐레이트 권위) ─────────  그대로 유지
│   list_equipment / get_equipment (사람이 큐레이트한 고신뢰 설비)
│
├─ 지식그래프 (XD 내부 JSON, 신규) ──────────  AI 추출·분석·연결
│   _knowledge_graph.json  (nodes[] + edges[])
│   8000 read API + AI 툴 + force 그래프 시각화(도면관리 UI 통합)
```

- **온톨로지는 손대지 않는다.** 세션26 `f0782d9`의 `_extracted_overlay` 승격을 **되돌려** `list_equipment`를 순수 큐레이트로 복원(§6). 추출 태그는 지식그래프의 `tag` 노드로 이관.
- 지식그래프는 기존 자산을 **참조(ref_id)로 투영**하되 데이터를 복제하지 않음 — 설비 노드는 온톨로지 equipment를 가리키고, 그 위에 AI가 찾은 관계를 얹음. TypeDB 원칙(외부·선택) 그대로.
- 첫 스펙은 **읽기 전용**. 자기확장(write)·서비스 라우팅은 다음 스펙.

### §2. 노드/엣지 데이터 모델

**노드** `{id, type, ref_id, label, props}` — type ∈ `equipment · sheet · issue · task · file · tag · note`
- 앞 5개는 기존 자산 투영(ref_id로 원본 링크), `tag`=추출 태그, `note`=AI wiki 지식노트

**엣지** `{src, dst, type, confidence, track, evidence}` — track ∈ `curated · rule · llm`

| 엣지 type | 의미 | 출처 |
|---|---|---|
| `appears_on` | 설비→시트 | 온톨로지 바인딩(appears_on 계승) |
| `pinned_to` | 이슈→시트 | 이슈 핀 |
| `about` | 작업→이슈/시트 | 작업 |
| `has_tag` | 시트→태그 | sheet_meta 추출 |
| `references` | 문서→설비/시트 | 파일 |
| `relates_to` | 설비↔설비(상위/하위·전원계통) | **AI 추출** |
| `describes` | 노트→임의 노드 | **AI wiki** |

- **근거체인** = 엣지의 `evidence` + `describes` 노트 링크를 AI가 따라감
- `confidence`·`track`으로 정직성 유지(저신뢰·llm 추출은 "미검증" 표기 — 기존 D4 원칙 계승)

> **사용자 확인 대기 3점** (다음 세션 첫 질문): ①온톨로지 overlay 되돌림 ②설비 노드=복제 아닌 참조 투영 ③relates_to·note를 AI 추출 소유로.

---

## 3. 설계 §3~§7 (초안 — 미제시·미승인)

> 다음 세션에서 §1·§2 승인 후 아래를 사용자와 다듬어 확정한다. 지금은 방향 메모.

### §3. 시드 (기존 자산 → 그래프) — 조각 ②
- 소스: `ontology.list_equipment`(설비+appears_on) · `store.list_drawings/sheets`(시트) · 이슈(`routes_issue`) · 작업(`routes_task`) · 파일(`routes_files`) · `sheet_meta`(추출 tag·has_tag).
- 멱등 재빌드 스크립트 `scripts/build_knowledge_graph.py` (시드 온톨로지처럼). read-time 계산 vs 빌드타임 스냅샷은 §4에서 결정.
- **결정 필요**: 그래프를 (a) read-time에 매번 조합 vs (b) 빌드해서 `_knowledge_graph.json`에 스냅샷. 자산 규모(청주 40시트·이슈10·설비15)면 read-time도 가능하나, 시각화·순회 성능·⑥ write-back 대비 스냅샷+증분갱신이 유력.

### §4. 조회 API (순회·경로·근거체인) — 조각 ③
- `GET /api/kg/node/{id}` — 노드 + 인접 엣지.
- `GET /api/kg/neighbors?id=&types=&depth=` — N홉 이웃(순회, depth 상한).
- `GET /api/kg/path?from=&to=` — 두 노드 경로추적(BFS, 최단/전부).
- `GET /api/kg/evidence?id=` — 근거체인(엣지 evidence + describes 노트).
- `GET /api/kg/graph?scope=` — 시각화용 서브그래프(노드+엣지, 스코프 필터).
- AI 툴 신설: `kg_neighbors` · `kg_path` · `kg_evidence`(사이드카가 HTTP GET만, 격리 유지). 기존 `find_sheets_by_equipment`·`get_sheet_content`와 역할 구분 명시.

### §5. 시각화 (force 그래프, **도면관리 UI 통합** — C5) — 조각 ④
- **사용자 요구**: 별도 앱이 아니라 도면관리 시스템 UI 안에서 분석 지식을 시각화해 보고 조회.
- 프론트 신규 뷰(예: 좌측 내비 "지식그래프" 또는 시트/설비 상세의 "관계" 패널). force-directed 그래프.
- 참고 자산: xg-web T3 미니-NMS의 **Obsidian식 force 그래프**(라벨겹침0·필터·크게보기 줌/팬) — 같은 사용자, 검증된 UX 패턴. `D:\_Project\xg-web` (메모리 [[project_t3_mini_nms]]). 여기서 접근/차용 가능.
- 노드 색=type, 엣지 스타일=track(curated 실선·llm 점선), 클릭→원자산 딥링크(시트 열기·이슈 열기), 저신뢰 시각 구분.
- **결정 필요**: 통합 위치(전용 페이지 vs 상세 패널 vs 둘 다), 초기 스코프(전체 그래프 vs 노드 중심 이웃뷰).

### §6. 단계10 overlay 되돌림 (온톨로지 순수 복원) — 필수 정리
- `ontology.py`: `_extracted_overlay`·`_norm_tag`·`list_equipment(include_extracted=...)` 오버레이 제거 → `list_equipment`를 세션26 이전(순수 큐레이트)으로 복원.
- `routes_ontology.py`: 변경 없음(list_equipment 시그니처 유지 확인).
- `tests/test_s15_ontology_promote.py`: 삭제 또는 지식그래프 시드 테스트로 대체.
- 추출 태그의 "설비로서의 노출"은 지식그래프 `tag` 노드 + `has_tag` 엣지로 이관(§2).
- ⚠️ `f0782d9`가 순수 리버트는 아님(3렌즈 수리분과 섞임) — normalize/guard/tools 수리는 유지하고 **overlay만** 발라낸다. git으로 `ontology.py`의 overlay 추가분만 역적용.

### §7. 테스트
- 스토어: 노드/엣지 CRUD·멱등 시드·참조 무결성(ref_id 원자산 존재).
- 조회: neighbors depth·path BFS·evidence 체인 pytest.
- 격리/회귀: AI 사이드카 격리 유지(kg_* 툴 HTTP GET만), 기존 178+50 회귀 0.
- 시각화: vitest 컴포넌트 + 브라우저 e2e(콘솔0).

---

## 4. 다음 세션 재개 절차 (정확히 이어받기)

1. **이 문서 정독** → `brainstorming` 스킬 재장착.
2. **§2 승인 질문부터**: 위 "사용자 확인 대기 3점"을 물어 §1·§2 확정.
3. §3~§7을 순서대로 사용자와 다듬어 승인(특히 §3 스냅샷 vs read-time, §5 통합 위치).
4. 승인되면 이 문서를 **정식 스펙으로 승격**(FROZEN) → `writing-plans` 스킬로 구현계획.
5. 구현 착수(조각 ①②③④ 순). 첫 실무 = §6 overlay 되돌림 + ① 스토어.

## 5. 제약·불변식 (계승)
- TypeDB 원칙 LOCKED: 지식그래프 SoT=내부 JSON. TypeDB는 온톨로지(큐레이트)만, 외부·선택.
- AI 사이드카 격리: kg_* 툴도 8000 HTTP GET만(backend import 0).
- 정직성(D4): 엣지 confidence·track 노출, 저신뢰·llm 추출은 "미검증" 표기.
- 8000 egress 0 유지. 회귀 0.

## 6. 이번 세션 코드 상태(참고)
- S15 단계5·10·O7 + 3렌즈 수리 커밋: `05d0014`, `f0782d9`. backend 178·사이드카 50·8002 자체 7·vitest 128·build GREEN.
- S15 Acceptance 14/15 MET(O13 on만 DEFERRED — Docker 미기동). **단, 단계10(O13)은 이 트랙으로 방향 수정되므로 O13 자체가 재정의됨** — 다음 세션에서 O13/단계10 문언을 이 설계 기준으로 갱신.
