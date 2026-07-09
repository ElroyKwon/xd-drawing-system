# 지식그래프 ⑥ Write-back — 설계 스펙 (FROZEN · 2026-07-09)

> **STATUS: FROZEN.** 세션29 브레인스토밍 사용자 승인 완료. writing-plans로 구현계획 착수.
> 이 스펙 = **쓰기 트랙 ⑥**(relates_to 확인 승격 + AI 오탐 거부). 읽기 트랙 ①②③④는 세션28 구현 완료(`ff020a5`).
> HARD 불변식: TypeDB 물리분리 · AI 사이드카 격리 · 8000 egress 0 · 빌드 멱등 · 회귀 0 (§8).

---

## 0. 왜 이 트랙인가 (읽기 스펙이 이연한 것)

읽기 스펙(`2026-07-09-knowledge-graph-layer-design.md`)은 명시적으로 ⑥을 다음 스펙으로 이연했다:

- 읽기 스펙 §2③: "`relates_to`는 **승격 경로**(llm→curated). 승격의 **모델·표기만 첫 스펙, 확인 쓰기는 ⑥로 이연**."
- 읽기 스펙 §5(⑥): "AI 자기확장 (write-back, 승격 확인 쓰기·검증 게이트) ← 다음 스펙."

세션28에서 읽기 그래프는 `track` 필드(rule/curated/llm)와 점선/실선 표기까지 갖췄다. 이 스펙은 그 위에 **사람이 AI 제안(track=llm)을 확인·거부하는 쓰기 경로**를 얹는다.

### 핵심 긴장 — 멱등 재빌드가 승격을 지운다

`scripts/build_knowledge_graph.py`는 스냅샷(`uploads/_knowledge_graph.json`)을 **통째로 재생성**한다(투영+AI, 멱등). 사람이 relates_to를 llm→curated로 확인해도, 다음 재빌드에서 원래 track으로 되돌아간다. 따라서 이 트랙의 심장은 "쓰기 API"가 아니라 **승격이 재빌드에서 살아남는 영속 구조**다.

### 현실 함정 — relates_to(llm) = 0

현재 설비 큐레이트태그(MTR-1·VCB-22.9KV…) ∩ 시트 추출태그(LV-6·TR-1201…) 겹침이 0이라, 8002 mock이 반환한 관계가 설비노드 미매핑으로 전량 드롭된다(날조 방지 = 설계대로). 실 설비 relates_to는 GATE-7 실 LLM 몫이다. 그래서 이 트랙은 **승격할 데이터가 없는 상태에서 시작**한다.

---

## 1. 공동설계 확정 사항 (세션29)

| # | 결정 | 확정 |
|---|---|---|
| W1 | 범위 경계 | **메커니즘만 (데이터 불문)** — 임의 llm 엣지를 안전 승격/거부하는 쓰기 경로만. 실 설비관계 데이터는 mock확장/GATE-7 독립 트랙이 나중에 공급 |
| W2 | 심장 아키텍처 | **오버레이 저널** `_kg_overlay.json`(append-only) + **로드타임 병합**. 빌드는 오버레이를 모름(멱등 유지) |
| W3 | 동작 범위 | **confirm + reject** 2동작. 수동 엣지추가·note편집은 이연 |
| W4 | 병합 대상 | 오버레이는 **track=llm 엣지에만** 적용. rule(기계사실)·curated(사람권위)는 보호 |
| W5 | reject 처리 | 로드 시 엣지 **목록에서 drop**(뷰·순회에서 사라짐). 저널엔 기록 남아 되돌림 가능 |
| W6 | UI | **최소 UI 포함** — canvas llm 점선 클릭 → confirm/reject 버튼 → track 즉시 육안 |
| W7 | 시연 데이터 | relates_to(llm)=0이라 **시드 스크립트**로 개발 스냅샷에 llm 엣지 1개 주입(실데이터 아님 명시) |
| W8 | 증분 재빌드 | **스코프 밖(YAGNI)** — 오버레이가 승격 생존 보장, 전량 재빌드 멱등 유지(현 규모 134노드 0.x초) |
| W9 | 인증 | actor는 `X-Actor` 헤더 옵셔널 기록. **실 인증 강제는 GATE-6 이연** |

---

## 2. 아키텍처 — 2층 분리

```
scripts/build_knowledge_graph.py  →  uploads/_knowledge_graph.json  (기계 사실, 멱등, 전량 재생성)
POST /api/kg/edge/{confirm,reject} → uploads/_kg_overlay.json        (사람 권위, append-only 저널)
kg_store._load()  →  스냅샷 로드 후 오버레이 적용 → 병합 그래프 반환  (읽기·뷰는 이것만 봄)
```

