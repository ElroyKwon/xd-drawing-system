# EVIDENCE — S1 업로드→변환→뷰어

> S1 메타프롬프트(`prompts/01-s1-upload-convert-view.md`, FROZEN) acceptance A1~A8에 대한 완료 증거. 검증팀은 이 보고 + 실제 실행으로 채점한다.

## 구현 항목

- **백엔드(xd 소유 로컬 FastAPI)** 신설 `backend/`: `main.py`(앱·CORS·`/files` 정적·`/health`), `config.py`, `store.py`(DrawingStore 추상화: JSON 폴백 + TypeDB), `conversion.py`(ODA DWG→DXF + ezdxf 시트/PNG + PyMuPDF PDF), `routes_drawing.py`(POST/GET), `schema/04-drawings.tql`(Study_TypeDB 이식).
- **이식 + 갭 보강**: Study_TypeDB `drawing_service`/`dxf_service`를 이식하되, 원본이 미구현(placeholder)이던 **DWG→DXF(ODA CLI 연동)을 신규 구현**, **paperspace 빈 경우 modelspace fallback**, **PDF(PyMuPDF) 경로**를 보강.
- **프론트**: `src/api/drawings.ts`(API 클라이언트), `FilesView`(실 업로드 input+멀티파트, 변환 폴링, 업로드 목록, 뷰어 열기), `MarkupCanvas`(imageUrl 시 실 PNG / 없으면 정적 외관), `Sheet.imageUrl` 필드, `BuildSheetsView` 연결, `s1-buildout.css`.

## 검증 실행 + 결과 (실측)

| 항목 | 결과 |
|---|---|
| `npm run build` (tsc+vite) | **PASS** (1769 modules) |
| `npm test` | **54 PASS** (기존 51 + 수정 1 + MarkupCanvas 회귀 2) |
| backend `pytest` | **2 PASS** (JSON store roundtrip, PDF 렌더 파이프라인) |
| `GET /health` | 200, store_backend=json, oda_available=true |
| PDF 업로드 end-to-end | 청주 EE-01-006 → completed, 1시트 PNG(618KB), 서빙 200 |
| DWG 업로드 end-to-end | A04.01~03 평면도 → ODA 변환(AC1032) → modelspace PNG(147KB), scan: layouts 3·layers 198·blocks 513·msp 867 entities |
| 브라우저 end-to-end | 업로드→변환완료→뷰어 → **중앙 캔버스에 실제 도면 렌더 확인**(스크린샷 `scratchpad/s1-viewer-dwg.png`), 콘솔 에러 0 |

## A6 — 렌더 3-way bake-off 비교초안

S1 합격선은 1엔진 end-to-end(확정). 1엔진 실구현 + 나머지 2엔진 접근 평가:

| 엔진 | 상태 | 충실도 | 공수 | 종속성 | 비고 |
|---|---|---|---|---|---|
| **①하이브리드** (ezdxf+matplotlib → PNG / PyMuPDF) | **구현·실측** | 중상 (래스터, R-Center 평면도 치수·심볼·텍스트·ACAD색상 정상) | 낮음 (이식+보강) | **0** (로컬, 비종속) | 줌 시 픽셀화, 벡터 인터랙션 없음, paperspace 빈 DWG는 modelspace 통짜 |
| **②오픈소스 자체** (DXF→three.js/canvas 벡터) | 미구현(평가) | 상 (벡터 줌·선택) | **높음** (엔티티별 렌더러·텍스트·해치·블록·xref 직접) | 0 (비종속) | 벡터 인터랙션·시트분리 정밀화 가능 → **S1.5** |
| **③APS Viewer** (SVF2 + Viewer SDK) | 미구현(평가) | **최상** (2D/3D, ACC 동일) | 중 (SDK 통합) | **높음** (Autodesk cloud·유료 translate·인증) | 비종속 전략 위배 → **HUMAN_GATE**, bake-off 격리 평가만 |

**초안 판정**: 로컬·비종속 walking skeleton에는 ①하이브리드가 즉효(이미 실 도면 표시 성공). 벡터 인터랙션 요구가 커지면 ②를 S1.5에서 추가 비교, ③은 게이트 승인 시 격리 평가. 3엔진 풀 비교는 S1.5.

