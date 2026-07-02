# LOOP — 실동작 빌드아웃 루프 (supervisor contract)

> ai-loop 스킬용 감독 계약. appearance-loop(외관)의 **후속 루프**. 다음 세션은 `ai-loop` 스킬을 장착하고 이 파일 → `PLAN.md` → `PROGRESS.md` 순으로 읽어 **재시작이 아니라 이어받기**로 진행한다.
> 선행 루프: `docs/appearance-loop/`(외관 = DONE, 52 test PASS, product Done-When 전 항목 MET, 커밋 d4d87bd). 본 루프는 그 **완성된 React 외관에 실데이터·실동작을 붙인다.**

## Goal

ACC(Autodesk Construction Cloud) 벤치마크의 **실제 기능을 전부 동작 상태로 구현**한다. 외관 루프가 "보이는 것"을 완성했으므로, 본 루프는 정적 시드(`buildFilesData`·`viewerData`·`buildSheetsData`·`projectAdminData`)를 **실데이터·실연산·영속으로 교체**하고, 도면 업로드→변환→렌더→마크업/측정/비교/이슈→온톨로지까지 end-to-end로 동작시킨다.

핵심은 "새 화면 만들기"가 아니라 **"완성된 외관 affordance를 진짜로 작동시키기"**다.

## Loop type

**FULL loop** — 다슬라이스·다마일스톤, 백엔드/렌더링/온톨로지에 실제 판단이 걸림. 각 마일스톤마다 메타프롬프트 공동설계 → 구현 → 별도 검증팀 채점 → 기록.

## Frozen decisions (2026-06-25 사용자 확정)

1. **목표 = ACC 실기능 전체 구현(외관 아님).** 외관은 appearance-loop DONE으로 완성. 본 루프는 실동작.
2. **백엔드 = xd 소유 독립 로컬 풀스택 서버.** FastAPI + TypeDB(3.x) + 로컬 파일스토리지를 **xd-drawing-system 레포 안에** 둔다. 자매 프로젝트 `D:\_Project\Study_TypeDB`의 **검증된 도면처리 구현(`backend/api/routes/drawing.py`·`services/drawing_service.py`·`models/drawing.py`·`typedb/schemas/04-drawings.tql`, 250 테스트 PASS)을 코드로 가져와 이식**한다. **단 Study_TypeDB 레포에 런타임 의존하지 않는다** — xd가 자체 로컬 서버를 구동한다(엔지니어 PC 로컬, 메모리 `typedb-deployment-decision` 부합). API는 xd 소유.
3. **도면 렌더 = 3-way bake-off 비교.** 단일 엔진을 미리 확정하지 않는다. ① 하이브리드(PDF=pdf.js 자체 렌더 / DWG=ODA→DXF·PDF 변환 후 표시) ② 오픈소스 자체(ODA→DXF + three.js/canvas 벡터 렌더) ③ APS Viewer(Autodesk Platform Services SDK) — 세 접근을 **각각 구현해 동일 도면으로 퀄리티·공수·종속성을 나란히 비교**한다. 승자 채택은 비교 평가 후 **별도 게이트**. APS 정식 채택은 "Autodesk 비종속" 전략 변경 = HUMAN_GATE.
4. **첫 수직 슬라이스 = 업로드→변환→뷰어 end-to-end.** 실제 dwg/pdf를 업로드해 변환하고 뷰어에 표시하는 것이 1순위(S1). 백엔드 부트스트랩(S0)은 이 슬라이스를 동작시키기 위한 최소 기반으로 S1에 포함한다.

## Done-When (product) — ACC 카탈로그 A~I 전 영역 실동작

