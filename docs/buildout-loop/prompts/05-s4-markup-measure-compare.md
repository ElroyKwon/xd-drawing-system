# S4 — 마크업·측정·시트비교 실연산 + 영속  [STATUS: FROZEN — 2026-06-26 사용자 확인 완료]

> ai-loop 스테이지 계약. `LOOP.md`·`PLAN.md` freeze 결정과 S1(`prompts/01`)·S1.5(`prompts/02`)·S2(`prompts/03`)·S3(`prompts/04`) 결과를 상속한다. 구현 에이전트가 이 텍스트를 그대로 입력받아 자율 실행하고, **별도 검증팀이 아래 Acceptance checklist(E1~E12)로 항목별 채점**한다. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).

## Stage goal / Done-When

ACC 2D 뷰어의 **마크업(§E 일부)·측정/축척교정(§F)·시트비교(§G)** affordance를 **실동작+영속**시킨다. `SheetViewerShell`이 의존하는 정적 시드(`demoMarkups`·`measureRows`·`demoIssuePins`는 S5 소관이므로 유지)와 비기능 모달(`CalibrationModal` "교정 계산 안 함", `CompareOverlay` "정적 데모")을 실제 그리기·연산·영속으로 교체한다.

세 축:
1. **마크업** — 벡터 캔버스(S1.5 승자) 위에 실제 드래그로 마크업을 생성/선택/편집/삭제하고, 좌표를 영속(DXF=world 좌표, PDF/래스터=정규화 이미지 좌표)해 새로고침 후에도 유지된다.
2. **측정** — DXF 벡터 시트에서 `doc.units` 기반 실척으로 선형 거리·다각형 면적·지름을 **실제 연산**한다(자동 캘리브레이션). 측정 결과 영속.
3. **시트비교** — 같은 버전세트의 두 버전을 **클라이언트 정렬 오버레이(색상 합성)** 와 **백엔드 픽셀 diff 마스크** 두 방식으로 비교한다.

**완료 정의**: DXF 시트를 열어 → 마크업을 마우스로 그리고(텍스트/도형/클라우드/폴리라인/다각형) → 측정 도구로 두 점 거리·다각형 면적을 실척으로 측정하고 → 버전세트의 v1/v2를 오버레이+diff로 비교한 뒤 → 새로고침하면 마크업·측정이 그대로 복원된다. PDF 시트는 마크업(정규화 좌표)은 되고 측정은 "DXF 전용" 안내로 비활성. 콘솔 0.

## Co-design log (2026-06-26 사용자 확정 — freeze된 결정)

