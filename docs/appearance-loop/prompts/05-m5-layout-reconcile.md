# M5 메타프롬프트 — 횡단 레이아웃 호환(FR-LC) + 최종 reconcile (executor contract)

> ai-loop Phase 2.5 산출물. **freeze v1**(2026-06-25, 3개 핵심 결정 AskUserQuestion 공동설계 확정). 구현 에이전트는 이 지시에 맞춰 실행하고, 별도 검증팀/신선한 비평가는 아래 **Acceptance checklist**를 항목별 채점한다. 기준 변경 = 스코프 변경 = HUMAN_GATE.

## Stage goal

외관 완성 루프의 **마지막 마일스톤**. 두 축:
1. **FR-LC 횡단 레이아웃 호환** — M1~M4에서 만든 신규 화면 전체를 FHD(1920)·4K급(2560)·macOS 폰트 분기에서 무파손(가로 클리핑·요소 겹침·폰트 폴백 파손 0)으로 **재확인**하고, 발견된 파손을 surgical하게 수정. 특히 **C1 2560 누적 부채**(M1·M3·M4 모두 OS 창 한계로 2048까지만 device 실측)를 **헤드리스 Chrome 실제 2560 창**으로 해소.
2. **마지막 마일스톤 폴리시 — 알려진 a11y 부채 일괄 정리** + **최종 Phase 6.5 reconcile**(신선한 비평가가 LOOP Done-When 전 항목 MET/NARROWED/UNMET + 증거등급 판정).

"없는 화면 만들기"가 아니라 **기존 완성분의 호환성·접근성 마감 + 전체 Done-When 정직한 정산**. HUMAN_GATE 경계(영속화·실연동·유료 SDK·배포·DB) 침범 금지.

## Co-design log (frozen decisions — 2026-06-25, AskUserQuestion)

1. **범위 = 검증 + 발견된 파손 수정 + 알려진 부채 정리.** 마지막 마일스톤이므로 (a) M1~M4 전 화면 재검증, (b) 검증이 실제로 찾아낸 가로 오버플로/겹침/폰트 파손 수정, (c) 누적된 **알려진 a11y 부채**(A2 button>h3 중첩, 전 모달 ESC/포커스 트랩 부재) 일괄 정리까지 포함. 단 **광범위 능동 리팩터는 금지** — 손대는 모든 줄은 "재검증/파손/명시된 알려진 부채"로 추적 가능해야 함(surgical 원칙 유지). A3(카탈로그 외 칩)·A4(templateId 시맨틱)는 **저위험·명백 개선만** 정리, 위험하면 EVIDENCE에 수용 부채로 기록.
2. **C1 2560 실측 = 헤드리스 Chrome 진짜 2560 창.** Node v24 내장 WebSocket으로 zero-dep CDP 클라이언트를 만들어 헤드리스 Chrome을 실제 `--window-size=2560,1440`(및 1920,1080)로 띄우고, 각 화면에서 `documentElement.scrollWidth - clientWidth`(셸 가로 오버플로)와 요소 겹침을 측정. OS 창 한계 우회 → **device급 실측**으로 2560 부채 해소(에뮬레이션 device-metrics-override 아님 — 실제 레이아웃 창).
3. **이월분 처리 = 신선한 비평가 판정에 일임.** FR-FS-012~015(Build 이슈·양식·사진·구성원·브리지·설정 distinct 화면)와 누적 a11y 부채의 Done-When 정산을 **미리 정하지 않는다**. 구현 안 한 fresh 비평가가 원본 product Done-When 목록 + 증거만 보고 독립 판정. NARROWED/UNMET이 나오면 그대로 `HUMAN_GATE.md`로 올려 사용자가 경계를 수용하거나 되돌린다. (PROGRESS의 "의도된 이월" 메모는 비평가에게 **입력으로 주지 않는다** — 사전 판정 오염 방지.)

## Instruction (실행 지시)