## Done-When reconciliation (A1~A8)

| ID | 항목 | 판정 | 증거등급 |
|---|---|---|---|
| A1 | FastAPI 기동·health·CORS | **MET** | device(실서버 200) |
| A2 | Study_TypeDB 이식·런타임 비의존 | **MET** | static+device(import 0, JSON store 동작) |
| A3 | UI 업로드→POST→저장·적재 | **MET** | device(브라우저 업로드 성공) |
| A4 | 변환 DWG→DXF→시트 PNG, status 전이 | **MET** | device(ODA+ezdxf 실변환) |
| A5 | 뷰어 중앙에 실 도면 렌더 | **MET** | device(브라우저 스크린샷) |
| A6 | 렌더 bake-off 비교초안 | **MET** (1엔진 구현+2엔진 평가표; 3엔진 풀=S1.5) | device+static |
| A7 | build/npm test/pytest PASS | **MET** | device |
| A8 | 콘솔 0 + 스크린샷 증거 | **MET** | device |

NARROWED/UNMET 0. (A6는 freeze된 범위 자체가 "1엔진+비교초안"이므로 MET.)

## 독립 검증팀 (2렌즈) + 수정 — full loop

- **렌즈A 적대적 엣지**(서버 공격): 잘못된 콘텐츠는 우아(400/failed, 크래시·행 0). **2 BLOCKER 재현** — ①동시 10업로드 시 JSON store race로 `_index.json` 손상·전체 카탈로그 유실 ②`project_name` traversal로 uploads 밖 임의 쓰기.
- **렌즈B 코드 리뷰**(보안·리소스): B1 traversal + **#7 TypeDB `add_drawing` 미러 누락**(TypeDB 모드 조회 깨짐) + 후속(figure 누수·health 부정확).
- **수정**: store **싱글톤 + atomic write**(temp+os.replace) + 손상 백업 / `project_name` **슬러그 검증 + 경로 봉쇄**(is_relative_to) / TypeDB `add_drawing`에 `_MIRROR` 적재 / `_render_layout_png` try-finally / health `os.path.exists` / **typedb-driver 3.7.0 고정**.
- **재검증(실측)**: 동시 10 → **10/10 잔존·index valid** / traversal 2종 **400·uploads밖 쓰기 차단** / pytest **4 PASS**(traversal·singleton 회귀 추가) / TypeDB 모드 업로드 → **적재·조회 동작**.

## 남은 위험 / 후속

- **TypeDB 활성화됨**: typedb/typedb:3.7.3 Docker + typedb-driver **3.7.0 고정**(3.11.x는 `DriverOptions` API 불일치)으로 `store_backend=typedb` 연결·스키마 적용·`drawing_file` 적재·조회 확인. S2+에서 TypeDB 조회를 JSON 미러 의존에서 **직접 쿼리로 강화** 여지.
- paperspace 빈 DWG의 시트 자동분리 → modelspace 통짜 렌더(S2 개선 여지).
- 한글 파일명: 브라우저(UTF-8) 정상, curl(CP949)만 mojibake(클라이언트 이슈).
- 32비트/64비트 Python 혼재 → backend는 `backend/.venv`(64bit) 전용.

## Human gates 해당

- APS 정식 채택(미실행, 평가만) · 고객 기밀 도면(미사용, 샘플만) · 배포(없음) · 인증(없음).

---

# EVIDENCE — S1.5 렌더 bake-off 풀 (2-way 승자 채택)

> 메타프롬프트 `prompts/02-s1_5-render-bakeoff.md`(FROZEN) acceptance B1~B7에 대한 완료 증거. 검증팀은 이 보고 + 실제 실행으로 채점한다.

## 구현 항목

