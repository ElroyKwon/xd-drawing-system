# S7 — 인증(로컬 모의) + RBAC 강제 + 프로젝트/구성원 영속  [STATUS: FROZEN 2026-06-30]

> ai-loop 스테이지 계약. `LOOP.md`·`PLAN.md` freeze 결정과 S1~S6(`prompts/01`~`08`) 결과를 상속한다. 구현 에이전트가 이 텍스트를 그대로 입력받아 자율 실행하고, **별도 검증팀이 아래 Acceptance checklist(J1~J12)로 항목별 채점**한다. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).

## Stage goal / Done-When

ACC Build의 **구성원·역할·권한**을 **실동작+영속+강제**로 만든다. 현재 프로젝트·구성원·access는 전부 React state(새로고침 시 소실)이고, 권한 메타(`_DEFAULT_PERMISSIONS`·`share_status`)는 저장·표시만 하고 검사가 0이며, "개혁"은 UI 하드코딩이고 백엔드에 인증·사용자·프로젝트·구성원 엔티티가 전무하다. LOOP.md Done-When "**S7 인증/RBAC + 프로젝트/구성원 영속**"과 PLAN "로컬 인증 + 역할(관리자·편집자·뷰어), projectAdminData 정적→영속, 프로젝트 생성/구성원 접근이 권한 반영"을 충족한다.

세 축:
1. **로컬 모의 인증** — 비밀번호/세션/OAuth 없이 백엔드에 "현재 사용자"를 영속하고 구성원 간 **전환** 가능. 새로고침에도 복원. "개혁" 하드코딩을 실 현재 사용자로 대체.
2. **프로젝트·구성원 영속** — `project`/`member`/`project_member`(역할·상태) 엔티티를 `DrawingStore`에 신설(JSON SoT + TypeDB 미러, S3~S6 패턴 계승). 프로젝트 목록/생성, 구성원 추가/검색/역할변경이 백엔드 영속. 정규화 역할 모델.
3. **RBAC 백엔드 강제** — 현재 사용자의 프로젝트 역할로 API가 실제 거부(403). 뷰어=읽기전용, 편집자=콘텐츠 mutation, 관리자=구성원 관리까지. 프론트는 같은 역할로 권한 없는 액션을 비활성/숨김.

**완료 정의**: (a) 사용자 메뉴에서 현재 사용자를 다른 구성원으로 전환→새로고침 복원, 화면의 사용자 표기·권한이 실제로 바뀐다. (b) ProjectAdminView에서 구성원 추가/역할변경(현재 disabled 해제)→백엔드 영속→새로고침 복원. (c) **뷰어**로 전환하면 폴더 생성·파일 업로드·삭제·마크업/이슈 작성이 서버에서 403으로 거부되고 프론트 버튼도 비활성. **편집자**는 콘텐츠는 되지만 구성원 관리는 거부. **관리자**는 전부 가능. (d) 프로젝트 생성이 백엔드 영속(생성자=관리자 자동)→새로고침 복원. 콘솔 0.

## 2026-06-29 user correction 계승

- 웹은 도면관리 업무공간이다. S7 증거의 구성원·역할은 실 시드(개혁 이=관리자·도면 검토자·현장 담당자·고객 열람자) 기반이어야 하며 generic 더미 금지.

## Co-design log (2026-06-30 사용자 확정 — AskUserQuestion 4결정 freeze)

- **(Q1) 인증 = 로컬 모의 사용자 전환.** 비밀번호 해시·세션 토큰·OAuth 없음. 백엔드에 `current_user`를 영속(`get_current_user`/`set_current_user`), 구성원 중 한 명으로 전환. 새로고침 복원. → 실제 로그인/세션은 범위 외(프로덕션 auth=HUMAN_GATE, 후속).
- **(Q2) RBAC = 백엔드 역할 기반 강제(403).** 역할 위계 뷰어 < 편집자 < 관리자. **뷰어**: 모든 mutation 거부(읽기만). **편집자**: 콘텐츠 mutation(폴더·파일·마크업·이슈 생성/수정/삭제) 허용, 구성원/역할 관리 거부. **관리자**: 전부. 강제 지점 = 현재 사용자의 **해당 프로젝트 역할**로 검사. → 프론트는 같은 역할로 UI 비활성(서버 403과 일관, 우회는 서버가 최종 차단).
- **(Q3) 영속 = 구성원 + 프로젝트 둘 다.** `project`/`member`/`project_member` 엔티티 신설. 프로젝트 목록/생성·구성원 추가/역할변경 모두 백엔드 영속(JSON SoT·TypeDB 미러). → 템플릿 구성원·회사 디렉터리는 범위 외(후속).
- **(Q4) 데이터 모델 = 정규화 역할 모델 영속화.** 기존 일반모드 모델(`Member` ↔ `ProjectMemberAccess` with role 관리자/편집자/뷰어·status 활성/대기)을 그대로 백엔드 영속화. `projectAdminData`의 순수 조인 헬퍼 계승. → 회사(company)·액세스레벨(access level, ACC의 별도 축)은 범위 외(후속).
- **(가정) 기존 게이트 비파괴.** 기본 `current_user`=시드 관리자(개혁)로 두어 S1~S6의 기존 mutation 테스트(67 pytest)가 그대로 통과. 강제는 뷰어/편집자로 전환했을 때만 발현.
- **(가정) seed-on-create.** project/member가 없으면 시드(Study_Project + 4 구성원 + 개혁=관리자) idempotent 생성(S3 폴더 패턴 계승). 데이터 스코프는 기존대로 `project_name` 문자열 유지(프로젝트 엔티티는 그 위 메타).

