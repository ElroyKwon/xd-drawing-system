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

기능 백로그 SoT: `docs/Screenshot_Feature_Catalog.md`. ACC 캡처 `스크린샷/` 53장(`fa1872d`로 git 추적)을 화면·기능·구현상태로 정리한 단일 백로그다. "스크린샷에 보이는 기능 전부 구현"이 목표이며, 각 기능은 feature-note → planning-gate → `ai-loop` 메타 프롬프트로 내려보낸다.

### 외관 완성 ai-loop (다음 세션 바로 실행)

다음 세션은 `ai-loop` 스킬을 장착하고 `docs/appearance-loop/LOOP.md` → `docs/appearance-loop/PROGRESS.md`를 먼저 읽어 **재시작이 아니라 이어받기**로 진행한다. **M1·M2·M3 완료. 다음은 M4(2D 뷰어 + 마크업/측정/비교/이슈)** — 메타프롬프트가 아직 없으므로 **초안 → `AskUserQuestion` 공동설계 → freeze(Phase 2.5)부터** 시작한 뒤 구현한다(곧바로 구현 아님).

- 목표: 기존 로컬 셸을 카탈로그 구조 수준으로 끌어올려 외관 완성(없는 화면 만들기 아님).
- Freeze된 결정: ① 충실도=카탈로그 구조 완성(픽셀 일치 비대상) ② 검증=구조 체크리스트+브라우저 스크린샷+test/build ③ 예산=마일스톤마다 체크인.
- 마일스톤: ~~M1 Hub~~(완료) → ~~M2 Project Admin+템플릿 상세~~(완료) → ~~M3 Build 비뷰어~~(완료) → **M4 2D 뷰어(마크업/측정/비교/이슈)** → M5 레이아웃 호환+최종 reconcile (`docs/appearance-loop/PLAN.md`).
- 영속화·실연동·유료 SDK·DWG 렌더·배포는 HUMAN_GATE — affordance만.

직전 세션(2026-06-24) 완료:
- **M1 Hub 표면 완료**(`f627cd1`): 샘플 템플릿 접기/펴기, 카드 "사용하여 생성"→작성 모달 프리필, 드롭다운 옵션. 검증팀 2렌즈 PASS, build PASS·test 34 PASS.
- **M2 Project Admin 템플릿 상세 완료**(`8c55fe6`): 진입동선+모드분기(`template-admin`)+측면 네비 2그룹+5섹션+알림 매트릭스 3단 계층. 2 독립 렌즈 검증 차단0, build PASS·test 39 PASS, C1 2560 device 실측. 상세 `EVIDENCE.md` §M2.
- **M3 Build 비뷰어 표면 완료**: 4결정 공동설계(범위=홈·시트·파일 집중+나머지 6 이월 / 구조 우선 / 분석차트 빈상태 골격 / 화면별 파일 분할). `src/build/` 8뷰 분할 + 홈(개요/종합 탭)·시트(행메뉴 팝오버)·파일(Welcome배너·11폴더트리·11컬럼·업로드모달) 보강. 2 독립 렌즈 차단0, build PASS·test 43 PASS, 1920/2560 오버플로 0·콘솔 0. FR-FS-012/013/014/015(이슈·양식·사진·구성원·브리지·설정)는 캡처 부재로 의도적 이월. 상세 `EVIDENCE.md` §M3.

남은 작업 큐:

- **외관(모든 보이는 화면)** → 위 "외관 완성 ai-loop"가 M1~M5로 흡수(뷰어 마크업·시트 목록·템플릿 워크플로우·네비 충실도 포함).
- 외관 완성 후: DUC planning gate (문서만) — 근거 `docs/feature-notes/005`·`009`.
- 외관 완성 후: DWG→웹 렌더 PoC (HUMAN_GATE: 엔진/유료 SDK/Autodesk API 채택 전 정지).

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
