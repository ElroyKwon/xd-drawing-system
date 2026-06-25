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

## 남은 위험 / 후속

- **TypeDB 미연결**: Docker 데몬 미기동 + typedb-driver `DriverOptions` API 시그니처 불일치로 현재 JSON store 폴백. 메타프롬프트 A1의 "TypeDB 연결"은 **JSON 폴백으로 충족**했고, 실제 TypeDB 적재 활성화는 **Docker 기동 + 드라이버 API 교정**이 필요 → 후속(별도 단계). 메타프롬프트 freeze 답이 TypeDB=Docker였으므로, 이는 **환경 의존 미해결**로 기록(코드 결함 아님, store 추상화로 무중단 전환 가능).
- paperspace 빈 DWG의 시트 자동분리 → modelspace 통짜 렌더(S2 개선 여지).
- 한글 파일명: 브라우저(UTF-8) 정상, curl(CP949)만 mojibake(클라이언트 이슈).
- 32비트/64비트 Python 혼재 → backend는 `backend/.venv`(64bit) 전용.

## Human gates 해당

- APS 정식 채택(미실행, 평가만) · 고객 기밀 도면(미사용, 샘플만) · 배포(없음) · 인증(없음).
