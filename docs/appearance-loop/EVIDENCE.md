# EVIDENCE — 외관 완성 루프 완료 증거

> 마일스톤별 acceptance 채점 + 증거등급 누적. 최종 Done-When(LOOP.md) 전 항목 reconcile은 M5에서 신선한 비평가가 수행.
> 증거등급: `device`(실타깃) / `emulated`(스탠드인·브라우저 에뮬) / `synthetic`(우회 입력) / `static`(코드만).

## §M1 — Hub 표면 (2026-06-24, 세션 10)

메타프롬프트: `prompts/01-m1-hub.md` (freeze). 검증팀 2렌즈(구조 비평가 정적 채점 + 브라우저 렌더 검증자 chrome-devtools).

### Acceptance checklist 판정

| 항목 | 판정 | 증거등급 | 근거 |
|---|---|---|---|
| A1 My Home 6영역 렌더 | MET | emulated | 브라우저 스냅샷: 온보딩 배너·할당(필터칩3+빈상태)·지도 플레이스홀더·책갈피 빈상태·최근항목(4컬럼5행+페이저). 원본 173732·173742 구조 일치. |
| A2 샘플 템플릿 접기/펴기 헤더+기본 펼침 | MET | emulated | `useState(true)` 기본 펼침, 클릭 토글로 카드+모두보기 함께 접힘 확인. |
| A3 샘플 카드 4종+"사용하여 생성" 버튼 | MET | emulated | 4카드(GC/PSO/IO/OO) 각 이름·액세스 칩·"사용하여 생성" 버튼 렌더. |
| A4 "사용하여 생성"→모달+템플릿 프리필 | MET | emulated+synthetic | 브라우저: GC 카드 클릭→작성 모달 오픈, 템플릿 콤보 `value="General Contractor"` selected. 단위 테스트(`App.test.tsx`)로도 고정. |
| A5 허브 템플릿 분기(작성·검색·빈상태·테이블) | MET | emulated | 빈상태 + 2단계 작성→테이블 행 추가 확인. |
| A6 2단계 작성 모달(유형→이름) | MET | emulated | step1 라디오→다음→step2 이름→취소/X/제출 정상. |
| B1 `npm run build` 성공 | MET | device | tsc+vite build 성공(로컬 실행). |
| B2 `npm test` 전부 PASS | MET | device | 34 PASS(기존 33 + A4 회귀 1). |
| B3 콘솔 에러 0 | MET | emulated | chrome-devtools 콘솔: vite/React DevTools 안내만, 에러·경고 0. |
| B4 HUMAN_GATE 미침범 | MET | static | `openModalWithTemplate`=`setForm`만. 영속화·네트워크·외부 SDK·지도 임베드 없음(정적 MapPin). |
| C1 1920·2560 가로 오버플로 0 | **MET (emulated, 부분)** | emulated | 1920 및 와이드 2048px 실측 `scrollWidth==clientWidth`, 오버플로 false. **OS 창 한계로 2560 정확검증 미실시** — 코드상 `minmax(0,1fr)`+전용 스크롤 컨테이너로 안전 추정. M5에서 2560 재확인 필요. |
| D1 탭 전환·레벨 분리 | MET | emulated | My Home↔프로젝트↔템플릿 region 교체, project-admin/build 풀스크린 분리 유지. |
| D2 모달 동선 무파손 | MET | emulated | 프리필 모달 취소/X/제출, 빈 이름 가드 셸 무파손. |

### 차단 결함
없음 (구조 비평가·브라우저 검증자 모두 차단 0건).

### 알려진 부채 (차단 아님 — 기존 코드, M1 변경분 아님)
- A2: 접기 헤더 `<button>` 안에 `<h3>` 중첩 — 접근성(heading 역할 미노출, `aria-controls` 부재). M1에서 이 버튼을 실토글로 만들며 표면화.
- A3: 카탈로그에 없는 "복사" 칩·"사용자 정의" 서브텍스트(정적 장식).
- A4: `templateId` 필드에 템플릿 이름 문자열 저장(의미상 ID 부채, 동명/i18n 시 취약).
- → surgical change 원칙상 M1 범위에서 미수정. M2~M5 또는 별도 정리 후보.

### 검증 미실시/제약
- C1 2560px 정확검증: OS 창 한계로 미실시(2048까지 emulated). 픽셀정확 2560은 헤드리스/최대화 환경 재확인 권장.
- 본 EVIDENCE는 M1 단위 증거. LOOP.md Done-When(product) 전 항목의 MET/NARROWED/UNMET 최종 reconcile은 M5에서 신선한 비평가가 수행.

## §M2 — Project Admin 템플릿 상세 (2026-06-24, 세션 11)

메타프롬프트: `prompts/02-m2-admin.md` (freeze v2). 게이트 결정: 단일 M2 + 알림 매트릭스 단계화(사용자 확정). 검증팀 2 독립 렌즈(렌즈1=구조/카탈로그 충실도+엣지케이스, 렌즈2=레이아웃/비기능/회귀격리), 둘 다 chrome-devtools 실브라우저 구동 + 마커 검증으로 page-select race 우회.

### Acceptance checklist 판정 (frozen 메타프롬프트 §Acceptance)

