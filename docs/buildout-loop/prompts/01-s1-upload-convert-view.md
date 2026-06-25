# S1 — 업로드→변환→뷰어 (메타프롬프트)  [STATUS: FROZEN — 2026-06-25 사용자 확인 완료]

> ai-loop 스테이지 계약. `LOOP.md`·`PLAN.md` freeze 결정을 상속한다. 이 텍스트는 구현 에이전트가 그대로 입력받아 자율 실행하고, **별도 검증팀이 아래 Acceptance checklist로 항목별 채점**한다. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).

## Stage goal / Done-When

실제 dwg/pdf 도면을 **xd-drawing-system 화면에서 업로드 → xd 소유 로컬 백엔드가 변환 → 시트 추출 → 2D 뷰어에 실제 도면 표시**까지 end-to-end 한 줄로 동작시킨다. 정적 시드가 아니라 **방금 업로드한 실파일**이 뷰어에 뜬다.

**완료 정의**: 테스트 도면 한 장을 UI에서 업로드하면, 백엔드가 변환·시트화하고, 뷰어 중앙 캔버스에 그 도면이 실제로 렌더된다. + 렌더 3-way bake-off 비교표 산출.

## Co-design log (freeze된 결정)

- **백엔드 = FastAPI(Python)**, xd 레포 `backend/`에 신설. Study_TypeDB가 FastAPI라 이식이 자연스럽다. TypeDB 로컬(Docker 또는 로컬 인스턴스) + 로컬 파일스토리지.
- **이식 소스**: `D:\_Project\Study_TypeDB\backend`의 `api/routes/drawing.py`·`services/drawing_service.py`·`api/models/drawing.py`·`typedb/schemas/04-drawings.tql`. 코드를 가져와 xd에 맞게 정리하되 **Study_TypeDB 레포에 런타임 의존 0**.
- **변환 도구**: `ezdxf`(DXF 스캔), `ODA File Converter`(`C:\Program Files\ODA\ODAFileConverter 27.1.0`, DWG→DXF), 시트 PNG는 `matplotlib`/`Pillow`(Study_TypeDB 보유) 또는 ODA PDF 경로.
- **렌더 bake-off(사용자 확정)**: ①하이브리드(PDF=pdf.js / 시트 PNG 표시) ②오픈소스(DXF→three.js/canvas 벡터) ③APS Viewer(격리 평가). **승자 채택은 비교 후 별도 게이트**.
- **S1 완료 범위(확인 1 = 1엔진 + 비교초안)**: walking skeleton 1엔진(권장: 하이브리드 PNG/pdf.js)으로 **end-to-end가 실제 동작하면 S1 완료**. 나머지 2엔진(오픈소스·APS)의 풀 구현·충실화는 **S1.5로 분리**. S1에서는 3엔진 비교표의 **초안**(접근·공수·종속성 평가)까지만.
- **TypeDB 기동(확인 2 = Docker)**: `typedb/typedb:3.7.3` Docker 컨테이너(Study_TypeDB와 동일). `docker run -d --name typedb -p 1729:1729 -v typedb-data:/var/lib/typedb/data typedb/typedb:3.7.3`.
- **테스트 도면(확인 3 = 대표 2장 고정)**: DWG 1장 = `reference/old-prototypes/prototype-도면지식관리/public/drawings/elec-sld.dwg`(소형 단선도), PDF 1장 = `D:\_Project\Data_Knowledge_Studio\data\raw\청주사업장신축\전기도면\EE-01-006_6-6kV_변전설비_단선결선도_-R-Center_변전실.pdf`. 변환 불가 시 같은 폴더 동급 도면으로 1:1 대체하고 EVIDENCE에 사유 기록.

## Instruction (수행 단계)