- **백엔드 ②벡터 추출**: `backend/vector.py` 신설 — ezdxf `drawing` 애드온 `Frontend`를 커스텀 recording 백엔드(`_JSONRecorderBackend`)에 연결해 modelspace를 2D 폴리라인(`strokes`)/채움 폴리곤(`fills`)/점(`points`) JSON으로 직렬화. INSERT(중첩 블록)·DIMENSION·HATCH 자동 explode, TEXT/MTEXT는 path 변환. 레이어·색상(hex)·선두께 메타 동반. 좌표 소수 1자리·flatten 0.5로 페이로드 절감.
- **엔드포인트**: `GET /api/drawings/{file_id}/vector` — `vector.json` 캐시(추출 1회 후 `FileResponse`로 직접 서빙). dxf_path는 uploads 내부 검증(traversal 방어 계승). PDF/변환 미완은 400.
- **영속 보강**: `ConversionResult.dxf_path`를 store에 영속(`update_conversion`에 `dxf_path` 인자 추가, JSON·TypeDB 양쪽 + 미러).
- **프론트 ②벡터 렌더러**: `src/build/viewer/VectorCanvas.tsx`(canvas2D) — 무손실 줌(커서 기준 휠)·팬(드래그)·핏·레이어 토글 패널·DPR 크리스프·rAF 스로틀. CAD 모델공간 관습대로 어두운 배경(흰/시안 등 추출 색상 가시화). `src/api/drawings.ts`에 `VectorData`/`fetchVector`.
- **엔진 토글 + 승자 채택**: `SheetViewerShell`에 `renderEngine` 상태 + `벡터`/`래스터` 토글. DWG/DXF(`fileId` 보유·source≠pdf-page)는 **승자인 벡터를 기본**으로, ①래스터 PNG(S1)는 토글로 보존. `Sheet.fileId`/`source` 필드 + `FilesView` 배선.

## 검증 실행 + 결과 (실측)

| 항목 | 결과 |
|---|---|
| `npm run build` (tsc+vite) | **PASS** (1770 modules) |
| `npm test` | **56 PASS** (기존 54 + VectorCanvas 회귀 2) |
| backend `pytest` | **6 PASS** (기존 4 + 벡터 추출/캐시 2) |
| `git diff --check` | clean |
| 벡터 추출 (실 DWG 평면도) | strokes 4818 · fills 5885 · **14 레이어** · entity_types {LINE 3028, INSERT 850, LWPOLYLINE 782, DIMENSION 341, MTEXT 341, ATTRIB 326, TEXT 111, CIRCLE 60, LEADER 49, HATCH 33, SOLID 31, ELLIPSE 28, POINT 1023, ATTDEF 1} |
| `/vector` 응답 | 첫 호출 200 ~8.5MB(추출+캐시 ~4.4s) · 캐시 호출 200(FileResponse ~0.34s) · PDF **400** |
| 브라우저 end-to-end | 실 DWG 업로드→변환→뷰어 **벡터 기본 렌더**(`evidence/s15-vector-default.png`) · **무손실 줌**(`s15-vector-zoom.png`, 확대해도 선·텍스트 또렷) · **레이어 토글**(`s15-vector-layers-off.png`, DIM·DIM1·TEXT 끄면 치수/텍스트 제거) · **①래스터 토글**(`s15-raster-png.png`) · 콘솔 에러 **0** |

## B4 — 렌더 bake-off 2-way 비교표 (실측)

동일 도면(실 DWG 평면도 3면, 14 레이어)을 두 엔진으로 렌더해 나란히 비교.

| 기준 | **①하이브리드 래스터** (ezdxf+matplotlib→PNG) | **②오픈소스 벡터** (DXF→canvas2D) | ③APS Viewer |
|---|---|---|---|
| 상태 | 구현·실측(S1) | **구현·실측(S1.5)** | **전략상 배제** |
| 충실도 | 중상 — 흰 배경, 색/치수/심볼/텍스트 정상. 정적 래스터 | 상 — CAD 어두운 배경, 14 레이어·치수·해치·블록·텍스트 벡터 렌더 | (Autodesk cloud 종속·유료 translate·인증 → 비종속 전략 위배로 평가 안 함) |
| 줌 | **픽셀화**(고정 DPI PNG) | **무손실**(벡터 좌표 재래스터) | — |
| 인터랙션 | 없음(이미지) | 팬·줌·핏·**레이어 토글** | — |
| 공수 | 낮음(S1 이식+보강) | 중 — 백엔드 추출(recording 백엔드)+canvas2D 렌더러 | — |
| 종속성 | **0**(로컬, matplotlib) | **0**(canvas2D 내장, 런타임 신규 의존 없음) | 높음(클라우드·유료·SDK) |
| 페이로드 | PNG 1장(수백 KB) | JSON ~8.5MB(텍스트 path 다수) — 후속 최적화 여지 | — |
| 한계 | 줌 픽셀화, 벡터 선택 불가, paperspace 빈 DWG=modelspace 통짜 | 텍스트가 path(글리프 아님)라 텍스트 多 도면 페이로드 큼; 마크업 좌표 연동 미구현(S4) | — |