| 항목 | 판정 | 증거등급 | 근거(두 렌즈 종합) |
|---|---|---|---|
| A1 시드 행 기본 렌더→상세 진입→뒤로가기 복귀 | MET | emulated | 시드 "표준 프로젝트 템플릿" 행 클릭→`.template-admin` 진입, "프로젝트 템플릿" 뒤로가기→탭 복귀(`aria-selected=true`). |
| A2 측면 네비 2그룹 distinct 전환 | MET | emulated | `템플릿 설정[구성·템플릿 구성원]`/`프로젝트 설정[프로젝트 구성원·회사·알림]`, 각 항목 클릭 시 distinct h1. |
| A3 구성(액션바·일반·고급 게시토글) | MET | emulated | `[프로젝트 만들기][사본 작성][보관]`, 이름+편집 연필, 토글 OFF 「아니요」/ON 「예」(`aria-checked` 토글) + 설명문. |
| A4 템플릿 구성원(추가·검색·5컬럼·페이저) | MET | emulated | 5컬럼·실값 TEST-/관리자/Project Admin·페이저. |
| A5 프로젝트 구성원(빈상태) | MET | emulated | 5컬럼 헤더 + "표시할 프로젝트 구성원이 없습니다." + HardHat 일러스트 + 설명문. |
| A6 회사(추가·검색·테이블·케밥) | MET | emulated | 이름·업종·추가된 일시·행 케밥(`aria-label="회사 작업"`). |
| A7 알림 매트릭스(보조네비·헤더·3그룹·기타 15도구·주파수4·권한바) | MET | emulated | "기타 알림" 전개 시 **정확히 15도구(자료전송 포함)**, 주파수 옵션 `[즉시·매시·다양한·매일]`, "관리". |
| A7-bis 필요한 작업 9도구 + 이벤트 3단 계층 | MET | emulated | 전개 시 **정확히 9도구**, 양식 재전개 시 이벤트 4행(라벨 strong + 설명 small 2줄). 그룹→도구→이벤트. |
| A8 전개/접기 토글 동작 | MET | emulated | 양식 4→0→4 일치, `aria-expanded` 토글, 빠른 반복 10회 후 행수 일관(24). |
| A9 일반 프로젝트 어드민 무회귀 | MET | device+static | 브라우저: 일반 모드 7항목 네비·"Project 레벨"/"프로젝트 관리"·"템플릿 관리" 미노출. 정적: `adminSections`(7)·`AdminSection`·`Exclude<…,"구성원">` 패널 불변, 템플릿 모드는 독립 타입 `TemplateSectionKey`/`templateRailGroups`로 분리. |
| B1 `npm run build` 성공 | MET | device | tsc+vite build 성공(로컬). |
| B2 `npm test` 전부 PASS | MET | device | **39 PASS**(기준선 34 → 시드 반영 기존 2건 정정 + M2 회귀 5건: A1 진입·A2 5항목 네비·A7 15도구·A7-bis 9도구+이벤트·A9 무회귀). |
| B3 콘솔 에러 0 | MET | emulated | 진입·5섹션 네비·매트릭스 전개·토글·복귀 전 과정 error/warn/issue 0. 초기 form-field issue는 select `name` 부여로 해소. |
| B4 HUMAN_GATE 미침범 | MET | static | 게시 토글·멤버/회사 추가·알림 정책·그룹 작성 모두 affordance(로컬 state/비활성)뿐, 영속화·RBAC·네트워크 없음. |
| C1 1920·2560 가로 오버플로 0 | **MET (device)** | device | **2560 실측 보강 완료**: 1920(scrollWidth 1906==1906)·2560(2546==2546) 양쪽, 매트릭스 두 그룹 전개+9도구 events 전개 최대 폭에서 셸·메인·`.notify-table` 모두 오버플로 0. (M1 C1의 2560 미실시 부채를 M2에서 device 등급으로 해소.) |
| D1 모드 분리(컨텍스트 누수 없음) | MET | emulated | 템플릿↔일반 모드 누수 0, 네비 5항목 왕복. |
| D2 모달 열고닫기 + 엣지 무파손 | MET | emulated | 멤버/회사 추가 모달 X·취소, 잘못된 입력("@@@!!!")에도 셸 무파손, 매트릭스 반복 토글 안전. |

### 차단 결함
없음 (두 독립 렌즈 모두 차단 0건).

### Done-When 이월 (Phase 6.5 최종 reconcile 입력 — M5)
- **FR-FS-004(측면 네비 6화면 distinct)**: M2는 **템플릿 모드**의 회사·알림(매트릭스) + 구성·템플릿/프로젝트 구성원만 커버. 일반 모드의 브리지·액티비티·위치·설정 + 일반 회사·알림 distinct 화면화는 **ACC 캡처 부재로 의도적 후속 이월**(frozen 메타프롬프트 §Out of scope + 사용자 게이트 승인 "템플릿 상세 우선"). → M5 신선한 비평가는 이를 UNMET이 아니라 "의도된 이월(HUMAN_GATE 승인)"로 판정할 것.
- **"템플릿 상세 셸(템플릿 설정/프로젝트 설정 + 알림 매트릭스)"** Done-When 항목 → **MET**(2렌즈 브라우저 실측).

### 비차단 학습점 (제품 결함 아님)
- 검증 오케스트레이션: 두 검증자가 chrome-devtools 단일 서버의 전역 selected-page를 공유 → page-select race. 둘 다 페이지 마커(`window.__LENS1B__`/`window.__lens`) 검증으로 잘못된 페이지 결과를 폐기해 우회. 향후 다중 브라우저 검증자는 `isolatedContext` + 마커를 표준화하거나 순차 실행 권장.
- 기존 부채(M1에서 식별, 여전히 미수정·차단 아님): A2 접기 헤더 button>h3 중첩, A3 "복사" 칩, A4 templateId 문자열. M2 범위 밖(surgical) — 별도 정리 후보.