- **(Q1) 범위 = 마크업+측정+비교 셋 다 S4 한 스테이지.** 잘게 쪼개지 않고 한 번에 구현·한 번 검증(체크인). 충실도 우선. → PR/검증팀 채점 범위가 크다는 점 수용.
- **(Q2) 좌표계 = 벡터 world + PDF 정규화 이중 트랙.** DWG/DXF 벡터 시트는 마크업/측정 오버레이를 **VectorCanvas 위**에 얹고 좌표를 **도면 world(model) 좌표**로 영속(무손실 줌·핏·레이어 토글과 정합, 줌해도 마크업이 도면에 고정). PDF-page/래스터 시트는 **정규화 이미지 좌표(0~1)** 로 영속. 마크업 레코드에 `coord_space`(`"world"` | `"image"`) 메타를 둬 두 트랙을 구분. **VectorCanvas는 world↔screen 변환을 외부에 노출**(좌표 함수 export 또는 오버레이 자식 슬롯)하도록 확장.
- **(Q3) 측정 캘리브레이션 = DXF 자동만, PDF 측정 제외.** DXF는 `doc.units`를 읽어 model 좌표를 실척 단위로 환산해 **자동 측정**(별도 수동 캘리브레이션 불필요). `vector.py`가 `units`/`scale` 메타를 `VectorData`에 추가. PDF/래스터 시트의 측정은 S4 **범위 외**(측정 도구를 "DXF 전용" 안내로 비활성). `CalibrationModal`은 DXF 단위 표시/확인 역할로 실연결(닫기-only 제거)하되, 수동 2점 교정은 후속.
- **(Q4) 비교 = 오버레이 + 픽셀 diff 둘 다.** (a) **클라이언트 정렬 오버레이** — 두 버전의 PNG/벡터를 bbox 정렬 후 이전=빨강/현재=파랑 색상 합성 + 투명도/스와이프 슬라이더. (b) **백엔드 픽셀 diff** — 두 버전 PNG를 동일 해상도로 정규화해 픽셀 비교 → 변경 영역 마스크(diff PNG) 생성·반환, 뷰어가 변경부 하이라이트. 같은 버전세트(S3 버전체인)의 v1↔v2를 대상으로 한다.
- **(가정) 영속 = DrawingStore 확장.** 기존 `store.py` `DrawingStore`에 **markup·measurement 엔티티 CRUD**를 추가(JsonDrawingStore + TypeDBDrawingStore 양 백엔드, S1~S3 미러 패턴 계승). 마크업/측정은 `(drawing_file_id, sheet_id)` 스코프로 저장. 비교 diff 결과는 캐시(파일) — 영속 엔티티 아님(재연산 가능). TypeDB 스키마에 markup/measurement entity 추가(Study_TypeDB 04-drawings 계승, 직접쿼리화는 후속·JSON 미러 의존 유지).
- **(가정) 이슈 핀(§H)은 S5 소관.** `demoIssuePins`·`issueCategories`·`IssueAddPanel`은 S4에서 건드리지 않음(마크업↔이슈 연계는 S5). 마크업 도구레일의 "이슈 핀" 도구는 외관 유지.
- **(가정) 테스트 도면.** DXF 측정/마크업은 `reference/`·`D:\_Project` 샘플 DWG/DXF(실척 좌표 보유)로 입증. 비교는 S3 버전세트에 같은 파일 v1/v2(약간 다른 도면)를 올려 실 diff 산출. 처리 결과를 EVIDENCE에 기록(무성 절단 금지).

## Instruction (수행 단계)