- [ ] **백엔드 기반**: xd 소유 로컬 서버(FastAPI+TypeDB+파일스토리지) 기동, 헬스체크·CORS·에러계약 정립. Study_TypeDB 도면처리 이식 완료, 런타임 의존 0.
- [ ] **A/B Hub**: 프로젝트 생성/목록/검색이 영속 데이터로 동작. 템플릿 적용이 실제 프로젝트 구성에 반영.
- [ ] **C Build 홈**: 진행률·작업·Bridge·최근활동 위젯이 실데이터 집계로 표시.
- [ ] **D 시트**: 업로드된 도면에서 시트가 추출되어 목록에 실데이터로 표시(번호·썸네일·버전·공종·태그). 검색/필터/정렬 실동작.
- [ ] **E 2D 뷰어**: 실제 도면이 렌더된다(3-way bake-off 중 채택 엔진). 팬/줌/핏 실동작.
- [ ] **F 측정·축척 교정**: 픽셀↔실척 캘리브레이션과 거리/면적 측정이 실제 연산.
- [ ] **G 시트 비교**: 두 버전 도면의 실제 오버레이/diff.
- [ ] **H 이슈**: 이슈 생성/조회/상태변경이 영속. 뷰어 핀 좌표가 시트에 연계.
- [ ] **I 파일**: 업로드·폴더·버전·다운로드·삭제가 실동작. 권한 반영.
- [~] **XD 고유(온톨로지)**: 도면 entity가 TypeDB에 적재되고 `equipmentEntityId` 바인딩이 동작(Study_TypeDB `analysis_result` 계승). AI 분석은 별도 단계. → **NARROWED: S10 온톨로지 스테이지로 연기**(2026-07-02, GATE-1 RESOLVED). S8은 사이드카 AI 챗에 집중, S8 DONE 전제에서 제외.

각 항목은 마일스톤 종료 시 신선한 비평가가 MET / NARROWED / UNMET + 증거등급으로 reconcile. NARROWED/UNMET는 DONE 차단 → `HUMAN_GATE.md`.

## Stop conditions

- 모든 Done-When 항목 MET + must-pass 게이트 PASS → DONE.
- 또는 HUMAN_GATE 항목 발생 → 정지·보고.
- 또는 한 마일스톤 종료 → 체크인 정지(예산 규칙, appearance-loop 선례 계승).

## Human gates (절대 자율 진행 금지 — AGENTS.md 승인 필요 항목)

- **APS Viewer 정식 채택**(bake-off 평가용 격리 테스트는 허용, 프로덕션 의존 전환은 게이트 — Autodesk cloud 종속·유료 translate·인증).
- **고객/기밀 도면 데이터 사용**(개발은 `reference/` 및 `D:\_Project` 샘플 도면으로, 고객 실데이터는 게이트).
- **인증/RBAC 프로덕션 적용**, **외부 배포**, **클라우드 백엔드 전환**(현 결정=로컬 풀스택).
- TypeDB 스키마는 Study_TypeDB 검증분 이식이므로 설계 게이트는 해소되나, **프로덕션 영속 정책 변경**은 게이트.

## Spec source (중복 생성 금지 — 기존 문서 재사용)

- 외관 스펙: `docs/PRD.md`(FR-FS·FR-DUC 슬라이스), `docs/Screenshot_Feature_Catalog.md`(A~J)
- 변환 파이프라인 설계: `docs/TRD.md` §DWG/DXF Upload Conversion(195~268), `docs/feature-notes/005`·`009`
- 이식 소스: `D:\_Project\Study_TypeDB\backend`(도면 API·서비스·TypeDB 스키마, 250 test PASS)
- 테스트 도면: `reference/old-prototypes/.../dwg/`(건축·전기·기계·구조·소방 다분야), `D:\_Project\Data_Knowledge_Studio\...\청주사업장신축`(전기 단선도·평면도 PDF)
- 마일스톤: `docs/buildout-loop/PLAN.md`
- 진행상태: `docs/buildout-loop/PROGRESS.md`
- 스테이지 메타프롬프트: `docs/buildout-loop/prompts/<stage>.md`
