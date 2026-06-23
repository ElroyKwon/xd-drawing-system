# xd-drawing-system

XD 제품군에 포함될 도면관리 시스템 개발 프로젝트.

Autodesk Construction Cloud Build를 벤치마크로 삼아, 도면관리 화면과 워크플로우를 메뉴 단위로 재현하고 XD 고유의 설비 엔티티 바인딩과 지식 연동을 붙여가는 실험/개발 공간이다.

## Current State

- 앱 scaffold는 Vite + React + TypeScript + Vitest 기반이다.
- 현재 구현은 로컬 mock 데이터와 클라이언트 상태만 사용한다.
- DB/API/Auth/Autodesk 연동/paid SDK/배포는 없다.
- project-local custom automation은 폐기했다.
- 루트 Markdown은 `README.md`, `AGENTS.md`, `CLAUDE.md`만 유지한다.

## Implemented Local Slices

- ACC #6 `프로젝트 목록`
- ACC #1 `프로젝트 작성 모달`
- Hub `My Home`, `프로젝트`, `프로젝트 템플릿` local shells
- Project Admin local shells
- Build local shells
- Local-only 2D sheet viewer shell

## Next Session

해상도/픽셀 기반 반응형(구 FR-RL) 요구사항은 폐기했다. 레이아웃은 "FHD/4K + macOS 브라우저에서 무파손"(PRD `Layout Compatibility`, FR-LC-001~003)만 유지한다.

남은 작업 큐 (글로벌 `ai-loop` 스킬):

1. DUC planning gate (문서만, FR-DUC-011/012 포함) — 근거는 `docs/feature-notes/005`·`009`
2. DWG→웹 렌더 PoC (HUMAN_GATE: 엔진/유료 SDK/Autodesk API 채택 전 정지)

## Start

```powershell
cd "D:\_Project\xd-drawing-system"
codex
```

Read first:

1. `AGENTS.md`
2. `README.md`

## References

- `reference/acc-screenshots/`
- `reference/acc-analysis/`
- `reference/dks-design-docs/`
- `reference/old-prototypes/`

Treat `reference/` as read-only source material. Copy or summarize into active working docs only when needed.

## Verification

For product code changes, run at minimum:

```powershell
npm test
npm run build
git diff --check
```

For UI work, also verify browser behavior, console state, and screenshot evidence when relevant.