**three.js 검토·비채택**: ②를 three.js로도 만들 수 있으나, 추출 데이터가 평탄화된 2D 폴리라인/채움이라 **canvas2D로 무손실 줌·레이어 토글·DPR 크리스프가 충분**하고, three(~600KB)를 더하면 **비종속 전략(런타임 신규 의존 0)에 역행**한다. 따라서 ②는 canvas2D로 구현(메타프롬프트가 "three.js 또는 canvas2D" 허용). 근거: CLAUDE.md simplicity-first + 루프 비종속 가치.

## B5 — 승자 채택 전환

- **승자 = ②오픈소스 벡터(canvas2D).** 근거: 무손실 줌 + 레이어 토글 + 벡터 인터랙션이 2D 도면 검토의 핵심 가치이며, ①래스터의 줌 픽셀화·정적 한계를 해소. 둘 다 **로컬·비종속**이라 채택이 LOOP.md HUMAN_GATE(=APS 정식 채택, Autodesk 종속)에 **해당하지 않음 → 자율 전환**.
- **전환 결과**: DWG/DXF 시트의 뷰어 **기본 엔진 = 벡터**(`SheetViewerShell` 기본값). ①래스터 PNG는 `래스터` 토글로 항상 열람 가능(S1 마크업 오버레이 경로 보존). PDF는 벡터 산출물이 없으므로 ①래스터 유지.

## Done-When reconciliation (B1~B8)

| ID | 항목 | 판정 | 증거등급 |
|---|---|---|---|
| B1 | ②벡터가 S1 DXF로 동일 도면을 벡터 렌더(실 업로드) | **MET** | device(브라우저 스크린샷) |
| B2 | 엔티티 커버리지(LINE·LWPOLYLINE·ARC·CIRCLE·ELLIPSE·TEXT·MTEXT·INSERT 중첩·HATCH·DIMENSION) | **MET** | device(추출 stats 실측) |
| B3 | 무손실 줌·팬·핏·레이어 토글 실동작 | **MET** | device(줌/레이어 스크린샷) |
| B4 | bake-off 실측 비교표(①·② 나란히, ③ 전략상 배제, 대비 스크린샷) | **MET** | device+static |
| B5 | 승자 채택 전환(기본 엔진=승자, 토글 보존) | **MET** | device(벡터 기본 진입) |
| B6 | pytest + npm test + build + git diff --check | **MET** | device |
| B7 | 콘솔 0 + 스크린샷 증거 | **MET** | device |

NARROWED/UNMET 0. (③APS는 freeze된 범위에서 "전략상 배제"이므로 비차단.)

## 독립 검증팀 (3렌즈) + 수리 — full loop

