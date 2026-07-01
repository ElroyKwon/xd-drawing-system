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

---

## S2.5 실측 baseline (2026-06-29, 구현 전 — F10 before 기준)

**테스트 도면**: 제주 BESS 전기도면 일식.pdf (68페이지 / 94MB, 한화 양식 멀티페이지 번들)
**환경**: backend `XD_STORE=json`, end-to-end(업로드 API → 변환 → 목록 API).

| 항목 | 실측값 | 판정 |
|---|---|---|
| 변환 시간 | 68p **약 15초** | 양호(병목 아님) |
| PNG 생성 | 68/68장, 78KB/장, 총 27MB | 정상 |
| 단건/목록 API | 31KB / 16~83ms | 양호 |
| 저장 용량 | **119MB/도면** (원본 PDF 93MB + sheets 27MB) | P3 대상 |
| **시트번호 추출** | **0/68 (0%) → 전부 "Page N"** | P1 대상(치명) |
| **시트제목 추출** | 전 시트 동일 파일명 stem(멀티페이지 무의미) | P1 대상 |
| **공종 분류** | 68/68 'G'(General 폴백) | P1 대상 |
| 목록 페이지네이션 | 버튼 장식("1 중 1" 하드코딩, onClick 없음), 전체 `.map()` 일괄 | P2 대상 |

**근본 원인(코드 확인)**: PDF 텍스트 레이어는 실재(2p=2967자, `DWG NO`·`DWG. TITLE` 라벨 명확). 그러나 `sheet_meta.py` — `_filename_number`가 한글 파일명에 None(폴백 불가) / `_near_label_number`가 라벨 다음 2줄만 보는데 2D 타이틀블록은 `get_text()` 선형화에서 라벨↔값 비인접 / `_title`이 파일명 stem 우선이라 멀티페이지 전 시트 동일 제목.

→ S2.5 메타프롬프트 `prompts/06-s2_5-multipage-scale.md` FROZEN. 구현 후 동일 PDF로 after 측정해 F10에 before/after 기록.

## S2.5 구현 결과 (2026-06-29, after — F10 before/after)

**동일 도면(제주 BESS 68p)으로 새 코드 end-to-end 재측정.**

| 지표 | before(구현 전) | after(구현 후) | 항목 |
|---|---|---|---|
| 시트번호 추출 | 0/68 (0%) | **67/68 (98%)** | F1 |
| 고유 제목 | 1 (전부 파일명) | **67/68 고유** | F2 |
| 공종 분류 | 68 'G' | **67 'E'(전기) / 1 'G'** | F3 |
| storage_bytes | None(미노출) | **124,572,799 (118MB)** | F7 |

폴백 1건(p1)=표지(타이틀블록 없음) → "Page 1" 명시적 폴백(정상, F2/무성금지 준수). 근본 원인은 좌표 기반 라벨앵커(`title-block-xy`)로 `DWG NO`/`DWG. TITLE` 라벨 바로 아래 값을 공간 페어링해 해소. 공종 `EE`(번호 중간 토큰)를 토큰 스캔으로 전기 판정.

### 검증 게이트
- 백엔드 pytest **37 PASS**(기존 28 + S2.5 9: 라벨앵커·다중토큰 공종·멀티페이지 제목·폴백·노이즈 거부·청주 회귀·storage_bytes ×2). 청주 단일파일 경로 회귀 0(F4).
- 프론트 `npm test` **70 PASS**(기존 65 + 페이지네이션 5: 50행/페이지·범위라벨·경계 비활성·다음 이동·필터 리셋, F5/F6).
- `npm run build`(tsc+vite) PASS, `git diff --check` clean(F9).
- F10 브라우저 e2e: 아래 별도 기록.

### 구현 범위
- P1: `sheet_meta.py`(좌표 라벨앵커 `_spatial_value`/`_spatial_number`/`_spatial_title` + 다중토큰 `_discipline` + 멀티페이지 `_title`), `conversion.py`(`_page_lines`로 dict 라인 추출→`extract_sheet_meta` 전달).
- P2: `SheetsListView.tsx`(클라 페이지네이션 50/페이지, 필터 리셋), `BuildSheetsView.tsx`·테스트에서 옛 countLabel 정리.
- P3: `routes_drawing.py`(`_storage_bytes`+`_with_urls` 노출), `drawings.ts`(타입), `FilesView.tsx`(크기 컬럼=원본+파생).

### F10 브라우저 e2e (2026-06-29, 콘솔 0)

Study_Project에 제주 68p 업로드 후 시트/파일 뷰 검증(스크린샷 `evidence/s2_5-*.png`):
- **시트 목록 실값**: ESS-EE-DWG-001~909 번호 + 페이지별 도면명(KEY SINGLE LINE DIAGRAM·BATTERY실 소내 전력 단선도 등) + 공종 E(전기). 정적/Page N 아님(F1·F2·F3).
- **페이지네이션(F5/F6)**: "총 81개 중 1–50" / "1 / 2", 이전 비활성 → 다음 클릭 → "총 81개 중 51–81" / "2 / 2", 다음 비활성. 페이지당 50행 렌더.
- **용량 표시(F8)**: 파일 뷰 크기 컬럼 = 제주 118.8 MB(원본 93MB+파생), EE-01-006 798.4 KB, original.dwg 11.0 MB.
- **콘솔 0**: error/warn 0건.
- 참고: 옛 세션 업로드분("제주_BESS_8p"·"plan_v1" 등)은 "Page N"/G로 표시 = 구 코드 변환 산출물(재변환 안 함). 신규 업로드분만 신 추출 적용 = 정상.

### 독립 검증팀 3렌즈 (2026-06-29) + 수리

- **백엔드 적대적**: F1·F2·F3·F7 실 제주 68p로 PASS(폴백률 100%→1%, 공종 E67/G1, 용량 124.6MB). **MAJOR-1 적발** — `extract_sheet_meta`가 `lines`만 있으면 `_spatial_title`을 multipage 무관 우선 실행 → 청주 단일파일 제목이 파일명 stem에서 좌표값으로 바뀌는 F4 회귀(회귀 테스트가 lines 없는 경로만 봐 사각). MINOR 1~5(날짜 오염·below창·공종 첫글자폴백·날짜 번호둔갑·용량 매호출 rglob)=다른 벤더 양식/성능 잠재, 제주·청주 미발현.
- **프론트 비기능**: F5·F6·F8·F9 전부 PASS, BLOCKER/MAJOR 0. MINOR a11y(페이저 aria-live 부재) 1건.
- **Done-When 비평가**: F1~F10 전부 MET, NARROWED/UNMET 0 → DONE 가능·HUMAN_GATE 불필요. EVIDENCE "35 PASS" 산술 오기 적발(→37 정정).

