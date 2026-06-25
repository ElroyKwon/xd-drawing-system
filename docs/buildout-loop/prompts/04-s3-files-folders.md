# S3 — 파일/폴더 관리 + 버전 히스토리 + 권한 메타  [STATUS: FROZEN — 2026-06-25 사용자 확인 완료]

> ai-loop 스테이지 계약. `LOOP.md`·`PLAN.md` freeze 결정과 S1(`prompts/01`)·S1.5(`prompts/02`)·S2(`prompts/03`) 결과를 상속한다. 구현 에이전트가 이 텍스트를 그대로 입력받아 자율 실행하고, **별도 검증팀이 아래 Acceptance checklist(D1~D9)로 항목별 채점**한다. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).

## Stage goal / Done-When

ACC Files(스크린샷 카탈로그 §I, 180047/180059) 화면을 **실동작**시킨다. `FilesView`의 정적 폴더트리(`fileFolders` 11폴더 시드)와 빈 테이블("--")을 **실 폴더트리 CRUD + 파일 메타 + 버전 히스토리 + 폴더 권한 메타**로 교체한다. 폴더를 만들고/이름변경/삭제하고, 파일을 폴더에 업로드하고, **같은 논리 파일에 새 버전을 명시적으로 추가**하면 버전 체인이 보관되고 최신 버전이 목록에 뜨며 이력을 조회할 수 있고, 다운로드/삭제가 동작한다. 폴더/파일의 **공유 상태·권한은 메타데이터로 모델링되어 실데이터로 표시**된다(인증·접근차단 강제는 S7).

**완료 정의**: 사용자가 폴더를 생성→그 폴더에 파일 업로드→같은 파일의 새 버전 추가(버전 2 표시·v1 이력 보관)→다운로드/삭제→폴더 이름변경/삭제가 모두 동작하고, 목록 테이블이 실데이터(이름·설명·버전·공유상태·크기·수정일·최종수정자·버전추가자)로 채워진다. 콘솔 0.

## Co-design log (2026-06-25 사용자 확정 — freeze된 결정)

- **(Q1) 권한 = 메타+표시까지, 인증/RBAC 강제는 S7 연기.** 폴더/파일에 `share_status`(예: 비공개/프로젝트 공유)와 폴더 권한 메타(역할별 접근 레벨 데이터 모델)를 붙이고 `FilesView` "공유 상태" 컬럼에 실데이터로 표시한다. **실제 로그인·접근차단(RBAC 강제)은 S7** — LOOP Human gate("인증/RBAC 프로덕션 적용") 부합. S3는 데이터 모델 + 표시 + 편집 UI까지, 강제 enforcement는 안 함.
- **(Q2) 영속 = DrawingStore 확장.** 기존 `store.py`의 `DrawingStore` 추상화에 **folder 엔티티 CRUD**(`add_folder`/`get_folder`/`list_folders`/`update_folder`/`delete_folder`)를 추가하고 drawing 메타에 `folder_id`를 부여. **JsonDrawingStore + TypeDBDrawingStore 두 백엔드 모두** 동일 API 구현(S1~S2 store 패턴 계승, JSON 미러 의존 유지). 신규 store 클래스 분리하지 않음.
- **(Q3) 버전 = 명시적 버전세트.** 한 논리 파일 = **버전 체인**(version_set). 같은 파일에 "새 버전 추가" 명시 액션 → 이전 버전 보관 + 최신 버전이 목록 1행으로 표시 + 버전 이력 조회(드롭다운/패널). 파일명 자동매칭 증가 **아님**. 재업로드는 항상 명시적 "버전 추가" 경로. ACC "버전 추가자" 컬럼 방식.
- **(Q4) 폴더 시드 = 기본폴더 백엔드 생성(seed-on-create).** 프론트 정적 `fileFolders` 11폴더 시드는 제거. 대신 **백엔드가 신규 프로젝트 첫 접근 시 ACC 기본 폴더 세트를 실제 레코드로 생성**(Bids·Contractors·Coordination·Correspondence·Drawings·For the Field·Handover·Quantity models·Supported files+PDFs 등). 이후 사용자 CRUD로 변경. 폴더는 정적 시드가 아니라 **백엔드 실데이터**.
- **(가정) S3 범위 경계.** 마크업/이슈 컬럼은 S4/S5 소관 — S3는 해당 컬럼을 **카운트 0 또는 placeholder로 유지**(무성 구현 금지, 한계 명시). 시트 비교(G)·측정(F) 무관.
- **(가정) 테스트 도면/파일.** `reference/`·`D:\_Project` 샘플 dwg/pdf를 스테이징 복사본으로 업로드. 버전 체인 시연은 같은 파일을 v1 업로드 후 (약간 다른) 파일을 v2로 "버전 추가". 폴더 CRUD·다운로드·삭제는 실제 HTTP 왕복으로 입증. 처리 결과를 EVIDENCE에 기록(무성 절단 금지).

