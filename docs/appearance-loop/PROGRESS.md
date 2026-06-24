# PROGRESS — 외관 완성 루프

> 매 재진입 시 `LOOP.md` → 이 파일 순으로 읽고 이어받는다.

## 현재 상태 (2026-06-25, 세션 14 — M5 완료 = 루프 DONE)

- **단계**: **M5 횡단 레이아웃 호환(FR-LC) + 최종 reconcile 완료. 외관 완성 루프 product Done-When 전 항목 MET → DONE.** 체크인 정지(예산 규칙). build PASS · **test 52 PASS** · 콘솔 0 · diff-check clean · HUMAN_GATE 0건.
- **M5 3결정(`05-m5-layout-reconcile.md` 공동설계)**: ①범위=검증+발견된 파손 수정+알려진 a11y 부채 정리 ②C1 2560=헤드리스 Chrome 실제 2560 창 측정(device급) ③이월분=신선한 비평가 판정에 일임.
- **M5 구현 결과**:
  - **FR-LC 재검증(파손 0)**: zero-dep CDP 하네스(Node v24 내장 WebSocket, 실제 `--window-size` 창)로 M1~M4 전 10화면 1920·2560 측정 → 셸 가로 오버플로 ≤0(대부분 -15), 스크롤 컨테이너 밖 클리핑 0. **C1 2560 누적 부채 device급 해소**(실제 2560 창). 3대 스트레스 화면(알림 매트릭스·11컬럼 파일·4열 뷰어) 스크린샷 육안 겹침 0. 폰트 스택 mac/win 분기 static 확인. **파손 0이라 레이아웃 코드 미변경(surgical).**
  - **a11y 부채 정리**: 신규 `src/hooks/useModalDismiss.ts`(ESC·포커스 트랩·트리거 복귀 공통 훅, autoFocus 존중, `isConnected` 가드) → 모달 9개 적용(App 3·ProjectAdmin 2·Issues 1·Files 1·viewer 2; viewer는 인라인 ESC를 훅으로 대체). A2 접기 헤더 accordion 교정(`<h3><button><span>`)+`styles.css`. A3/A4는 수용 부채 기록(능동 리팩터 회피).
  - **검증 2 독립 렌즈**: 적대적 a11y 검증자(차단0/비차단4, B-2만 수정) + Phase 6.5 완결성 비평가(아래).
  - **회귀 테스트 3건**(accordion·모달 ESC+트리거복귀·포커스 dialog 진입). 49→52 PASS.
- **Phase 6.5 reconcile 결과**: 신선한 비평가(구현 미참여, PROGRESS 사전 메모 비입력)가 LOOP product Done-When 16항목 전부 **MET**(NARROWED/UNMET 0). **정정 발견**: §M2/§M3가 "의도된 이월(미구현)"로 적었던 FR-FS-004 일반모드 6화면·FR-FS-012/014/015가 실제 코드엔 distinct 화면으로 이미 구현돼 있어 MET(사전 메모가 과보수적이었음). HUMAN_GATE 불필요.

### M4 결과 요약 (2026-06-24, 세션 13)
- **M4 4결정(`04-m4-viewer.md`)**: ①범위=§E·F·G·H 4영역 전부 한 사이클(affordance 깊이), FR-FS-007~010 본 M4가 커버 ②마크업 캔버스=충실한 정적 외관(드로잉 없음) ③측정/비교/이슈=풀 affordance ④코드구조=`src/build/viewer/` 하위 분할.
- **M4 구현**: `src/build/viewer/` 신규 9컴포넌트 + `viewerData.ts`. `SheetViewerShell.tsx` 재작성(좌3탭·우측 보조·툴레일10·하단 뷰컨트롤). `styles.css` "M4 2D 뷰어" 섹션. 회귀 6건. 3렌즈 검증(접근성 차단5 적발→수정), 49 PASS.