**수리(수리 후 재검증)**:
- **MAJOR-1 수리**: 좌표 제목을 `if lines and multipage:`로 멀티페이지에만 우선(단일파일=stem 우선 S2 보존). 회귀 테스트 `test_single_file_title_keeps_filename_stem_even_with_lines` 추가.
- **MINOR-4 수리**: `_looks_like_number`에 순수 날짜(2025-03-24) 거부 가드 → 날짜가 번호로 둔갑 방지. 회귀 테스트 `test_date_not_picked_as_number` 추가.
- **수리 검증(device)**: 제주 멀티 번호 67/68·고유제목 67 **불변**, 청주 단일파일 5개(EE-01-001~005) 번호=filename·공종=E·**제목=파일명 stem 전부 복원**(F4 회귀 0 device 입증). pytest **39 PASS**.
- EVIDENCE "35 PASS" → **37**(수리 전), 수리 후 **39** 정정.

**잔여 후속 부채(비차단, S2.5 범위 외)**: 멀티벤더 양식의 날짜/노이즈 값 오염·below 탐색창·공종 첫글자 폴백 오분류(ATS→A 등)=양식 프로파일/추출 강화 후속 · 용량 stat 매 목록호출 rglob 캐시 · 페이저 aria-live · OCR/스캔 PDF.

---

# EVIDENCE — S4 마크업·측정·시트비교 실연산 + 영속 (2026-06-29)

> 메타프롬프트 `prompts/05-s4-markup-measure-compare.md` FROZEN(acceptance E1~E13) 기준. 구현 후 자체 e2e + 독립 검증팀 채점.

## 게이트 (must-pass)
- `npm run build`(tsc+vite) PASS · `npm test` **76 PASS**(geometry 6 신규) · backend `pytest` **51 PASS**(S4 12 신규) · `git diff --check` clean(CRLF 경고만).

## 구현 범위
- **백엔드**: `store.py`(DrawingStore에 markup/measurement CRUD — Json·TypeDB 양 백엔드, `_markups.json`/`_measurements.json` 인덱스, `(file_id,sheet_id)` 스코프), `schema/04-drawings.tql`(markup·measurement entity+속성 추가), `vector.py`(`$INSUNITS`→`units{name,to_meter}` 추출+스키마진화 캐시가드), `compare.py`(PIL 픽셀 diff 마스크+변경비율), `routes_markup.py`(신설: markups GET/POST/PATCH/DELETE·measurements GET/POST/DELETE·compare GET, 같은 version_set 검증·traversal 방어), `routes_drawing.py`(/vector `Cache-Control: no-cache`), `main.py`(라우트 등록).
- **프론트**: `VectorCanvas.tsx`(world↔screen 변환으로 같은 draw 루프에 마크업/측정 오버레이 렌더+도구 드래그/클릭 생성+히트테스트+텍스트 입력+onUnits), `MarkupCanvas.tsx`(PDF/래스터 정규화 좌표 SVG 오버레이+드로잉, draftRef 단일 진실원), `geometry.ts`(측정 순수함수 distance/polygonArea/measureValue), `SheetViewerShell.tsx`(전면 오케스트레이션: 로드·생성·편집·삭제·비교), `MarkupListPanel`/`MarkupPropertyPanel`/`MeasurePanel`/`CalibrationModal`(실데이터·편집·삭제·단위), `CompareModal`(버전 조회·선택)/`CompareOverlay`(canvas 색상합성+투명도/스와이프+백엔드 diff 마스크 토글), `drawings.ts`(S4 API·타입), `viewerData.ts`(데모 시드 제거), `s1-buildout.css`(S4 스타일).

## Acceptance 체크 (E1~E13) — 브라우저 e2e device 증거
실데이터: DWG `09a5c45a`(original.dwg, INSUNITS=4 mm, 범위 ~244m), PDF `0fc96642`(6.6kV 단선결선도), 비교 버전세트 plan_a(v1)/plan_b(v2 박스 이동).