## Instruction (수행 단계)

1. **S3-a 백엔드 폴더 CRUD**: `store.py` `DrawingStore`에 folder 메서드 추가(`add_folder`/`get_folder`/`list_folders(project_name)`/`update_folder`/`delete_folder`) — Json·TypeDB 두 구현 모두. folder 메타: `folder_id`·`project_name`·`name`·`parent_id`(트리)·`share_status`·`permissions`(역할별 레벨)·`updated_at`·`updated_by`. 신규 프로젝트 첫 `list_folders`에서 기본 폴더 세트 seed-on-create(중복 생성 방지·idempotent).
2. **S3-b 백엔드 라우트**: `routes_drawing.py`(또는 신규 `routes_files.py`)에 `GET/POST/PATCH/DELETE /api/folders`, 파일 다운로드 `GET /api/drawings/{id}/download`, 삭제 `DELETE /api/drawings/{id}`, 버전 추가 `POST /api/drawings/{id}/versions`(버전세트에 새 버전 append). 업로드(`POST /api/drawings`)에 `folder_id` 폼 필드 수용. 에러계약(404/400) 일관.
3. **S3-c 버전세트 모델**: drawing 메타에 `version_set_id`(논리 파일 키)·`version`(순번)·`is_latest` 부여. 같은 version_set의 이전 버전은 보관, `list_drawings`는 기본 최신만(또는 그룹). 버전 이력 조회 `GET /api/drawings/{id}/versions` 반환. traversal/경로 방어(S1 선례).
4. **S3-d 프론트 폴더트리 실동작**: `FilesView`가 `GET /api/folders` 조회로 트리 렌더(정적 `fileFolders` 제거). 폴더 생성/이름변경/삭제 UI(기존 affordance 활용) → API 연동. 폴더 선택 시 해당 폴더 파일만 필터.
5. **S3-e 프론트 파일 테이블 실데이터**: 선택 폴더의 `GET /api/drawings?folder_id=` → 테이블 실데이터(이름·설명·버전·공유상태·크기·수정일·최종수정자·버전추가자). 마크업/이슈 컬럼은 0/placeholder(한계 명시). 행 메뉴: 다운로드·삭제·새 버전 추가·버전 이력. 업로드 모달에 현재 폴더 타깃.
6. **S3-f 권한 메타 표시/편집**: 폴더/파일 `share_status`·권한을 테이블 "공유 상태" 컬럼에 실데이터 표시 + 편집 UI(메타만, 강제 없음). 인증/접근차단은 S7로 명시 연기(주석/문서).
7. **검증**: 백엔드 pytest(폴더 CRUD·seed idempotent·버전세트 append·다운로드·삭제·traversal 방어), 프론트 test(폴더트리 실데이터 렌더·버전 이력·필터 회귀), `npm run build`·`npm test`·`git diff --check`. 브라우저 e2e(폴더 생성→업로드→버전 추가→이력→다운로드→삭제→폴더 삭제) 스크린샷.

## Inputs

- 프론트: `src/build/FilesView.tsx`(폴더트리·테이블·업로드모달·행메뉴), `src/build/buildFilesData.ts`(`fileFolders`·`FileFolderRow` 제거 대상), `src/api/drawings.ts`(클라이언트 API 확장), 권한 참고 `src/projectAdminData.ts`(`MemberRole`).
- 백엔드: `backend/store.py`(`DrawingStore`·Json·TypeDB), `backend/routes_drawing.py`, `backend/conversion.py`, `backend/config.py`, `backend/main.py`(라우트/정적서빙).
- 스펙: `docs/Screenshot_Feature_Catalog.md` §I(180047 컬럼·폴더트리, 180059 업로드 모달), `docs/buildout-loop/LOOP.md` Done-When "I 파일"·Human gates.
- 테스트 파일: `reference/old-prototypes/.../dwg/`·`D:\_Project` 샘플(읽기전용 → 스테이징 복사본 업로드).