freeze된 B1~B7로 3개 신선한 검증자가 항목별 채점(결함 탐색 지향):
- **렌즈A 백엔드/벡터 적대적 엣지**: B1·B2·B4·B6 **PASS**. traversal(절대경로·`..`·심볼릭 5종 → 404)·손상 DXF(500, 크래시 0)·캐시 손상 자가복구·동시 8요청(8/8 유효)·project_name traversal 전부 견딤. stats가 EVIDENCE 수치와 정확 일치. BLOCKER/MAJOR 0, MINOR 2(500 detail 경로 노출 / 비원자 캐시쓰기).
- **렌즈B 프론트/비기능**: B3·B5·B6·B7 **PASS**(isolatedContext 라이브 재현). 무손실 줌·레이어 토글·엔진 전환 동작, 콘솔 에러 0. React 로직 공격(stale 상태·휠 cleanup·fetch race·bbox null·pointer) 모두 견딤. a11y 적절. BLOCKER/MAJOR 0, MINOR 3(bbox null 시 fit no-op / 향후 in-place 시트전환 시 renderEngine stale 잠재 / 레이어 버튼 접근명).
- **렌즈C Done-When 완결성 비평가**: B1~B7 **전부 MET**, Q1~Q3(APS 배제·폭넓은 커버리지·승자 전환) 준수, Out of scope 침범·narrowing 0. 부채 1(B2 회귀 assert 6종으로 좁음).
- **수리(검증 부채 3건 반영)**: ①B2 회귀에 ARC/ELLIPSE/MTEXT/DIMENSION assert 추가 → 커버리지를 device stats가 아닌 **회귀로 고정**(pytest 6 PASS 유지). ②`/vector` 500 detail에서 서버 경로 제거(로그로만, 클라이언트엔 일반 메시지). ③`vector.py` 캐시 쓰기를 temp+`os.replace` **atomic**으로(store.py 규율과 일치).
- **재검증(실측)**: pytest **6 PASS**(강화 assert 포함) · 재기동 후 health 200·`/vector` 200(캐시)·PDF 400.
- **비차단 잔여**(HUMAN_GATE 아님): bbox null 시 fit no-op(빈 도면만), 향후 필름스트립 in-place 전환 도입 시 renderEngine key 필요(현 경로 미발현), 8.5MB 페이로드 최적화 = 후속.

## S1.5 남은 위험 / 후속

- 벡터 JSON 페이로드 큼(텍스트 path 다수, ~8.5MB) → 글리프 캐시/타일링/지오메트리 단순화 = 후속 최적화.
- 벡터 위 마크업/측정 좌표 연동 = S4(현재 마크업 오버레이는 래스터 경로에만).
- canvas2D 직접 재렌더는 초대형 도면에서 팬 프레임 비용 — 필요 시 offscreen 캐시(현 PoC 범위 밖).
- POINT 엔티티(pdmode 0)는 렌더 0 — 노드 마커, 표시 영향 미미.

---

# EVIDENCE — S2 시트 레지스터 (PDF 페이지 분할 + paperspace DWG 분리)

> 메타프롬프트 `prompts/03-s2-sheet-register.md`(FROZEN) acceptance C1~C8 완료 증거. 검증팀은 이 보고 + 실제 실행으로 채점한다.

## 구현 항목

- **백엔드 시트 메타 휴리스틱**: `backend/sheet_meta.py` 신설 — `extract_sheet_meta(text, filename, page_index)`가 시트번호/제목/공종을 추정. 우선순위 ①페이지텍스트 후보∩파일명접두(고신뢰) ②라벨(DWG/SHEET/도면번호) 근처 후보 ③파일명 번호 ④`Page N`. 공종=번호 접두(E/A/M/P/S/C)→코드/라벨, 미상=G(기타). `discipline_from_filename` 헬퍼.
- **PDF 페이지 분할 + 메타**: `render_pdf_sheets`가 페이지별 `get_text()`로 메타 추출해 `Sheet`에 부착. `Sheet` dataclass에 `sheet_number/sheet_title/discipline_code/discipline_label/meta_source` 추가.
- **paperspace 분리 교정**: `render_dxf_sheets`가 다중 paperspace 레이아웃을 각각 시트로 분리(레이아웃명=번호), 빈 paperspace는 modelspace 단일 폴백(로깅). filename을 `process_drawing`→렌더로 스레딩.
- **목록 png_url(버그 수정)**: `GET /api/drawings`가 `_with_urls`를 각 행에 적용 — 시트 레지스터(목록 API)에서 뷰어가 실 렌더를 띄우게 함(브라우저 e2e에서 적발·수정).
- **프론트 실데이터 시트 레지스터**: `BuildSheetsView`가 `listDrawings`를 조회·폴링→`drawingsToSheets`로 `Sheet[]` 구성. **정적 `initialSheets` 제거**(완전 교체). 공종 필터(드롭다운)·번호 자연정렬 토글 추가(`sortSheets`). `SheetsListView`에 필터/정렬 props. `api/drawings.ts`에 `VectorData`·`fetchVector` 외 `drawingsToSheets`, `BackendSheet` 메타 필드. `SheetDisciplineCode`를 string으로 확장(실 공종 G/S/C 수용).