- **E1 마크업 그리기(벡터)** MET(device): DXF Model 시트에서 도구레일로 도형/클라우드/폴리라인/다각형/텍스트를 마우스 드래그·클릭으로 실제 생성(스크린샷 `s4-02-markups-restored.png`).
- **E2 마크업 영속+복원(world)** MET(device): 5개 마크업 `POST` 저장 → **전체 페이지 새로고침+재진입** 후 `GET`으로 전부 복원, world 좌표라 줌/핏 무관 도면에 고정. 텍스트 geom=실 DXF 좌표 `[86919,41182]`.
- **E3 선택/편집/삭제** MET(device): 도형 선택→속성패널(종류·좌표계 world·정점수·작성자)→색상 PATCH(#d8232a→#2f9e44 백엔드 반영)→삭제(5→4 영속).
- **E4 PDF 마크업(정규화)** MET(device): PDF 단선결선도에서 도형·텍스트 생성, `coord_space=image`·정규화 좌표 `[0.32,0.28]→[0.58,0.5]`∈[0,1] 영속(`s4-04-*.png`).
- **E5 측정 실연산(DXF 자동)** MET(device): mm 단위 자동 인식("mm (실척 자동)"), 선형=**43.645 m**(model 43645mm×0.001), 다각형 면적=**615.83 ㎡**. 정적 measureRows 아님(`s4-03-measure-dxf.png`).
- **E6 측정 영속** MET(device): MeasurePanel 실데이터(M1 선형·M2 면적), `_measurements.json` 영속.
- **E7 PDF 측정 비활성** MET(device): PDF 시트 측정 패널 "측정은 DXF 벡터 시트 전용입니다(PDF 제외)." 안내, 측정 도구 비활성.
- **E8 비교 오버레이(클라)** MET(device): plan v1/v2를 canvas 픽셀 색상 합성 — 이전=빨강/현재=파랑(박스 이동이 빨강·파랑 분리로 가시), 공통 프레임=검정. 투명도·스와이프 슬라이더·이전/현재 토글 동작(`s4-05-compare-overlay-diff.png`).
- **E9 비교 diff(백엔드)** MET(device): `GET /compare?against=` 픽셀 diff 마스크 PNG 생성·반환, **변경 픽셀 2.00%** 표시, 변경 영역 강조 토글. 같은 version_set 검증·traversal 방어(pytest).
- **E10 백엔드 영속 모델** MET(static+device): store markup/measurement CRUD Json·TypeDB 양 구현, TypeDB 스키마 entity 추가, `(file_id,sheet_id)` 스코프(pytest 12 + JSON 인덱스 확인).
- **E11 테스트 게이트** MET: build PASS · npm test 76 · pytest 51 · diff clean.
- **E12 브라우저 e2e + 콘솔 0** MET(device): 클린 리로드 후 전 플로우, 콘솔 **error 0**(CORS·draft 잔여는 수리 후 소거; 잔여 1 a11y issue+1 canvas warn도 `willReadFrequently`+select `name`으로 해소).
- **E13 실제 도면 기반 운영자 사례** MET(device): DXF에 "**현장 패널 번호와 도면 표기 상이 - CAD 수정 요청**", PDF 단선결선도에 "**차단기 용량 표기 재확인 요망**" — 실제 렌더 도면을 보고 만든 운영자 관점 마크업(generic seed 아님).

## 구현 중 적발·수리한 실 버그(자체)
1. **벡터 캐시 units 누락**: S1.5 캐시 vector.json에 units 없음 → 측정 model 단위로만 계산. **스키마진화 가드**(`if "units" in cached`) + 캐시 재생성으로 수리.
2. **이미지 CORS 캐시 충돌**: 일반 `<img>`가 ACAO 없이 캐시한 응답을 crossOrigin 합성 요청이 재사용 → taint로 색상 합성 실패. CompareOverlay 합성 로드에 `?cors=1` 캐시키 분리 + `/vector` `Cache-Control: no-cache`로 수리.
3. **MarkupCanvas stale 클로저**: PDF 드로잉이 draft를 `useState`로 읽어 단일 제스처 내 빈 값 → 마크업 미생성. **draftRef 단일 진실원**으로 수리(VectorCanvas 선례).
4. **setPointerCapture 합성포인터 throw**: try/catch 방어(best-effort).

## 독립 검증팀 3렌즈 (2026-06-29) + 수리

- **백엔드 적대적**: PASS. 스코프 격리(다른 시트/파일 마크업 누수 0)·compare version_set 검증(같은 vset 200·다른 vset 400·없는 against 404·sheet_index 초과 400, 라이브 입증)·traversal 방어·units 무성가정금지·diff 정규화(동일 0·해상도 불일치 resize) 전부 실증. BLOCKER/MAJOR 0. **MINOR 2**(TypeDB markup/measurement insert 소수초 datetime 리터럴·`update_markup` 그래프 미반영 — 둘 다 JSON-SoT·미실행 경로라 무해, "TypeDB 직접쿼리화 후속" freeze 가정 범위).
- **프론트 코드/정확성**: PASS(조건부). 좌표 역변환·측정 수학(geometry.test 7케이스)·coord_space 분기·편집/삭제 영속·CompareOverlay 픽셀 루프 전부 정확 확인. **MAJOR-1 적발** — `VectorCanvas` 클릭 선택 게이팅이 client/local 좌표 혼용(`e.clientX` vs `down.sx`) → `hypot<4` 불성립 → **캔버스 클릭으로 마크업 선택이 죽어 있음**(리스트 선택 우회로 E3는 충족돼 MAJOR). MINOR-2(이미지 하드 실패 시 무한 스피너), MINOR-3(리스트가 coord_space 미필터).
- **Done-When 비평가**: **E1~E13 전 항목 MET, NARROWED/UNMET 0** → DONE 가능·HUMAN_GATE 불필요. 측정값 산술 직접 재계산 일치(선형 43.645m·면적 615.83㎡). 비차단 권고: E5 지름 device 증거 부재(코드+버튼+unit test만).

### 수리(수리 후 재검증)
- **MAJOR-1 수리**: `VectorCanvas.tsx` 클릭 게이팅을 로컬-로컬 비교(`localPos(e)`)로 통일. **device 재검증**: Model 시트에서 캔버스 다각형을 직접 클릭 → "다각형 마크업 속성" 패널 오픈 확인(클릭 선택 복구).
- **MINOR-2 수리**: CompareOverlay 이미지 로드 `.catch`에서 `setTainted(true)`+`setDiffError` → 무한 스피너 차단.
- **MINOR-3 수리**: `MarkupListPanel`에 `visibleMarkups` 전달(리스트=현재 캔버스 coord_space 일치). device 확인(벡터 모드 리스트=world 4건).
- **E5 지름 device 보강**: Model 시트에서 지름 2점 측정 → **27.258 m** 영속(`_measurements.json` 3건: 선형 43.645m·면적 615.83㎡·지름 27.258m). 3종 전부 device. 패널·캔버스 동시 표시 스크린샷 `evidence/s4-06-measure-three-types.png`(M1 선형 43.64m·M2 면적 615.83㎡·M3 지름 27.26m, 캔버스 오버레이 라벨 가시) → E5 비차단 부채 해소.
- **콘솔 정리**: `CompareOverlay` tmp 컨텍스트 `willReadFrequently:true` + `CompareModal` select `name` 추가 → 최종 콘솔 **error/warn/issue 0**.
- **수리 후 게이트 재검증**: build PASS · npm test **76 PASS** · pytest **51 PASS** · git diff --check clean(CRLF만).

### 잔여 후속 부채(비차단, S4 범위 외)
- TypeDB 그래프 markup/measurement 직접 적재·갱신(현재 JSON 미러 SoT, STORE_BACKEND=json) — "직접쿼리화 후속" freeze 가정.
- CompareOverlay 다해상도 버전 정렬이 stretch-to-A(동일 시트 버전은 무해, 시맨틱 bbox 정렬은 후속).
- 수동 2점 캘리브레이션·PDF 측정·이슈 영속(S5)·마크업↔이슈 연계.

---

# S5 — 이슈 영속 + 뷰어 핀 연계 (2026-06-30, 세션 8 — 검증 마무리 완료 · DONE)

> 메타프롬프트 `prompts/07-s5-issues-pins.md` FROZEN(AskUserQuestion 4결정: 독립 Issue 엔티티 · ACC식 상태 4종+메타 · 양방향 점프 · 핀 선택적+S4 좌표계). acceptance **H1~H13 전부 MET**. 세션 7 구현+부분검증 → 세션 8에서 이월분(H7·H10 e2e·독립 3렌즈·reconcile·커밋) 마무리. 자동 게이트 GREEN(pytest **61**·npm **83**·build·diff clean), 적발 결함 수리 후 DONE.

## 구현 요약
- **백엔드**: `store.py` 이슈 CRUD(`add_issue`/`list_issues(file_id·sheet_id·status·category·project_name 필터)`/`get_issue`/`update_issue`/`delete_issue`=soft) Json·TypeDB 양 백엔드(TypeDB best-effort 그래프+JSON 미러 SoT). `routes_issue.py` 신설(prefix `/api/issues` — `/api/drawings/{file_id}`가 "issues"를 file_id로 오인하는 경로 충돌 회피, 동작 동일). 상태머신 검증(열림→진행중→답변됨→닫힘, 닫힘→진행중 거부·닫힘→열림 재오픈 허용)·핀 좌표 검증(world/image, image=[0,1])·카테고리 집계(닫힘·삭제 제외). `schema/04-drawings.tql` `issue` entity 추가. `main.py` 라우터 등록.
- **프론트**: `drawings.ts` `Issue`/`IssuePin` 타입 + `listIssues`/`createIssue`/`updateIssue`/`deleteIssue`/`issueCategoryCounts` + `ISSUE_STATUS_TRANSITIONS`. `IssuesView.tsx` 전면 실연결(목록·열린/삭제됨 필터·검색·작성 모달·상태 변경·핀 딥링크 버튼, 정적 행 제거). `IssueAddPanel.tsx` 실집계 count + 시트 이슈 목록 + 선택. `IssueCreateForm.tsx`·`IssueDetailPanel.tsx` 신설(뷰어 핀 작성/상세). `VectorCanvas.tsx`(이슈 핀 도구→world 클릭 생성·`drawIssuePin` 렌더·핀 히트테스트 선택·`focusPin` 센터링)·`MarkupCanvas.tsx`(image 정규화 핀). `SheetViewerShell.tsx`(이슈 상태·placePin·createIssueFromPin·changeIssueStatus·removeIssue·focusIssueId/focusPin). `BuildSheetsView.tsx`(이슈 섹션도 도면 로드·`openIssuePin` 딥링크 배선). `viewerData.ts`(issueTypes·issueStatuses, IssueCategory count 제거).

## 게이트 (전부 PASS — 세션 8 재확인)
- `npm run build` PASS(tsc+vite) · `npm test` **83 PASS**(신규 7: IssuesView 5 + VectorCanvas 핀 2) · backend `pytest` **61 PASS**(S5 10 = 세션7 8 + 세션8 회귀 2[PATCH 핀-위치 불변식·핀 비유한 거부]) · `git diff --check` clean(CRLF 경고만).

## 브라우저 e2e (device, json 백엔드 + 실 DWG `original.dwg` Model 시트)
- **H4 핀 생성(world)**: 이슈 핀 도구 선택 → 캔버스 클릭 → 작성 폼에 **실 DXF world 좌표 "도면 좌표 (140819.7, 36724.7)"** 캡처. 운영자 제목 "현장 분전반 위치가 도면 표기와 상이 — CAD 수정 요청" 작성 → 생성.
- **H1 생성 영속 / H8 카테고리 실집계**: 작성 직후 IssueDetailPanel(현장 확인·도면 검토자·핀(world)·열림). 브라우저→백엔드 fetch로 영속 확인(`/api/issues` total 1, pin=[140819.7,36724.7] world, sheet_id 09a5c45a). 카테고리 `{clash:1, quality:0, coordination:0}`.
- **H3 상태 전이 영속**: 열림→진행중 변경 → fetch status="진행중" 확인.
- **H2 전역 목록 / H5 복원**: 페이지 새로고침 → Build→이슈 탭 전역 IssuesView에 "현장 확인 · 진행중 · 핀" 1행(정적 "문 출입 방향 확인" 시드 제거). 인스펙터 위치="Model 핀"(시트 해석).
- **H6 양방향 딥링크**: IssuesView 인스펙터 "뷰어에서 핀 보기" → Model 시트 뷰어 점프 → 이슈 탭 자동 선택 + "이 시트의 이슈 (1)" 복원 + IssueDetailPanel 자동 선택 + 핀 world 좌표 캔버스 복원(focusPin 센터링).
- **H12 콘솔 0**: error/warn/issue **0**. 스크린샷 `evidence/s5-01-pin-created.png`·`s5-02-deeplink-pin-restored.png`.

## 세션 8 이월 e2e (device, json 백엔드)
- **H7 핀 없는 전역 이슈**: IssuesView 작성 모달 → "전기·기계 도면 간 케이블 트레이 경로 협의 필요"(유형 협의·Coordination·설계 코디네이터, 핀 없음) 작성 → 인스펙터 "위치: 위치 없음", 목록 "협의 · 열림"(핀 마커 없음, 핀 이슈의 "· 핀"과 대조). 백엔드 fetch `pin:null, sheet_id:null, category:coordination` 영속 확인. 스크린샷 `evidence/s5-03-global-nopin-issue.png`.
- **H10 PDF image 핀**: EE-01-006 단선결선도(pdf-page) 뷰어 → 이슈 핀 도구 → 도면 클릭 → 작성 폼 "핀 위치: 정규화 (0.50, 0.50)" → "단선결선도 차단기 정격 표기 불명확 — 현장 명판과 대조 필요"(Quality·전기 검토자) 작성 → 상세 "위치: 핀(image)". fetch `pin.coord_space:"image", point:[0.49999,0.50000]` ∈ [0,1] 영속.
- **H10/H6 새로고침 복원+딥링크**: 새로고침 → 전역 IssuesView 3이슈 복원 → PDF 이슈 "뷰어에서 핀 보기" → EE-01-006 시트 점프 + 이슈 탭 자동 선택 + "이 시트의 이슈 (1)" + 상세 "위치: 핀(image)" 복원. **콘솔 error/warn/issue 0**. 스크린샷 `evidence/s5-04-pdf-image-pin-restored.png`.

## 독립 검증팀 3렌즈 (세션 8)
- **백엔드 적대적**: BLOCKER 0. 상태머신·핀 좌표·카테고리 집계·soft delete·스코프·원자적 쓰기(tmp+os.replace, 단일 lock)·에러계약 PASS. **MAJOR-1 적발**(`patch_issue`가 create와 달리 핀-위치 불변식 미검증 → 전역 이슈에 PATCH로 부유 핀 부착·유령 시트 재배치 가능). MINOR: 삭제후 편집 가능·생성 시 종착상태 주입·**world 핀 NaN/Infinity 수락(JSON 직렬화 깨짐→콘솔 위협)**·self전이 no-op.
- **프론트 비기능/a11y**: BLOCKER/MAJOR 0. 모달 a11y(role/aria-modal/포커스트랩/ESC)·좌표 일관(S4 MAJOR-1 회귀 없음)·image 클램프·전이 가드·하드코딩 제거 PASS. MINOR: **딥링크 focusIssueId 잔존→issues 변경마다 선택 강제 재설정**·focusPin draw마다 재중심화·"열린 이슈" 탭에 닫힘 노출·핀 색상전용(색맹)·인라인폼 ESC 없음·검색 제목한정.
- **Done-When 비평가**: H1~H13 전부 MET/NARROWED, **침묵 좁힘 0건**. H12만 PDF/무핀 e2e 미실시로 NARROWED였으나 세션 8 e2e로 해소.

## 세션 8 수리 (적발 결함)
- **백엔드 MAJOR-1 수리**: `routes_issue.py patch_issue`에 핀-위치 불변식 추가 — 결과 이슈가 핀을 가지면 `_require_pin_location(file_id, sheet_id)` 강제(create와 동일). 라이브 재현 확인: 전역 이슈 부유 핀 PATCH→**400**, 핀 이슈 유령 시트 재배치→**404**(수리 전 둘 다 수락됨). 회귀 `test_issue_patch_pin_location_invariant`.
- **백엔드 MINOR(H12 위협) 수리**: `_validate_pin`에 `math.isfinite` 검사 추가 — world/image 공통 NaN/Infinity 거부(JSON 직렬화 깨짐·브라우저 JSON.parse throw 방지). 회귀 `test_issue_pin_rejects_non_finite`.
- **프론트 MINOR 수리**: `SheetViewerShell` 딥링크 effect에 `appliedFocusRef` 1회 적용 가드 — focusIssueId당 1회만 선택·탭 전환, 이후 issues 변경(상태변경·새 핀 작성)이 선택을 되돌리지 않음.

## 세션 7 자체 적발·수리
- POST `/api/issues` 빈 경로(`""`) trailing-slash 307 → no-slash 경로가 정답(프론트 일치) 확인. curl(Git Bash) body 전송 아티팩트("error parsing the body")는 S4 markup POST에도 동일 → 라우트 무관, 브라우저 경로 정상.
- `getByLabelText("제목")` 회귀: 필수 표시(`*`)로 라벨 텍스트 변동 → 입력에 `aria-label="제목"` 부여(시각 `*` 유지 + 접근명 일치).

## Done-When reconcile (H1~H13)
- **H1 생성 영속** — MET(A): 모달+뷰어 핀 둘 다 실 POST, no-op 제거. e2e+unit.
- **H2 목록 실데이터/필터/검색** — MET(A): 전역 3이슈 e2e, 정적 시드 제거.
- **H3 상태 변경 영속** — MET(A): 열림→진행중 e2e+fetch, 불가 전이 거부 unit.
- **H4 뷰어 핀 생성(world)** — MET(A): 실 DXF world (140819.7, 36724.7).
- **H5 핀 렌더+복원 고정** — MET(A): 새로고침 복원+focusPin 센터링.
- **H6 양방향 점프(딥링크)** — MET(A): DWG+PDF 딥링크 e2e.
- **H7 핀 선택적(전역 이슈)** — MET(A): 무핀 전역 이슈 e2e(pin:null).
- **H8 메타 충실·카테고리 실집계** — MET(A): 유형/담당자/카테고리/상태 + clash:1.
- **H9 백엔드 영속 모델** — MET(B json / C TypeDB 그래프): CRUD·soft delete·검증·스코프 pytest. TypeDB 그래프 직접적재는 후속(freeze 명시).
- **H10 PDF 핀(정규화)** — MET(A): image [0.5,0.5] e2e 생성·영속·복원.
- **H11 테스트 게이트** — MET(B): pytest 61·npm 83·build·diff clean.
- **H12 브라우저 e2e + 콘솔 0** — MET(A): DWG+PDF+무핀 e2e, 콘솔 0(세션 8 PDF/무핀 보강으로 NARROWED 해소).
- **H13 실 도면 기반 운영자 이슈** — MET(A): DWG 분전반 위치 + PDF 단선결선도 차단기 정격(둘 다 실 렌더 도면 기반, generic seed 아님).

## 잔여 비차단 부채 (S5 범위 외·후속)
- 백엔드: 삭제됨 이슈 편집 가능·생성 시 종착상태 주입(UI 경로로는 불가, 정상 경로 무영향)·없는 file_id 목록=빈배열(마크업과 일관).
- 프론트: focusPin draw마다 재중심화·"열린 이슈" 탭에 닫힘 노출(닫힘 전용 뷰 추가 시 해소, 설계 결정)·핀 색상전용 상태구분(텍스트 대체경로 존재)·인라인 폼 ESC·검색 제목한정·로드 race 가드.
- TypeDB 그래프 직접 쿼리화(JSON 미러 SoT 유지), 이슈 첨부/댓글/알림(ACC 협업), 권한 enforcement=S7.

---

# S6 — Build 홈 위젯 실데이터 + 전역 검색 (2026-06-30, 세션 8 — DONE)

> 메타프롬프트 `prompts/08-s6-home-search.md` FROZEN(AskUserQuestion 4결정: 미구현 위젯 정직한 빈 상태 · 카운트+이슈 분석 차트[신규 의존성 0] · 백엔드 `/api/search` 라우트+상단 전역검색 · 검색 대상 시트+이슈+파일/폴더 전부). acceptance **I1~I14 전부 MET**.

## 구현 요약
- **백엔드**: `routes_search.py` 신설 — `GET /api/search?q=&project_name=` 시트(완료 도면 sheets 번호/제목/이름)·이슈(제목, 삭제됨 제외)·파일(최신 버전 filename)·폴더(name) 대소문자 무시 부분일치 교차. 타입별 그룹 + 딥링크 식별자(file_id/sheet_id/issue_id/folder_id) + 결과 상한 20/타입·`truncated` 플래그. 빈/공백 q → 빈 결과. `main.py` 라우터 등록. 기존 store 목록 재사용(신규 엔티티 0).
- **프론트**: `homeStats.ts` 신설(순수 집계 헬퍼: 시트 수[완료]·고유 버전세트 파일 수·폴더 수·활성 이슈 수·상태별·저장용량 합·최근 업로드·작성일별 이슈 상태 + `formatBytes`). `BuildHomeView.tsx` 재작성(인라인 하드코딩 제거 → listDrawings/listIssues/listFolders fetch+집계, 빠른링크·저장용량·작업상태[이슈 실집계]·최근활동 실데이터, 진행률·구성원·작업·브리지·날씨는 정직한 빈 상태, 종합 탭 "작성일별 이슈 상태" 경량 인라인 SVG/CSS 누적막대 차트+양식 빈 상태). `GlobalSearch.tsx` 신설(상단바 전역 검색: 디바운스 250ms·결과 listbox 패널[시트/이슈/파일/폴더 그룹]·빈쿼리/무결과/로딩·바깥클릭 닫기·truncated 안내). `drawings.ts` `searchProject`+`SearchResults` 타입. `BuildSheetsView.tsx`(GlobalSearch 배선·딥링크 핸들러 searchOpenSheet/Issue/Folder·드로잉 로드 모든 섹션 1회+시트/이슈 폴링·홈 props). `IssuesView.tsx` `focusIssueId` preselect·`FilesView.tsx` `focusFolderId` 폴더 선택.

## 게이트 (전부 PASS)
- `npm run build` PASS · `npm test` **91 PASS**(신규: homeStats 3 + GlobalSearch 4 + BuildSheetsView 갱신) · backend `pytest` **67 PASS**(신규 S6 검색 6) · `git diff --check` clean.

## 브라우저 e2e (device, json 백엔드, 실 도면/이슈)
- **I1~I6 홈 개요 실데이터**: 홈 진입 → 빠른링크 **시트 15**(시트목록 15개 일치)·**파일 7**·**폴더 11**, **저장 용량 26.7 MB**(storage_bytes 합), 작업상태 "작업 없음 · 추가 예정"(정직한 빈) + **진행 중인 이슈 3개**(실집계), 최근 활동 **실 업로드**(plan_b/plan_a/plan_v1/EE-01-006/제주 BESS, 실 날짜). 스크린샷 `evidence/s6-01-home-overview-realdata.png`.
- **I7 분석 차트**: 종합 탭 → "작성일별 이슈 상태" 누적막대 차트(열림/진행중/답변됨/닫힘 범례, role=img), 양식 카드는 "양식 기능 추가 예정" 빈 상태. 신규 의존성 0(인라인 SVG/CSS). 스크린샷 `evidence/s6-02-home-analytics-issuechart.png`.
- **I8 정직한 빈 상태**: 진행률("일정 미구성")·구성원(빠른링크에서 제거)·작업·브리지("콘텐츠 없음·추가 예정")·날씨(제거)·양식 모두 가짜 하드코딩 수치 0.
- **I10/I11 전역 검색 + 딥링크**: 상단 검색 "EE" → 시트 2 + 파일 2 교차(스크린샷 `s6-03`). 시트 결과 클릭 → **뷰어 진입(EE-01-006)**. "케이블" → 전역 무핀 이슈 → 클릭 → **이슈 탭 전환 + 해당 이슈 자동 선택**(인스펙터 상세, 스크린샷 `s6-04`). "Drawings" → 폴더 → 클릭 → **파일 화면 + Drawings 폴더 선택**. "plan" → 시트 3 + 파일 1.
- **I13 콘솔 0**: 검색 입력 `name`+combobox ARIA 부여 후 error/warn/issue **0**.
- **I14 정합성**: 홈 시트 15 = 시트목록 15, 이슈 3 = 이슈탭 3(활성), 검색 결과는 실제 객체.

## 독립 검증팀 3렌즈 (세션 8)
- **백엔드 적대적**: BLOCKER 0. 부분일치·대소문자·완료필터·이슈 스코프/삭제제외·상한/truncated·빈쿼리·딥링크식별자·latest dedup PASS. **MAJOR 적발**: `GET /api/search`가 `list_folders`의 seed-on-create를 트리거 → 임의 project_name 검색만으로 폴더 트리 영속 생성(GET 안전성/멱등성 위반). MINOR: project_name=None 폴더 스코프 비대칭·pending 파일명 노출(FilesView와 정합, 방어가능).
- **프론트 비기능/a11y**: BLOCKER 0. fetch race 가드·디바운스·언마운트 정리·catch 폴백·신규 의존성 0·딥링크 배선·빈 상태 정직성 PASS. **조건부 MAJOR**: 홈 "진행 중인 이슈"=active(닫힘 제외) vs IssuesView "열린 이슈" 탭=비삭제 전체(닫힘 포함) → 닫힘 이슈 존재 시 카운트 불일치(현 데이터 닫힘 0 → e2e 3=3 일치). MINOR: combobox ARIA 미완성·차트 색맹·미사용 import·indexOf O(n²)·silent no-op.
- **Done-When 비평가**: I1~I14 전부 MET, **침묵 좁힘 0건**. 검색 4종 전부·신규 의존성 0·정직한 빈 상태 모두 freeze 준수. DONE 가능.

## 세션 8 수리 (적발 결함)
- **백엔드 MAJOR 수리**: `store.list_folders`에 `seed: bool=True` 파라미터 추가(abstract·Json·TypeDB), `routes_search`는 `seed=False`로 호출 → 검색이 폴더를 생성하지 않음. 라이브 재현: phantom 프로젝트 검색 → `folders:[]`(부작용 0), 기존 Study_Project Drawings는 정상 검색. 회귀 `test_search_does_not_seed_folders`.
- **프론트 MINOR 수리(내 편집 orphan/품질)**: `BuildHomeView` 미사용 import(`FolderClosed`/`Layers`) 제거·차트 `indexOf` O(n²)→map index. `GlobalSearch` combobox ARIA 보강(role=combobox·aria-expanded·aria-controls·listbox id). 검색 입력 `name` 부여(폼필드 콘솔 경고 해소).
- **조건부 MAJOR(I4/I14) 판단**: 홈 위젯은 "진행 중인 프로젝트 이슈"=active(열림+진행중+답변됨)로 의미가 정확하고, 현 데이터(닫힘 0)에서 이슈 탭과 e2e 3=3 일치. 닫힘 이슈 존재 시 두 뷰의 카운트 차이는 active-vs-all 의미 차이(S5 "열린 이슈" 탭 닫힘 노출 부채와 동일 근원) — 캡처 손실 없이 무리하게 통합하지 않고 **잔여 비차단 부채**로 기록.

## Done-When reconcile (I1~I14)
- **I1~I7** — MET(A): 홈 실데이터 로드·시트/파일/폴더 수·이슈 집계·최근활동·저장용량·이슈 차트 e2e 입증.
- **I8** — MET(A/C): 정직한 빈 상태, 가짜 수치 0(e2e 개요+코드).
- **I9** — MET(A): 검색 라우트 교차·부분일치·스코프·상한·빈쿼리, seed 부작용 수리. pytest 7+e2e.
- **I10/I11** — MET(A): 상단 전역 검색 + 시트/이슈/폴더 딥링크 e2e.
- **I12** — MET(B): build·npm test **91**·pytest **68**·diff clean.
- **I13** — MET(A): e2e 콘솔 0.
- **I14** — MET(A): 홈 집계가 시트목록·이슈탭·파일화면 실수와 일치(현 데이터).

## 잔여 비차단 부채 (S6 범위 외·후속)
- 홈 "진행 중인 이슈"(active) vs 이슈 탭(비삭제 전체) 카운트 차이 — 닫힘 이슈 존재 시 표면화(active 의미는 정확, 닫힘 전용 뷰=후속).
- 검색: project_name=None 시 폴더 스코프 비대칭·pending 파일명 노출·퍼지/하이라이트/랭킹 없음(부분일치까지).
- 홈: 차트 색맹 대응(세그먼트 색상전용)·구성원/날씨 카드 제거(빈 카드 보존 대신)·진행률/작업/브리지/양식/날씨 백엔드(각 후속·S7).

---

# S7 — 인증(로컬 모의) + RBAC 강제 + 프로젝트/구성원 영속 (2026-06-30, 세션 9 — 구현 DONE · 검증 부분완료 · 미커밋→커밋)

> 메타프롬프트 `prompts/09-s7-auth-rbac-members.md` FROZEN(AskUserQuestion 4결정: 로컬 모의 사용자 전환 · 백엔드 역할 기반 강제(403) · 구성원+프로젝트 둘 다 영속 · 정규화 역할 모델). acceptance J1~J12. **자동 게이트 GREEN + RBAC 라이브 강제 + 핵심 UI e2e 입증**, 다만 독립 검증팀 3렌즈·전체 Done-When reconcile·J7 Build 콘텐츠 UI 게이팅 일부는 **다음 세션 이월**.

## 구현 요약
- **백엔드**: `store.py` member/project/project_member CRUD + current_user(JSON `_members/_projects/_project_members/_auth.json`, TypeDB는 _MIRROR 위임, seed-on-create=4구성원+Study_Project 역할[개혁 관리자·도면검토자 편집자·고객열람자 뷰어]). `auth.py` 신설(역할 위계 뷰어<편집자<관리자, `require_role`/`require_role_for_file|folder|issue`, **미구성 프로젝트는 강제 안 함**=레거시/테스트 보존). `routes_auth.py` 신설(GET/PUT `/api/auth/me`·GET/POST `/api/projects`·구성원 GET/POST/PATCH/DELETE, 관리자 강제). 기존 mutation 라우트(folders·drawings 업로드/버전/삭제·markup/measurement·issue 생성/수정/삭제)에 `require_role(편집자)` 적용. `schema/04-drawings.tql` member/project/project_member entity. `main.py` 등록.
- **프론트**: `api/admin.ts` 신설(getMe/switchUser/listProjects/createProject/listMembers/listProjectMembers/addProjectMember/patchProjectMember/removeProjectMember). `App.tsx`(현재 사용자 getMe 로드·하드코딩 "개혁" 제거·BrandBar 사용자 전환 메뉴·프로젝트 백엔드 로드+낙관적 생성·currentRole→canManage). `BrandBar` 사용자 전환 드롭다운(combobox ARIA). `ProjectAdminView`(구성원 백엔드 listProjectMembers·추가 addProjectMember·역할변경 select enable→patchProjectMember·canManage 게이트). `BuildManagementView` 구성원 실데이터(project_member).

## 게이트 (전부 PASS)
- `npm run build` PASS · `npm test` **92 PASS**(ProjectAdminView 9 재작성 + App 2 admin 모킹) · backend `pytest` **74 PASS**(신규 S7 6, **기존 68 회귀 0** — 기본 current_user=관리자 + 미구성 프로젝트 미강제) · `git diff --check` clean.

## RBAC 라이브 강제 (브라우저 fetch 경로, json 백엔드)
- 뷰어(고객 열람자)로 전환 → Study_Project 폴더 생성 → **403** `"권한 부족: '편집자' 이상 필요 (현재 역할: 뷰어)"`.
- 관리자(개혁)로 복귀 → 폴더 생성 → **200**. (curl Git Bash는 body 아티팩트로 400 — 브라우저 경로가 정답, pytest도 동일 입증.)

## 브라우저 e2e (device, 콘솔 0)
- **J1 현재 사용자 + 전환**: 헤더/아바타 "개혁 이"(하드코딩 제거, getMe 실데이터) → 사용자 메뉴 4구성원 → "고객 열람자" 전환 → 헤더/아바타 "고객 열람자" 갱신 → 관리자 복귀.
- **J2 프로젝트 영속**: 프로젝트 목록 2개(Study_Project·Seaport, 백엔드 시드 로드).
- **J7 권한 UI**: 뷰어로 Project Admin → "구성원 추가"·역할 select **disabled**(스크린샷 `s7-01`). 관리자로 → 둘 다 **enabled**(스크린샷 `s7-02`). 콘솔 0.
- **구성원 실데이터**: Study_Project 구성원 3행(개혁 관리자·도면검토자 편집자·고객열람자 뷰어).

## 단위 테스트 입증(J3/J4/J5/J6/J9)
- backend: RBAC 뷰어 403·편집자/관리자 허용·구성원 관리 관리자 한정·역할변경·프로젝트 생성 생성자=관리자·current user 전환·join·seed.
- frontend: ProjectAdminView 구성원 로드·추가(백엔드)·역할변경·canManage 비활성·필터.

## 다음 세션 이월 (S7 DONE 선언 전)
- **독립 검증팀 3렌즈**(백엔드 적대 + 프론트 a11y + Done-When 비평가) — 미실시.
- **Done-When reconcile(J1~J12 + 증거등급)** — 미실시.
- **J7 Build 콘텐츠 UI 게이팅**: 현재 ProjectAdmin(추가·역할변경)만 UI 비활성. Build 업로드·폴더생성·마크업·이슈 작성 버튼은 **서버 403으로 차단되나 UI 사전 비활성 미적용**(currentRole를 Build 뷰로 thread 필요). 403 수신 시 사용자 안내도 후속.
- **J11 브라우저 e2e 확장**: 구성원 추가/역할변경 device 입증(unit 통과, 브라우저 미실시), 프로젝트 생성 영속 새로고침 복원 device.

## 잔여 비차단 부채 (S7 범위 외·후속)
- 실제 인증(비밀번호·세션·OAuth·로그아웃)=프로덕션 HUMAN_GATE 후속. 회사·액세스레벨(별도 축)·템플릿 구성원·알림 권한 매트릭스·프로젝트 데이터 격리 강제·구성원 초대 이메일=후속. TypeDB 구성원/프로젝트 직접쿼리화(JSON 미러 SoT 유지).

---

# S7 검증 마무리 (2026-07-01, 세션 10 — 이월분 완결 → S7 DONE)

> 세션 9 이월(3렌즈·reconcile·J7 Build UI 게이팅·J11 e2e 확장)을 모두 완결. **J7 Build 콘텐츠 UI 게이팅 구현 + 독립 3렌즈 실시 + 적발 결함 전량 수리 + 디바이스급 e2e + Done-When reconcile**. 자동 게이트 재실행 GREEN. **S7 DONE 선언.**

## J7 Build 콘텐츠 UI 게이팅 구현 (이월분)
- `canEdit = currentRole !== "뷰어"`를 `App.tsx`→`BuildSheetsView`→`FilesView`/`IssuesView`/`SheetViewerShell`로 스레딩(기본 true=레거시/편집, 뷰어만 false; 서버 미구성 프로젝트 미강제와 일관). 뷰어 게이트: **파일**(업로드·새폴더 disabled, 폴더행 메뉴 숨김, 도면행 새버전/삭제 숨김), **이슈**(작성·상태변경·삭제), **뷰어**(MarkupToolRail 작성도구 잠금·IssueDetailPanel·MarkupPropertyPanel·MeasurePanel). 비활성 컨트롤에 사유 title + 전역 `:disabled` 시각 처리(opacity 0.45·not-allowed) 추가.
- 프론트 게이팅 단위 테스트 신규 6(FilesView 3·IssuesView 1·MarkupToolRail 2).

## 독립 검증팀 3렌즈 (세션 10 — 신선한 Explore 3인 병렬)
- **렌즈1 백엔드 적대**: mutation 라우트 전수 강제표 작성 후 **BLOCKER 2 + MAJOR 3 적발** — (A) `create_project` require_role 없음+이름중복 병합 → 뷰어가 동명 프로젝트 생성으로 관리자 승격, (B) 클라 지정 `id`로 시드 프로젝트 덮어쓰기, (C) 이슈 생성이 자기신고 project_name으로 강제하나 실 file_id에 바인딩(우회), (D) 전 구성원 제거로 '미구성' 강등→RBAC 무력화, (E) 마지막 관리자 강등 락아웃. 위계 비교·회귀 기본값은 PASS.
- **렌즈2 프론트 비기능/a11y**: 우회 경로 축 PASS(뷰어 activeTool이 '선택' 외로 못 감→캔버스 무력) + **MAJOR 2 적발** — (1) 캔버스 게이팅이 툴레일 disabled 단일 의존(잠재 fail-open), (2) `FilesView`가 `PROJECT="Study_Project"` 하드코딩→canEdit 게이트와 데이터가 다른 프로젝트 참조. MINOR(로드중 fail-open·name키·a11f·controlled input).
- **렌즈3 Done-When 비평**: J1~J9·J12 코드 MET이나 증거등급 대부분 emulated/static, **J11 NARROWED**(브라우저 e2e 4요소 중 일부만), J5/J6 라이브 서버 403 미입증 지적. 프로세스 완결성(3렌즈·게이트 재실행) 분리 보고.

## 세션 10 수리 (적발 결함 전량)
- **백엔드**: (A) `create_project`에 `require_role(name,관리자)`+이름 중복 409+서버 생성 id(클라 id 무시). (B) 동상. (C) `create_issue`가 file_id 있으면 `require_role_for_file`로 실도면 역할 강제. (D/E) `patch/remove_project_member`에 **마지막 활성 관리자 제거·강등 차단**(400) 가드+`_active_admin_ids` 헬퍼.
- **프론트**: (1) `SheetViewerShell.selectTool`+`commitMarkup/Measurement`/`placePin`/`createIssueFromPin`에 `!canEdit` 방어심화 가드. (2) `FilesView`에 `projectName` prop 스레딩(BuildSheetsView가 `project.name` 전달)—데이터·게이트 동일 프로젝트 참조. MINOR(controlled input `?? ""`·disabled select title).
- **회귀 테스트**: 백엔드 신규 4(중복명 승격 차단·클라 id 무시·이슈 실file 강제·마지막 관리자 가드). 프론트 게이팅 6.
- **라이브 재검증(running server)**: 뷰어 create_project('Study_Project')→403·클라 id 시드 무손상·마지막 관리자 제거/강등→400.

## e2e 적발 추가 결함 + 수리
- 신규 프로젝트 생성 직후 생성자가 구성원 테이블상 관리자인데 ProjectAdmin 관리 컨트롤이 잠김 — `me.roles` 마운트 1회 로드 stale로 새 프로젝트 role 미반영. **수리**: `submitProject`가 생성 성공 시 `getMe()` 재로드. device 재확인(새 프로젝트 "S7 canManage 검증"→구성원 추가 버튼 활성, `s7-10`).

## 게이트 (전부 PASS — 세션 10 재실행)
- `npm run build` PASS · `npm test` **98**(기존 92 + 게이팅 6) · backend `pytest` **78**(기존 74 + 수리 회귀 4) · `git diff --check` clean.

## 브라우저 e2e (device, 콘솔 0 — chrome-devtools 실브라우저)
- **J1 전환**: 헤더 "개혁 이"→아바타 메뉴 "고객 열람자" 전환→"고객 열람자 님, 환영합니다." (`s7-03`).
- **J7 뷰어 게이팅(device·DOM 확인)**: 파일 업로드 `disabled=true`+title+opacity 0.45·새 폴더 동상·폴더행 메뉴 0개·도면행 메뉴는 읽기 항목만(뷰어열기/다운로드/버전이력, 새버전·삭제 숨김) (`s7-05`). 이슈 작성 `disabled=true`+title (`s7-06`). 뷰어 시트 MarkupToolRail: 선택만 활성, 9개 작성도구 `disabled=true`+"편집 권한이 없습니다(뷰어)".
- **J5 라이브 403(device)**: 뷰어 상태 브라우저 fetch `POST /api/folders`→**403** `{"detail":"권한 부족: '편집자' 이상 필요 (현재 역할: 뷰어)"}`.
- **J3 역할변경 영속(device)**: 고객 열람자 뷰어→편집자 변경→reload→**편집자 복원** (`s7-07`), 원복.
- **J2 프로젝트 생성 영속(device)**: "S7 검증 현장" 생성→reload→목록 복원(4개) (`s7-08`).
- **canManage 수리(device)**: `s7-10`.
- **콘솔**: 앱 유발 error/warn **0**(관측된 1건은 J5용 의도적 뷰어 probe 403 그 자체).

## Done-When reconcile (J1~J12 — 신선한 비평가 + 디바이스 재검증)
- **J1** 로컬 모의 현재 사용자+전환/복원 — **MET [device]** (헤더 전환·getMe 실데이터·하드코딩 제거).
- **J2** 프로젝트 영속 — **MET [device]** (생성→reload 복원, 생성자=관리자, state-only 제거).
- **J3** 구성원 영속+역할변경 — **MET [device]** (역할 select→PATCH→reload 편집자 복원).
- **J4** 정규화 역할 모델 — **MET [emulated+static]** (3역할·2상태·member↔project_member 조인·schema entity, pytest join).
- **J5** RBAC 강제 뷰어 403 — **MET [device]** (브라우저 fetch 403 + 라이브 curl + pytest 경계).
- **J6** RBAC 강제 편집자/관리자 — **MET [device+emulated]** (관리자 관리 활성 device·편집자 콘텐츠 허용/구성원관리 403 pytest+curl·위계 pytest).
- **J7** 권한 UI 반영 — **MET [device]** (파일·이슈·뷰어 툴레일 DOM disabled 확인 + 시각 처리 + canManage 수리).
- **J8** Build 구성원 실데이터 — **MET [static+emulated]** (BuildManagementView listProjectMembers).
- **J9** 백엔드 영속 모델 — **MET [emulated; TypeDB 미러=static]** (store CRUD+current_user+seed idempotent, pytest, 회귀 0).
- **J10** 테스트 게이트 — **MET [device/emulated]** (build·npm test 98·pytest 78·diff clean 재실행).
- **J11** 브라우저 e2e+콘솔0 — **MET [device]** (4요소 전부 device, 콘솔 앱유발 0). ← 세션9 NARROWED 해소.
- **J12** 실 시드 기반 — **MET [device+static]** (개혁 이·도면 검토자·현장 담당자·고객 열람자 실명, 브라우저+store 확인).
- **결론**: NARROWED/UNMET **0**. 프로세스 완결성(독립 3렌즈·게이트 재실행·reconcile) 모두 실시. → **S7 DONE.**

## 잔여 비차단 부채 (S7 이후·후속)
- 파일 없는 전역 이슈에 가짜 project_name(0-구성원) 지정 시 orphan 이슈 생성 가능(폴더/업로드와 동급 저영향, 실프로젝트 목록 미노출). 초기 me 로드 전 순간 fail-open(서버 403이 최종 게이트). 프로젝트명 키 역할 조회(rename 취약). 죽은 체크박스(일괄액션 미배선). TypeDB 미러 json 모드 static-only. 실제 인증(비밀번호·세션·OAuth)=HUMAN_GATE 후속.
