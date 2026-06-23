# PRD

## Feature Goal

초기 설정 slice는 허브 레벨에서 XD 도면관리 프로젝트를 확인하고 새 프로젝트를 로컬 mock 데이터로 작성하는 첫 화면을 정의한다. 구현 대상은 ACC #6 `프로젝트 목록`과 ACC #1 `프로젝트 작성 모달`의 UX 구조 재현으로 제한한다.

## Users

- Primary user: 도면관리 시스템을 처음 설정하는 프로젝트 관리자 또는 PMO 사용자.
- Secondary user: 프로젝트 목록을 검색하고 기본 진입 모듈을 확인하는 운영/설계 협업 사용자.

## In Scope

- 허브 레벨 프로젝트 목록 화면.
- `+ 프로젝트 만들기`에서 열리는 중앙 `프로젝트 작성` 모달.
- 프로젝트명 필수 검증.
- 유효한 작성 시 로컬 mock 프로젝트를 목록에 추가하는 흐름.
- 취소/닫기 시 목록을 변경하지 않는 흐름.
- 프로젝트명 또는 프로젝트 번호 검색.
- 검색, 필터 affordance, 컬럼/설정 affordance, 페이지네이션이 있는 ACC #6형 목록 레이아웃.

## Out Of Scope

- Project Admin 구성원, 회사, 역할, 권한 화면.
- 프로젝트 템플릿 관리 화면. 단, 작성 모달의 템플릿 선택 필드는 포함한다.
- Build 앱 셸, 시트 목록, 2D 뷰어, 마크업, 이슈, 파일, 사진.
- 인증, 권한 모델, DB 스키마, API persistence.
- Autodesk cloud/API, paid SDK, 외부 배포.
- 고객 또는 기밀 도면 파일.
- CAD editor 기능.

## Functional Requirements

| ID | Requirement | Source evidence |
|---|---|---|
| FR-IS-001 | 사용자는 허브 레벨 `프로젝트` 탭에서 프로젝트 목록을 볼 수 있어야 한다. 목록에는 유형, 이름, 번호, 기본 액세스, 허브, 작성 날짜 컬럼이 있어야 한다. | ACC #6 `Video Screen1781231401038.png`; `docs/feature-notes/001-initial-setup.md` |
| FR-IS-002 | 사용자는 프로젝트 이름 또는 번호로 목록을 검색하고, 검색어를 지우면 전체 mock 목록으로 돌아갈 수 있어야 한다. | ACC #6 검색 입력; manual UI verification |
| FR-IS-003 | 사용자는 `+ 프로젝트 만들기`를 눌러 프로젝트 목록 위에 중앙 `프로젝트 작성` 모달을 열 수 있어야 한다. | ACC #1 `ScreenShot Tool -20260612102152.png`; ACC #6 create CTA |
| FR-IS-004 | 프로젝트 작성 모달은 프로젝트 이름, 프로젝트 번호, 프로젝트 유형, 템플릿, 주소, 시간대, 시작일, 종료일, 프로젝트 값, 통화 입력 UI를 제공해야 한다. | ACC #1 분석 섹션; screenshot 직접 확인 |
| FR-IS-005 | 프로젝트 이름은 필수이며, 비어 있는 상태로 제출하면 validation state를 표시하고 프로젝트를 추가하지 않아야 한다. | ACC #1 필수 별표/모달 폼 패턴 |
| FR-IS-006 | 유효한 프로젝트 이름으로 제출하면 로컬 mock 프로젝트가 목록에 1건 추가되고 모달이 닫혀야 한다. | `docs/feature-notes/001-initial-setup.md` create flow |
| FR-IS-007 | `취소` 또는 닫기 버튼은 모달을 닫되 프로젝트 목록을 변경하지 않아야 한다. | ACC #1 하단 `취소`; no-change flow |
| FR-IS-008 | 데스크톱과 모바일 폭에서 주요 버튼, 필드, 테이블/목록, 모달 텍스트가 겹치거나 잘리지 않아야 하며, 브라우저 콘솔 에러가 없어야 한다. | UI manual verification; frontend guidance |
| FR-IS-009 | 이 slice의 데이터는 로컬 mock 데이터로만 동작해야 하며 인증, DB, API, Autodesk 계정, paid SDK, 배포를 요구하지 않아야 한다. | `AGENTS.md` approval rules; user instruction |