### M3 결과 요약 (2026-06-24, 세션 12)
- M3 4결정(`03-m3-build.md`): ①범위=캡처 강한 3개(홈·시트·파일) 집중 + 나머지 6 이월 ②상호작용=구조 우선 계승 ③분석차트=빈상태 골격+정적 축/범례 ④코드구조=화면별 파일 분할.
- M3 구현 결과: `src/build/` 신규 8뷰 파일(`BuildHomeView`[개요/종합 탭]·`SheetsListView`[행메뉴 팝오버]·`FilesView`[Welcome배너·11폴더트리·11컬럼·업로드모달]·`IssuesView`·`FormsView`·`PhotosView`·`BuildManagementView`·`SheetViewerShell`) + `nav.ts` + `buildFilesData.ts`(11폴더 시드). `BuildSheetsView.tsx`는 rail+topbar+라우팅 셸(143줄)로 축소. `styles.css`에 `home-*`·`row-menu-*`·`files-welcome`·`upload-*` 추가, `.files-table` min-width 1320. 회귀 테스트 4건 추가.
  - M3 4결정(`03-m3-build.md` 공동설계): ①범위=캡처 강한 3개(홈·시트·파일) 집중 + 나머지 6 이월 ②상호작용=구조 우선 계승 ③분석차트=빈상태 골격+정적 축/범례 ④코드구조=화면별 파일 분할.
  - M3 구현 결과: `src/build/` 신규 8뷰 파일(`BuildHomeView`[개요/종합 탭]·`SheetsListView`[행메뉴 팝오버]·`FilesView`[Welcome배너·11폴더트리·11컬럼·업로드모달]·`IssuesView`·`FormsView`·`PhotosView`·`BuildManagementView`·`SheetViewerShell`) + `nav.ts` + `buildFilesData.ts`(11폴더 시드). `BuildSheetsView.tsx`는 rail+topbar+라우팅 셸(143줄)로 축소. `styles.css`에 `home-*`·`row-menu-*`·`files-welcome`·`upload-*` 추가, `.files-table` min-width 1320. 회귀 테스트 4건 추가.

## Done-When 이월 추적 (Phase 6.5 reconcile 오판 방지)

- **FR-FS-004 일부 후속 이월(M2)**: "Project Admin 측면 네비(회사·브리지·액티비티·알림·위치·설정) 각각 구분 화면" 중 **브리지·액티비티·위치·설정** + **일반 모드의 회사·알림 화면**은 ACC 캡처 부재로 후속 이월. M2가 커버: **템플릿 모드**의 회사·알림(매트릭스) + 구성·템플릿/프로젝트 구성원.
- **FR-FS-012/013/014/015 후속 이월(M3)**: Build 레벨 **이슈·양식·사진·구성원·브리지·설정**의 distinct 화면화는 **Build 레벨 독립 캡처 부재로 후속 이월**(§H 175657은 뷰어 안 이슈 연계=M4 성격). 근거=M3 결정 1(추정 구현 금지)·M2 선례. 현 셸/placeholder는 분할 이동만(무회귀). M3가 커버: **FR-FS-005(홈)·006(시트)·011(파일)**=MET.
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
- [x] M3 Build 비뷰어 표면 (2026-06-24 — 2렌즈 검증 차단0, 체크인 정지)
- [x] M4 2D 뷰어 + 마크업/측정/비교/이슈 (2026-06-24 — 3렌즈 검증, 접근성 차단5 적발→수정, 체크인 정지)
- [x] M5 횡단 레이아웃 호환 + 최종 reconcile (2026-06-25 — FR-LC 파손0·C1 2560 device급 해소·a11y 9모달 훅·2렌즈 차단0·Done-When 전항목 MET → **루프 DONE**)

## 프로세스 완결성 (Done-When과 별도 추적)

- [x] 각 마일스톤 메타프롬프트를 `prompts/`에 freeze했는가 (M1·M2·M3·M4·M5 freeze 완료)
- [x] 각 마일스톤 별도 검증팀(2~4 렌즈) 돌렸는가 (M1=2, M2=2, M3=2, M4=3, M5=2렌즈[적대적 a11y + Phase 6.5 완결성])
- [x] 최종 Phase 6.5 reconcile(신선한 비평가)을 돌렸는가 (M5에서 LOOP product Done-When 16항목 전부 MET, NARROWED/UNMET 0 — 사전 메모 비입력 독립 판정)

## 검증 로그

