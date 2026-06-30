# PROGRESS — 실동작 빌드아웃 루프

> 매 재진입 시 `LOOP.md` → `PLAN.md` → 이 파일 순으로 읽고 이어받는다.

## 현재 상태 (2026-06-30, 세션 8 — S6 Build 홈 위젯 실데이터 + 전역 검색 DONE)

- **단계**: **S6 DONE.** 메타프롬프트 `prompts/08-s6-home-search.md` FROZEN(AskUserQuestion 4결정: **미구현 위젯 정직한 빈 상태 · 카운트+이슈 분석 차트[신규 의존성 0] · 백엔드 `/api/search`+상단 전역검색 · 검색 대상 시트+이슈+파일/폴더 전부**). acceptance **I1~I14 전부 MET**(EVIDENCE 하단 S6 reconcile).
- **구현 요약**: 백엔드 `routes_search.py` 신설(`GET /api/search` 시트·이슈·파일·폴더 교차 부분일치+딥링크 식별자+상한/truncated, read-only seed=False), `main.py` 등록, `store.list_folders` seed 파라미터. 프론트 `homeStats.ts` 신설(순수 집계), `BuildHomeView` 재작성(인라인 하드코딩 제거→실데이터 집계+정직한 빈 상태+경량 SVG/CSS 이슈 차트), `GlobalSearch.tsx` 신설(상단 전역검색·디바운스·결과 패널·딥링크), `drawings.ts` `searchProject`, `BuildSheetsView`(검색 배선·딥링크·드로잉 로드 모든 섹션), `IssuesView` focusIssueId·`FilesView` focusFolderId.
- **게이트(전부 PASS)**: build · npm test **91** · pytest **68**(S6 검색 7) · git diff --check clean.
- **브라우저 e2e(device)**: 홈 개요 실데이터(시트15·파일7·폴더11·저장 26.7MB·진행중 이슈3·최근활동 실업로드)·종합 이슈 차트·정직한 빈 상태 + 전역 검색(EE→시트2+파일2·케이블→이슈·Drawings→폴더·plan→시트3+파일1) + 딥링크(시트→뷰어/이슈→이슈탭+선택/폴더→파일+폴더). 콘솔 0. 스크린샷 `evidence/s6-01~04`.
- **독립 검증팀 3렌즈**: 백엔드 적대적(**MAJOR**=GET 검색이 폴더 seed 부작용)·프론트 비기능/a11y(조건부 MAJOR=홈 active vs 이슈탭 전체 카운트, MINOR a11y/정리)·Done-When 비평가(I1~I14 MET·침묵 좁힘 0). **MAJOR seed 수리·재검증**(seed=False, 라이브 phantom→folders:[], 회귀 1) + 프론트 MINOR 수리(미사용 import·indexOf·combobox ARIA·검색 name).

### 세션 8 진입점 (S6 이후)
- `prompts/08` FROZEN·I1~I14 MET·커밋 완료. 다음 = **S7**(인증/RBAC + 프로젝트/구성원 영속, prompts/09 작성부터 — 프로덕션 auth는 HUMAN_GATE, 로컬 범위). 재기동법은 세션6 블록과 동일.

---

## 이전 상태 (2026-06-30, 세션 8 — S5 이슈 영속+핀 연계 검증 마무리 DONE)