- **관심사 분리**: 빌드는 스냅샷만 쓰고, write-back은 오버레이만 쓴다. 두 주체가 같은 파일을 경쟁 쓰기하지 않는다.
- **동형 패턴**: 이 프로젝트가 아는 "빌드=기계사실 / 저널=사람권위" 구조. (세션28에서 되돌린 온톨로지 `_extracted_overlay`와는 **층이 다름** — 그건 온톨로지 표면 승격, 이건 지식그래프 내부 track 승격. 혼동 금지.)
- **물리분리 유지**: TypeDB 원칙 LOCKED. 오버레이는 XD 내부 JSON.

---

## 3. 데이터 모델

### 3.1 오버레이 스키마 `uploads/_kg_overlay.json`

```json
{
  "version": 1,
  "graphs": {
    "<project_name>": {
      "overrides": [
        {"edge_key": "eq:EQ-A|eq:EQ-B|relates_to", "action": "confirm", "actor": "khlee", "at": "2026-07-09T13:00:00Z", "reason": null},
        {"edge_key": "eq:EQ-C|eq:EQ-D|relates_to", "action": "reject", "actor": null, "at": null, "reason": "오탐 - 다른 계통"}
      ]
    }
  }
}
```

- **append-only**: 새 override는 리스트 끝에 추가. 기존 항목 수정·삭제 없음.
- **last-write-wins**: 같은 `edge_key`에 override가 여러 개면 **리스트 마지막 항목이 유효**. (되돌림 = 반대 action을 새로 append.)
- **시계 없음(빌드 규약 계승)**: `at`은 API가 요청 시각을 주입(없으면 null 허용). 스토어/병합 로직은 `at`을 읽지 않는다(순서는 리스트 위치로 결정).

### 3.2 엣지 식별키 `edge_key`

- 형식: `"{a}|{b}|relates_to"` — relates_to는 **무방향**이므로 `a, b = sorted([src, dst])`로 정규화(A↔B 동일 키).
- relates_to 외 엣지(has_tag·appears_on·references 등)는 write-back 대상이 아니므로 키를 만들지 않는다.

### 3.3 track 상태

| track | 의미 | 표기 | write-back 대상 |
|---|---|---|---|
| `rule` | 기계 결정(투영) | 실선 | ✗ (보호) |
| `curated` | 사람 권위(온톨로지·**confirm 승격**) | 실선 | ✗ (이미 권위) |
| `llm` | AI 제안·미검증 | 점선 | **✓ confirm/reject 대상** |
| `rejected` (신규) | 사람이 오탐 판정 | 로드 시 drop | (저널 기록만) |

---

## 4. 병합 규칙 (핵심 안전성)

`kg_store`가 스냅샷을 로드한 뒤 오버레이를 적용해 병합 그래프를 만든다. 순서:

1. 프로젝트 스냅샷 그래프 로드(`nodes`, `edges`).
2. 프로젝트 오버레이 로드. 각 `edge_key`에 대해 **마지막 override**만 취함(last-write-wins) → `{edge_key: action}` 맵.
3. 각 엣지 순회:
   - `track != "llm"` → 오버레이 **무시**(rule·curated 보호).
   - `track == "llm"` 이고 override 없음 → 그대로(점선 llm).
   - `track == "llm"` + `confirm` → 엣지 `track`을 `curated`로 치환.
   - `track == "llm"` + `reject` → 엣지를 **결과 목록에서 제외**(drop).
4. **Dangling 무시**: override의 `edge_key`가 현재 스냅샷 어느 엣지와도 안 맞으면(재빌드로 그 llm 엣지가 사라짐) 조용히 무시. 무결성 게이트(`check_integrity`)가 dangling override를 경고로 리포트하되 로드는 실패시키지 않는다.

> **불변식**: 병합은 **읽기 경로에서만** 일어난다. 스냅샷 파일 자체는 write-back으로 변경되지 않는다. 재빌드는 항상 오버레이 없는 순수 스냅샷을 만들고, 병합은 그 위에 얹힌다 → 승격이 재빌드에서 생존.

---

## 5. API 표면 (쓰기 2개, 읽기 트랙과 분리)

`routes_kg.py`는 읽기 전용을 유지하고, **쓰기 라우트는 신규 파일**(예: `routes_kg_writeback.py`)로 분리해 격리 경계를 명확히 한다.

- `POST /api/kg/edge/confirm`
  - body `{project_name, src, dst}`
  - 검증: 병합 전 스냅샷에서 `edge_key`(정규화) 엣지가 **존재하고 `track=="llm"`** 인지 확인. 아니면 **400**(존재X/이미 curated/rule 대상 아님 등 명확한 message).
  - 성공: 오버레이에 `{edge_key, action:"confirm", actor, at}` append → `{ok:true, edge_key, new_track:"curated"}`.