## 검증 실행 + 결과 (실측)

| 항목 | 결과 |
|---|---|
| `npm run build` | **PASS** |
| `npm test` | **57 PASS** (기존 + S2 시트목록/필터/정렬 회귀, App/BuildSheets 실데이터 목킹 이관) |
| backend `pytest` | **14 PASS** (기존 6 + 시트메타/PDF분할/paperspace 분리·폴백 8) |
| `git diff --check` | clean |
| 휴리스틱 실측 | 청주 EE-01-006 → number=EE-01-006·E(전기)·src=filename+page · 제주 8p → Page N·G(기타)·page-index 폴백 · 합성 "DWG. NO\nE-205" → title-block |
| 브라우저 end-to-end | 8페이지 PDF 업로드→**시트 8개 분할**(C1) · EE-01-006 PDF→**번호·공종 정확 추출**(C2) · 시트 목록 **실데이터 완전 교체**(C3, 정적 A001 전무, 스크린샷 `evidence/s2-sheet-register.png`) · 공종필터 E→1시트(C4) · 시트 열기→**실 PDF 렌더**(C6, `s2-viewer-pdf-render.png`) · 콘솔 0(C8) |
| paperspace 분리 | 합성 다중 paperspace DXF → 2시트 분리(pytest) · 빈 paperspace → modelspace 단일(pytest) |

## Done-When reconciliation (C1~C8)

| ID | 항목 | 판정 | 증거등급 |
|---|---|---|---|
| C1 | 멀티페이지 PDF → 페이지수만큼 시트 분할 | **MET** | device(8p→8시트) |
| C2 | 타이틀블록 휴리스틱 번호·제목·공종 + 폴백 | **MET** | device(EE-01-006 추출 / 제주 Page N 폴백) |
| C3 | 시트 목록 실데이터 완전 교체(정적 제거) | **MET** | device(정적 A001 전무) + static(initialSheets 삭제) |
| C4 | 검색/필터/정렬 실데이터 동작 | **MET** | device(공종필터 E→1) + 회귀(sortSheets/filter) |
| C5 | 다중 paperspace → 다중 시트, 빈 paperspace=modelspace 단일(한계 명시) | **MET** | device(pytest 분리/폴백) |
| C6 | 시트 목록→뷰어 연계(DWG 벡터·PDF PNG) | **MET** | device(EE-01-006 실 PDF 렌더, _with_urls 수정 후) |
| C7 | pytest + npm test + build + git diff --check | **MET** | device |
| C8 | 콘솔 0 + 스크린샷 | **MET** | device |

NARROWED/UNMET 0.

## S2 남은 위험 / 후속

- 멀티페이지 번들(제주 등) 페이지는 타이틀블록 텍스트가 추출 불가/회전이라 대부분 `Page N` 폴백(휴리스틱 본질적 취약 — freeze가 폴백을 acceptance로 수용). 강 추출은 파일명=번호인 단일도면에서.
- 빈 paperspace DWG의 modelspace 영역 자동분할은 범위 밖(타이틀블록/뷰포트 추론 — 후속).
- 버전/버전세트 = S3 연기(현재 v1 등록만, versionSet="-").
- TypeDB 직접 쿼리화 = 후속(JSON 미러 의존 유지).
- 시트 목록 폴링(2.5s, 시트 섹션 한정) — 대규모에선 SSE/수동 새로고침 후속.

## 독립 검증팀 (3렌즈) + 수리 — full loop