## Acceptance checklist (검증팀이 항목별 채점 — freeze 후 불변) — 전부 MET(2026-06-25, 3렌즈+e2e)

- [x] D1. **폴더 트리 실데이터**: `FilesView` 트리가 `GET /api/folders` 실데이터로 렌더(정적 `fileFolders` 제거). 신규 프로젝트는 ACC 기본 폴더 세트가 백엔드 실레코드로 seed-on-create(idempotent — 중복 생성 안 됨). → MET(브라우저 9폴더+PDFs)
- [x] D2. **폴더 CRUD**: 폴더 생성·이름변경·삭제가 HTTP 왕복으로 동작하고 트리에 반영. parent_id 트리 구조 유지. → MET(e2e 생성 + 단위 CRUD·parent 검증·cascade)
- [x] D3. **폴더 타깃 업로드**: 파일을 선택 폴더에 업로드 → `folder_id` 부여, 해당 폴더 목록에 표시. 폴더 선택 시 그 폴더 파일만 필터. → MET(plan_v1→전기도면 v3)
- [x] D4. **명시적 버전세트**: 같은 논리 파일에 "새 버전 추가" → 이전 버전 보관 + 최신(version 2, is_latest) 목록 1행 표시 + 버전 이력 조회 동작. 파일명 자동매칭 아님. → MET(v2·이력 v2/v1·1행)
- [x] D5. **다운로드/삭제**: 파일 다운로드(원본 반환)·삭제가 동작. 삭제 후 목록 반영. traversal/경로 방어. → MET(다운로드 링크·삭제·depth 가드)
- [x] D6. **파일 테이블 실데이터**: 이름·설명·버전·공유상태·크기·수정일·최종수정자·버전추가자가 실데이터. 마크업/이슈 컬럼은 0/placeholder(한계 명시·무성 구현 금지). → MET(설명만 placeholder=모델 부재)
- [x] D7. **권한 메타 표시**: 폴더/파일 share_status·권한 메타가 모델링되어 "공유 상태" 컬럼에 실데이터로 표시(+편집 UI). 인증/RBAC 강제는 S7 연기로 명시. → MET(수리 후: 파일 share 상속+폴더 공유 편집)
- [x] D8. **테스트 게이트**: 백엔드 pytest + 프론트 `npm test` + `npm run build` + `git diff --check` clean. 폴더 CRUD·seed idempotent·버전 append·traversal 커버. → MET(build·npm test 65·pytest 28·diff clean)
- [x] D9. **브라우저 e2e + 콘솔 0**: 폴더 생성→업로드→버전 추가→이력→다운로드→삭제 end-to-end 스크린샷, 콘솔 에러 0. → MET(전 흐름 e2e·콘솔 0)

## Out of scope (S3에서 의도적으로 하지 않음)

- **인증/로그인·RBAC 강제(접근 차단)** — S7. S3는 권한 **메타 모델 + 표시 + 편집**까지만.
- 마크업/이슈 실데이터(컬럼은 0/placeholder) — S4/S5.
- 측정·시트 비교(F/G) — S4.
- 시트 레지스터·변환 파이프라인 변경(S1/S1.5/S2 완료분 재사용, 회귀만 방지).
- TypeDB 직접 쿼리화(JSON 미러 의존 유지, 후속).
- 외부 스토리지/클라우드(로컬 파일스토리지 유지), AI/온톨로지(S8), APS(전략상 배제).

## Freeze 답 (사용자 확정)

1. 권한 = **메타+표시까지**(인증/RBAC 강제는 S7 연기, LOOP Human gate 부합).
2. 영속 = **DrawingStore 확장**(folder 엔티티 + drawing.folder_id, Json·TypeDB 양 백엔드).
3. 버전 = **명시적 버전세트**(버전 체인 보관·최신표시·이력조회, 파일명 자동매칭 아님).
4. 폴더 시드 = **기본폴더 백엔드 생성**(seed-on-create + 이후 CRUD, 정적 프론트 시드 제거).

→ STATUS: FROZEN. 실행·채점은 이 고정 텍스트 기준. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).
