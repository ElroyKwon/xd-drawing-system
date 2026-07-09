# 지식/관계성 메타 레이어 — 설계 스펙 (FROZEN · 2026-07-09)

> **STATUS: FROZEN.** §1~§7 사용자 승인 완료(세션27). writing-plans로 구현계획 착수.
> 첫 스펙 = **읽기 그래프**(조각 ①②③④). ⑤서비스라우팅·⑥write-back은 다음 스펙.
> HARD 불변식: TypeDB 원칙 · AI 사이드카 격리 · 8000 egress 0 · 회귀 0 (§8).

---

## 0. 왜 이 트랙이 생겼나 (사용자 방향 재정의)

세션26에서 S15 단계5·10·O7 + 3렌즈 수리를 마친 뒤, 사용자가 **단계10의 방향 자체를 재정의**했다.

- 기존 단계10 = "추출 태그를 `/api/ontology/equipment` 표면으로 **승격**(overlay)" → 커밋 `f0782d9`로 구현됨(`ontology._extracted_overlay`).
- **사용자 재정의**: 온톨로지는 TypeDB로 큐레이트 권위 그대로 두고, AI가 별개로 분석한 결과물(관계성·wiki·지식)은 **분리된 레이어**로. 결국 **에이전틱 AI의 자료 소스**로 활용하기 위한 준비.
- **핵심 제약(사용자 강조, 세션27)**: 이 레이어의 분석·결과물은 **반드시 외부 AI API를 통해 생성**한다. 결정적 백엔드 규칙이나 mock이 아니라, 실 LLM(8002 사이드카 provider)이 코퍼스를 읽고 관계·지식을 만든다.

→ 이 트랙은 `ROADMAP.md §0 A`(S15 백본1)의 연장이자 방향 수정. `prompts/20` 단계10("승격")은 **폐기**이며, 이 문서가 대체 스펙이다. 단계10 코드 `_extracted_overlay`는 §6에서 되돌린다.

---

## 1. 공동설계 확정 사항 (세션26~27)

| # | 결정 | 확정 |
|---|---|---|
| C1 | 레이어 범위 | **풀 지식레이어** = 설비관계 그래프 + 도면 자산 크로스링크 + AI wiki 지식노트 |
| C2 | 저장 뼈대 | **XD 내부 지식 스토어(JSON)** — 온톨로지(TypeDB)와 물리 분리. TypeDB 원칙(외부·선택) 준수 |
| C3 | 에이전틱 AI 활용 | **4개 전부**: ①그래프 순회·경로추적 ②근거체인 조회 ③서비스·툴 라우팅 ④지식 축적·자기확장 |
| C4 | 첫 스펙 경계 | **A. 읽기 그래프 먼저** = ①②③④(스토어+시드+순회/근거+시각화) 읽기전용. ⑤⑥은 다음 스펙 |
| C5 | 시각화 위치 | **도면관리 UI 통합** 전용 페이지 — 지식을 모두 보고 조회(별도 앱 아님) |
| §2① | 온톨로지 overlay | **완전 되돌림** — `list_equipment` 순수 큐레이트 복원 |
| §2② | 설비 노드 | **참조 투영**(ref_id) — 데이터 복제 0, SoT는 온톨로지 |
| §2③ | AI 소유 + 승격 | `relates_to`·`note`는 AI 소유. **track으로 정직성 충분** + `relates_to`는 **승격 경로**(llm→curated). 승격의 **모델·표기만 첫 스펙, 확인 쓰기는 ⑥로 이연** |
| §3 | 시드 전략 | **통합 스냅샷 + 멱등 재빌드**(`_knowledge_graph.json`). 조회=스냅샷 읽기 |
| §3b | AI 생성 경로 | **기존 8002 사이드카 확장**(신규 `/analyze`) — 외부 AI API가 relates_to·note 생성 |
| §5 | 시각화 스코프 | **전용 페이지 + 전체그래프**(xg-web식 force). 상세패널 임베드는 이연 |

### 전체 그림 (6 조각) — 첫 스펙은 ①②③④
```
① 노드/엣지 스토어 (JSON)                     ← 토대
② 기존 자산 시드 + 외부 AI API 관계·지식 생성   ← 8002 /analyze
③ 순회·경로추적 + 근거체인 조회 API
④ 그래프 시각화 (force, 도면관리 UI 전용 페이지)
─────────────── 첫 스펙 경계 ───────────────
⑤ 서비스·툴 라우팅 인덱스        ← 다음 스펙
⑥ AI 자기확장 (write-back, 승격 확인 쓰기·검증 게이트)  ← 다음 스펙
```

---

## 2. 아키텍처 — 두 레이어 명확 분리

```
┌─ 온톨로지 (TypeDB, 큐레이트 권위) ─────────  그대로 유지
│   list_equipment / get_equipment  (사람이 큐레이트한 고신뢰 설비)
│
├─ 지식그래프 (XD 내부 JSON, 신규) ──────────  AI 추출·분석·연결
│   data/<project>/_knowledge_graph.json  (nodes[] + edges[])
│   8000 read API(/api/kg/*) + kg_* AI 툴 + force 그래프 전용 페이지
│                              ↑ AI 엣지 생성 = 8002 사이드카(외부 AI API)
```