### Part A — 헤드리스 2560/1920 측정 하네스 (결정 2)
- scratchpad에 zero-dep Node 스크립트(`measure-layout.mjs` 류)를 만든다. Node v24 내장 `WebSocket`/`fetch` 사용, npm 의존성 추가 금지.
- 절차: `npm run dev`(또는 `vite preview`) 서버 기동 → Chrome(`C:\Program Files\Google\Chrome\Application\chrome.exe`)을 `--headless=new --remote-debugging-port=<port> --window-size=2560,1440`로 기동 → `/json/version`·`/json`으로 CDP 타겟 WebSocket 획득 → `Page.navigate` + `Runtime.evaluate`로 각 화면 진입 후 측정.
- 측정 대상 화면(앱 내 네비로 진입 가능한 M1~M4 전부): Hub My Home, 프로젝트 템플릿(샘플 펼침/접힘), Project Admin(구성원·회사·알림 매트릭스 최대 전개·템플릿 상세), Build 홈(개요/종합 탭), Build 시트목록(11컬럼), Build 파일(폴더트리+업로드 모달), Build 2D 뷰어(기본·속성패널·측정패널·비교 오버레이·이슈탭), 그리고 모달 열린 상태.
- 각 측정 행: `{ screen, width, scrollWidth, clientWidth, overflow: scrollWidth-clientWidth, overlaps: [...] }`. overflow ≤ 0 합격. 넓은 표(`.files-table`·`.table-scroll`·알림 매트릭스)는 **전용 스크롤 컨테이너 내부 가로 스크롤만 허용** → 셸(`documentElement`/`.app`) 오버플로로만 판정, 표 내부 스크롤은 합격으로 본다.
- 1920·2560 두 폭 모두 측정. 결과를 EVIDENCE §M5에 표로 기록(폭×화면×overflow, 증거등급 `device`).

### Part B — FR-LC 재검증 + 발견된 파손 수정 (결정 1a·1b)
- Part A 측정 + 브라우저 육안(스크린샷) 대조로 가로 클리핑·요소 겹침을 확인한다.
- **macOS 폰트 분기(FR-LC-002)**: 실제 mac 부재 → `styles.css` 폰트 스택이 `-apple-system`/`Apple SD Gothic Neo`(mac)와 `Segoe UI`/`Malgun Gothic`(win)을 모두 선언하고 자연 폴백하는지 **정적 확인**(증거등급 `static` 정직 기록). 신규로 mac 전용 분기 추가 금지(FR-LC-003).
- **파손 발견 시에만** 수정한다. 수정은 기존 스타일 토큰/패턴(`minmax(0,1fr)`·전용 스크롤 컨테이너) 재사용, 픽셀 튜닝 아닌 구조적 무파손이 목표. 파손이 없으면 "무파손 확인"으로 기록하고 코드 미변경.

### Part C — 알려진 a11y 부채 일괄 정리 (결정 1c)
- **A2 — 접기 헤더 heading 중첩**: `src/App.tsx` 샘플 템플릿 토글(`button.tmpl-section-head` 안의 `<h3 id="sample-template-title">`). WAI-ARIA accordion 패턴으로 교정 — heading이 button을 감싸는 구조(`<h3><button aria-expanded>…</button></h3>`)로 swap하거나, 동등하게 button 안 heading 제거 + 접근名 유지. `aria-labelledby="sample-template-title"` 연결과 `aria-expanded` 토글은 보존. 시각 외관 불변.
- **모달 ESC + 포커스 트랩 일괄**: 현재 ESC 핸들러는 M4 모달 2개(`CompareModal`·`CalibrationModal`)에만 있고 포커스 트랩은 전무. 나머지 6개 모달(`App.tsx` 3개: 템플릿 타입 선택·템플릿 이름·프로젝트 작성 / `ProjectAdminView.tsx` 2개: 구성원·템플릿 추가 / `IssuesView.tsx` 1개 / `FilesView.tsx` 1개)에 **공통 동작 통일**: (1) ESC로 닫힘, (2) 열릴 때 첫 포커서블/dialog로 포커스 이동, (3) Tab/Shift+Tab이 dialog 안에서 순환(포커스 트랩), (4) 닫힐 때 직전 트리거로 포커스 복귀.
  - **공통 훅 1개로 추출**(`src/hooks/useModalDismiss.ts` 또는 유사) 후 8개 모달에 적용 — 중복 ESC 핸들러 코드 정리. M4 모달의 기존 ESC 인라인 핸들러는 훅으로 대체(동작 동일·무회귀).
  - 훅 시그니처는 최소: `useModalDismiss(onClose, containerRef)`. 영속화/포털 등 신규 인프라 도입 금지.