- **단계**: **S5 DONE.** 세션 7 구현+부분검증 → 세션 8에서 이월분(H7·H10 e2e·독립 3렌즈·reconcile·커밋) 마무리. 메타프롬프트 `prompts/07-s5-issues-pins.md` FROZEN(4결정: **독립 Issue 엔티티 · ACC식 상태 4종+메타 · 양방향 점프 · 핀 선택적+S4 좌표계**). acceptance **H1~H13 전부 MET**(EVIDENCE 하단 S5 reconcile).
- **구현 요약**: 백엔드 `store.py`(이슈 CRUD Json·TypeDB+`_issues.json`, soft delete, 상태머신/핀좌표/카테고리집계), `routes_issue.py` 신설(prefix `/api/issues` — 도면 라우트 경로충돌 회피), `schema/04-drawings.tql`(issue entity), `main.py` 등록. 프론트 `drawings.ts`(Issue API), `IssuesView`(전역 실데이터·필터·검색·작성·상태변경·핀 딥링크), `IssueAddPanel`(실집계+시트 이슈목록), `IssueCreateForm`·`IssueDetailPanel` 신설, `VectorCanvas`(world 핀)·`MarkupCanvas`(image 핀), `SheetViewerShell`(이슈 배선·focusIssue), `BuildSheetsView`(딥링크).
- **게이트(전부 PASS)**: build · npm test **83** · pytest **61**(S5 10 = 세션7 8 + 세션8 회귀 2) · git diff --check clean.
- **브라우저 e2e(device)**: 세션7 H1~H6·H8·H12(실 DXF world 140819.7,36724.7) + **세션8 H7**(무핀 전역 이슈 pin:null) + **H10**(PDF 단선결선도 image 핀 [0.5,0.5] 생성·영속·새로고침 복원·딥링크). 콘솔 0. 스크린샷 `evidence/s5-01~04`.
- **독립 검증팀 3렌즈**: 백엔드 적대적(**MAJOR-1**=PATCH 핀-위치 불변식 미검증 + MINOR world핀 비유한 수락)·프론트 비기능/a11y(MINOR 딥링크 focus 잔존 등)·Done-When 비평가(H1~H13 MET, 침묵 좁힘 0). **MAJOR-1+H12위협 MINOR+프론트 딥링크 MINOR 수리·재검증**(라이브 부유핀 PATCH→400·유령시트→404, 회귀 2 추가).

### 세션 8 진입점
- `prompts/07` FROZEN·H1~H13 MET·커밋 완료. 다음 = **S6**(Build 홈 위젯 실데이터+전역 검색, prompts/08 작성부터). 재기동법은 세션6 블록과 동일(XD_STORE=auto/json, backend .venv python uvicorn 8000, npm run dev 5173).

---

## 이전 상태 (2026-06-29, 세션 6 — S4 마크업·측정·시트비교 DONE)