1. **S4-a 백엔드 영속 모델**: `store.py` `DrawingStore`에 마크업/측정 CRUD 추가 — `add_markup`/`list_markups(file_id, sheet_id)`/`update_markup`/`delete_markup`, `add_measurement`/`list_measurements(file_id, sheet_id)`/`delete_measurement`. Json·TypeDB 두 구현. markup 메타: `markup_id`·`file_id`·`sheet_id`·`kind`(텍스트/클라우드/폴리라인/도형/다각형/펜)·`coord_space`(world|image)·`geometry`(좌표 배열·JSON)·`style`(색/두께/채움/불투명도)·`text`·`author`·`created_at`. measurement 메타: `measurement_id`·`file_id`·`sheet_id`·`type`(선형/면적/지름)·`geometry`(world 좌표)·`value`·`unit`·`created_at`. TypeDB 스키마(`schema/04-drawings.tql` 상당)에 entity 추가.
2. **S4-b 백엔드 측정/단위**: `vector.py` `extract_vector`가 `doc.units`(또는 `$INSUNITS`)를 읽어 `VectorData`에 `units`·`unit_scale`(model→meter 환산계수) 추가. 단위 미상이면 명시적 `unknown`(무성 가정 금지). 측정 자체 연산은 프론트(world 좌표 + unit_scale)에서 수행하되, 단위 메타는 백엔드 제공.
3. **S4-c 백엔드 비교 diff**: `routes_*`에 `GET /api/drawings/{file_id}/compare?against={version_or_fileid}` — 두 버전 PNG를 동일 캔버스로 정규화 후 픽셀 비교(PIL), 변경 영역 마스크 PNG 생성·캐시·반환(+변경 픽셀 비율 stat). traversal/경로 방어(S1 선례), 같은 version_set 검증.
4. **S4-d 백엔드 라우트**: 신규 `routes_markup.py`(또는 routes_drawing 확장) — `GET/POST/PATCH/DELETE /api/drawings/{file_id}/markups`, `GET/POST/DELETE /api/drawings/{file_id}/measurements`, 비교 엔드포인트. 에러계약(404/400) 일관.
5. **S4-e 프론트 벡터 오버레이 좌표계**: `VectorCanvas`가 world↔screen 변환을 외부에 노출(함수 export 또는 오버레이 자식 슬롯) + 줌/팬/핏 상태 공유. 마크업/측정 오버레이가 이 변환을 써 도면에 고정 렌더. 래스터(`MarkupCanvas`)/PDF는 정규화 좌표 경로.
6. **S4-f 프론트 마크업 그리기/영속**: 도구레일 선택 → 캔버스 드래그로 마크업 생성(텍스트/도형/클라우드/폴리라인/다각형/펜) → `POST` 영속. 시트 열 때 `GET` 로드해 복원. 선택/속성편집(`MarkupPropertyPanel` 실연결)·삭제. `MarkupListPanel`/로그 탭이 실데이터 반영. 정적 `demoMarkups`는 fallback/seed 아닌 실데이터로 대체(또는 빈 상태에서 시작).
7. **S4-g 프론트 측정 실연산**: DXF 시트에서 측정 도구 → 두 점/다각형/원 클릭 → world 좌표 + `unit_scale`로 거리/면적/지름 실척 연산 → `MeasurePanel` 실데이터 + 영속. PDF/래스터 시트는 측정 비활성("DXF 전용" 안내). `CalibrationModal`은 DXF 단위 표시/확인으로 실연결.
8. **S4-h 프론트 시트비교**: `CompareModal`에서 같은 버전세트의 다른 버전 선택 → `CompareOverlay`가 (a) 클라 색상 오버레이(투명도/스와이프 슬라이더) + (b) 백엔드 diff 마스크 하이라이트 토글 제공. "정적 데모" 주석 제거·실연결.
9. **검증**: 백엔드 pytest(마크업/측정 CRUD·world 좌표 저장·measurement 연산값·diff 마스크 생성·units 추출·traversal 방어), 프론트 test(마크업 그리기→영속→복원·측정 연산·오버레이/diff 렌더·회귀), `npm run build`·`npm test`·`git diff --check`. 브라우저 e2e(DXF: 마크업 그리기→새로고침 복원→측정 실척→v1/v2 비교 오버레이+diff / PDF: 마크업 되고 측정 비활성) 스크린샷, 콘솔 0.

## Inputs

- 프론트: `src/build/SheetViewerShell.tsx`(상태·배선), `src/build/viewer/VectorCanvas.tsx`(좌표변환 노출·오버레이), `MarkupCanvas.tsx`(래스터/정규화 경로), `MarkupToolRail.tsx`·`MarkupPropertyPanel.tsx`·`MarkupListPanel.tsx`, `MeasurePanel.tsx`·`CalibrationModal.tsx`, `CompareModal.tsx`·`CompareOverlay.tsx`, `viewer/viewerData.ts`(타입·정적시드), `src/api/drawings.ts`(클라이언트 API 확장).
- 백엔드: `backend/store.py`(`DrawingStore`·Json·TypeDB), `backend/vector.py`(units 추출), `backend/routes_drawing.py`·신규 `routes_markup.py`, `backend/conversion.py`(PNG 경로·버전), `backend/main.py`(라우트 등록), TypeDB 스키마 파일.
- 스펙: `docs/Screenshot_Feature_Catalog.md` §E·§F·§G, `docs/buildout-loop/LOOP.md` Done-When "E 2D 뷰어·F 측정·G 시트비교".
- 테스트 파일: `reference/old-prototypes/.../dwg/`·`D:\_Project` 샘플(읽기전용 → 스테이징 복사본). 비교는 S3 버전세트 v1/v2.

## Acceptance checklist (검증팀이 항목별 채점 — freeze 후 불변)