## Selected Second Product Slice: Project Admin Member Access

Goal:

- `Study_Project`의 Project Admin에서 프로젝트 접근 구성원 목록과 추가 흐름을 로컬 mock 상태로 검증한다.
- `Project`, `Member`, `ProjectMemberAccess`를 별도 리소스로 유지한다.

Users:

- Primary user: 프로젝트별 접근 구성원을 확인하고 역할을 부여하는 프로젝트 관리자.
- Secondary user: 프로젝트 접근 상태를 검토하는 PMO 또는 도면관리 운영자.

In scope:

- Current project context: `Study_Project`.
- Project Admin shell with `구성원` selected.
- Members with `ProjectMemberAccess` for `Study_Project`.
- Search by member name or email.
- Row selection and right inspector details.
- Add existing mock member modal.
- Empty selection and duplicate project/member validation.
- Role choices: `관리자`, `편집자`, `뷰어`.

Out of scope:

- Company information or company management.
- New user account creation.
- Email invitation.
- Real authentication, authorization, or RBAC enforcement.
- DB/API persistence.
- Access deletion/revocation.
- Autodesk cloud/API integration.

## Project Admin Functional Requirements

| ID | Requirement | Source evidence |
|---|---|---|
| FR-PA-001 | Render Project Admin member access view for Study_Project. | ACC #2/#3 screenshots; `docs/feature-notes/002-project-admin-member-access.md` |
| FR-PA-002 | Show only members with ProjectMemberAccess for Study_Project. | `docs/feature-notes/002-project-admin-member-access.md` |
| FR-PA-003 | Search project-access members by name or email. | ACC #2/#3 search affordance |
| FR-PA-004 | Select a member row and show right inspector details. | ACC #2 right inspector pattern |
| FR-PA-005 | Open add-existing-member modal. | ACC #2 `구성원 추가` action |
| FR-PA-006 | Block add submit when no member is selected. | Local validation requirement |
| FR-PA-007 | Block duplicate ProjectMemberAccess for the same project/member. | Product decision: one access record per project/member |
| FR-PA-008 | Add a valid existing member with selected role to Study_Project. | Local mock member access flow |
| FR-PA-009 | Keep Project, Member, and ProjectMemberAccess separate; exclude company/auth/DB/API. | User-confirmed scope boundary; `AGENTS.md` approval rules |

## Selected Third Product Slice: Build Shell And Sheets List

Goal:

- Enter an ACC Build-style project module for `Study_Project` and render the first drawing-facing screen: `시트`.
- Prove the module shell and sheet metadata list before implementing a 2D viewer or drawing storage.

Users:

- Primary user: 도면 목록을 검토하고 특정 시트를 찾는 프로젝트 도면관리 사용자.
- Secondary user: Build module navigation and sheet metadata structure를 확인하는 PMO 또는 운영 사용자.

In scope:

- Local entry from `Study_Project` to Build.
- Build shell with top header and left rail.
- `시트` selected in the left rail.
- Local mock sheet metadata table.
- Search by sheet number, title, discipline, or tag.
- List/grid view toggle affordance.
- Export, filter, row menu, and pagination affordances.

Out of scope:

- 2D viewer and drawing canvas.
- Sheet upload, publish, version compare, and file storage.
- Markup, issue, form, photo, file, and Bridge workflows.
- Real authentication, authorization, RBAC, DB/API persistence.
- Autodesk cloud/API, paid SDK, customer drawing data, deployment.

## Build Shell And Sheets Functional Requirements

