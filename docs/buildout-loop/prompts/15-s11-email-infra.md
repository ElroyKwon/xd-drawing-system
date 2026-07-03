# S11 — 이메일 발송 인프라 (mock 수준 + 실 egress 게이트)  [STATUS: FROZEN 2026-07-03 · 밤샘 자율=추천안]

> 신규 스코프(ACC 범위 밖). 사용자 밤샘 승인: **mock 수준(메일이 기계 밖으로 안 나감)까지 자율 구현**, 실 SMTP/서비스 전송(외부 egress)은 **HUMAN_GATE**(어느 SMTP·자격증명은 사용자 결정). S8.4 egress 패턴(provider 추상화·감사로그·킬스위치) 재사용.

## Stage goal / Done-When

시스템이 이메일을 **발송할 수 있는 인프라**를 갖춘다 — provider 추상화, 템플릿, 감사로그, 킬스위치. 단 기본은 **mock**(발송 대신 outbox 기록)이며, 실 SMTP 전송은 자격증명 미구성 시 불가(게이트).

**완료 정의(S11)**:
- (a) **EmailProvider 추상화**: `MockEmailProvider`(발송 안 함, `_email_outbox.json`에 기록) + `SmtpEmailProvider`(실 SMTP, `XD_SMTP_*` env 필요 — 미구성 시 unavailable→mock 폴백). `make_email_provider()`가 env `XD_EMAIL_PROVIDER`(기본 mock)로 선택.
- (b) **템플릿**: `render_template(kind, context)` — 최소 `generic`·`issue_created`·`issue_status_changed`(S12 대비). 안전 문자열 조합(주입 없음).
- (c) **egress 감사+킬스위치**(S8.4 패턴 재사용): 발송 시도마다 메타데이터 1건(to·subject·template·provider·sent bool·ts, 본문 미기록) `_email_audit.jsonl`. 런타임 mode(mock|smtp) 토글로 실 전송 즉시 차단.
- (d) **라우트** `backend/routes_email.py`: `POST /api/email/send`(RBAC 편집자, mock=outbox)·`GET /api/email/outbox`·`GET /api/email/status`(provider·mode·smtp 구성여부[값 미노출])·`POST /api/email/mode`. main.py 등록.
- (e) **실 egress 게이트**: 실 SMTP 전송은 `XD_SMTP_HOST`/자격증명 미구성 시 동작 안 함 + `HUMAN_GATE.md`에 GATE-5(이메일 서비스·자격증명 결정) 기록. 기본 동작으로 외부 메일 0.
- (f) 회귀 0(backend pytest·build·vitest) + 사이드카 격리 무영향(이메일=8000 backend, 사이드카 무관).

## Co-design log (2026-07-03 — 밤샘 자율승인, AFK=추천안)

- **(Q1) 기본 provider = mock**(발송 0·outbox 기록). 실 SMTP는 자격증명 게이트. 안전 우선.
- **(Q2) 이메일 위치 = 8000 backend**(이슈 라이프사이클 S12가 트리거). 사이드카(AI)와 무관.
- **(Q3) 감사/킬스위치 = S8.4 패턴 재사용**(메타데이터만·런타임 토글). 본문 미기록(프라이버시).

## Instruction (수행 단계)

1. `backend/email_service.py`: EmailProvider(추상)·MockEmailProvider(outbox)·SmtpEmailProvider(스텁, env 미구성 raise)·`make_email_provider`·`render_template`·`send_email(to, subject, body, template=None, context=None, project=None)`(provider 선택→감사 record→mock이면 outbox append)·`current_mode`/`set_mode`·`status`·outbox read.
2. `backend/routes_email.py`: (d)의 4라우트. RBAC `require_role(project, "편집자")` on send.
3. `backend/main.py`: email 라우터 등록.
4. `backend/tests/test_email.py`: mock 발송→outbox 1건·감사 메타데이터만(본문 없음)·킬스위치(smtp 강제해도 미구성→발송 0)·템플릿 렌더·status smtp 미구성 노출·RBAC.
5. `docs/buildout-loop/HUMAN_GATE.md`: GATE-5 실 이메일 egress(SMTP 서비스·자격증명·발신주소 사용자 결정) 기록 — 미해결.
6. **검증**: 라이브 mock 발송→outbox 확인. 회귀 0. 실 SMTP는 구성 없이 발송 0 확인.

## Acceptance checklist (검증팀 채점 — freeze)

- **P1** — EmailProvider 추상화 + Mock(outbox 기록·발송0) + Smtp(미구성 시 unavailable). `make_email_provider` env 선택.
- **P2** — 템플릿 렌더(generic·issue_created·issue_status_changed) 안전 문자열, 주입 없음.
- **P3** — 발송 감사 메타데이터만(to·subject·template·provider·sent·ts), **본문 미기록**. 킬스위치 mode 토글로 실 전송 즉시 차단.
- **P4** — 라우트 4종 라이브(send RBAC·outbox·status[smtp 구성여부만, 자격증명 미노출]·mode).
- **P5** — **기본 동작으로 외부 메일 0**(mock). 실 SMTP는 자격증명 미구성 시 발송 안 함. HUMAN_GATE GATE-5 기록.
- **P6** — 회귀 0(backend pytest·build·vitest) + 사이드카 격리 무영향.

## Out of scope (의도적으로 하지 않음)

- **실 SMTP 전송·자격증명 구성** — HUMAN_GATE GATE-5(사용자 결정). 코드 경로는 두되 미구성 시 발송 0.
- **이슈 라이프사이클 트리거** — S12(이 인프라 위).
- **프론트 알림 설정 UI 실동작화** — S12/후속.
- **큐·재시도·바운스 처리** — 운영 후속.