- **단계**: **S4 DONE.** 뷰어 affordance(마크업·측정·시트비교)를 실동작+영속으로 교체. 메타프롬프트 `prompts/05-s4-markup-measure-compare.md` FROZEN, acceptance **E1~E13 전부 MET**(EVIDENCE 하단 S4). **미커밋**(diff --check clean, 커밋은 사용자 지시 시).
- **freeze 4결정 반영**: (Q1)마크업+측정+비교 한 스테이지 · (Q2)벡터 world + PDF 정규화 이중트랙(coord_space) · (Q3)측정 DXF 자동(doc.units)만·PDF 제외 · (Q4)클라 색상오버레이 + 백엔드 픽셀 diff 둘 다.
- **구현 요약**: backend `store.py`(markup/measurement CRUD Json·TypeDB+`_markups.json`/`_measurements.json`), `vector.py`(`$INSUNITS`→units+캐시 스키마가드), `compare.py`(PIL diff 마스크), `routes_markup.py`(신설), `schema/04-drawings.tql`(entity 추가), `/vector` no-cache. 프론트 `VectorCanvas.tsx`(world↔screen 오버레이+드로잉+측정+히트테스트), `MarkupCanvas.tsx`(PDF 정규화 SVG, draftRef), `geometry.ts`(측정 순수함수), `SheetViewerShell.tsx`(오케스트레이션), 패널 5종 실데이터, `CompareModal`/`CompareOverlay`(버전 색상합성+diff), `drawings.ts` API, `viewerData.ts` 데모 제거.
- **검증(device)**: DXF에 도형/클라우드/폴리라인/다각형/텍스트 그리기→**새로고침 복원**(world 좌표)→선택/색상편집/삭제 영속→측정 **선형 43.645m·면적 615.83㎡·지름 27.258m**(mm 자동 실척)→PDF 마크업(정규화 [0,1])·측정 비활성→plan v1/v2 비교(이전=빨강/현재=파랑 합성+투명도/스와이프 + 백엔드 diff **변경 2.00%** 마스크). 콘솔 error/warn/issue **0**. 스크린샷 `evidence/s4-01~05`.
- **게이트**: build PASS · npm test **76**(geometry 6 신규) · backend pytest **51**(S4 12 신규) · git diff clean.
- **독립 검증팀 3렌즈**: 백엔드 적대적(PASS, MINOR 2=TypeDB 그래프 drift 무해)·프론트 코드(PASS 조건부, **MAJOR-1 적발**=VectorCanvas 클릭선택 client/local 좌표혼용)·Done-When 비평가(E1~E13 MET·NARROWED 0). **MAJOR-1+MINOR-2/3 수리·재검증**(캔버스 클릭선택 복구 device 확인, 무한스피너 차단, 리스트 coord_space 일치), E5 지름 device 보강, 콘솔 정리(willReadFrequently+select name).
- **자체 적발·수리 실버그**: 벡터 캐시 units 누락(스키마가드)·이미지 CORS 캐시충돌(cors=1+no-cache)·MarkupCanvas stale클로저(draftRef)·setPointerCapture throw(try/catch).
- **남은 위험(비차단)**: TypeDB 그래프 직접적재(JSON 미러 SoT)·CompareOverlay 다해상도 stretch정렬·수동 캘리브레이션/PDF측정·이슈 영속=S5.

### 세션 6 진입점
- `prompts/05` FROZEN·E1~E13 MET. 다음=**S5 이슈 영속+뷰어 핀 연계**(마크업↔이슈, `IssuesView`·`IssueAddPanel`·`demoIssuePins` 실동작). prompts/07 작성부터.

---

## 이전 상태 (2026-06-29, 세션 5 — S2.5 멀티페이지 스케일 강건화 DONE)

- **단계**: **S2.5 DONE.** 실측(제주 BESS 68p/94MB 전기도면)으로 도출한 스케일 부채 3건 해소. 메타프롬프트 `prompts/06-s2_5-multipage-scale.md` FROZEN, acceptance **F1~F10 전부 MET**(EVIDENCE 하단 S2.5). **미커밋**(diff --check clean, 커밋은 사용자 지시 시).
- **공동설계 freeze**: P1=라벨앵커+폴백 · P2=클라 페이지네이션(50/페이지) · P3=용량 가시화(현행 보관 유지).
- **실측 before→after(동일 도면)**: 시트번호 추출 **0%→98%(67/68)** · 고유제목 1→67 · 공종 100%G→67 E(전기) · storage_bytes None→118MB 노출.
- **구현 요약**: backend `sheet_meta.py`(좌표 라벨앵커 `_spatial_value`/`_spatial_number`/`_spatial_title` — `DWG NO`/`DWG. TITLE` 바로 아래 값 공간 페어링, `get_text` 순서 비의존 + 다중토큰 공종 `_discipline`[ESS-EE-DWG→E] + 멀티페이지 `_title` + 날짜 가드), `conversion.py`(`_page_lines`로 dict 라인 추출→전달), `routes_drawing.py`(`_storage_bytes`+`_with_urls` 노출). 프론트 `SheetsListView.tsx`(클라 페이지네이션 50/페이지·필터 리셋·경계), `FilesView.tsx`(크기=원본+파생), `drawings.ts`(storage_bytes), 옛 countLabel 정리.
- **검증**: build PASS · npm test **70**(페이지네이션 5 추가) · backend pytest **39**(S2.5 11) · git diff clean · 브라우저 e2e(제주 68p→실 번호/제목/공종·페이지네이션 81개 2페이지·용량 118.8MB·콘솔 0, 스크린샷 `evidence/s2_5-*.png`).
- **독립 검증팀 3렌즈**: 백엔드 적대적(F1·F2·F3·F7 실데이터 PASS, **MAJOR-1 적발**=단일파일 제목 좌표우회 F4 회귀)·프론트 비기능(F5·F6·F8·F9 PASS, MINOR a11y)·Done-When 비평가(F1~F10 MET). **MAJOR-1 수리**(좌표 제목 `if lines and multipage:`로 멀티페이지 한정, 청주 5개 단일파일 제목=stem device 재검증·F4 회귀 0) + MINOR-4(날짜 둔갑 가드) 수리·회귀 테스트 2건 추가.
- **잔여 후속 부채**(비차단): 멀티벤더 양식 날짜/노이즈 오염·below창·공종 첫글자폴백 오분류 · 용량 stat rglob 캐시 · 페이저 aria-live · OCR/스캔 PDF.

