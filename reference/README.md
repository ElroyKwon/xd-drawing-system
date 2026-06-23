# Reference Map

이 폴더는 `xd-drawing-system` 개발용 참고자료 모음이다. 원본 보존용이므로 직접 수정하지 않는다.

## Primary References

### ACC Screenshots

Path: `reference/acc-screenshots/`

- ACC Build 화면 캡처 원본.
- 초기 설정, Project Admin, Build 홈, 시트 목록, 2D 뷰어, 마크업, 이슈, 파일, 사진 화면을 포함한다.
- UI/UX 구현 전 반드시 관련 화면 이미지를 먼저 확인한다.

Key file:

- `reference/acc-screenshots/_ACC-Build-화면분석-재현설계.md`

### ACC Analysis

Path: `reference/acc-analysis/`

- ACC Build 37화면 분석 문서의 별도 복사본.
- 구현 우선순위와 공통 컴포넌트 인벤토리를 확인할 때 사용한다.

### DKS Design Docs

Path: `reference/dks-design-docs/`

- `도면관리시스템_상세설계/`: 현재 기준 설계 문서.
- `Development_Design_legacy/`: 과거 자체 웹 CAD 설계 초안. 역사적 참고용이며, CAD editor 가정은 현 방향과 다르다.

First read:

- `reference/dks-design-docs/도면관리시스템_상세설계/00_개요-PMO/README.md`
- `reference/dks-design-docs/도면관리시스템_상세설계/05_프론트엔드-UIUX/README.md`
- `reference/dks-design-docs/도면관리시스템_상세설계/12_개발준비-기술스택/12-1_기술스택ADR.md`

### Autodesk Cloud

Path: `reference/autodesk-cloud/Autodesk_Cloud/`

- APS, Model Derivative, Data Management, Viewer SDK, 독자 DWG 파싱 전략 조사.
- 1차 앱 구현에서는 API 연동하지 않는다. 기술 판단 근거로만 사용한다.

### DKS Core Docs

Path: `reference/dks-core-docs/`

- 데이터 지식 스튜디오 README, concept map, RFP, 전략 문서.
- XD 차별점과 DKS 상위 맥락 확인용.

### Old Prototypes

Path: `reference/old-prototypes/`

- 이전 `prototype-도면지식관리`와 `prototype-도면지식관리-mvp`의 문서/데이터 참고 복사본.
- 새 앱의 코드 베이스가 아니다.
- `node_modules`, `.next`, 빌드 산출물은 복사하지 않았다.

## Not Copied

- `node_modules`
- `.next`
- build/cache outputs
- 폐기 대상으로 표시된 `Mockup_UI`는 기본 reference에 넣지 않았다.

## Rule

필요한 내용을 새 문서로 정리할 때는 `docs/`에 작성한다. `reference/` 원본은 수정하지 않는다.