- `POST /api/kg/edge/reject`
  - body `{project_name, src, dst, reason?}`
  - 검증: 동일(track=="llm").
  - 성공: `{edge_key, action:"reject", actor, at, reason}` append → `{ok:true, edge_key, hidden:true}`.
- **actor**: `X-Actor` 요청 헤더에서 읽어 기록(없으면 null). 인증 강제 없음(GATE-6 이연).
- **egress 0 유지**: 이 라우트는 8000 로컬 파일 쓰기만. 외부 호출 없음.

---

## 6. UI (최소, 육안검수용)

`src/KnowledgeGraphView.tsx` canvas에 엣지 상호작용 추가:

- **엣지 히트테스트**: 클릭 좌표에서 가장 가까운 엣지 선분 검출(임계 거리). 선택된 엣지 하이라이트.
- **조건부 버튼**: 선택 엣지의 `track=="llm"` 일 때만 `[confirm] [reject]` 버튼 노출(다른 track은 정보만).
- **동작**: 버튼 → `src/api/kg.ts`의 `confirmEdge`/`rejectEdge` 호출 → 성공 시 그래프 refetch → confirm은 실선(curated 색)으로, reject는 사라짐을 **즉시 육안**.
- 기존 뷰 관례(`BuildSheetsView.tsx` 헤더·상태·스타일) 계승.

---

## 7. 시연용 시드 (relates_to(llm)=0 대응)

- `scripts/seed_demo_llm_edge.py` — 개발 스냅샷(`_knowledge_graph.json`)의 지정 프로젝트에 **두 설비 노드 사이 relates_to(track=llm) 엣지 1개를 주입**한다. 육안검수·UI 시연 전용.
- **실데이터 아님을 명시**: 스크립트 상단 docstring + 주입 엣지 `props: {"demo_seed": true}`. mock확장/GATE-7 트랙이 실 relates_to를 공급하면 시드는 불필요.
- 시드는 스냅샷을 건드리므로, 재빌드하면 사라진다(정상 — 시연 후 재빌드로 청소).

---

## 8. HARD 불변식 (회귀 게이트)

1. **빌드 멱등 유지** — write-back은 `build_knowledge_graph.py`를 변경하지 않는다. 재빌드는 여전히 오버레이 없는 순수 스냅샷.
2. **track=llm 외 보호** — rule·curated 엣지는 오버레이로 절대 변경되지 않는다(테스트로 가드).
3. **읽기 API 표면 불변** — 병합은 `kg_store` 내부. `routes_kg.py`의 기존 5 라우트 응답 계약 유지(track이 curated로 바뀌거나 reject 엣지가 빠지는 것 외 형태 동일).
4. **8000 egress 0** — 쓰기 라우트는 로컬 파일 I/O만.
5. **회귀 0** — 세션28 기준선(프론트 vitest 135 · 백엔드 196 · AI 50 · 8002 8) 전부 유지 + 신규 테스트 추가.

---

## 9. 스코프 밖 (명시적 이연)

- **증분 재빌드(delta)** — YAGNI. 오버레이가 승격 생존을 보장하고 전량 재빌드가 멱등·저비용.
- **수동 엣지 추가 / note 편집** — 사람이 새 relates_to 저작하거나 note를 고치는 것은 다음 트랙.
- **실 인증(GATE-6)** — actor 기록만, 인증·권한 강제 없음.
- **mock 확장 / GATE-7 실 LLM** — 실 relates_to(llm) 데이터 공급은 독립 트랙. 이 스펙은 데이터 불문 메커니즘만.
- **⑤ 서비스·툴 라우팅 인덱스** — 별도 스펙.

---

## 10. 테스트 전략

**백엔드 (`kg_store` + 쓰기 라우트)**
- 오버레이 append·last-write-wins(같은 edge_key 반대 action 순차 → 마지막 유효).
- 병합: confirm → track=curated · reject → 엣지 drop · track=llm 아닌 엣지에 override → 무시(보호).
- dangling override 무시(스냅샷에 없는 edge_key) + 무결성 경고.
- 검증 400: 존재X 엣지 confirm · track=curated 엣지 confirm.
- **재빌드 후 승격 생존**: 오버레이 confirm → 스냅샷 재빌드(순수) → 병합 로드 시 여전히 curated.
- edge_key 무방향 정규화(A↔B 동일 키).

**프론트 (`KnowledgeGraphView` + `api/kg.ts`)**
- 엣지 선택 상태 · 버튼 표시 조건(llm만) · confirm/reject 호출 후 refetch.

**통합 스모크**
- 시드 스크립트로 llm 엣지 1개 → confirm API → graph 조회에서 curated 확인 → reject 다른 엣지 → 조회에서 사라짐.

---

*작성: 세션29(2026-07-09). 진입점 = 이 스펙 → writing-plans 구현계획 → subagent-driven 구현.*