freeze된 C1~C8로 3개 신선한 검증자가 항목별 채점(결함 탐색 지향):
- **렌즈A 백엔드/휴리스틱 적대적**: C1·C2·C5·C7 **PASS**. 합성 4p PDF→4시트, 청주 EE 8종 강추출(filename+page·E), 폴백 체인·"Page"→P 오분류 방어 견딤, viewport-only paperspace 교정 실증, pytest 14. **MAJOR 1**(`_near_label_number`가 라벨 근처 장비태그 TR-005를 진짜 M-201보다 먼저 채택 — 파일명 무번호 번들에서 silent 오추출) + MINOR(단자리 첫그룹 미추출·제목 파일명 고정·png_path 절대경로 노출).
- **렌즈B 프론트/비기능**: C3·C4·C6·C7·C8 **PASS**(isolatedContext 라이브). 정적 A001 전무·공종필터 E→1·자연정렬·시트열기 실 PDF 렌더·콘솔 0. 폴링 cleanup/race 견딤. MINOR(select name 누락·폴링 중 stale 필터옵션·필름스트립 무동작=범위밖).
- **렌즈C Done-When 비평가**: C1~C8 **전부 MET**, Q1~Q3(범위·실데이터 교체·휴리스틱+폴백) 준수, Out of scope 침범·narrowing 0. 후속(C5 합성 증거→실 다중-paperspace DWG로 device 격상 권장, 차단 아님).
- **수리(MAJOR + MINOR 반영)**: ①`_near_label_number`가 **공종 인식 후보(진짜 도면번호)를 장비태그보다 우선** 채택(회귀 `test_label_prefers_real_drawing_number_over_equipment_tag` 추가). ②`_with_urls`가 **png_path 절대경로 제거**(정보 노출 차단). ③공종 필터 select에 `name` 추가(폼 일관성). ④폴링으로 선택 공종이 사라지면 필터를 **전체로 리셋**(무효 select 방지).
- **재검증(실측)**: pytest **15 PASS**(MAJOR 회귀 추가) · npm test **57** · build PASS · git diff clean · 재기동 후 라이브 `GET /api/drawings`에 **png_path 미노출**·`_near_label_number` M-201 정확.
- **비차단 잔여**(HUMAN_GATE 아님): 단자리 첫그룹 번호 텍스트 미추출(파일명 폴백 커버) · 멀티페이지 제목 파일명 고정 · C5 device 증거 격상(실 다중-paperspace DWG 확보 시).

---

# EVIDENCE — S3 파일/폴더 관리 + 버전 + 권한 (메타프롬프트 `prompts/04-s3-files-folders.md`, FROZEN)

> acceptance D1~D9. 검증팀 3렌즈(백엔드 적대적·프론트 비기능·Done-When 비평가) + 브라우저 e2e로 채점.

## 구현 항목

- **백엔드**: `store.py` `DrawingStore`에 folder CRUD(`add/get/list[seed-on-create]/update/delete_folder`) + 버전세트(`add_version`·`list_versions`·`delete_drawing`) + `list_drawings(folder_id, latest_only)` 확장. Json SoT, TypeDB는 `_MIRROR` 위임(LOOP: 직접쿼리화 후속). `routes_files.py` 신설(`GET/POST/PATCH/DELETE /api/folders`). `routes_drawing.py`에 `POST /{id}/versions`·`GET /{id}/versions`·`GET /{id}/download`·`DELETE /{id}` + upload `folder_id`·share 상속.
- **프론트**: `src/api/drawings.ts`에 folder/version/download/delete API + `Drawing.share_status`·`Folder` 타입. `FilesView.tsx` 전면 개편(실 폴더트리·폴더 CRUD·폴더 타깃 업로드·파일 테이블 실데이터·행 메뉴[뷰어/다운로드/새버전/이력/삭제]·버전이력 모달·공유 편집). 정적 `buildFilesData.ts` **삭제**. `styles.css` S3 클래스.

## 검증 실행 + 결과 (실측)

| 항목 | 결과 |
|---|---|
| `npm run build` | **PASS** |
| `npm test` | **65 PASS** (기존 57 + FilesView 8) |
| backend `pytest` | **28 PASS** (기존 15 + S3 13) |
| `git diff --check` | clean |
| 브라우저 e2e | seed 9폴더+PDFs 트리 / 새 폴더 생성 / 폴더 타깃 업로드(plan_v1) / 버전 추가(plan_v2 → v2, 목록 1행) / 버전 이력(v2 최신+v1 보관, 다운로드 링크) / 삭제(빈 폴더) / **콘솔 0**. 스크린샷 `evidence/s3-files-tree.png`·`s3-version-history.png` |