| ID | Requirement | Source evidence |
|---|---|---|
| FR-BS-001 | Open a Build module shell for `Study_Project` from the project list. | ACC #8; ACC #6 default access `Build`; `docs/feature-notes/003-build-shell-sheets-list.md` |
| FR-BS-002 | Render Build top context and left rail navigation with `시트` selected. | ACC #8 and #10 left rail/header |
| FR-BS-003 | Show local mock sheets for `Study_Project` in a sheets table. | ACC #10 sheet list |
| FR-BS-004 | Show sheet thumbnail, number, version chip, version set, discipline, tags, last updater, and row menu affordance. | ACC #10 table columns and row structure |
| FR-BS-005 | Search sheets by number, title, discipline, or tag and restore all rows when cleared. | ACC #10 search/filter toolbar |
| FR-BS-006 | Provide list/grid view toggle affordance with list view as the functional view. | ACC #10 view toggle |
| FR-BS-007 | Provide export, filter, row menu, and pagination as local UI affordances only. | ACC #10 toolbar and footer |
| FR-BS-008 | Keep the slice local mock state only; no viewer/upload/storage/compare/markup/issues. | User scope boundary; `AGENTS.md` approval rules |
| FR-BS-009 | Avoid auth/RBAC, DB/API, Autodesk API, paid SDK, customer drawing data, and deployment. | `AGENTS.md` approval rules |

## Selected Fourth Product Slice: 2D Sheet Viewer First Slice

Goal:

- Continue from the Build `시트` list into an ACC #11-style 2D sheet viewer shell.
- Prove the viewing workflow as local-only UI with a static sheet render before real viewer engine, customer drawing, upload, markup persistence, or issue persistence work.
- Reserve an equipment entity ID / ontology binding slot in viewer state without connecting to TypeDB, DB/API, or schema work.

Users:

- Primary user: 도면 목록에서 특정 시트를 열어 검토하는 도면관리 사용자.
- Secondary user: 뷰어 위에 설비/온톨로지 바인딩이 붙을 위치를 검토하는 XD 제품 기획/운영 사용자.

In scope:

- Local entry from a mock sheet row into a viewer shell.
- Static sheet render area for a selected mock sheet such as `A001`.
- ACC #11-style right tool rail, bottom view controls, and left markup/issue panel affordance.
- Local UI state for selected tool, zoom/fit affordance, panel tab, and selected sheet.
- Empty markup/issues panel states.
- Viewer data slot for `equipmentEntityId` / ontology binding, with no real integration.

Out of scope:

- Real viewer engine evaluation or adoption.
- PDF/DWG/DXF parsing, tiled rendering, Canvas/WebGL renderer, Autodesk/APS-backed processing, or paid SDK work.
- Customer/confidential drawing files.
- Upload, publish, version compare, file storage, drawing sync.
- Markup creation/editing/persistence, issue creation/editing/persistence, calibrated measurement.
- Auth/RBAC, DB/API persistence, TypeDB/schema integration, Autodesk API, deployment.
- CAD editor scope.

## 2D Sheet Viewer Functional Requirements

| ID | Requirement | Source evidence |
|---|---|---|
| FR-SV-001 | Open a viewer shell for a selected local mock sheet from the Build `시트` list. | ACC #10 to #11 flow; `docs/feature-notes/004-2d-sheet-viewer-first-slice.md` |
| FR-SV-002 | Render selected sheet context with sheet number/title and project context. | ACC #11 title/context pattern |
| FR-SV-003 | Show a central static sheet render area without loading real drawing files. | ACC #11 central drawing canvas; local-only scope |
| FR-SV-004 | Render right-side viewer tool rail affordances for select, move, text, shape, pen, measurement, stamp, and color. | ACC #11 viewer toolbar |
| FR-SV-005 | Render bottom view controls for pan/fit/zoom/fullscreen/compare/measure as local affordances. | ACC #11 bottom controls |
| FR-SV-006 | Render left markup/issues panel affordance with empty states and tab switching. | ACC #12/#13 markup panel; #16 issues panel |
| FR-SV-007 | Preserve local sheet navigation context, optionally with filmstrip-style affordance. | ACC #23 filmstrip context; Build sheets list continuity |
| FR-SV-008 | Reserve `equipmentEntityId` / ontology binding in viewer state as a data slot only. | ACC analysis DKS differentiation notes; user instruction |
| FR-SV-009 | Keep real viewer engine, customer drawings, upload/publish, markup/issues persistence, DB/API/TypeDB, Autodesk, paid SDK, auth/RBAC, and deployment out of scope. | `AGENTS.md` approval rules; user instruction |

