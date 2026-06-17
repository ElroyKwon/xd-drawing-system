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
| FR-IS-002 | 사용자는 프로젝트 이름 또는 번호로 목록을 검색하고, 검색어를 지우면 전체 mock 목록으로 돌아갈 수 있어야 한다. | ACC #6 검색 입력; `CHECKS.md` 초기 설정 수동 검증 |
| FR-IS-003 | 사용자는 `+ 프로젝트 만들기`를 눌러 프로젝트 목록 위에 중앙 `프로젝트 작성` 모달을 열 수 있어야 한다. | ACC #1 `ScreenShot Tool -20260612102152.png`; ACC #6 create CTA |
| FR-IS-004 | 프로젝트 작성 모달은 프로젝트 이름, 프로젝트 번호, 프로젝트 유형, 템플릿, 주소, 시간대, 시작일, 종료일, 프로젝트 값, 통화 입력 UI를 제공해야 한다. | ACC #1 분석 섹션; screenshot 직접 확인 |
| FR-IS-005 | 프로젝트 이름은 필수이며, 비어 있는 상태로 제출하면 validation state를 표시하고 프로젝트를 추가하지 않아야 한다. | ACC #1 필수 별표/모달 폼 패턴; `CHECKS.md` |
| FR-IS-006 | 유효한 프로젝트 이름으로 제출하면 로컬 mock 프로젝트가 목록에 1건 추가되고 모달이 닫혀야 한다. | `docs/feature-notes/001-initial-setup.md` create flow |
| FR-IS-007 | `취소` 또는 닫기 버튼은 모달을 닫되 프로젝트 목록을 변경하지 않아야 한다. | ACC #1 하단 `취소`; no-change flow |
| FR-IS-008 | 데스크톱과 모바일 폭에서 주요 버튼, 필드, 테이블/목록, 모달 텍스트가 겹치거나 잘리지 않아야 하며, 브라우저 콘솔 에러가 없어야 한다. | `CHECKS.md` UI 수동 검증; frontend guidance |
| FR-IS-009 | 이 slice의 데이터는 로컬 mock 데이터로만 동작해야 하며 인증, DB, API, Autodesk 계정, paid SDK, 배포를 요구하지 않아야 한다. | `HUMAN_GATE.md`; user instruction |

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
| FR-PA-002 | Show only members with ProjectMemberAccess for Study_Project. | `docs/superpowers/specs/2026-06-17-project-admin-member-access-design.md` |
| FR-PA-003 | Search project-access members by name or email. | ACC #2/#3 search affordance |
| FR-PA-004 | Select a member row and show right inspector details. | ACC #2 right inspector pattern |
| FR-PA-005 | Open add-existing-member modal. | ACC #2 `구성원 추가` action |
| FR-PA-006 | Block add submit when no member is selected. | Local validation requirement |
| FR-PA-007 | Block duplicate ProjectMemberAccess for the same project/member. | Product decision: one access record per project/member |
| FR-PA-008 | Add a valid existing member with selected role to Study_Project. | Local mock member access flow |
| FR-PA-009 | Keep Project, Member, and ProjectMemberAccess separate; exclude company/auth/DB/API. | User-confirmed scope boundary; `HUMAN_GATE.md` |

## Source Evidence

- `reference/acc-screenshots/ScreenShot Tool -20260612102152.png`
- `reference/acc-screenshots/Video Screen1781231401038.png`
- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #1, #6
- `docs/feature-notes/001-initial-setup.md`
- `reference/acc-screenshots/ScreenShot Tool -20260612102437.png`
- `reference/acc-screenshots/Video Screen1781227558018.png`
- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #2, #3
- `docs/feature-notes/002-project-admin-member-access.md`
- `SPEC.md`, `CHECKS.md`, `HUMAN_GATE.md`