- **A3/A4(저위험만)**: A3(`tmpl-card` "복사" 칩·"사용자 정의" 서브텍스트가 카탈로그 외) — 카탈로그/캡처 대조해 명백히 불필요하고 제거가 무위험이면 정리, 애매하면 EVIDENCE에 "수용 부채"로 남김. A4(templateId에 이름 문자열 사용) — 프리필 로직 영향 있어 위험 → **이번 범위 제외**(EVIDENCE 수용 부채 기록), 능동 리팩터 금지.

### Part D — 회귀 테스트 + 게이트
- 부채 정리 회귀 테스트 추가(≥3): (1) 샘플 템플릿 접기 헤더가 button 안 heading 중첩이 아니고 `aria-expanded` 토글 동작, (2) 임의 M1~M3 모달이 ESC로 닫힘, (3) 모달 열릴 때 포커스가 dialog 내부로 이동(또는 닫힐 때 트리거 복귀). 기존 테스트 전부 무수정 PASS.
- **기준선 카운트는 구현 직전 `npm test` 실측해 PROGRESS 기록**(현재 49는 직전 측정치).
- `npm run build`(tsc 포함) PASS · `npm test` 전부 PASS · `git diff --check` 통과 · 브라우저 콘솔 에러 0.

### Part E — Phase 6.5 신선한 비평가 reconcile (결정 3)
- **구현에 참여하지 않은 fresh Agent**를 띄워, 입력으로 **오직** LOOP.md의 product Done-When 목록(FR-FS-001~016 + FR-LC-001~003)과 EVIDENCE.md 증거만 준다. PROGRESS의 "의도된 이월" 사전 메모·이 메타프롬프트의 결정 3은 **입력에서 제외**(사전 판정 오염 방지).
- 비평가는 각 항목에 **정확히 하나의 판정**(MET / NARROWED / UNMET) + **증거등급**(device / emulated / synthetic / static)을 부여하고 근거 1~2줄을 단다.
- NARROWED·UNMET 항목은 전부 `HUMAN_GATE.md`에 적는다(무엇이 어떻게 좁혀졌/안 됐는지). 외관 루프의 DONE은 NARROWED/UNMET이 있으면 차단 → 사용자 체크인에서 수용/반려 결정.

### affordance 경계표 (변함없음 — 침범 금지)
| 구분 | 동작 |
|---|---|
| 레이아웃 무파손 수정 · a11y 부채(ESC/포커스트랩/heading) · 측정 하네스(scratchpad) | **허용** |
| 영속화 · 실제 파일/마크업/이슈 저장 · 실 diff 연산 · 유료 SDK · DB/API · auth/RBAC · 배포 · mac 전용 반응형 분기 신설 | **비대상(HUMAN_GATE)** |