## Selected Fifth Planning Slice: DWG/DXF Upload Conversion Management

Goal:

- Prepare the Autodesk Cloud-like drawing upload path without turning the next implementation into a large cloud clone.
- Use local DWG to DXF conversion evidence to design the smallest useful upload/conversion management workflow.
- Keep ACC #11 `2D sheet viewer` local shell work separate from DWG/DXF processing, while defining the later integration point between converted drawing artifacts, viewer surfaces, issue overlays, and memo/markup workflows.

Users:

- Primary user: 도면 파일을 업로드하고 변환 상태와 추출 결과를 확인하는 도면관리 운영자.
- Secondary user: 변환된 도면에서 레이아웃, 시트 후보, 설비/도면 메타데이터를 검토하는 XD 제품 기획/엔지니어.

In scope:

- Local planning model for DWG intake, validation, conversion queue, DXF scan summary, and derived artifact tracking.
- Reference sample types: architectural floor plan, architectural enlarged plan, electrical equipment layout, communication equipment plan.
- Xref/package handling as a first-class validation concern.
- Layout and modelspace scan results that can become sheet/viewable candidates.
- Status model for queued, converting, scanned, failed, and render-risk states.
- A JSON traceability/progress artifact proposal for requirements, tasks, acceptance, tests, and conversion jobs.
- Official APS architecture research as benchmark evidence: Authentication, Data Management/OSS, Model Derivative, Viewer SDK, and Chrome DevTools debugging route.

Out of scope:

- Real Autodesk/APS credentials, developer hub provisioning, API calls, or paid usage.
- Product adoption of ODA, APS Viewer, Model Derivative, LibreDWG, or any other conversion/viewer engine without HUMAN_GATE.
- Customer/confidential drawing upload, storage, retention, deletion, or production sync.
- DB/API schema, TypeDB ingestion, auth/RBAC, deployment, and production object storage.
- Treating DXF conversion success as proof of viewer rendering quality.
- Closing Project Admin Task 6 or reusing any DUC/browser evidence for it.

## DWG/DXF Upload Conversion Functional Requirements

| ID | Requirement | Source evidence |
|---|---|---|
| FR-DUC-001 | The system design must provide a local drawing intake queue for selected DWG samples before any real customer upload is implemented. | Local conversion experiment; `docs/feature-notes/005-dwg-dxf-upload-conversion-management.md` |
| FR-DUC-002 | Intake validation must record file type, file size, source discipline, xref/package availability, and whether the file is eligible for conversion. | ODA/xref prior experiment findings; `FINDINGS.md` |
| FR-DUC-003 | The conversion design must model DWG to DXF jobs with status, start/end time, converter identity, input count, output count, and error messages. | Local ODA conversion result; APS Simple Viewer `POST /api/models` and status pattern |
| FR-DUC-004 | The scan design must extract DXF layouts, layer count, block count, entity counts, top INSERT names, and text samples. | Local `ezdxf` scan result |
| FR-DUC-005 | The design must identify sheet/viewable candidates from modelspace/layout evidence without assuming paperspace is populated. | Prior A04/A03 findings; converted DXF layouts with empty `배치` layouts |
| FR-DUC-006 | The design must separate conversion/scanning success from viewer rendering success and keep render quality as a distinct risk state. | Interrupted DXF render attempt; prior render performance findings |
| FR-DUC-007 | The design must define how converted artifacts can later connect to the Build `시트` list and ACC #11 viewer shell without changing the current SV scope. | Existing Build/SV document chain |
| FR-DUC-008 | The design must reserve future issue, memo, and markup overlays above the viewer surface without creating persisted records in this planning slice. | User instruction; ACC viewer/issue reference screenshots |
| FR-DUC-009 | The design must document official APS upload/translate/viewer architecture as benchmark research while keeping real APS use gated. | APS Simple Viewer, Viewer SDK, Model Derivative docs |
| FR-DUC-010 | The design must define a JSON traceability/progress artifact proposal for future loop automation, not as a current production data contract. | User reminder about JSON-shaped docs/progress; current Markdown ID traceability |
| FR-DUC-011 | The design must record an explicit upload format-to-feature matrix (which format unlocks viewing vs sheet-register vs issue/markup), using ACC reference behaviour. | `docs/feature-notes/009-acc-upload-format-feature-matrix.md`; Autodesk DOCS/BUILD/APS docs |
| FR-DUC-012 | The design must define two distinct ingestion paths mirroring ACC: a DWG-based viewer path (DWG→DXF→scan→viewable, the existing FR-DUC-001..007 chain) and a PDF-based sheet-register path (PDF→paged sheets→sheet register) that is the substrate for issue/markup/version-compare (FR-DUC-008). "Sheet/viewable candidate" (viewer) and "sheet register entry" (collaboration) are different concepts and must not collapse into one. | ACC Files vs Sheets behaviour; user decision 2026-06-23 (viewer=DWG, sheets=PDF) |