### 세션 5 진입점
- `prompts/06-s2_5-multipage-scale.md` FROZEN. 다음=S4(마크업·측정·비교, `prompts/05` 이미 FROZEN).

---

## 이전 상태 (2026-06-25, 세션 4 — S3 파일/폴더 관리 DONE)

- **단계**: **S3 DONE.** 폴더 트리 CRUD + 명시적 버전세트 + 권한 메타(표시·편집) + 다운로드/삭제. 정적 `buildFilesData` 11폴더 시드 제거 → 백엔드 seed-on-create(ACC 기본 9폴더+PDFs). 메타프롬프트 `prompts/04-s3-files-folders.md` FROZEN, acceptance **D1~D9 전부 MET**(EVIDENCE 하단 S3 섹션). **미커밋(이 세션에서 커밋 예정).**
- **공동설계 4결정(freeze)**: 권한=메타+표시까지(인증/RBAC 강제는 S7) · 영속=DrawingStore 확장(folder 엔티티+drawing.folder_id, Json·TypeDB 양 백엔드) · 버전=명시적 버전세트(보관·이력·최신 1행) · 폴더 시드=백엔드 seed-on-create.
- **구현 요약**: backend `store.py`(folder CRUD+버전세트 `add_version`/`list_versions`/`delete_drawing`+`list_drawings(folder_id,latest_only)`, TypeDB는 _MIRROR 위임), `routes_files.py`(신설 폴더 CRUD), `routes_drawing.py`(`/versions`·`/download`·DELETE·folder_id·share 상속). 프론트 `drawings.ts`(folder/version/download API+`Folder`·`share_status` 타입), `FilesView.tsx`(전면 개편: 실 폴더트리·CRUD·폴더 타깃 업로드·실데이터 테이블·행메뉴·버전이력 모달·공유 편집), `buildFilesData.ts` 삭제.
- **검증**: build PASS · npm test **65**(FilesView 8 추가) · backend pytest **28**(S3 13) · git diff clean · 브라우저 e2e(seed트리·폴더생성·폴더타깃 업로드·버전 v2+이력·다운로드·삭제·콘솔0, 스크린샷 `evidence/s3-*.png`).
- **독립 검증팀 3렌즈**: 백엔드 적대적(BLOCKER-1 레거시 버전 중복·MAJOR-2 version_no 경합·MAJOR-3 PATCH parent 미검증·MINOR-4 delete depth 적발)·프론트 비기능(D7 파일 공유 대리표시·편집UI 부재 적발)·Done-When 비평가(D7 NARROWED). **전부 수리·재검증**(회귀 테스트 6건 추가, e2e 재확인).
- **남은 위험**(비차단): 설명 컬럼 placeholder(Drawing description 모델 부재) · TypeDB folder 직접쿼리화 후속 · 파일 단위 공유 override(현재 폴더 상속) · 인증/RBAC 강제=S7.

