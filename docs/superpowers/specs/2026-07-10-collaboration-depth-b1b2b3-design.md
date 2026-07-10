# FROZEN 스펙 — 운영 협업 깊이 B1·B2·B3 (2026-07-10)

> 운영 시나리오 감사(세션34)에서 드러난 "다른 ID가 대응하는" 협업의 3대 미구현 갭을 채운다.
> 단일 사용자 도면 라이프사이클은 이미 완료. 본 스펙은 **다중 사용자 협업 깊이**만 대상.
> 기준선(JSON store). TypeDB / 실인증(GATE-6) / 실메일(GATE-5)은 스코프 밖(설계상 이연).

## Goal / Done-When

시나리오 "A가 이슈를 남기고 → **다른 ID(B, 협력사/현장)가 대응(답글)을 남기고** → 개정본 버전업 → **그 이슈를 해결한 버전에 연결** → 버전이 바뀌어도 **이슈가 시트를 따라간다**"가 데이터로 닫힌다.

- **B1** 이슈 댓글/답글 스레드(append-only). 다른 사용자가 답글을 나란히 쌓을 수 있다.
- **B2** 이슈 ↔ 해결버전 연결. 이슈가 자신을 고친 도면 버전을 데이터로 가리킨다.
- **B3** 이슈가 `sheet_key`를 계승 → 버전업으로 `sheet_id`가 재발급돼도 이슈가 최신 시트에 따라붙는다.

## 설계 (데이터 shape·정확)

### B1 — 댓글 스레드
- 이슈 레코드에 `comments: list` 임베드(이슈는 재변환 대상이 아니라 소멸 위험 없음). 각 댓글:
  `{"comment_id": uuid, "author_id": member_id|None, "author_name": str, "body": str, "created_at": iso}`
- 신규 라우트: `POST /api/issues/{issue_id}/comments`  body=`{ "body": str }` → 이슈에 append, 갱신 이슈 반환.
- 신규 라우트: `GET /api/issues/{issue_id}` (단건, 댓글 포함) — 상세 새로고침용(현재 목록 전용).
- store 신규: `add_issue_comment(issue_id, comment) -> Optional[dict]` — **append-only**(덮어쓰기 금지), 갱신 이슈 반환. 없으면 None.
- 권한: **뷰어 이상(프로젝트 구성원 누구나) 댓글 가능** — "협력사(뷰어)가 현장 확인을 남긴다" 시나리오를 살리고, 이슈 생성/상태변경은 편집자 유지(상태 오염 없이 목소리만 전달). author=`store.get_current_user()`를 요청 시점에 고정.
- 알림: `notifications.notify_issue_event("commented", issue, project_name, actor=current)` 재사용. 실패해도 댓글 성공.

### B2 — 해결버전 연결
- 이슈 레코드에 `resolution: {"file_id": str, "version_no": str|int, "note": str}|None`.
- `IssuePatch`에 `resolution: Optional[dict]` 추가 → `update_issue` 화이트리스트에 `resolution` 추가.
- 검증: `resolution.file_id`가 주어지면 존재하는 도면이어야(없으면 404). `resolution=None`으로 해제 허용(명시 clear).
- 강제 아님(닫힘 전이와 독립) — 있으면 이슈→버전 링크가 데이터로 존재.

### B3 — sheet_key 계승
- `create_issue`가 `file_id`+`sheet_id`를 가지면 sheet_key를 해석해 이슈에 `sheet_key` 저장.
  해석: 도면 row에서 sheet_id에 맞는 시트의 `sheet_number`/`sheet_index` + `version_set_id(=row.version_set_id or file_id)` → `store.resolve_sheet_key(...)`. 없으면 `store.issue_sheet_key(...)`로 발급(멱등).
- `list_issues`에 `sheet_key` 필터 추가(store + 라우트 쿼리 파라미터).
- 소급: `scripts/backfill_issue_sheet_keys.py` — file_id+sheet_id 있는 기존 이슈에 sheet_key 채움(멱등).
- `sheet_key`는 `file_id`처럼 **불변**(update_issue 화이트리스트 미포함).

## 건드리는 파일
- `backend/routes_issue.py` (댓글 POST/GET 단건, IssuePatch.resolution, create의 sheet_key 해석, list의 sheet_key 파라미터)
- `backend/store.py` (추상 + JsonDrawingStore + TypeDbDrawingStore: `add_issue_comment`, update_issue 화이트리스트에 `resolution`, list_issues에 `sheet_key`)
- `backend/notifications.py` ("commented" 이벤트 문구 — 기존 이벤트맵 있으면 확장)
- `scripts/backfill_issue_sheet_keys.py` (신규)
- 프론트: `src/build/IssuesView.tsx`(댓글 목록+입력, 해결버전 표시/설정), `src/api/issues.ts` 또는 해당 API 클라(addComment/getIssue/patch resolution), 시트 스코프 이슈 조회를 `sheet_key` 기준으로.
- 테스트: `backend/tests/test_s5_issues.py` 확장 + `src/**/IssuesView.test.tsx`(있으면) 확장.

## Acceptance (FROZEN — 구현 중 변경 금지)
- **C1** 뷰어 권한 사용자가 `POST .../comments` 성공, 이슈 `comments`에 append(author=현재유저, created_at 존재). 두 번 호출 시 2건 공존(append-only).
- **C2** 없는 이슈에 댓글 → 404. body 공백 → 400.
- **C3** `GET /api/issues/{id}`가 댓글을 시간순으로 반환.
- **C4** `PATCH`로 `resolution={file_id,version_no,note}` 세팅·영속. 존재 않는 file_id → 404. `resolution=null`로 해제.
- **C5** 시트 컨텍스트로 생성한 이슈가 `resolve_sheet_key`와 일치하는 `sheet_key`를 가진다.
- **C6**(핵심) 이슈 생성 후 같은 version_set에 **새 버전 추가**(새 sheet_id) → `list_issues(sheet_key=…)`가 **원 이슈를 계속 반환**(이슈가 버전 따라감). `list_issues(sheet_id=옛것)`도 하위호환 유지.
- **C7** backfill 스크립트가 기존 이슈(file_id+sheet_id 보유)에 sheet_key를 멱등 부여.
- **C8** 회귀 0: 기존 이슈 CRUD/상태전이/핀/카테고리 테스트 전량 통과. create/patch/delete 권한=편집자 유지. 댓글만 뷰어 허용.
- **C9** 알림: 댓글 시 mock outbox에 이벤트 기록(생성자 제외 규칙 계승).

## Out of scope
- 실시간(WS)·댓글 개별 수정/삭제·중첩(threaded) 답글(플랫 리스트만)·compare 자동 종료·@멘션·첨부.
- TypeDB 미러 세부·실인증·실메일.

## Test 전략
- store 단위: add_issue_comment append-only, list_issues sheet_key 필터, update_issue resolution 화이트리스트.
- 라우트: TestClient로 C1~C4·C9. 권한은 current_user 전환 + project member 시드로 뷰어/편집자 검증.
- 통합(C6): 도면 생성 → 이슈 → add_version → sheet_key 조회 일관성.
- 프론트: 댓글 입력→목록 렌더, 해결버전 표시. 회귀 vitest.
- 게이트: `pytest backend/tests -q` · `npm test` · `npm run build` · `git diff --check`.
