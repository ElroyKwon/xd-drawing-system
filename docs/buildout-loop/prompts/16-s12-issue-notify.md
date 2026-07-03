# S12 — 이슈 라이프사이클 이메일 알림 (mock, S11 위)  [STATUS: FROZEN 2026-07-03 · 밤샘 자율=추천안]

> 신규 스코프. S11 이메일 인프라 위. 이슈 생성/상태변경 → 구독자에게 알림 발송(기본 mock=외부0, outbox). 실 발송은 GATE-5 후. `notificationGroups` 정적 목업을 실동작 훅으로 대체.

## Done-When (S12)
- (a) 이슈 **생성** 시 프로젝트 구독자에게 `issue_created` 알림 발송(mock outbox).
- (b) 이슈 **상태변경** 시 `issue_status_changed` 알림(실제 status가 바뀐 경우만).
- (c) 구독자 = 프로젝트 구성원 중 이메일 보유자(미구성 프로젝트는 전체 폴백). actor 제외 옵션.
- (d) 알림 실패가 **이슈 작업을 깨뜨리지 않음**(예외 삼킴). 토글 `XD_NOTIFY`(기본 on).
- (e) 기본 외부 egress 0(mock 상속). 회귀 0.

## Co-design (밤샘 자율=추천안)
- 구독자 = 프로젝트 구성원(별도 구독 매트릭스 UI는 후속). 실 발송 = GATE-5.
- 알림은 best-effort(이슈 CRUD 실패와 분리).

## Instruction
1. `backend/notifications.py`: `subscribers_for(project, exclude)`·`notify_issue_event(kind, issue, project, actor)`(email_service.send_email 반복)·`enabled()`.
2. `backend/routes_issue.py`: create 후 `notify_issue_event("created", ...)`, patch status 변경 시 `"status_changed"` — 둘 다 try/except 방어.
3. `backend/tests/test_notifications.py`: 생성/상태변경→outbox 증가·구독자 수·actor 제외·disabled·실패 격리·이슈 CRUD 무영향.
4. 검증: 라이브 이슈 생성→outbox 알림 확인. 회귀 0.

## Acceptance (Q1~Q7)
- **Q1** 이슈 생성→구독자 mock 알림 발송(outbox 증가), issue_created 템플릿.
- **Q2** 상태변경(실제 변경)→issue_status_changed 알림. 변경 없으면 미발송.
- **Q3** 구독자=프로젝트 구성원 이메일(미구성 폴백), actor 제외 동작.
- **Q4** 알림 실패가 이슈 생성/변경을 깨뜨리지 않음(예외 격리).
- **Q5** `XD_NOTIFY=0`이면 미발송.
- **Q6** 기본 외부 egress 0(mock). 실 발송은 GATE-5.
- **Q7** 회귀 0(backend pytest·build) + 사이드카 격리 무영향.

## Out of scope
- 구독 매트릭스 UI 실동작화(후속) · 실 이메일 발송(GATE-5) · 알림 채널(SMS/푸시) · 다이제스트/빈도 설정.