### 세션 4 진입점 (S3 메타프롬프트)
- `prompts/04-s3-files-folders.md` FROZEN(공동설계 4결정). 다음=S4(마크업·측정·비교 실연산+영속).

---

## 이전 상태 (2026-06-25, 세션 3 — S2 시트 레지스터 DONE)

- **단계**: **S2 DONE.** PDF 페이지 분할→시트 목록 실데이터 완전 교체 + 타이틀블록 휴리스틱(번호/제목/공종+폴백) + paperspace 다중 분리. 메타프롬프트 `prompts/03-s2-sheet-register.md` FROZEN, acceptance **C1~C8 전부 MET**(EVIDENCE 하단 S2 섹션). **커밋 `877518d`.**
- **구현 요약**: backend `sheet_meta.py`(휴리스틱 추출), `conversion.py`(PDF 페이지 분할 메타·paperspace 분리·Sheet 메타필드), `GET /api/drawings` `_with_urls`(png_url 부여·png_path 제거). 프론트 `BuildSheetsView`(실데이터 fetch+poll·정적 시드 제거·공종 필터·자연정렬), `drawingsToSheets`, `SheetDisciplineCode` string화.
- **검증**: build PASS · npm test **57** · backend pytest **15** · git diff clean · 브라우저 e2e(8p PDF→8시트 C1·EE-01-006 추출 C2·실데이터 교체 C3·공종필터 C4·시트열기 실 PDF 렌더 C6·콘솔 0 C8, 스크린샷 `evidence/s2-*.png`).
- **독립 검증팀 3렌즈 통과**: 백엔드 적대적(C1·C2·C5·C7)·프론트 비기능(C3·C4·C6·C7·C8)·Done-When 비평가(C1~C8 MET). BLOCKER 0. MAJOR 1(휴리스틱 장비태그 노이즈) + MINOR(png_path 노출·select name·stale 필터) **수리·재검증 완료**(pytest 15).
- **버그 수정**: 목록 API png_url 누락→뷰어 정적폴백(브라우저 적발) `_with_urls`로 수정.
- **남은 위험**: 멀티페이지 번들 대부분 Page N 폴백(휴리스틱 취약, freeze 수용) · 빈 paperspace=modelspace 단일(자동분할 후속) · 버전 S3 · TypeDB 직접쿼리 후속.

### 세션 3 진입점 (S2 메타프롬프트)
- `prompts/03-s2-sheet-register.md` FROZEN(공동설계 3결정: 순수레지스터+paperspace·실데이터 완전교체·타이틀블록 휴리스틱).

---

## 이전 상태 (2026-06-25, 세션 3 — S1.5 렌더 bake-off DONE)

- **단계**: **S1.5 DONE.** 2-way 렌더 bake-off(①하이브리드 래스터 PNG vs ②오픈소스 벡터 canvas2D) 풀 구현 + 승자(②벡터) 채택 전환. 메타프롬프트 `prompts/02-s1_5-render-bakeoff.md` FROZEN, acceptance **B1~B7 전부 MET**(EVIDENCE 하단 S1.5 섹션). **커밋 `2284512`.**
- **구현 요약**: backend `vector.py`(ezdxf recording 백엔드로 폭넓은 엔티티 추출→JSON: LINE/LWPOLYLINE/ARC/CIRCLE/ELLIPSE/TEXT/MTEXT/INSERT 중첩/HATCH/DIMENSION) + `/api/drawings/{id}/vector`(캐시·FileResponse·traversal 방어·PDF 400) + `dxf_path` 영속. 프론트 `VectorCanvas.tsx`(canvas2D 무손실 줌·팬·핏·레이어 토글·어두운 CAD 배경) + `SheetViewerShell` 엔진 토글(승자=벡터 기본, ①래스터 보존).
- **검증**: `npm run build` PASS · `npm test` **56 PASS** · backend `pytest` **6 PASS** · `git diff --check` clean · 브라우저 end-to-end(벡터 기본 렌더·무손실 줌·레이어 토글·래스터 토글·콘솔 0, 스크린샷 `evidence/s15-*.png`).
- **독립 검증팀 3렌즈 통과**: 백엔드 적대적(B1·B2·B4·B6 PASS)·프론트 비기능(B3·B5·B6·B7 PASS)·Done-When 비평가(B1~B7 MET, Q1~Q3 준수, narrowing 0). BLOCKER/MAJOR 0. 검증 부채 3건(B2 회귀 강화·500 경로노출·비원자 캐시) **수리·재검증 완료**.
- **bake-off 결론**: ②벡터 승자(무손실 줌+레이어 토글+벡터 인터랙션, 둘 다 비종속이라 채택이 게이트 무관). ③APS는 사용자 결정으로 **전략상 배제**(평가 안 함).
- **남은 위험**: 벡터 JSON ~8.5MB(텍스트 path 多) 최적화 후속 · 벡터 위 마크업/측정 좌표연동 = S4 · canvas2D 초대형 도면 offscreen 캐시 후속.