## Inputs (참고 가능 자료)
- 스펙: `docs/PRD.md` FR-LC-001~003(L277~281) + FR-FS-001~016
- 루프 계약: `docs/appearance-loop/LOOP.md`(Done-When), `PROGRESS.md`(이월 추적·부채 메모 — **단 Part E 비평가 입력에서는 제외**), `CHECKS.md`, `EVIDENCE.md`(M1~M4 증거)
- 현 코드: `src/App.tsx`(샘플 토글 679~711·모달 776/823/870), `src/ProjectAdminView.tsx`(모달 384/918), `src/build/IssuesView.tsx`(60), `src/build/FilesView.tsx`(165), `src/build/viewer/CompareModal.tsx`·`CalibrationModal.tsx`(기존 ESC 핸들러), `src/styles.css`(폰트 스택·`.modal-backdrop`·`.files-table`·`.table-scroll`·알림 매트릭스)
- Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe` / dev: `npm run dev`

## Acceptance checklist (검증팀/비평가 항목별 PASS/FAIL)

**레이아웃 (Gate 2 — 핵심)**
- [ ] A1. 헤드리스 Chrome **실제 2560 창** 측정 하네스가 동작하고, M1~M4 전 화면 + 모달 열린 상태의 셸 가로 오버플로를 1920·2560 두 폭에서 출력(증거등급 device).
- [ ] A2. 1920·2560에서 셸(`documentElement`/`.app`) 가로 오버플로 ≤ 0. 넓은 표/매트릭스는 전용 스크롤 컨테이너 내부만 가로 스크롤(셸 비밀어냄).
- [ ] A3. 요소 겹침·가로 클리핑 0(육안 스크린샷 대조 포함). 발견된 파손은 전부 수정돼 재측정 통과.
- [ ] A4. macOS 폰트 스택이 `-apple-system`/`Apple SD Gothic Neo` + Windows 폴백을 선언(정적 확인, 증거등급 static 정직 기록). mac 전용 신규 분기 미추가(FR-LC-003).

**a11y 부채 정리 (마지막 폴리시)**
- [ ] B1. 샘플 템플릿 접기 헤더가 button 안 heading 중첩이 아니다(WAI-ARIA accordion). `aria-expanded` 토글·접근名 보존, 시각 외관 불변.
- [ ] B2. 모달 8개 전부 ESC로 닫히고, 포커스 트랩(열릴 때 dialog 내부 포커스·Tab 순환·닫힐 때 트리거 복귀)이 공통 훅으로 일관 적용. 중복 ESC 코드 정리.
- [ ] B3. A3/A4 처리 명시: 저위험 정리분은 반영, 미정리분은 EVIDENCE에 "수용 부채"로 기록(능동 리팩터 없음).

**Must-pass (Gate 1)**
- [ ] C1. `npm run build` 성공(tsc 포함).
- [ ] C2. `npm test` 전부 PASS(기준선 + 신규 회귀 ≥3). 기준선 카운트 PROGRESS 기록.
- [ ] C3. 브라우저 콘솔 에러 0. `git diff --check` 통과. HUMAN_GATE 경계 미침범.

**Real user flow**
- [ ] D1. M1~M4 전 화면 진입/이탈·탭 전환·모달 열고닫기(ESC/취소/X/제출)가 1920·2560에서 동작. 빈/긴 입력·빠른 더블클릭에서 무파손. Hub↔Admin↔Build 레벨 분리 유지.

**최종 reconcile (Phase 6.5 — process 완결성)**
- [ ] E1. 신선한 비평가(구현 미참여)가 LOOP product Done-When 전 항목에 MET/NARROWED/UNMET + 증거등급 부여. 사전 "의도된 이월" 메모 비입력.
- [ ] E2. NARROWED·UNMET 전부 `HUMAN_GATE.md` 기재 → 사용자 체크인 결정. EVIDENCE §M5에 per-item 판정표 기록.

## Out of scope (의도적으로 안 함)
- 광범위 능동 리팩터·픽셀 단위 색/간격/폰트 완벽 일치(외관 루프 비대상) — 손대는 줄은 재검증/파손/알려진 부채로만 추적.
- A4 templateId 시맨틱 리팩터(프리필 로직 위험 → 수용 부채 기록).
- 모바일/태블릿 반응형 분기 신설(FR-LC-003 — 전 기능 완성 후 일괄).
- FR-FS-012~015 등 이월 화면 신규 구현(비평가가 NARROWED/UNMET 판정하면 HUMAN_GATE로 사용자 결정 — 이번 마일스톤에서 구현하지 않음).
- 영속화·실 diff·실 업로드·유료 SDK·DB/API·auth·배포(HUMAN_GATE 항구 경계).
