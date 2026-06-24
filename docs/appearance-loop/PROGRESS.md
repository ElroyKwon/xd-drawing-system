# PROGRESS — 외관 완성 루프

> 매 재진입 시 `LOOP.md` → 이 파일 순으로 읽고 이어받는다.

## 현재 상태 (2026-06-24, 세션 11 — M2 구현 완료)

- **단계**: **M2 Project Admin 템플릿 상세 완료**(검증 2렌즈 차단0, build PASS, test 39 PASS). 체크인 정지(예산 규칙).
- **다음 행동(다음 세션 진입점)**: `ai-loop` 장착 → `LOOP.md`·이 파일 읽기 → **M3 Build 비뷰어 표면**의 메타프롬프트 공동설계(Phase 2.5)부터. M3는 아직 메타프롬프트 미작성 → 초안→AskUserQuestion 공동설계→freeze 후 구현.
  - 게이트 해소됨: M2 작업량 분할 = **단일 M2 + 알림 매트릭스 단계화**(사용자 확정, `02-m2-admin.md` §게이트).
  - M2 구현 결과: `App.tsx`(activeView `"template-admin"` 분기·`seedHubTemplates`·`selectedTemplateId`·행 클릭→`openTemplateAdmin`), `ProjectAdminView.tsx`(얇은 래퍼 `mode` 분기 → 일반 `ProjectMemberAdminView`/템플릿 `TemplateAdminView`+5섹션+`NotificationMatrix` 3단 계층), `projectAdminData.ts`(템플릿 시드 `templateMembers`·`templateCompanies`·`notificationGroups`), `styles.css`(`.template-admin`·`.notify-*`·`.publish-toggle` 등). 회귀 테스트 5건 추가.

## Done-When 이월 추적 (Phase 6.5 reconcile 오판 방지)

- **FR-FS-004 일부 후속 이월**: LOOP Done-When의 "Project Admin 측면 네비(회사·브리지·액티비티·알림·위치·설정) 각각 구분 화면" 중 **브리지·액티비티·위치·설정** + **일반 모드의 회사·알림 화면**은 ACC 캡처 부재로 M2에서 다루지 않고 **후속(캡처 확보 시) 이월**. 근거=Co-design 결정 1(추정 구현 금지)·사용자 명시 승인(템플릿 상세 우선).
- M2가 커버: **템플릿 모드**의 회사·알림(매트릭스) + 구성·템플릿 구성원·프로젝트 구성원.
- → M5 신선한 비평가는 위 이월분을 "누락(UNMET)"이 아니라 "의도된 이월(HUMAN_GATE 승인)"으로 판정할 것.

### M1 결과 요약 (2026-06-24)
- Freeze된 결정 3종: ① 상호작용=구조 우선(부가 컨트롤 외관만) ② 샘플 카드 "사용하여 생성"→프로젝트 작성 모달+템플릿 프리필 ③ 프로젝트 목록 미손댐. (`prompts/01-m1-hub.md`)
- 구현(`src/App.tsx`·`src/styles.css`): 샘플 템플릿 접기/펴기 토글, 카드 "사용하여 생성" 버튼, 모달 템플릿 드롭다운 옵션 4종 + 프리필 경로(`openModalWithTemplate`), CSS `.tmpl-card-use`. 회귀 테스트 1건 추가(`App.test.tsx`).
- 검증: 구조 비평가=조건부통과(차단0), 브라우저 렌더 검증자=A1~A6·B3·C1·D1·D2 전부 PASS(콘솔 에러 0, 오버플로 0). `npm run build` PASS, `npm test` 34 PASS.
- 알려진 부채(차단 아님, 기존 코드): A2 접기 헤더 `<button>` 안 `<h3>` 중첩(접근성), A3 카탈로그 외 "복사" 칩·"사용자 정의" 서브텍스트, A4 templateId에 이름 문자열 사용(의미상 ID 부채). M2~M5 또는 별도 정리 후보.
- 증거등급 주의: C1(가로 오버플로)은 OS 창 한계로 **2048px까지만 실측(emulated)**. 코드상 `minmax(0,1fr)`+전용 스크롤 컨테이너로 2560 안전 추정이나 2560 정확검증은 미실시.

