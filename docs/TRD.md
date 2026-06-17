# TRD

## Technical Approach

초기 설정 slice는 planning gate PASS 이후 Vite + React + TypeScript + Vitest baseline으로 구현됐다. 현재 구현은 클라이언트 로컬 상태와 mock 프로젝트 데이터만 사용해 ACC #6 `프로젝트 목록`과 ACC #1 `프로젝트 작성 모달`의 UI/상호작용을 검증한다.

## Frontend Boundary

- 허브 레벨 프로젝트 목록 화면을 현재 app의 첫 진입 화면으로 둔다.
- 프로젝트 목록 데이터는 초기 mock 배열에서 읽는다.
- `+ 프로젝트 만들기`는 같은 화면 위에 modal state를 열고 닫는다.
- form state는 클라이언트 내부 상태로 유지한다.
- submit 시 프로젝트 이름 validation을 먼저 수행한다.
- 유효한 submit은 mock 배열에 1건 append한다.
- 검색은 클라이언트에서 프로젝트 이름과 번호를 대상으로 수행한다.
- 필터, 컬럼/설정, 페이지네이션은 ACC #6 레이아웃 affordance로 먼저 제공하고, 실제 고급 설정 기능은 후속 slice로 미룬다.

## Backend Boundary

- 이 slice에는 backend가 없다.
- REST API, database persistence, authentication, authorization, Autodesk account 연결은 만들지 않는다.
- 서버 상태, tenant model, role-permission model은 후속 설계/승인 전까지 다루지 않는다.

## Persistence Model

- Persistence: 없음.
- Runtime state: 브라우저 세션 내 local mock state.
- Reload behavior: 구현 시 새로고침하면 기본 mock 목록으로 돌아가는 것이 허용된다.
- Customer data: 사용하지 않는다.

## External Dependencies

- 현재 app baseline은 `package.json`의 Vite, React, TypeScript, Vitest, Testing Library 의존성을 사용한다.
- 후속 구현 단계에서 paid SDK, Autodesk API, customer drawing 사용이 필요한 경우 `HUMAN_GATE.md` 기준으로 먼저 확인한다.
- 저장된 screenshot/reference 문서는 읽기 전용 근거로만 사용한다.

## Explicit Non-Use

- No Autodesk cloud/API integration.
- No Autodesk account login.
- No paid SDK.
- No database schema.
- No production API.
- No auth/permission model.
- No deployment.
- No customer/confidential drawings.
- No CAD editor or DWG editing behavior.

## Requirement Mapping

| Requirement ID | Technical handling |
|---|---|
| FR-IS-001 | Render project list from local mock projects. |
| FR-IS-002 | Filter local mock projects by lowercase name/number match. |
| FR-IS-003 | Toggle modal visibility from create CTA. |
| FR-IS-004 | Maintain modal form state for listed fields. |
| FR-IS-005 | Block submit and show field-level validation when name is empty. |
| FR-IS-006 | Append one mock `Project` and close modal on valid submit. |
| FR-IS-007 | Close modal without state mutation on cancel/close. |
| FR-IS-008 | Validate layout manually in desktop/mobile browser and check console. |
| FR-IS-009 | Keep all data and integration boundaries local-only. |