## Instruction (수행 단계)

1. **S7-a 백엔드 영속 모델**: `store.py`에 `member`(member_id·name·email·phone)·`project`(project_id·name·number·created_at·created_by)·`project_member`(project_name·member_id·role·status·added_at) CRUD + `current_user`(get/set) 추가(JSON `_members.json`/`_projects.json`/`_project_members.json`/`_auth.json`, TypeDB 미러). seed-on-create(Study_Project + 4구성원, 개혁=관리자 활성). 역할/상태 검증. `schema/04-drawings.tql`에 entity 추가.
2. **S7-b 인증/구성원 라우트**: 신규 `routes_auth.py`(또는 통합) — `GET /api/auth/me`(현재 사용자 + 프로젝트별 역할), `PUT /api/auth/me`(member_id로 전환), `GET /api/members`·`GET /api/projects/{project_name}/members`, `POST /api/projects/{project_name}/members`(관리자), `PATCH /api/members/{...역할/상태}`(관리자), `DELETE`(관리자), `GET /api/projects`·`POST /api/projects`(생성자=관리자 자동). 에러계약 일관.
3. **S7-c RBAC 강제 헬퍼**: `auth.py`(또는 store)에 `current_role(project_name)` + `require_role(project_name, min_role)` — 현재 사용자의 그 프로젝트 역할을 읽어 위계 검사, 미달이면 `HTTPException(403)`. 역할 위계 상수.
4. **S7-d 기존 라우트에 강제 적용**: 콘텐츠 mutation 라우트(`routes_files` 폴더 CRUD/share, `routes_drawing` 업로드/삭제/버전, `routes_markup` 마크업·측정 생성/삭제, `routes_issue` 생성/PATCH/삭제)에 `require_role(project_name, 편집자)` 적용. 구성원/역할 관리·프로젝트 생성은 `require_role(..., 관리자)`. 읽기(GET)는 무검사. **기본 current_user=관리자라 기존 동작·테스트 보존.**
5. **S7-e 프론트 API + 현재 사용자 컨텍스트**: `src/api/` 에 auth/members/projects API + 타입. `App.tsx`가 마운트 시 `GET /api/auth/me`로 현재 사용자·역할 로드(하드코딩 "개혁" 제거), 사용자 메뉴에서 전환(`PUT`)→재로드. 프로젝트 목록/생성을 백엔드 API로(state-only 제거).
6. **S7-f ProjectAdminView 실연결**: 구성원 추가/검색/역할변경을 실 API·영속으로(역할 `<select disabled>` 해제→변경 시 PATCH). `App.tsx`의 access state→백엔드. 정적 시드 제거.
7. **S7-g 권한 UI 반영**: 현재 사용자 역할에 따라 권한 없는 액션 비활성/숨김 — 뷰어: 업로드·삭제·폴더생성·마크업/이슈 작성·역할변경 버튼 disable. 편집자: 구성원 관리 disable. 서버 403과 일관(403 수신 시 사용자에게 안내).
8. **S7-h Build 구성원 화면 실데이터**: `BuildManagementView` 구성원 섹션 하드코딩 문자열 → `project_member` 실데이터(같은 소스).
9. **검증**: 백엔드 pytest(역할 위계·뷰어/편집자/관리자 403 경계·current user 전환·project/member CRUD·역할변경·seed·기존 테스트 회귀), 프론트 test(현재 사용자 로드·전환·구성원 영속·역할변경·권한 UI 비활성), `npm run build`·`npm test`·`git diff --check`. 브라우저 e2e(사용자 전환→권한 변화·구성원 추가/역할변경 영속·뷰어 mutation 403 차단·프로젝트 생성 영속) 스크린샷, 콘솔 0.

## Inputs

