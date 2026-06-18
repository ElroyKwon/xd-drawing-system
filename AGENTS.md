# Codex 작업 지침

## 언어

- 기본 응답은 한국어로 한다.
- 기술명, API명, 파일명은 원문을 유지한다.

## 프로젝트 정체성

- 이 프로젝트는 `xd-drawing-system`이다.
- Autodesk 제품을 그대로 납품하는 것이 아니라, XD 시스템군 안에서 ACC Build 수준의 도면관리 UX를 재현하고 XD 고유 기능을 붙이는 프로젝트다.
- UI/UX 판단은 직접 접속보다 `reference/acc-screenshots`의 저장 스크린샷과 `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md`를 우선 근거로 삼는다.

## 세션 진입 순서

1. `README.md`
2. `SPEC.md`
3. `PLAN.md`
4. `CHECKS.md`
5. `HUMAN_GATE.md`
6. `docs/sessions/NEXT_SESSION.md`
7. `reference/README.md`

## 참고자료 우선순위

1. `reference/acc-screenshots/`
2. `reference/acc-analysis/_ACC-Build-화면분석-재현설계.md`
3. `reference/dks-design-docs/도면관리시스템_상세설계/00_개요-PMO/README.md`
4. `reference/dks-design-docs/도면관리시스템_상세설계/05_프론트엔드-UIUX/README.md`
5. `reference/dks-design-docs/도면관리시스템_상세설계/12_개발준비-기술스택/12-1_기술스택ADR.md`
6. `reference/old-prototypes/`
7. `reference/ai-dev-loop/`

## 개발 방식

- 한 번에 전체 시스템을 만들지 않는다.
- 기능 하나를 정하고, 그 기능의 스크린샷 근거를 확인한 뒤 구현한다.
- 각 기능은 `docs/feature-notes/`에 짧은 기록을 남긴다.
- `SPEC.md`, `PLAN.md`, `CHECKS.md`, `EVIDENCE.md`를 기능 단위로 갱신한다.
- 구현 전에는 `development-loop-orchestrator`로 현재 단계를 확인한다.
- 새 기능은 `feature-docs-scaffold`로 7개 핵심 문서를 만든 뒤 `planning-gate`를 통과해야 한다.
- `SLICE-ONLY PASS`는 정식 문서 루프 PASS가 아니며, 구현 범위를 명확히 제한할 때만 사용한다.

## 보존 원칙

- `reference/` 아래 자료는 원본 참고용이다. 수정하지 말고 필요한 내용은 `docs/`로 정리해 사용한다.
- 기존 프로젝트 `D:\_Project\prototype-도면지식관리`와 `D:\_Project\prototype-도면지식관리-mvp`는 수정하지 않는다.
- 무거운 산출물(`node_modules`, `.next`, 빌드 캐시)을 reference로 추가하지 않는다.

## 검증 원칙

- 완료 보고 전 `CHECKS.md`에 있는 확인을 실행한다.
- 실행 결과는 `EVIDENCE.md`에 기록한다.
- 브라우저 확인이 필요한 경우에는 가능하면 스크린샷과 콘솔 에러 상태를 함께 남긴다.

## 세션 종료 절차

사용자가 `세션 종료`를 요청하면 구현을 새로 확장하지 말고 closeout/handoff 작업으로 전환한다.

1. `git status --short --untracked-files=all`로 dirty 파일을 확인하고, 기존 변경과 이번 세션 변경을 분리해 기록한다.
2. `PLAN.md`, `CHECKS.md`, `EVIDENCE.md`, `docs/sessions/NEXT_SESSION.md`를 현재 상태에 맞게 갱신한다.
3. `CHECKS.md` 기준의 검증을 실행하고 결과를 `EVIDENCE.md`에 남긴다. 실행하지 못한 검증은 이유와 남은 증거 요구사항을 적는다.
4. 브라우저 검증이 필요한 작업은 fresh interaction, console state, screenshot path가 없으면 PASS로 쓰지 않는다.
5. 남아 있는 blocker, human gate, 다음 세션의 첫 명령과 읽을 파일을 `docs/sessions/NEXT_SESSION.md`에 명시한다.
6. 글로벌 Obsidian 업무일지 규칙을 반드시 실행한다.
   - `G:\내 드라이브\_Obsidian\CLAUDE.md`의 `업무일지 자동 기록` 섹션을 확인한다.
   - `G:\내 드라이브\_Obsidian\지식관리\업무일지\YYYY-MM-DD.md`에 이번 세션 항목을 append한다. 새 파일이면 YAML frontmatter를 포함한다.
   - 세션 번호는 해당 날짜 파일의 기존 세션 수 + 1로 쓴다.
   - 업무일지 대상 폴더가 WIKI 제외인지, 관련 `_CONCEPT-MAP.md` 갱신 대상이 있는지 확인하고 필요한 경우 같이 처리한다.
   - 업무일지를 작성하지 못했으면 완료 보고를 하지 말고, 실패 이유와 남은 조치를 blocker로 보고한다.
7. 사용자가 명시적으로 요청하지 않으면 commit/push하지 않는다.

완료 보고에는 다음을 포함한다.

- 현재 stage
- dirty 파일 분류
- 변경 파일
- 실행한 검증과 결과
- 실패 또는 미실행 검증
- blocker와 human gate 상태
- Obsidian 업무일지 기록 여부와 파일 경로
- 다음 세션이 이어갈 정확한 next action

## 사람 승인 게이트

`HUMAN_GATE.md`에 있는 항목은 자동으로 넘기지 않는다. 특히 인증, 권한, DB 스키마, 고객 데이터, 삭제, 배포 관련 변경은 먼저 확인한다.

## XD 시스템 방향 — 확정 결정 (2026-06-18)

- **TypeDB 배포 전략 확정**: TypeDB는 엔지니어 PC에 별도 배포하여 운영한다. 엔지니어 PC의 모든 도면을 분석해 이 로컬 TypeDB 인스턴스에 적재하는 것이 목표다.
- **프론트엔드 연동 설계는 미결**: viewer → TypeDB 연결 설계 및 구현은 별도 게이트 결정이 필요하다. 현재 슬라이스에서는 `equipmentEntityId` 슬롯 예약만 허용된다.
- **나머지 설계 보완 진행 중**: 상위 아키텍처/보안 설계는 별도로 진행 중이며, 해당 설계가 완료되면 HUMAN_GATE.md 허용 항목이 갱신된다.

## 현재 설계 문서 감사 결과 요약 (2026-06-18)

독립 감사 실행 결과 (세부 내용은 EVIDENCE.md `설계 문서 감사 - 2026-06-18` 섹션 참조):

**전반적 판정**: PASS with 3 Action Items

| 항목 | 상태 |
|---|---|
| 목적 및 설계 의도 일치 | PASS |
| 문서 루프 프로세스 준수 | PASS |
| Human Gate 관리 | PASS (TypeDB 결정 반영 완료) |
| Task_List T-SV 상태 불일치 | 수정 완료 (Gate Passed / Implementation Ready) |
| Project Admin Task 6 브라우저 블로커 해결 경로 | 미정의 (별도 결정 필요) |

**현재 슬라이스 상태**:
- Phase 1 초기 설정: DONE
- Phase 2 Project Admin: 코드 DONE, 브라우저 증거 BLOCKED_BROWSER_UNAVAILABLE
- Phase 3 Build Shell + Sheets: DONE
- Phase 4 2D Sheet Viewer: Planning Gate PASS, 구현 대기 (사용자 요청 시 시작)
