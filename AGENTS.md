# Codex 작업 지침

## 언어

- 기본 응답은 한국어로 한다.
- 기술명, API명, 파일명은 원문을 유지한다.

## 프로젝트 정체성

- 이 프로젝트는 `xd-drawing-system`이다.
- Autodesk 제품을 그대로 납품하는 것이 아니라, XD 시스템군 안에서 ACC Build 수준의 도면관리 UX를 재현하고 XD 고유 기능을 붙이는 프로젝트다.
- UI/UX 판단은 직접 접속보다 `reference/acc-screenshots/`의 저장 스크린샷과 `reference/acc-analysis/`를 우선 근거로 삼는다.

## 루트 문서 원칙

- 루트 Markdown은 `README.md`, `AGENTS.md`, `CLAUDE.md`만 유지한다.
- 나머지 과거 루트 Markdown은 폐기했다.
- project-local custom automation은 폐기했다.
- 새 작업은 Codex 제공 기능과 일반 도구만 사용한다.

## 개발 방식

- 한 번에 전체 시스템을 만들지 않는다.
- 기능 하나를 정하고, 해당 기능의 스크린샷 근거를 확인한 뒤 구현한다.
- `reference/` 아래 자료는 원본 참고용이다. 수정하지 않는다.
- 기존 프로젝트 `D:\_Project\prototype-도면지식관리`와 `D:\_Project\prototype-도면지식관리-mvp`는 수정하지 않는다.
- 무거운 산출물(`node_modules`, `.next`, 빌드 캐시)은 reference로 추가하지 않는다.

## 검증 원칙

코드 변경 후 최소 검증:

```powershell
npm test
npm run build
git diff --check
```

UI 변경은 가능한 경우 브라우저 동작, 콘솔 상태, 스크린샷 증거를 함께 확인한다.

## 승인 필요 항목

다음은 자동으로 진행하지 말고 먼저 확인한다.

- 인증/권한 모델 변경
- DB 스키마/API 영속화
- 고객 또는 기밀 도면 데이터 사용
- Autodesk cloud/API 또는 외부 API 연결
- paid SDK 추가
- 배포
- 실제 Project Admin auth/RBAC 적용
- 실제 도면 업로드/저장/삭제
- real viewer engine 채택
- TypeDB 연동 설계 또는 구현

## 세션 종료

사용자가 `세션 종료`, `세션종료`, `세션 마무리`를 요청하면 새 구현을 멈추고 정리한다.

1. `git status --short --untracked-files=all`로 현재 변경을 확인한다.
2. 변경 파일과 검증 결과를 요약한다.
3. 미실행 검증과 남은 blocker를 명시한다.
4. 글로벌 Obsidian 업무일지 규칙을 실행한다.
   - `G:\내 드라이브\_Obsidian\CLAUDE.md`의 `업무일지 자동 기록` 섹션을 확인한다.
   - `G:\내 드라이브\_Obsidian\지식관리\업무일지\YYYY-MM-DD.md`에 이번 세션 항목을 append한다.
5. 사용자가 명시적으로 요청하지 않으면 commit/push하지 않는다.
