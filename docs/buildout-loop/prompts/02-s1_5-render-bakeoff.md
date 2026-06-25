# S1.5 — 렌더 bake-off 풀 (2-way 승자 채택)  [STATUS: FROZEN — 2026-06-25 사용자 확인 완료]

> ai-loop 스테이지 계약. `LOOP.md`·`PLAN.md` freeze 결정과 `prompts/01-*`(S1 FROZEN) 결과를 상속한다. 구현 에이전트가 이 텍스트를 그대로 입력받아 자율 실행하고, **별도 검증팀이 아래 Acceptance checklist로 항목별 채점**한다. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).

## Stage goal / Done-When

S1 EVIDENCE A6의 **렌더 bake-off 비교초안**(①하이브리드만 실구현, ②③ 미구현 평가)을 **2-way 풀 비교 + 승자 채택 전환**으로 완성한다.

- **①하이브리드 래스터**(ezdxf+matplotlib→PNG / PyMuPDF) — S1에서 이미 구현·실측. 기준선.
- **②오픈소스 벡터**(DXF→three.js/canvas, 비종속) — **이번에 폭넓은 엔티티 커버리지로 신규 구현**.
- **③APS Viewer** — 사용자 결정으로 **bake-off에서 제외**(비종속 전략 위배). EVIDENCE에 "전략상 배제(데스크 평가 불요)"로 1줄 명기, 구현·평가 모두 안 함.

**완료 정의**: 동일 테스트 도면을 ①(PNG)·②(벡터)로 **나란히 렌더해 실측 비교표**(충실도·공수·종속성·성능·인터랙션)를 산출하고, **승자를 뷰어 기본 렌더 엔진으로 실제 전환**(엔진 토글 + 기본값 변경)까지 동작시킨다.

## Co-design log (2026-06-25 사용자 확정 — freeze된 결정)

- **(Q1) APS = 제외, 2-way로.** ③APS는 Autodesk cloud 종속·유료 translate·인증으로 비종속 전략에 위배 → bake-off 자체에서 뺀다. 데스크 평가도 불요. EVIDENCE 비교표에서 ③행은 "전략상 배제"로 표기.
- **(Q2) ②벡터 = 폭넓은 엔티티 커버리지.** 핵심 엔티티(LINE/LWPOLYLINE/POLYLINE/ARC/CIRCLE/ELLIPSE/TEXT/INSERT)에 더해 **HATCH·DIMENSION·MTEXT·중첩 INSERT(블록 explode)·레이어 토글**까지 충실 구현. ②의 장점(벡터 줌 무손실·레이어/선택 인터랙션)을 제대로 입증하는 수준.
- **(Q3) 승자 채택 전환까지.** 비교표 + 승자 권고에서 멈추지 않고, **승자를 뷰어 기본 엔진으로 실제 전환**한다(엔진 토글 UI + 기본 엔진 변경). ①·② **둘 다 로컬·비종속**이므로 둘 중 승자 채택은 LOOP.md의 HUMAN_GATE(=APS 정식 채택)에 **해당하지 않음 → S1.5 안에서 자율 전환 가능**. (게이트는 Autodesk 종속 전환에만 걸림.)
- **렌더 입력**: 백엔드가 S1에서 이미 `dxf_path`를 생성·보유. ②벡터 경로는 이 DXF를 입력으로 쓴다.
- **②구현 접근(권장, 구현 재량)**: 백엔드 `ezdxf`로 엔티티를 정규화 JSON으로 추출(블록 explode·HATCH 경계·DIMENSION 지오메트리 포함) → 새 엔드포인트로 서빙 → 프론트 three.js(또는 canvas2D)가 렌더. 충실도/공수 균형상 서버 추출을 권장하되, 클라이언트 DXF 파싱(dxf-parser 등)도 동등 충실도면 허용. **선택한 접근과 근거를 EVIDENCE에 기록**.
- **테스트 도면**: S1 대표 2장(DWG=평면도 A04.01~03 또는 elec-sld, PDF=청주 EE-01-006) **동일 유지**로 ①↔② 직접 비교. 벡터 충실도 차이를 드러낼 도면(치수·해치·블록 다수) 1장 추가 허용.

## Instruction (수행 단계)