- **M1 (2026-06-24)**: `npm run build` PASS · `npm test` 34 PASS(기존 33 + A4 프리필 회귀 1). 검증팀 2렌즈 — 구조 비평가 차단0/조건부통과, 브라우저 렌더 검증자 전 항목 PASS(콘솔 에러 0, 와이드폭 오버플로 0). 상세 `EVIDENCE.md` §M1.
- **M2 메타프롬프트 검토 (2026-06-24)**: freeze 전 3렌즈 객관 검토(캡처 충실도·구현 가능성·스코프/게이트). 차단 7건 적발·수정 → freeze v2. 주요: 알림 도구 13→15(자료전송 누락)·"필요한 작업 알림" 3단 계층 오기·주파수 "즉시" 누락·진입점 시드 부재·App state/네비 타입 격리 미명시·FR-FS-004 NARROWING 추적 부재. (구현은 다음 세션.)
- **M2 구현 (2026-06-24, 세션 11)**: `npm run build` PASS · `npm test` **39 PASS**(34→시드 반영 기존 2건 정정 + M2 회귀 5건). 검증팀 2 독립 렌즈(구조/엣지·레이아웃/비기능) 모두 **차단 0**. acceptance A1~A9·A7-bis·B1~B4·C1·D1·D2 전부 MET. C1 2560 device 등급 실측 보강(M1 부채 해소: 1920=1906==1906, 2560=2546==2546, 매트릭스 최대 전개 오버플로 0). 상세 `EVIDENCE.md` §M2.
- **M3 구현 (2026-06-24, 세션 12)**: `npm run build` PASS · `npm test` **43 PASS**(기준선 39 + M3 회귀 4건: 홈 개요/종합 탭전환·종합 6분석카드·시트 행메뉴 팝오버·파일 업로드 모달). 검증팀 2 독립 렌즈(렌즈1=구조 비평가 정적, 렌즈2=브라우저 렌더/레이아웃) 모두 **차단 0**. acceptance A1~A8·B1~B4·C1·D1·D2 전부 MET. C1 1920/2560 device 실측(파일 11컬럼 -15/-16·홈/시트 -16, 넓은 표는 `.table-scroll` 내부 격리). 콘솔 0. 이동 5화면 마크업 바이트 동일(분할 무회귀). 상세 `EVIDENCE.md` §M3.
- **M4 구현 (2026-06-24, 세션 13)**: `npm run build` PASS · `npm test` **49 PASS**(기준선 43 + M4 회귀 6건: 도구 토글·타입별 속성·3탭·측정+교정·비교 A/B+오버레이·측정패널 자동닫힘). 검증팀 3 독립 렌즈(렌즈1=구조 비평가 차단0, 렌즈2=접근성/엣지 비평가 차단5 적발, 렌즈3=브라우저 직접 실측). 렌즈2 차단5(비교 모드 하단컨트롤 중복·패널 중첩·측정 도구 잔류·activeTool 잔류·모달 ESC 부재) **전부 수정** + 브라우저 재실측으로 해소 확인(dup 2→1). acceptance A1~A8·B1~B4·C1·D1·D2 전부 MET. C1 1920=-16·2048(4열 has-aside)=-15 device 실측, 2560은 고정폭 합산 정적 근거(OS 창 한계). 콘솔 0. 상세 `EVIDENCE.md` §M4.
- **M5 구현 (2026-06-25, 세션 14)**: `npm run build` PASS · `npm test` **52 PASS**(기준선 49 + M5 회귀 3건: accordion 헤더·모달 ESC+트리거복귀·포커스 dialog 진입). FR-LC 재검증=헤드리스 Chrome 실제 2560 창(zero-dep CDP)으로 전 10화면 1920·2560 셸 오버플로 ≤0·클리핑 0 → **파손 0(레이아웃 코드 미변경)**. C1 2560 누적 부채 device급 해소. a11y=공통 훅 `useModalDismiss` 9모달 적용 + A2 accordion 교정. 검증팀 2 독립 렌즈(적대적 a11y=차단0/비차단4[B-2만 수정], Phase 6.5 완결성=Done-When 16항목 전부 MET). 콘솔 0·diff-check clean. 상세 `EVIDENCE.md` §M5.
- 기준선: **M5 종료 시점 52 PASS**·build PASS. **루프 DONE(전 마일스톤 완료, product Done-When 전 항목 MET, HUMAN_GATE 0).**

## 잔여 수용 부채 (차단 아님 — 후속 정리 후보)
- **A3** 샘플 카드 "복사" 칩·"사용자 정의" 서브텍스트(ACC 원본 캡처 부재로 제거 위험), **A4** templateId 이름 문자열(프리필 의존 → 시맨틱 리팩터 위험).
- **모달 훅 잠재 결함 3건**(현 구성 미트리거): B-1 0-포커서블 모달 트랩 누수, B-3 모달 내 `<select>` ESC가 모달 닫음, **B-4 중첩 모달 동시 ESC**(향후 중첩 모달 도입 시 차단 승격 — 도입 전 훅에 최상위-모달-only 스택 필요).
- ARIA 미세(tablist roving·tabpanel 연결) — 기존 탭 구현과 일관, 별도 정리 후보.
