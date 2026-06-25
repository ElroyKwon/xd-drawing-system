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