## 구현 기준선 (코드 변경 없이 파악한 현 외관 상태)

- Hub 셸(BrandBar·HubAdminBar·탭), 프로젝트 목록, 프로젝트 작성 모달: **구현됨**.
- My Home(온보딩 배너·할당·지도·책갈피·최근항목): **기본 셸 존재**, 카탈로그 수준 미달.
- 프로젝트 템플릿(샘플 카드·허브 템플릿·작성 2단계 모달): **부분**.
- Project Admin: 구성원 접근 셸 존재. 측면 네비 distinct 화면·템플릿 상세: **미확인/미구현 가능성** (M2에서 `ProjectAdminView.tsx` 정밀 점검 필요).
- Build: 홈·시트·파일·이슈·양식·사진·구성원·브리지·설정 + 2D 뷰어 셸 **전부 기본 셸 존재**. 단 충실도 낮음(예: Build 홈 = "68%" 카드 4개, 실제는 개요/종합 탭+위젯+차트). 뷰어 = 정적 시트+빈 마크업/이슈 패널뿐.

## 마일스톤 체크리스트

- [x] M1 Hub 표면 (2026-06-24 — 검증 PASS, 체크인 정지)
- [x] M2 Project Admin + 템플릿 상세 (2026-06-24 — 2렌즈 검증 차단0, 체크인 정지)
- [ ] M3 Build 비뷰어 표면
- [ ] M4 2D 뷰어 + 마크업/측정/비교/이슈
- [ ] M5 횡단 레이아웃 호환 + 최종 reconcile

## 프로세스 완결성 (Done-When과 별도 추적)

- [x] 각 마일스톤 메타프롬프트를 `prompts/`에 freeze했는가 (M1·M2 freeze 완료; M3~M5 미작성)
- [x] 각 마일스톤 별도 검증팀(2~4 렌즈) 돌렸는가 (M1=2렌즈, M2=2렌즈; M3~M5 예정)
- [ ] 최종 Phase 6.5 reconcile(신선한 비평가)을 돌렸는가 (M5 최종에서 LOOP Done-When 전 항목 reconcile 예정 — 아직 미실시)

## 검증 로그

- **M1 (2026-06-24)**: `npm run build` PASS · `npm test` 34 PASS(기존 33 + A4 프리필 회귀 1). 검증팀 2렌즈 — 구조 비평가 차단0/조건부통과, 브라우저 렌더 검증자 전 항목 PASS(콘솔 에러 0, 와이드폭 오버플로 0). 상세 `EVIDENCE.md` §M1.
- **M2 메타프롬프트 검토 (2026-06-24)**: freeze 전 3렌즈 객관 검토(캡처 충실도·구현 가능성·스코프/게이트). 차단 7건 적발·수정 → freeze v2. 주요: 알림 도구 13→15(자료전송 누락)·"필요한 작업 알림" 3단 계층 오기·주파수 "즉시" 누락·진입점 시드 부재·App state/네비 타입 격리 미명시·FR-FS-004 NARROWING 추적 부재. (구현은 다음 세션.)
- **M2 구현 (2026-06-24, 세션 11)**: `npm run build` PASS · `npm test` **39 PASS**(34→시드 반영 기존 2건 정정 + M2 회귀 5건). 검증팀 2 독립 렌즈(구조/엣지·레이아웃/비기능) 모두 **차단 0**. acceptance A1~A9·A7-bis·B1~B4·C1·D1·D2 전부 MET. C1 2560 device 등급 실측 보강(M1 부채 해소: 1920=1906==1906, 2560=2546==2546, 매트릭스 최대 전개 오버플로 0). 상세 `EVIDENCE.md` §M2.
- 기준선: M2 종료 시점 39 PASS·build PASS.