### 세션 3 진입점 (S1.5 메타프롬프트)
- `prompts/02-s1_5-render-bakeoff.md` FROZEN(공동설계 3결정: APS 제외 2-way·폭넓은 커버리지·승자 채택 전환).

---

## 이전 상태 (2026-06-25, 세션 2 — S1 walking skeleton 동작 완료)

- **단계**: **S1 업로드→변환→뷰어 walking skeleton 동작 완료.** 실 dwg/pdf 업로드→변환→뷰어 실 도면 렌더 end-to-end 입증. `npm run build` PASS · `npm test` **54 PASS** · backend `pytest` **2 PASS** · 브라우저 콘솔 0 · `git diff --check` clean. 메타프롬프트 A1~A8 전부 MET(증거 `EVIDENCE.md`). **미커밋.**
- **S1 구현 요약**: `backend/`(FastAPI+DrawingStore 추상화+ODA/ezdxf/PyMuPDF 변환, Study_TypeDB 이식·런타임 비의존) + 프론트(`src/api/drawings.ts`·FilesView 실업로드·MarkupCanvas 실PNG·Sheet.imageUrl).
- **독립 검증팀(2렌즈) 통과**: 적대적 엣지 + 코드리뷰가 2 BLOCKER(JSON store race 카탈로그 유실 / project_name traversal) + #7(TypeDB 미러 누락) 적발 → **전부 수정·재검증**(동시10→10/10·index valid, traversal 400, pytest 4 PASS).
- **TypeDB 활성화 완료**: typedb/typedb:3.7.3 Docker + typedb-driver 3.7.0 고정 → `store_backend=typedb`, 스키마 적용, drawing_file 실 적재·조회 확인.
- **커밋**: S1 walking skeleton=`e146fc8`. 검증 수정+TypeDB=후속 커밋.
- **남은 위험**: 나머지 2엔진(오픈소스·APS) 충실화 = S1.5. TypeDB 조회 직접 쿼리화 = S2+. paperspace 빈 DWG 시트분리 = S2.

### 세션 1 (계획 수립)
- 루프 **계획 수립 완료, S1 메타프롬프트 FROZEN**.
- **확정된 4결정**(`LOOP.md` Frozen decisions):
  1. 목표 = ACC 실기능 전체 구현(외관은 appearance-loop DONE).
  2. 백엔드 = xd 소유 독립 로컬 풀스택(Study_TypeDB 코드 이식, 런타임 비의존).
  3. 도면 렌더 = 하이브리드·오픈소스·APS 3-way bake-off 비교.
  4. 첫 슬라이스 = S1 업로드→변환→뷰어.