## 검증팀 3렌즈 + 적발·수리

- **렌즈A 백엔드 적대적**: D1 PASS(12스레드 동시 seed 중복 0)·D5 PASS(traversal·root rmtree 방어). **BLOCKER-1**(레거시 `version_set_id=None` base에 버전 추가 시 base가 demote 안 돼 목록 중복) + **MAJOR-2**(version_no lock 밖 경합) + **MAJOR-3**(PATCH parent 미검증) + MINOR-4(delete depth) 적발.
- **렌즈B 프론트 비기능**: D3·D6 PASS(폴더 타깃 업로드·필터·마크업/이슈 placeholder 한계 명시·a11y[role menu/menuitem·dialog·Enter/Esc]·회귀[폴링·뷰어연계]). **D7 결함**(파일 공유칩이 현재 폴더 share 대리표시→루트 전부 비공개, Drawing share_status 미모델링, 공유 편집 UI 부재) 적발.
- **렌즈C Done-When 비평가**: D1·D2·D3·D4·D5·D6·D8 MET, **D7 NARROWED**(공유 편집 UI 미구현 → HUMAN_GATE 후보).
- **수리(전부 반영·재검증)**: ①`add_version` de-latest 매칭을 `_in_set`(version_set_id 또는 file_id)으로 확장 + 레거시 base 백필 + version_no를 lock 내 할당(BLOCKER-1·MAJOR-2). ②`patch_folder` parent 존재·자기참조·순환 검증(MAJOR-3). ③Drawing `share_status` 모델링(업로드 시 폴더 상속) + 프론트 파일행이 `d.share_status` 표시 + 폴더 행 메뉴 "공유 상태 전환" 편집 UI(D7). ④delete rmtree file_id-depth 가드(MINOR-4). 회귀 테스트 4건 추가(`test_add_version_on_legacy_base_demotes_and_backfills`·`test_version_no_assigned_by_store`·`test_patch_folder_parent_validation`·`test_folder_share_inheritance`) + 프론트 2건(파일 공유칩·폴더 공유 토글).

## Done-When reconciliation (D1~D9 — 수리 후)

| ID | 항목 | 판정 | 증거등급 |
|---|---|---|---|
| D1 | 폴더 트리 실데이터 + seed-on-create idempotent | **MET** | device(브라우저 9폴더+PDFs) + 단위 |
| D2 | 폴더 CRUD(parent 트리·검증) | **MET** | device(폴더 생성) + 단위(CRUD·parent 검증·cascade) |
| D3 | 폴더 타깃 업로드 + 필터 | **MET** | device(plan_v1→전기도면 v3, 폴더별 필터) |
| D4 | 명시적 버전세트(보관·이력·최신 1행) | **MET** | device(v2 추가·이력 v2/v1·1행 합침) + 단위(레거시·경합) |
| D5 | 다운로드/삭제 + traversal 방어 | **MET** | device(다운로드 링크·삭제) + 단위(depth·traversal) |
| D6 | 파일 테이블 실데이터 + 마크업/이슈 placeholder | **MET** | device(버전·크기·공유·수정자, 마크업/이슈 0+title 한계) |
| D7 | 권한 메타 표시 + 편집 UI | **MET**(수리 후) | device(공유 상속 "프로젝트 공유") + 단위(폴더 공유 토글·share 상속) |
| D8 | 테스트 게이트 | **MET** | device(build·npm test 65·pytest 28·diff clean) |
| D9 | 브라우저 e2e + 콘솔 0 | **MET** | device(전 흐름 e2e·콘솔 0) |

**종합**: D1~D9 전부 MET(수리 후). NARROWED/UNMET 0. BLOCKER/MAJOR 적발분 전부 수리·재검증. 비차단 잔여: 설명 컬럼 placeholder(Drawing description 모델 부재) · TypeDB folder 직접쿼리화(JSON 미러 의존 유지, 후속) · 파일 단위 공유 override(현재 폴더 상속).
