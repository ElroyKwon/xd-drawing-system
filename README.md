# xd-drawing-system

XD 제품군에 포함될 도면관리 시스템 개발 프로젝트.

이 프로젝트는 Autodesk Construction Cloud Build를 벤치마크로 삼아, 도면관리 화면과 워크플로우를 메뉴 단위로 하나씩 재현하면서 XD 고유의 설비 엔티티 바인딩과 지식 연동을 붙여가는 실험/개발 공간이다.

## 현재 단계

초기 세팅과 첫 구현 slice가 완료되었다.

구현된 slice:

- ACC #6 `프로젝트 목록`
- ACC #1 `프로젝트 작성 모달`

앱 scaffold는 Vite + React + TypeScript + Vitest 기반이며, 현재 구현은 로컬 mock 데이터와 클라이언트 상태만 사용한다. DB/API/Auth/Autodesk 연동/paid SDK/배포는 아직 없다.

다음 Codex 세션은 이 폴더에서 시작한다.

```powershell
cd "D:\_Project\xd-drawing-system"
codex
```

## 첫 진입 순서

1. `AGENTS.md`
2. `SPEC.md`
3. `PLAN.md`
4. `CHECKS.md`
5. `HUMAN_GATE.md`
6. `docs\sessions\NEXT_SESSION.md`
7. `reference\README.md`

## 핵심 방향

- 제품명/폴더명: `xd-drawing-system`
- 제품군: XD 시스템 통합 라인
- 벤치마크: Autodesk Construction Cloud Build
- 1차 범위: 초기 설정, 프로젝트/멤버/시트 목록, 2D 시트 뷰어, 마크업, 이슈
- 제외: DWG 원본 CAD 편집기, 3D BIM, Bridge, 프로덕션 인증/권한
- 차별점: 핀, 마크업, 이슈를 픽셀 좌표뿐 아니라 설비 엔티티 ID에 바인딩

## 참고자료 위치

```text
reference/
├─ acc-screenshots/       ACC Build 스크린샷 원본 39개 파일
├─ acc-analysis/          ACC 화면 분석 문서
├─ dks-design-docs/       도면관리 시스템 상세설계, Development_Design legacy
├─ autodesk-cloud/        Autodesk Cloud / APS 조사
├─ dks-core-docs/         DKS README, concept map, RFP, 전략 문서
├─ cheongju-fms/          청주사업장 FMS 고도화 참고자료
├─ old-prototypes/        이전 도면지식관리 프로토타입 참고자료
└─ ai-dev-loop/           AI 개발 루프 스킬/템플릿 원본
```

## 개발 루프

기능 하나마다 다음 파일을 갱신한다.

- `SPEC.md`: 현재 기능의 목표와 범위
- `PLAN.md`: 작업 순서
- `CHECKS.md`: 검증 명령과 수동 확인 시나리오
- `EVIDENCE.md`: 실행 결과와 증거
- `HUMAN_GATE.md`: 사람 승인 또는 중단이 필요한 항목

완료로 말하기 전에는 `EVIDENCE.md`에 실제 검증 결과가 있어야 한다.

현재 구현 증거:

- `EVIDENCE.md`의 `Initial Setup Slice Implementation`
- `docs/evidence/initial-setup-desktop.png`
- `docs/evidence/initial-setup-mobile-list.png`
- `docs/evidence/initial-setup-mobile-modal.png`
- `docs/evidence/initial-setup-mobile-modal-bottom.png`