- **선행 근거**:
  - 현 앱 = 100% 정적 외관(의존성에 dxf/dwg/pdf/three 없음, `type=file`+FileReader 없음, viewerData 주석 "실제 드로잉/영속/연산 없음").
  - `Study_TypeDB`(`D:\_Project\Study_TypeDB`) = 동작 백엔드(FastAPI+TypeDB 3.7.3+ezdxf, 250 test PASS). 도면 API/서비스/온톨로지(`04-drawings.tql`)가 S1과 거의 일치 → **이식 소스**.
  - 변환 도구체인 검증됨: ODA File Converter(설치), ezdxf, PyMuPDF(fitz), matplotlib, Pillow.
  - 테스트 도면: `D:\_Project` 전역 dwg 822·pdf 901·dxf 25. xd 레포 내 `reference/old-prototypes/.../dwg/`에 다분야 도면.

## 다음 작업 — S1~S6 DONE, 다음은 S7

**S1**(e146fc8+f7b1a99) · **S1.5**(`2284512`) · **S2**(`877518d`) · **S3**(`dbb1b6f`) · **S2.5**(`82ae45f`) · **S4**(`0051f87`) · **S5**(`83996d9`, H1~H13 MET) · **S6**(I1~I14 MET, 3렌즈+e2e, 세션8 커밋) **완료**. 다음 진입:
- **S7 인증/RBAC + 프로젝트/구성원 영속**: 로컬 인증 + 역할(관리자·편집자·뷰어), `projectAdminData` 정적→영속, 권한 반영. 프로덕션 auth는 HUMAN_GATE(로컬 범위). prompts/09 메타프롬프트 작성부터.
- (참고) S6 후속 부채: 홈 active vs 이슈탭 전체 카운트 차이(닫힘 전용뷰)·검색 퍼지/하이라이트/랭킹·차트 색맹 대응·구성원/작업/브리지/양식/날씨/진행률 백엔드.
- (참고) S5 후속 부채: 삭제됨 이슈 편집·"열린 이슈" 탭 닫힘 노출·핀 색맹 대체·이슈 첨부/댓글/알림·TypeDB 그래프 직접쿼리화·권한 enforcement(S7).
- (참고) S3 후속 부채: 설명 컬럼 실데이터·TypeDB folder 직접쿼리화·파일 단위 공유 override·인증/RBAC(S7). S2 후속: 멀티페이지 타이틀블록 강추출·빈 paperspace 자동분할.

### ⚙️ 다음 세션 재기동 방법 (중요)
1. **TypeDB 컨테이너**: `docker ps`로 `typedb-server`(typedb/typedb:3.7.3, 포트 1729) 확인. 없으면 `docker start typedb-server`(또는 Study_TypeDB README의 run 명령).
2. **백엔드**: `cd backend && XD_STORE=auto .venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000` (venv=64bit, typedb-driver==3.7.0 고정). `XD_STORE=json`이면 TypeDB 없이 폴백.
3. **프론트**: `npm run dev` (vite, 5173/5174). 백엔드 URL은 `src/api/drawings.ts` BACKEND_BASE=http://127.0.0.1:8000.
4. **검증**: `npm test`(57) · `cd backend && .venv/Scripts/python.exe -m pytest tests/`(15) · 브라우저 Build→파일→업로드→시트목록(실데이터)→시트 열기.
5. **주의**: 활성 `python`은 32비트(matplotlib 없음) — backend는 반드시 `backend/.venv/Scripts/python.exe`(64bit) 사용.

## 미해결 / 메모

- 외관 17화면 브라우저 스크린샷 전수 점검은 fork가 미완(audit 폴더 빈 상태). 외관 자체는 appearance-loop에서 DONE·52 test PASS·전 항목 MET로 검증됨. 사용자가 원하면 직접 재점검 가능.
- 마일스톤 체크리스트는 `PLAN.md` 참조. S1만 메타프롬프트 작성, S2~S8은 해당 마일스톤 진입 시 작성.