- [ ] E1. **마크업 그리기(벡터)**: DXF 벡터 시트에서 도구레일 선택 후 캔버스 드래그로 마크업(텍스트/도형/클라우드/폴리라인/다각형) 실제 생성. 정적 표시 아님.
- [ ] E2. **마크업 영속+복원(world)**: 생성한 마크업이 `POST`로 저장되고 새로고침/재진입 시 `GET`으로 복원. DXF는 world 좌표로 저장돼 줌/핏 변경에도 도면에 고정.
- [ ] E3. **마크업 선택/편집/삭제**: 마크업 선택→`MarkupPropertyPanel` 실데이터 표시·속성 편집·삭제가 영속 반영. `MarkupListPanel`/로그 탭 실데이터.
- [ ] E4. **PDF 마크업(정규화)**: PDF-page/래스터 시트에서도 마크업 그리기·영속이 정규화 이미지 좌표로 동작(coord_space=image). 줌 없는 이미지 좌표 기준 일관.
- [ ] E5. **측정 실연산(DXF 자동)**: DXF 시트에서 선형 거리·다각형 면적·지름을 `doc.units` 실척으로 실제 연산(정적 measureRows 아님). 알려진 치수 도면으로 값 타당성 확인.
- [ ] E6. **측정 영속**: 측정 결과가 저장되고 재진입 시 복원. `MeasurePanel` 실데이터.
- [ ] E7. **PDF 측정 비활성**: PDF/래스터 시트는 측정 도구가 "DXF 전용"으로 비활성/안내(무성 오작동 금지). 범위 외 명시.
- [ ] E8. **비교 오버레이(클라)**: 같은 버전세트 v1/v2를 이전=빨강/현재=파랑 색상 합성으로 정렬 오버레이 + 투명도/스와이프 슬라이더 동작. "정적 데모" 제거.
- [ ] E9. **비교 diff(백엔드)**: 백엔드가 두 버전 PNG 픽셀 비교로 변경영역 마스크 PNG 생성·반환, 뷰어가 변경부 하이라이트 토글. 같은 version_set 검증·traversal 방어.
- [ ] E10. **백엔드 영속 모델**: `store.py`에 markup/measurement CRUD(Json·TypeDB 양 백엔드), TypeDB 스키마 entity 추가. `(file_id, sheet_id)` 스코프.
- [ ] E11. **테스트 게이트**: 백엔드 pytest + 프론트 `npm test` + `npm run build` + `git diff --check` clean. 마크업 CRUD·측정 연산·diff·units 추출 커버.
- [ ] E12. **브라우저 e2e + 콘솔 0**: DXF(마크업 그리기→복원→측정→v1/v2 비교 오버레이+diff) + PDF(마크업 되고 측정 비활성) end-to-end 스크린샷, 콘솔 에러 0.

## Out of scope (S4에서 의도적으로 하지 않음)

- **이슈 영속·마크업↔이슈 핀 연계(§H)** — S5. `demoIssuePins`·`IssueAddPanel`·이슈 핀 도구는 외관 유지.
- **PDF/래스터 측정·수동 2점 캘리브레이션** — DXF 자동 측정만. PDF 측정·수동 교정은 후속.
- **마크업 실시간 협업/충돌 병합** — 단일 사용자 로컬, 동시편집 동기화 없음.
- **인증/RBAC 강제(마크업 작성자 권한 enforcement)** — S7. author 메타는 표시까지.
- **비교의 벡터 토폴로지 diff(엔티티 단위)** — 픽셀 diff + 색상 오버레이까지. 시맨틱 diff는 후속.
- TypeDB 직접 쿼리화(JSON 미러 의존 유지), AI/온톨로지(S8), APS(전략상 배제).

## Freeze 답 (사용자 확정)

1. 범위 = **마크업+측정+비교 셋 다 S4 한 스테이지**(충실 우선).
2. 좌표계 = **벡터 world + PDF 정규화 이중 트랙**(coord_space 메타, VectorCanvas 좌표변환 노출).
3. 측정 = **DXF 자동만**(doc.units 실척), PDF 측정 제외.
4. 비교 = **클라 오버레이 + 백엔드 픽셀 diff 둘 다**(같은 version_set v1/v2).

→ STATUS: FROZEN(2026-06-26). 실행·채점은 이 고정 텍스트 기준. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).