- 프론트: `src/App.tsx`(현재 사용자·프로젝트 목록/생성·access state), `src/ProjectAdminView.tsx`(구성원 테이블·추가 모달·역할 select disabled), `src/projectAdminData.ts`(정규화 모델·조인 헬퍼 — 백엔드 이관 소스), `src/build/BuildManagementView.tsx`(구성원 하드코딩), 신규 `src/api/*`(auth/members/projects).
- 백엔드: `backend/store.py`(엔티티 CRUD+current user), 신규 `backend/routes_auth.py`·`backend/auth.py`(RBAC 헬퍼), 기존 `routes_files`/`routes_drawing`/`routes_markup`/`routes_issue`(강제 적용), `backend/main.py`(등록), `backend/schema/04-drawings.tql`(entity).
- 스펙: `docs/Screenshot_Feature_Catalog.md` 구성원/역할/액세스 항목, `docs/buildout-loop/LOOP.md` Done-When S7. S3 권한 메타(`prompts/04`) 참고.

## Acceptance checklist (검증팀이 항목별 채점 — freeze 후 불변)

- [ ] J1. **로컬 모의 현재 사용자**: 백엔드에 현재 사용자 영속 + 구성원 전환(`GET/PUT /api/auth/me`). 프론트 사용자 메뉴 전환→새로고침 복원. "개혁" 하드코딩 제거(실 현재 사용자 표기).
- [ ] J2. **프로젝트 영속**: 프로젝트 목록/생성이 백엔드 영속, 새로고침 복원. 생성자=관리자 자동 부여. state-only 제거.
- [ ] J3. **구성원 영속 + 역할변경**: ProjectAdminView 구성원 추가/검색이 실 API·영속. 역할변경 `<select>` enable→PATCH 영속, 새로고침 복원.
- [ ] J4. **정규화 역할 모델**: 관리자/편집자/뷰어 3역할 + 활성/대기 상태. member ↔ project_member 정규화. schema entity 추가.
- [ ] J5. **RBAC 강제 — 뷰어**: 뷰어로 전환 시 폴더 생성·파일 업로드/삭제·마크업/이슈 생성/수정/삭제가 서버 **403** 거부. 읽기(GET)는 허용.
- [ ] J6. **RBAC 강제 — 편집자/관리자**: 편집자는 콘텐츠 mutation 허용·구성원/역할 관리 **403**. 관리자는 전부 허용. 위계 검사 정확.
- [ ] J7. **권한 UI 반영**: 현재 사용자 역할에 따라 권한 없는 액션 버튼 비활성/숨김(뷰어=업로드·삭제·작성·역할변경, 편집자=구성원 관리). 서버 403과 일관.
- [ ] J8. **Build 구성원 실데이터**: `BuildManagementView` 구성원 섹션이 `project_member` 실데이터(하드코딩 문자열 제거).
- [ ] J9. **백엔드 영속 모델**: store project/member/project_member CRUD + current user(JSON·TypeDB 미러), schema entity, 역할/상태 검증, seed-on-create. 기존 67 pytest 회귀 0.
- [ ] J10. **테스트 게이트**: 백엔드 pytest + 프론트 `npm test` + `npm run build` + `git diff --check` clean. RBAC 403 경계·전환·CRUD·역할변경 커버.
- [ ] J11. **브라우저 e2e + 콘솔 0**: 사용자 전환→권한 변화 + 구성원 추가/역할변경 영속 + 뷰어 mutation 403 차단 + 프로젝트 생성 영속 end-to-end 스크린샷, 콘솔 에러 0.
- [ ] J12. **실데이터 기반**: 구성원·역할이 실 시드(개혁=관리자·도면 검토자·현장 담당자·고객 열람자) 기반. generic 더미·하드코딩 문자열이면 불합격.

## Out of scope (S7에서 의도적으로 하지 않음)

- **실제 인증**(비밀번호 해시·세션/토큰·OAuth·로그아웃) — 로컬 모의 전환까지. 프로덕션 auth=HUMAN_GATE 후속.
- **회사(company) 디렉터리·액세스 레벨(access level)** — ACC의 별도 축. 역할(role)만. 후속.
- **템플릿 구성원·프로젝트 구성원 시드·알림 매트릭스 권한** — 템플릿 워크플로(후속). S7은 일반 프로젝트 구성원.
- **프로젝트 단위 데이터 격리 강제**(다른 프로젝트 데이터 접근 차단) — 데이터는 기존대로 `project_name` 스코프. 역할 강제만.
- **구성원 초대 이메일·@멘션·알림** — 후속.
- TypeDB 직접 쿼리화(JSON 미러 의존 유지), AI/온톨로지(S8), APS(전략상 배제).

## Freeze 답 (사용자 확정 — AskUserQuestion 2026-06-30)

1. 인증 = **로컬 모의 사용자 전환**(비밀번호/세션 없음).
2. RBAC = **백엔드 역할 기반 강제(403)**(뷰어<편집자<관리자).
3. 영속 = **구성원 + 프로젝트 둘 다**(project/member/project_member 엔티티).
4. 데이터 모델 = **정규화 역할 모델 영속화**(회사·액세스레벨 후속).

→ STATUS: FROZEN(2026-06-30). 실행·채점은 이 고정 텍스트 기준. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).