1. **②-a 백엔드 엔티티 추출**: S1 `conversion.py`가 만든 DXF에서 `ezdxf`로 렌더 엔티티를 정규화 JSON으로 추출하는 경로 신설 — LINE/LWPOLYLINE/POLYLINE/ARC/CIRCLE/ELLIPSE/TEXT/MTEXT/INSERT(**중첩 블록 explode**)/HATCH(경계 경로)/DIMENSION(분해 지오메트리). 레이어·색상(ACI→RGB)·선두께 메타 포함. `GET /drawings/{id}/vector`(또는 동급) 서빙. (클라이언트 파싱 접근 채택 시: raw DXF 서빙 + 프론트 파서.)
2. **②-b 프론트 벡터 렌더러**: three.js(또는 canvas2D) 기반 벡터 뷰 컴포넌트 신설. 팬/줌(무손실)/핏, **레이어 토글**, 엔티티 색상·선두께 반영. `MarkupCanvas`/`SheetViewerShell`에 렌더 엔진 분기 추가(기존 ① PNG 경로는 보존). 의존성(three 등) `package.json` 추가.
3. **bake-off 실측 비교**: 동일 도면을 ①(PNG)·②(벡터)로 렌더해 **충실도(시각 정합)·공수·종속성·성능(로드/줌 체감, 가능하면 수치)·인터랙션(줌 무손실/레이어/선택)** 비교표를 EVIDENCE에 산출(③은 "전략상 배제" 1행). 벡터 줌 무손실 vs PNG 픽셀화를 스크린샷으로 대비.
4. **승자 채택 전환**: 비교 결과로 승자 선정 → 뷰어 **기본 렌더 엔진으로 전환**(엔진 토글 UI로 다른 엔진도 열람 가능하게 유지, 기본값만 승자로). 선정 근거를 EVIDENCE에 기록.
5. **검증**: 백엔드 pytest(엔티티 추출 회귀), 프론트 `npm test`(벡터 렌더 컴포넌트 회귀 + 기존 회귀 유지), `npm run build`·`git diff --check`. 브라우저에서 ①↔② 토글·벡터 줌 무손실·레이어 토글 스크린샷 증거.

## Inputs

- S1 산출물: `backend/conversion.py`(DXF/`dxf_path` 생성), `backend/routes_drawing.py`, `src/build/viewer/MarkupCanvas.tsx`, `src/build/SheetViewerShell.tsx`, `src/api/drawings.ts`, `src/buildSheetsData.ts`(`Sheet.imageUrl`).
- 테스트 도면: S1과 동일(§Co-design). `reference/`는 읽기 전용 — 업로드 테스트는 스테이징 복사본으로.
- 비교초안: `docs/buildout-loop/EVIDENCE.md` §A6(이번에 풀 비교표로 교체·확장).

## Acceptance checklist (검증팀이 항목별 채점 — freeze 후 불변)

- [ ] B1. ②벡터 경로가 S1 DXF를 입력으로 동일 도면을 **벡터 렌더**한다(정적 시드 아님, 실 업로드 도면).
- [ ] B2. 엔티티 커버리지: LINE·LWPOLYLINE/POLYLINE·ARC·CIRCLE·ELLIPSE·TEXT·MTEXT·INSERT(**중첩 블록**)·HATCH·DIMENSION이 렌더된다. 누락 엔티티는 EVIDENCE에 명시.
- [ ] B3. 벡터 인터랙션: **줌 무손실**(PNG 대비 픽셀화 없음)·팬·핏·**레이어 토글**이 실동작.
- [ ] B4. bake-off 실측 비교표: ①·② 충실도·공수·종속성·성능·인터랙션 나란히. ③은 "전략상 배제"로 표기. ①↔② 대비 스크린샷 첨부.
- [ ] B5. **승자 채택 전환**: 승자가 뷰어 기본 렌더 엔진으로 실제 전환(엔진 토글로 타 엔진 열람 유지, 기본값=승자). 근거 기록.
- [ ] B6. 백엔드 pytest PASS + 프론트 `npm test` PASS(신규 벡터 컴포넌트 회귀 + 기존 회귀 유지) + `npm run build` PASS + `git diff --check` clean.
- [ ] B7. 브라우저 콘솔 에러 0 + ①↔② 토글·벡터 줌 무손실·레이어 토글 스크린샷 증거 첨부.

## Out of scope (S1.5에서 의도적으로 하지 않음)

- ③APS Viewer 구현·평가(전략상 배제 — 게이트 무관, 아예 안 함).
- 마크업·측정·비교·이슈 **실연산/영속**(S4·S5). 벡터 위 마크업 좌표계 연동은 S4.
- 시트 레지스터 PDF 페이지 분할 경로(S2). PDF는 ①경로(PyMuPDF/표시) 유지, ②벡터는 DWG/DXF 대상.
- paperspace 빈 DWG 시트 자동분리 정밀화(S2).
- TypeDB 직접 쿼리화(S2+).

## Freeze 답 (2026-06-25 사용자 확정)

1. **APS** = bake-off 제외, 2-way(①래스터 vs ②벡터). EVIDENCE에 "전략상 배제" 명기.
2. **②벡터 충실도** = 폭넓은 엔티티 커버리지(HATCH·DIMENSION·MTEXT·중첩 블록·레이어 토글).
3. **종료 지점** = 비교표 + **승자 채택 전환**까지. ①vs② 채택은 비종속이라 게이트 무관·자율.

**테스트 도면 추가**: 사용자 미지정 → 구현 에이전트가 `reference/` 다분야 DWG에서 치수·해치·블록이 많은 도면 1장을 골라 EVIDENCE에 사유 기록.

→ STATUS: FROZEN. 실행·채점은 이 고정 텍스트 기준. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).