- **온톨로지는 손대지 않는다.** `f0782d9`의 `_extracted_overlay` 승격을 **되돌려** `list_equipment`를 순수 큐레이트로 복원(§6). 추출 태그는 지식그래프 `tag` 노드로 이관.
- 지식그래프는 기존 자산을 **참조(ref_id)로 투영**하되 데이터 복제 0 — 설비 노드는 온톨로지 equipment를 가리키고, 그 위에 AI가 찾은 관계를 얹는다.
- 첫 스펙은 **읽기 전용**. 자기확장(write)·서비스 라우팅·승격 확인 쓰기는 다음 스펙.

### 데이터 모델

**노드** `{id, type, ref_id, label, props}` — type ∈ `equipment · sheet · issue · task · file · tag · note`
- 앞 5개는 기존 자산 투영(ref_id로 원본 링크), `tag`=추출 태그, `note`=AI wiki 지식노트

**엣지** `{src, dst, type, confidence, track, evidence}` — track ∈ `curated · rule · llm`

| 엣지 type | 의미 | 출처 | track |
|---|---|---|---|
| `appears_on` | 설비→시트 | 온톨로지 바인딩 계승 | curated |
| `pinned_to` | 이슈→시트 | 이슈 핀 | rule |
| `about` | 작업→이슈/시트 | 작업 | rule |
| `has_tag` | 시트→태그 | sheet_meta 추출 | rule |
| `references` | 문서→설비/시트 | 파일 | rule |
| `relates_to` | 설비↔설비(상위/하위·전원계통) | **외부 AI API** | **llm**(→승격 시 curated) |
| `describes` | 노트→임의 노드 | **외부 AI API(wiki)** | **llm** |

- **근거체인** = 엣지의 `evidence` + `describes` 노트 링크를 AI가 따라감.
- `confidence`·`track`으로 정직성 유지(저신뢰·llm 추출은 "미검증" 표기 — D4 계승).
- **승격 경로(설계만, 쓰기는 ⑥)**: `relates_to`는 `track=llm`으로 시드되어 뷰에서 "제안됨/미검증" 점선. 사람이 확인하면 `track=curated`로 승격 — 이 **확인 쓰기 동작은 ⑥ write-back 스펙**. 첫 스펙은 모델(track 필드)·표기(점선·저신뢰 구분)만 갖춘다.
- `note`는 승격 경로 없이 AI 주석으로 유지.

---

## 3. 시드 + 외부 AI API 생성 (조각 ②)

**통합 스냅샷 + 멱등 재빌드.** `scripts/build_knowledge_graph.py` 하나가 전 그래프를 `data/<project>/_knowledge_graph.json`에 굽고, 조회 API는 스냅샷만 읽는다. 재빌드는 온톨로지 시드처럼 멱등(재실행 = 동일 결과). 증분/자동 갱신은 ⑥로 이연.

빌드 오케스트레이션:
1. **투영 엣지·노드**(결정적, AI 아님) — 8000 GET에서:
   - `ontology.list_equipment`(설비 + `appears_on`) → equipment 노드 + appears_on 엣지
   - `store.list_drawings`/sheets → sheet 노드
   - 이슈(`/api/issues`) → issue 노드 + `pinned_to`(핀 있을 때)
   - 작업(`/api/tasks`) → task 노드 + `about`
   - 파일(`/api/drawings`/folders) → file 노드 + `references`
   - `sheet_meta`(추출 태그) → tag 노드 + `has_tag`
2. **AI 엣지·노드**(외부 AI API) — **8002 사이드카 신규 `POST /analyze`** 호출:
   - 입력: 코퍼스(시트 본문색인·설비 목록·추출 태그). 8002가 8000에서 독립 GET(격리 유지).
   - provider = `OpenAIExtractProvider`(실 LLM, HUMAN_GATE-7 `XD_EXTRACT_LLM=1`+키) / 기본 `MockExtractProvider`(결정적·egress 0).
   - 출력: `relates_to` 후보(설비쌍 + confidence + evidence) + `note`(wiki 지식 + describes 대상). 전부 `track=llm`.
   - **mock 기본**이면 결정적/최소 관계 → egress 0 유지. 실 LLM 켤 때만 진짜 관계·지식 생성.

**참조 무결성**: AI 엣지의 src/dst는 반드시 투영 노드(ref_id 존재)를 가리켜야 함 — dangling 엣지는 빌드가 거부·로그.

---

## 4. 조회 API (순회·경로·근거체인) — 조각 ③

8000 신규 라우트 `routes_kg.py`(prefix `/api/kg`), 스냅샷 읽기 전용:
- `GET /api/kg/node/{id}?project_name=` — 노드 + 인접 엣지.
- `GET /api/kg/neighbors?project_name=&id=&types=&depth=` — N홉 이웃(순회, depth 상한 방어).
- `GET /api/kg/path?project_name=&from=&to=` — 두 노드 경로추적(BFS, 최단).
- `GET /api/kg/evidence?project_name=&id=` — 근거체인(엣지 evidence + describes 노트).
- `GET /api/kg/graph?project_name=&scope=` — 시각화용 서브그래프(노드+엣지, 스코프 필터).