1. **S1-a 백엔드 부트스트랩**: `backend/`(FastAPI) 신설 — 앱 엔트리, 설정(.env), CORS(vite 5173/5174 허용), 헬스체크 `GET /health`, 통일 에러계약. TypeDB 클라이언트 연결(스키마 `04-drawings.tql` 이식·적용). 로컬 `uploads/` 스토리지. 프론트 dev 프록시 또는 baseURL 설정.
2. **S1-b 업로드**: `FilesView`/시트 업로드 모달의 정적 셸을 실제 `<input type=file>` + 멀티파트 업로드로 교체. `POST /drawings`(파일 저장 + `drawing_file` 적재 + `conversion_status=pending`) 구현·연결. 업로드 진행/실패 UI 상태.
3. **S1-c 변환**: 백그라운드 변환(`process_drawing_in_background` 계승). DWG는 ODA→DXF, ezdxf 스캔(layouts·layers·blocks·INSERT·extents), 시트 추출, 시트별 PNG 생성(`png_path`), `drawing_sheet` 적재, `conversion_status` 갱신. 폴링 또는 SSE로 상태 표시.
4. **S1-d 뷰어 + bake-off**: `SheetViewerShell` 중앙 캔버스를 실 렌더로 교체. 먼저 1엔진(권장: 하이브리드 PNG/pdf.js)으로 end-to-end 성립 → three.js DXF 렌더 추가 → APS 격리 평가. 동일 테스트 도면으로 **퀄리티(시각 충실도)·공수·종속성·성능 비교표** 작성(`docs/buildout-loop/evidence/` 또는 EVIDENCE.md §S1).
5. **검증**: 백엔드 테스트(pytest, 업로드·변환·조회), 프론트 테스트(업로드 흐름 회귀), `npm run build`·`npm test`·`git diff --check`. 브라우저 실제 업로드→렌더 스크린샷 증거.

## Inputs

- 테스트 도면: `reference/old-prototypes/prototype-도면지식관리-mvp/dwg/1) 건축공사/1. 건축/1. 도면/*.dwg`(다분야), `reference/old-prototypes/prototype-도면지식관리/public/drawings/*.dwg`(elec-sld 등 소형), PDF는 `D:\_Project\Data_Knowledge_Studio\...\청주사업장신축\전기도면\*.pdf`. ※ `reference/`는 읽기 전용(원본 수정 금지) — 업로드 테스트는 스테이징 복사본으로.
- 이식 소스/스펙: `LOOP.md` Spec source 절 참조.

## Acceptance checklist (검증팀이 항목별 채점 — freeze 후 불변)

- [ ] A1. `backend/` FastAPI 기동, `GET /health` 200, TypeDB 연결 OK, CORS로 프론트에서 호출 성공.
- [ ] A2. Study_TypeDB 도면처리 이식 완료, xd 레포가 Study_TypeDB 경로에 **런타임 의존 0**(import/path 검증).
- [ ] A3. UI에서 실제 파일 선택→업로드 시 `POST /drawings` 성공, 서버 `uploads/`에 저장, `drawing_file` TypeDB 적재.
- [ ] A4. 백그라운드 변환이 DWG→DXF→시트 PNG 생성, `drawing_sheet` 적재, `conversion_status`가 pending→done 전이. 실패 시 에러 메시지.
- [ ] A5. `SheetViewerShell` 중앙에 **방금 업로드한 실제 도면**이 렌더된다(정적 시드 아님). **1엔진 end-to-end 성립이 S1 합격선**.
- [ ] A6. 렌더 bake-off **비교초안** 산출 — 1엔진 구현 결과 + 나머지 2엔진(오픈소스·APS)의 접근·공수·종속성 평가표. 3엔진 풀 구현은 S1.5(여기선 비차단). APS는 격리 평가(프로덕션 의존 0).
- [ ] A7. 백엔드 pytest PASS + 프론트 `npm test`(업로드 회귀 포함) PASS + `npm run build` PASS + `git diff --check` clean.
- [ ] A8. 브라우저 콘솔 에러 0, 업로드→렌더 스크린샷 증거 첨부.

## Out of scope (S1에서 의도적으로 하지 않음)

- 마크업·측정·비교·이슈 **실연산/영속**(S4·S5). S1은 뷰어 표시까지.
- 시트 레지스터 PDF 페이지 분할 경로(S2) — S1은 DWG 뷰어 경로 우선(PDF는 단순 표시만).
- 파일 버전 히스토리·폴더 권한(S3).
- 인증/RBAC(S7), AI 분석/온톨로지 바인딩 심화(S8).
- APS 정식 채택(게이트), 클라우드 배포(게이트), 고객 기밀 도면(게이트).

## Freeze 답 (2026-06-25 사용자 확정)

1. **S1 완료 범위** = 1엔진 end-to-end + 비교초안. 나머지 2엔진 충실화는 S1.5.
2. **TypeDB 기동** = Docker(`typedb/typedb:3.7.3`).
3. **테스트 도면** = 대표 2장 고정(elec-sld.dwg + 청주 EE-01-006 단선도 PDF). 변환 불가 시 동급 1:1 대체.

→ STATUS: FROZEN. 실행·채점은 이 고정 텍스트 기준. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).
