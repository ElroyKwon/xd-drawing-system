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