## Full ACC Visible Surface Coverage Addendum

Goal:

- Use all locally captured ACC screenshots as a visible product surface checklist.
- Implement every visible menu as at least a local clickable shell before deeper feature completion.
- Keep real persistence, auth/RBAC, Autodesk/APS, paid SDK, customer drawings, deployment, and destructive actions gated.

Source coverage:

- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` maps captured screenshots #1 through #37.
- `reference/acc-screenshots/` contains the original screenshot images used by that analysis.

Implementation level definitions:

- `Implemented`: local UI behavior exists and is covered by automated/browser evidence.
- `Visible shell`: menu opens a dedicated screen with representative local content, empty states, and core affordances, but no backend/persistence.
- `Planned/gated`: visible in PRD and UI as future/gated behavior; implementation requires a separate slice or human gate.

## Full Surface Functional Requirements

| ID | Requirement | Implementation level | Source evidence |
|---|---|---|---|
| FR-FS-001 | Hub `My Home` must show assigned-work, project, bookmark, and recent-item dashboard areas. | Visible shell | ACC #4/#5 |
| FR-FS-002 | Hub `프로젝트 템플릿` must open a dedicated template screen with sample-template cards and Hub template empty state, without deciding XD template scope. | Visible shell / gated | ACC #7; Autodesk template research |
| FR-FS-003 | Hub `허브 설정` must stay separate from Project Admin settings and show organization-level settings. | Visible shell | Hub/Admin separation decision |
| FR-FS-004 | Project Admin side navigation items `회사`, `브리지`, `액티비티`, `알림`, `위치`, and `설정` must open distinct project-admin screens. | Visible shell | ACC #2/#3 |
| FR-FS-005 | Build `홈` must open a project dashboard with progress, quick links, recent activity, and empty task/bridge widgets. | Visible shell | ACC #8/#9 |
| FR-FS-006 | Build `시트` must keep the existing local sheet table and allow opening a local viewer shell for a selected sheet. | Visible shell | ACC #10/#11 |
| FR-FS-007 | Viewer shell must show selected sheet context, static drawing surface, left markup/issues panel, right tool rail, bottom controls, and sheet filmstrip. | Visible shell / local-only | ACC #11~#17, #23 |
| FR-FS-008 | Viewer comparison affordance must show sheet compare and sheet picker concepts without real diff computation. | Visible shell / gated | ACC #18~#22 |
| FR-FS-009 | Viewer issue affordance must show issue detail fields, comments, activity log, and pin concept without persisted records. | Visible shell / gated | ACC #24~#29 |
| FR-FS-010 | Viewer markup affordance must show pen/shape/arrow/search concepts without persisted drawing edits. | Visible shell / gated | ACC #30~#32 |
| FR-FS-011 | Build `파일` must show folder tree, upload/folder actions, file table columns, search/filter, and empty/sample file state. | Visible shell | ACC #33 |
| FR-FS-012 | Build `이슈` must show issue list toolbar, create issue modal affordance, sample/empty list state, and inspector concept. | Visible shell | ACC #34~#36 |
| FR-FS-013 | Build `양식` must show a local placeholder screen and remain marked as screenshot coverage gap until source screenshots are captured. | Visible shell / source gap | ACC analysis missing item |
| FR-FS-014 | Build `사진` must show album/gallery/map tabs, media action affordances, project photo tree, and empty gallery state. | Visible shell | ACC #37 |
| FR-FS-015 | Build `구성원`, `브리지`, and `설정` management entries must open distinct project-work management screens instead of inert buttons. | Visible shell | ACC #8 rail |
| FR-FS-016 | Every visible shell must preserve Hub vs Project Admin vs Build project-work level separation. | Implemented | 2026-06-19 shell separation |
| FR-FS-017 | Any upload, issue deletion, template publishing, real compare, real markup persistence, file storage, auth/RBAC, DB/API, Autodesk/APS, TypeDB, paid SDK, customer drawing, or deployment behavior must remain blocked by approval rules. | Gated | `AGENTS.md` |

## Layout Compatibility (해상도/플랫폼 호환성)

> 2026-06-23 재정의: 해상도/픽셀 기반 반응형 요구사항(구 FR-RL-001~008)과 OS-배율 시각 QA 매트릭스 절차는 폐기했다. 픽셀 단위 반응형/뷰포트 매트릭스를 추적하는 대신 아래 단순 기준만 유지한다.

- **FR-LC-001** — FHD(1920)·4K 등 일반 데스크톱 해상도와 macOS 브라우저(Chrome/Safari)에서 레이아웃이 깨지지 않아야 한다: 가로 클리핑·요소 겹침·폰트 폴백 파손이 없어야 한다. 넓은 데이터 테이블은 셸 레이아웃을 밀어내지 않도록 전용 스크롤 컨테이너 내부에서만 가로 스크롤한다.
- **FR-LC-002** — 폰트 스택은 macOS(`-apple-system`/`Apple SD Gothic Neo`)와 Windows(`Segoe UI`/`Malgun Gothic`)에서 모두 자연스럽게 분기되어야 한다.
- **FR-LC-003** — 모바일/태블릿 반응형은 전 기능 완성 후 일괄 처리로 보류한다. 그 전에는 모바일 전용 분기를 새로 추가하지 않는다.

(기존 FR-IS-008·FR-FS 시리즈의 "겹치거나 잘리지 않아야 한다" 조항은 본 호환성 기준과 함께 그대로 유효하다.)

## Source Evidence

- `reference/acc-screenshots/ScreenShot Tool -20260612102152.png`
- `reference/acc-screenshots/Video Screen1781231401038.png`
- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #1, #6
- `docs/feature-notes/001-initial-setup.md`
- `reference/acc-screenshots/ScreenShot Tool -20260612102437.png`
- `reference/acc-screenshots/Video Screen1781227558018.png`
- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #2, #3
- `docs/feature-notes/002-project-admin-member-access.md`
- `reference/acc-screenshots/Video Screen1781231464329.png`
- `reference/acc-screenshots/Video Screen1781231492911.png`
- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #8, #10
- `docs/feature-notes/003-build-shell-sheets-list.md`
- `reference/acc-screenshots/Video Screen1781231512247.png`
- `reference/acc-screenshots/Video Screen1781231537335.png`
- `reference/acc-screenshots/Video Screen1781231557885.png`
- `reference/acc-screenshots/Video Screen1781231575003.png`
- `reference/acc-screenshots/Video Screen1781231601337.png`
- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #11 through #17
- `docs/feature-notes/004-2d-sheet-viewer-first-slice.md`
- `docs/feature-notes/005-dwg-dxf-upload-conversion-management.md`
- `reference/old-prototypes/prototype-도면지식관리-mvp/docs/ai-3d-builder/_archive-dxf-pivot-2026-04-22/parity-lab-p062/FINDINGS.md`
- Autodesk Platform Services Simple Viewer tutorial: https://get-started.aps.autodesk.com/tutorials/simple-viewer/
- Autodesk Platform Services Viewer SDK overview: https://aps.autodesk.com/developer/overview/viewer-sdk
- Autodesk Platform Services Model Derivative API overview: https://aps.autodesk.com/developer/overview/model-derivative-api
- `AGENTS.md`