응답은 노드에 `track`·`confidence`를 실어 저신뢰·llm을 프론트가 구분하게 한다.

**AI 툴 신설**(`ai/tools.py` 패턴, 8000 HTTP GET만 — 격리 유지):
- `kg_neighbors` · `kg_path` · `kg_evidence`.
- 기존 `find_sheets_by_equipment`(태그 역조회)·`get_sheet_content`(본문)와 역할 구분 명시 — kg_* 는 **관계 그래프 순회**, 후자는 자산 본문·태그.

---

## 5. 시각화 (force 그래프, 도면관리 UI 전용 페이지 — C5)

- 좌측 내비 **"지식그래프" 전용 뷰** 신설. 초기 스코프 = **전체 그래프 + 필터**.
- **xg-web T3 미니-NMS의 Obsidian식 force 그래프 차용**(라벨겹침0·필터·크게보기 줌/팬) — 같은 사용자, 검증된 UX. `D:\_Project\xg-web`(메모리 [[project_t3_mini_nms]])에서 패턴 가져옴.
- 노드 색 = type, 엣지 스타일 = track(curated 실선 · llm 점선 · 저신뢰 흐리게), 클릭 → 이웃 하이라이트 + 원자산 딥링크(시트 열기·이슈 열기).
- `GET /api/kg/graph`로 서브그래프 로드, 필터(type·track·confidence 임계)로 노드 중심 이웃뷰도 흡수.
- 상세 패널(시트/설비 안 "관계" 탭) 임베드는 **이연**(YAGNI — 전용 페이지로 먼저 검증).

---

## 6. overlay 되돌림 (온톨로지 순수 복원) — 필수 정리

- `ontology.py`: `_extracted_overlay`·`_norm_tag`·`list_equipment(include_extracted=…)` 오버레이 제거 → `list_equipment`를 세션26 이전(순수 큐레이트)으로 복원.
- `routes_ontology.py`: 변경 없음(`list_equipment` 시그니처 유지 확인).
- `tests/test_s15_ontology_promote.py`: 삭제 또는 지식그래프 시드 테스트로 대체.
- 추출 태그의 "설비로서의 노출"은 지식그래프 `tag` 노드 + `has_tag` 엣지로 이관(§2).
- ⚠️ `f0782d9`는 순수 리버트 아님(3렌즈 수리분 섞임) — normalize/guard/tools 수리는 **유지**, **overlay만** 외과적으로 발라낸다. git으로 `ontology.py`의 overlay 추가분만 역적용.

---

## 7. 테스트

- **스토어**(8000): 노드/엣지 CRUD·멱등 시드·참조 무결성(ref_id 원자산 존재·dangling 거부).
- **조회**(8000): neighbors depth 상한·path BFS·evidence 체인 pytest.
- **사이드카**(8002): 신규 `/analyze` — mock provider로 relates_to·note 결정적 생성, 격리 유지(backend import 0), 실 LLM은 HUMAN_GATE-7.
- **격리/회귀**: kg_* 툴 8000 GET만, 기존 backend 178 · 사이드카 50 회귀 0.
- **시각화**: vitest 컴포넌트 + 브라우저 e2e(콘솔0).

---

## 8. 제약·불변식 (계승, LOCKED)

- **TypeDB 원칙**: 지식그래프 SoT = 내부 JSON. TypeDB는 온톨로지(큐레이트)만, 외부·선택.
- **AI 사이드카 격리**: 8002 `/analyze`도 backend import 0, 8000과 HTTP만. kg_* 툴도 8000 HTTP GET만.
- **외부 AI API 필수**: relates_to·note는 8002 provider(실 LLM)가 생성 — HUMAN_GATE-7 게이트, 기본 mock(egress 0).
- **정직성(D4)**: 엣지 confidence·track 노출, 저신뢰·llm은 "미검증" 표기.
- **8000 egress 0 유지. 회귀 0.**

---

## 9. 구현 순서 (writing-plans 입력)

1. **§6 overlay 되돌림** — 온톨로지 순수 복원(선행 정리).
2. **① 스토어** — `_knowledge_graph.json` 노드/엣지 스키마 + 로드/조회 헬퍼 + 참조 무결성.
3. **② 시드 + 8002 `/analyze`** — 투영 빌드 + 사이드카 확장(외부 AI API 관계·지식 생성).
4. **③ 조회 API** — `routes_kg.py` + kg_* AI 툴.
5. **④ 시각화** — 전용 페이지 force 그래프(xg-web 차용).
6. 각 단계 §7 테스트 통과 후 다음.

## 10. 이전 세션 코드 상태(참고)

- S15 단계5·10·O7 + 3렌즈 수리 커밋: `05d0014`, `f0782d9`, `b5d6f41`. backend 178·사이드카 50·8002 자체 7·vitest 128·build GREEN.
- 미푸시 로컬 main 커밋(push 승인 대기).
- 단계10(O13)은 이 트랙으로 방향 수정되어 재정의됨.
