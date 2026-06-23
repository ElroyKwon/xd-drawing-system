# 001 Initial Setup

## User Goal

첫 구현 slice를 ACC 허브 레벨의 `프로젝트 목록`과 `프로젝트 작성` 모달로 제한한다. 이 slice는 도면관리 앱의 실제 도면/뷰어 기능에 들어가기 전에, XD 도면관리 프로젝트를 만들고 목록에서 확인하는 초기 진입 화면을 정의한다.

## ACC Evidence

Screenshot files:

- `reference/acc-screenshots/ScreenShot Tool -20260612102152.png`
- `reference/acc-screenshots/Video Screen1781231401038.png`

Screen-analysis sections:

- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #1 `프로젝트 작성 모달`
- `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md` #6 `프로젝트 목록`

Supporting context only:

- #7 `프로젝트 템플릿` is used only as background for the template select in the create modal. The template management screen is not part of this slice.

## In Scope

- Hub-level project list screen based on ACC #6.
- `+ 프로젝트 만들기` action opens the project creation modal.
- Project creation modal based on ACC #1.
- Visible create fields:
  - 프로젝트 이름, required
  - 프로젝트 번호
  - 프로젝트 유형
  - 템플릿 선택
  - 주소 and manual-address affordance
  - 시간대
  - 시작일 and 종료일
  - 프로젝트 값 and 통화
- Required-name validation.
- `취소` and close actions dismiss the modal without changing the list.
- Valid `프로젝트 작성` action creates a local mock project entry and returns to the project list.
- Project list displays project type, name, number, default access, hub, created date, search, filter affordance, column/settings affordance, and pagination.
- Search filters mock projects by name or number.
- All data is local mock data for UI validation only.

## Out Of Scope

- Project Admin member/company/role screens.
- Project template management screen.
- Build module shell, sheets list, viewer, issue, markup, files, photos.
- Authentication, authorization, role-permission model, or tenant model.
- Database schema, API persistence, Autodesk cloud/API integration, paid SDKs.
- Customer or confidential drawing files.
- Deployment outside the local development machine.
- CAD editor behavior.

## User Flow

1. User opens the hub-level project list.
2. User reviews existing mock projects.
3. User searches by project name or project number.
4. User clicks `+ 프로젝트 만들기`.
5. System opens the centered `프로젝트 작성` modal over the project list.
6. User submits with an empty project name.
7. System shows a required-field validation state and keeps the modal open.
8. User enters a project name and optional metadata.
9. User clicks `프로젝트 작성`.
10. System adds the mock project to the list and closes the modal.
11. User reopens the modal and clicks `취소` or close.
12. System closes the modal without adding a project.

## Data Model For Slice

The implementation can use a local mock `Project` shape:

```text
Project
- id
- typeIcon
- name
- number
- projectType
- templateId
- address
- manualAddress
- timezone
- startDate
- endDate
- projectValue
- currency
- defaultAccess
- hub
- createdAt
```

Required behavior:

- Create: add one local mock project from the modal.
- Read: render mock projects in the project list.
- Update: not required in this slice.
- Delete: not required in this slice.
- Undo: not required because no delete or destructive operation is included.

## Planned Implementation Files

No implementation files are created in this documentation pass.

Expected implementation files will be decided when app scaffolding starts.

## Checks And Evidence

Relevant checks are manual UI verification of the initial setup slice.

Verification should be recorded in the active handoff path chosen for the session. This note itself does not claim implementation completion.
