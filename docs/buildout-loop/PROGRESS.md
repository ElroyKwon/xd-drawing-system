# PROGRESS — 실동작 빌드아웃 루프

> 매 재진입 시 `LOOP.md` → `PLAN.md` → 이 파일 순으로 읽고 이어받는다.

## 현재 상태 (2026-07-03, 세션 16 — S8.2 DONE + S8.3-폴리시 4종 DONE 전부 커밋)

**AI 챗이 앱에서 실 gpt-5.5 + TypeDB 그라운딩으로 완전 동작하고, S8.3-폴리시(마크다운·리사이즈·대화목록·딥링크)까지 커밋 완료.** 로컬 `main`은 `origin/main`(`d6e8b8b`)보다 **6커밋 ahead, 아직 push 안 함**.

- **커밋 순서(미푸시 6)**: `bf6c055`(세션14 문서정리) → `c39d6bf`(S8.2 툴 7종+골든 이밸 100%) → `cc510c8`(마크다운 렌더 R5) → `8dba37b`(드로어 폭 리사이즈) → `9b0ebc7`(대화 목록 UI) → `086c331`(딥링크 xd:navigate R6). HEAD=`086c331`.
- **S8.3-폴리시 DONE(전부 device 검증·콘솔0)**:
  - **마크다운 렌더**(`cc510c8`): `src/ai/markdown.tsx` 경량 안전 렌더러(굵게·코드·불릿·번호, dangerouslySetInnerHTML 미사용). raw `**` 제거. vitest +5.
  - **드로어 폭 리사이즈**(`8dba37b`): 왼쪽 가장자리 드래그(기본400·클램프 320~900).
  - **대화 목록 UI**(`9b0ebc7`): 헤더 새 대화(＋)·대화 목록(🕘), 기존 대화 클릭 복원. 사이드카 `GET /api/chat/conversations`·`/{cid}` 소비.
  - **딥링크**(`086c331`): 사이드카 run_chat이 툴결과서 `references`(시트·이슈 id→라벨) 수집→응답+영속. 프론트 참조 칩(📄시트/⚠이슈) 클릭→`xd:navigate` 이벤트→BuildSheetsView가 searchOpenSheet/searchOpenIssue 재사용. device: ⚠칩→이슈뷰+상세, 📄칩→도면 뷰어. `evidence/s8_3-deeplink-issue.png`·`sheet.png`.
- **회귀 GREEN**: vitest **116** · build · backend pytest **97** · 사이드카 pytest **26**(딥링크 references +4) · 격리 import0 · 8000 tracked diff0. (⚠️ vitest는 8000 내리고 실행 — 라이브 백엔드면 App 템플릿 테스트가 시드 로드로 오염. 백엔드 내리면 116 전부 통과 확인.)
- **untracked**: `.obsidian/` 설정 6개(제품 무관 vault 설정 — 추적/ignore 결정 필요).
- **TypeDB 운영 메모**: 드라이버 패닉(`overflow subtracting durations`)은 컨테이너 장시간 기동 타이밍 버그 → **컨테이너 재시작으로 해소**. `XD_STORE=typedb` 강제 기동 시 폴백 없이 실패로 드러남(데모는 typedb 강제 권장).

### ▶ 사용자 신규 요청 백로그 (2026-07-03 세션16 — "연결 기능" 존재 여부 확인 결과)
현재 미구현/신규 스코프. **ACC 외관 복제 범위를 넘어서는 신규 기능**이며 일부는 HUMAN_GATE.
1. **관계자 이메일 발송** — ❌ 미구현. SMTP/메일 발송 로직 전무(`email`은 구성원 표시 필드일 뿐). → 신규: 메일 provider·자격증명·발송 서비스 필요. **외부 egress = 결정 게이트**.
2. **이슈 생성·상태변경 이메일 알림** — ❌ 미구현. 알림 설정 UI(`notificationGroups`/`Frequencies`)는 **정적 목업**(발송 안 됨). → 신규: 이슈 라이프사이클 훅 + 메일 발송(위 1 의존) + 구독자 매트릭스 실동작화.
3. **실 로그인→링크 접속→업로드→버전추적** — 부분. **버전관리 추적은 구현됨**(S3: 파일/폴더 CRUD + 명시적 버전세트[보관·이력·최신1행], plan_a/b/v1 실동작). **단 실 인증은 미구현** — 현재 S7은 **로컬 모의 사용자 전환**(자격증명·세션·매직링크 없음). 실 로그인/RBAC 프로덕션 = **기존 HUMAN_GATE**(LOOP.md). 매직링크 초대·외부 접속도 신규 스코프.

- **다음 세션 우선순위**:
  1. 미푸시 6커밋 원격 `main` push(사용자 승인 시).
  2. `.obsidian/` gitignore 결정.
  3. 루프 잔여: **S8.4**(egress 감사로그/킬스위치/키관리 정식화) → **S8.5**(독립 3렌즈+Done-When reconcile→S8 DONE) → **S10**(온톨로지 적재+바인딩).
  4. 신규 백로그(위 1~3)는 스코프·게이트 사용자 확정 후 착수(이메일=egress 게이트, 실인증=프로덕션 게이트).

---

## 이전 상태 (2026-07-03, 세션 15 — S8.2 툴 카탈로그 + 그라운딩/환각 골든 이밸 DONE)

**AI 챗 툴이 7종으로 확장되고, 실 gpt-5.5가 TypeDB에 그라운딩해 환각 없이 답함을 골든 이밸로 라이브 입증.** `prompts/11-s8_2-tool-catalog-eval.md` FROZEN(3결정 공동설계: 툴세트 ROADMAP 5종·이밸 라이브만 90%·환각 표준기준). 독립 검증자 L1~L10 전항목 PASS.

- **S8.2 DONE**(커밋 예정, `prompts/11` FROZEN, L1~L10 MET): 읽기 툴 **5종 추가**(총 7종) — `get_project_summary`(drawings·issues·folders 실 GET 조합)·`get_sheet(sheet_id)`·`list_issues(status·category 필터)`·`get_issue(issue_id)`·`list_files(folder 필터+파일별 sheet_count)`. **오직 8000 HTTP GET**(격리 import 0). not-found는 `{"found": False}` 정직 반환. `agent.py` TOOLS_SCHEMA·_dispatch·_summarize 7종 등록(project 서버주입). 사이드카 pytest **22**(신규 11).
- **골든 라이브 이밸 15/15 = 100%**(`evidence/s8_2-golden-eval.md`, 세트 `backend/ai/eval/golden.json`, 러너 `run_golden.py`): 그라운딩 10 + 환각 적대 5. **이밸이 실오답 2건 조기 적발** — 1차 13/15(G5 제주BESS "1페이지" 환각·G4 clash 2/3 불완전) → 근본원인 수리(list_issues category 필터 + list_files sheet_count + 프롬프트 라우팅 지침, **8000 무수정·격리 유지**) → 3차 15/15. 환각 5문항 전부 '없음' 정직 응답.
- **정답 근거 순환성 검증**(사용자 지적 반영): 골든 정답이 8000(TypeDB)=LLM 소스와 동일한 순환 위험을 **8000 밖 3층 독립대조**로 해소 — JSON 원자료(`_issues.json` 필터=12·`_index.json`=8·`_folders.json`=14 = API 일치=미러 정합) + 원본 PDF fitz(`제주 original.pdf page_count=8` = G5 정답 독립 참). 남은 민감점: 시트15=버전이력 포함(최신만 13)·디스크 고아파일 5개. 데이터 진실성 체계검증은 S10.
- **실 TypeDB 라이브 앱 시연**(`evidence/s8_2-chat-typedb-live.png`): `XD_STORE=typedb` 강제(폴백 raise), 로그 `TypeDB connected 1729/xd_drawings`. 앱 드로어→"이 프로젝트 요약+제주BESS 페이지"→툴칩(get_project_summary sheets=15 open_issues=12 files=8·list_files files=8 folders=14)→답변(파일8·시트15·이슈12·폴더14·제주BESS 8페이지), 콘솔0. **TypeDB 드라이버 패닉("overflow subtracting durations")은 컨테이너 장시간 기동 타이밍버그 → 재시작으로 해소.**
- **회귀 0**: `npm build`·vitest **111**·backend pytest **97**·사이드카 pytest **22**·격리 import0·8000 tracked diff0.
- **독립 검증자**(general-purpose, 156s): L1~L10 전항목 PASS, 반례 탐색에도 답변/툴콜 불일치 0, 수리 이력을 `results_run1/run2.json`로 실재 확인(위조 아님).
- **다음 = S8.3-폴리시**(마크다운 렌더[답변 `**` raw 노출]·대화이력 UI·딥링크 xd:navigate) → S8.4(egress 감사) → S8.5(3렌즈+reconcile→S8 DONE) → S10(온톨로지). 재기동법 아래 세션6 블록(⚠️ 8001 라우트 추가 후 수동 재기동·vitest는 8000 내리고).

---

## 이전 상태 (2026-07-03, 세션 14 — S8 AI 챗 사이드카 실동작: S8.0·S8.1·S8.3 DONE + 실 GPT-5.5)

**AI 챗 어시스턴트가 앱에서 실 GPT로 동작한다.** 사이드카 골격(S8.0) → LLM 두뇌·대화영속(S8.1) → 앱 챗 드로어 UI(S8.3)까지 실동작. 커밋 7건(아래).

- **S8.0 DONE**(`e6309c1`, `prompts/10` FROZEN, K1~K10 MET): 격리형 8001 사이드카(`backend/ai/`, 기존 8000 **무수정**) — `main_ai`·`client`(httpx lazy)·`tools`(search·list_sheets 8000 GET 그라운딩)·`health`. 격리 불변식 자동검사(AST import 0, 기존코드 diff 0). 자체 venv·requirements(uvicorn plain). 사이드카 pytest 8·라이브 스모크(`list_sheets=15==8000 raw`). 증거 `EVIDENCE.md` S8.0.
- **S8.1 DONE**(`beb56c9` + `12096f1`): 챗 두뇌. `provider.py`(OpenAIProvider **Responses API**+MockProvider egress0), `agent.py`(tool-use 루프: LLM→툴콜→8000 HTTP 실행→그라운딩 답), `ai_store.py`(대화 영속 `_ai_data/`, 원자적write, owner=표시용), `routes_chat.py`(POST /api/chat + 대화 목록/상세), `.env` 로더. **LLM 확정: OpenAI `gpt-5.5` + reasoning effort `low`, Responses API 필수**(chat.completions는 함수툴+effort 미지원 400). 키=`backend/ai/.env`(gitignore). 사이드카 pytest **12**. **실 GPT 라이브 실증** `evidence/s8_1-real-gpt-transcript.md`(5턴, TypeDB 백엔드, 스스로 툴선택·다중턴 컨텍스트·환각0).
- **S8.3 DONE**(`d6e8b8b`): 앱 챗 드로어 UI. `src/ai/`(격리: `aiClient`·`ChatDrawer`[FAB+패널·버블·툴칩·ESC·aria-live]·`chat.css`, 앱모듈 미의존) + BuildSheetsView **단일 마운트** + 킬스위치 `VITE_AI_ENABLED`. device e2e: FAB→드로어→실 GPT 답변+툴칩, 콘솔0(`evidence/s8_3-chat-drawer.png`). vitest **111** 회귀0.
- **UI 정리**(`0060c44`): 평가판 배너("N일 남음"/"지금 구입")·"더 많은 XD 제품" 스트립·Build 평가판 배너 **전 화면 제거**. `docs/product/screenshots` 10장 재촬영(2560×1362, 기존=`이전버전_2026-07-02/`).
- **데이터 프리뷰**(`d9d4b5d`): 실 데이터 Q&A 기록(TypeDB 그라운딩) — `s8_1-real-gpt-transcript.md`가 대체.
- **GATE 처분**: GATE-1 RESOLVED(온톨로지→S10). **GATE-2 RESOLVED**(프론트 격리 = Build 스코프 드로어·단일 접점). **GATE-3 RESOLVED**(owner=표시용 하향). **egress**: 대화·툴결과 OpenAI 전송=사용자 승인(GPT API 선택). provider=mock이면 egress 0.
- **인프라**: TypeDB 3.7.3 Docker 기동(`store_backend=typedb` 실동작) → **S10 온톨로지 착수 가능**. Ollama 미기동·로컬모델 없음.
- **재기동 (8001 신규)**: `backend/ai`에서 `.venv/Scripts/python.exe -m uvicorn main_ai:app --host 127.0.0.1 --port 8001`(`./run.ps1`). 최초 1회 `python -m venv .venv`+`pip install -r requirements.txt`. `.env`에 `OPENAI_API_KEY`·`XD_AI_MODEL=gpt-5.5`·`XD_AI_EFFORT=low`. 프론트 `VITE_AI_BASE`(기본 8001). ⚠️ **vitest는 8000 내리고 실행**.
- **다음 = ai-loop 이어가기**: 통합 로드맵·검수 `docs/buildout-loop/ROADMAP.md` 참조. 남은 스테이지 **S8.2**(전체 툴 카탈로그+골든 이밸/환각 적대) · **S8.4**(egress 감사로그/게이트 정식화) · **S8.5**(3렌즈 검수+격리 불변식 reconcile) · **S8.3 폴리시**(마크다운 렌더·대화이력 UI·딥링크 xd:navigate) · **S10**(온톨로지 적재+바인딩). 각 스테이지 메타프롬프트는 다음 세션 착수 시 공동설계·freeze.

---

## 이전 상태 (2026-07-02, 세션 13 — 백로그 소진: 정리 + 사진 도구)

사용자 지시: "남은 것 전부 다음 세션 백로그 순서대로, ai-loop 선택은 추천안으로 진행". 백로그 순서대로 자율 실행 중.

- **백로그 1 — 정리(DONE, 커밋 `af32b07`)**: 프로젝트 삭제 API + Hub 행 삭제 액션. `store.remove_project`(구성원 cascade, Json·TypeDB미러) + `DELETE /api/projects/{id}`(require_role 관리자, 404) + 프론트 `deleteProject`·App 테이블 행 삭제 버튼(관리자 게이트+confirm). 테스트 프로젝트 3종(x·S7검증현장·S7canManage검증) 실서버 API로 삭제 → **Hub 2개(Study/Seaport)로 클린**. pytest 12(신규 1)·vitest 108·build. device: 실서버 DELETE+cascade, UI 임시프로젝트 생성→삭제(confirm·목록갱신·콘솔0). evidence/s9_2-cleanup-hub.png.
- **백로그 2a — 사진(Photos) 도구(DONE, 커밋 `a9f9b3f`)**: 정적 플레이스홀더 → 실기능. store Photo 엔티티(add/list[project·sheet]/get/update/delete) + `routes_photo.py`(`/api/photos` 멀티파트 업로드·목록·/summary·PATCH·DELETE, RBAC 편집자·이미지검증·traversal방어·삭제시 파일정리) + `/files` static 서빙. 프론트 `api/photos.ts`·PhotosView 재작성(갤러리 그리드·다중 업로드·연결/미연결 필터·검색·라이트박스[캡션·시트연결 select·삭제], 게이팅) + BuildSheetsView 배선 + CSS. seed_demo `seed_photos()`(PIL 라벨 6장, 5연결·1미연결, 멱등). **pytest 92(사진 5)·vitest 108·build**. device: 갤러리 6장·연결5·라이트박스(백엔드 이미지·연결시트·캡션·select·삭제)·미연결 필터 1장·콘솔0. evidence/s9_2-photos-*.png.
- **백로그 2b — 프로젝트 템플릿 워크플로우(DONE, 커밋 `79fe995`)**: 허브 템플릿 로컬상태 → 백엔드 영속 엔티티 + **생성 시 템플릿 폴더·구성원 자동 시드**. store Template 엔티티(list/add/get/delete + 허브 기본 2종 시드, Json·TypeDB미러) + `routes_template.py`(`/api/templates` GET·POST[blank/existing-copy]·DELETE + `apply_template_to_project`[폴더 dedup·구성원 생성자 skip]) + create_project 적용. 프론트 `api/templates.ts` + App(백엔드 로드/낙관적 생성/삭제·2단계 모달 원본 프로젝트 select·생성 모달 허브 템플릿 optgroup). **pytest 97(템플릿 5)·vitest 108·build**. device: 생성 모달서 '표준 프로젝트 템플릿' 선택→생성→Project Admin 구성원 3명(reviewer 편집자·viewer 뷰어 시드)+폴더(시방서/제출물/회의록) 확인·콘솔0. **스코프: 알림 매트릭스·샘플 갤러리 상세 13화면 = UI 장식성으로 후순위 연기.** evidence/s9_3-template-applied-members.png.
- **백로그 2c — 홈 진행률 위젯 + 브리지(DONE, 커밋 `cba6551`)**: 일정 엔티티 부재 → 진행률을 '작업 항목 처리율'로 산출(가짜 일정 배제). `homeStats.computeProjectProgress`(작업 done+양식 완료+이슈 닫힘/총계) + BuildHomeView 진행률 카드(전체%+구성별 내역바·빈상태) + 브리지 정직한 빈 상태(교차-허브 연동 예정). 날씨=외부API=HUMAN_GATE 제외. **vitest 111(진행률 3)·build**. device: Study_Project 홈 12%(완료 3/25=작업2/8·양식1/5·이슈0/12)·콘솔0. evidence/s9_2c-home-progress.png. **⚠️ 프론트 단위 스위트는 오프라인 전제(라이브 백엔드 뜨면 App 템플릿 테스트가 백엔드 시드 로드로 실패 — vitest는 백엔드 내리고 실행).**
- **✅ 트랙B 전부 완료(2a·2b·2c).**
- **백로그 5(부채) — 이슈 카운트 정합(DONE, 커밋 `dbd1235`)**: '열린 이슈' 탭이 삭제됨 제외 전부(닫힘 포함)를 보여 홈 active 카운트와 어긋나던 것을 수정. IssuesView showDeleted→view(open|closed|deleted) 3-세그먼트, open=active(홈 정합)·closed=닫힘·deleted=삭제됨, ACTIVE_STATUSES를 homeStats와 공유. **vitest 111·build**. device: 열린 이슈 12=홈 active 12 → 1건 닫힘 → 열린 11·홈 11·닫힌뷰 1·진행률 이슈 1/12·8% 동시 정합·콘솔0. evidence/s9_debt-issue-count-reconciled.png.
- **⏸ 다음 = 체크포인트(HUMAN_GATE, 세션13 AskUserQuestion 타임아웃/AFK로 미응답)**:
  - **S8 사이드카 AI** — LLM egress=명시적 HUMAN_GATE + GATE-2(프론트 격리 접점)·GATE-3(owner 프라이버시) 사용자 결정 필요. Mock/로컬만으로 S8.0~S8.3 착수는 가능하나 핵심 가치(실 LLM)가 게이트라 AFK 상태 자율 착수 보류.
  - **S10 온톨로지** — Docker 미기동 확인(`docker ps` 실패, npipe 없음) → TypeDB 실적재 불가, json 폴백 유지. Docker Desktop 기동 후 가능.
  - **잔여 부채**: 검색 퍼지/랭킹 · 색맹 대응(상태 색상 단독 의존). (카운트 정합은 이번 세션 해소.)
- **세션13 총평**: 5 마일스톤 커밋(1 정리·2a 사진·2b 템플릿·2c 홈위젯·5 카운트정합). pytest **97** · vitest **111** · build 전부 GREEN. 재기동법 세션6 블록(⚠️ 라우트 추가 후 uvicorn 수동 재기동, **프론트 vitest는 백엔드 내리고 실행**).

---

## 이전 상태 (2026-07-02, 세션 12 — GATE-1 해소 + 데모 실데이터 + S9 작업 도구)

사용자 3갈래 요청(개발 확대+문서화 / 현실적 이슈+마크업 / S8 병행)에 대해 4결정 freeze 후 자율 실행. **추천대로 진행 + 미커밋 커밋** 승인.

- **미커밋 정리**: 세션11 S8 설계 4렌즈 검수분·HUMAN_GATE·s7 evidence 커밋(`0e97fea`).
- **GATE-1 RESOLVED (결정 ii)**: 온톨로지 바인딩 → **S10 연기**. `LOOP.md` Done-When NARROWED(연기처 S10), `PLAN.md` S8=사이드카 AI 챗 재정의 + S10 신설, `HUMAN_GATE.md` RESOLVED (`e25187f`). **S8 DONE 전제에서 온톨로지 제외 확정.**
- **트랙A — 데모 실데이터**(`b20977f`): 테스트 산물 이슈·junk 도면 정리 + 현실적 전기설계 이슈 **12건(핀 11)**을 단선결선도/배치 DWG(world)/BESS 8p에 분산 + 리비전 클라우드·실무 라벨 마크업. `scripts/seed_demo.py`(재현 산출물, uploads/ gitignore 대응). **사용자 피드백("안 이쁨") 반영**: 시트당 1~3개 분산·의미 라벨·겹침 제거.
- **마크업 가독성**(`1edb6af`): VectorCanvas 흰 배경 박스 + MarkupCanvas SVG 흰 외곽선(halo) → 도면 위 라벨 가독. build+test 98.
- **트랙B S9 — 작업(Tasks) 도구**(`a2c1f6a`): 홈 '작업 상태' 빈 상태 → 실데이터. 신규 Task 엔티티 CRUD(`store.py`·`routes_task.py`·`/api/tasks`+`/summary`) + RBAC(편집자) + `api/tasks.ts`·`BuildTasksView`(IssuesView 톤) + '작업' 네비 + 홈 위젯 딥링크. 시드 작업 8건. **build · vitest 103 · pytest 82** · 브라우저 e2e(작업뷰 8건·홈 6진행/2완료·콘솔0). *구현+자체검증(독립 3렌즈는 미실시).*
- **트랙B S9.1 — 양식(Forms) 도구**(`76ad33d`): 양식 플레이스홀더 → 체크리스트 점검표 실기능. `store.py` Form 엔티티(items 체크리스트)+`routes_form.py`(`/api/forms`+`/summary`+완료율 산출)+RBAC · `api/forms.ts`·`FormsView`(완료율 진행바·체크박스 토글·필터) · 홈 종합 탭 양식 KPI 3카드 실데이터 · 시드 점검표 5건(완료율 0~100%). build·vitest **108**·pytest **86**·브라우저 e2e(양식 5건·40% 진행바·콘솔0).
- **트랙C 문서화**(`3c6539b`): 완성 화면 스크린샷 10종(`docs/product/screenshots/01~10`) + `기능설명서.md`(모듈별 구현 명세) + `사용자매뉴얼.md`(작업별 안내). **제안서 PPTX는 사용자가 별도 터미널에서 진행**(세션 종료 답변으로 제안서 콘텐츠 전달).
- **다음 후보**: 제안서 PPTX(사용자 진행 중) · 트랙B 추가 기능(템플릿/사진) · S8.0 사이드카(GATE-2/3은 S8.3/S8.1 前). 테스트 프로젝트("x"·S7검증*) 정리는 보류(파괴적·미확인) — Hub 스크린샷 클린업 시 필요.

### 세션 12 진입점
- 재기동: 백엔드 `XD_STORE=auto backend/.venv/Scripts/python.exe -m uvicorn main:app --app-dir backend --port 8000` (⚠️ `--reload`는 backend/ 변경을 놓치는 사례 있음 — 라우트 추가 후엔 수동 재기동 권장) · 프론트 `npm run dev`(5173). 데모 재생성 = `PYTHONUTF8=1 backend/.venv/Scripts/python.exe scripts/seed_demo.py`.
- **제안서 PPTX = 완료(사용자 진행 종결).**

### ▶ 다음 세션 백로그 (사용자 확정 2026-07-02: "남은 것 전부 다음 세션에서")
순서대로 진행. 각 기능은 store+routes+프론트+테스트+브라우저 e2e, 스테이지 완료 시 커밋.
1. **정리(빠름)**: 테스트 프로젝트("x"·"S7 검증 현장"·"S7 canManage 검증") 삭제 → Hub 화면 클린. (프로젝트 삭제 API 필요 시 신설 — 파괴적이라 첫 착수 시 사용자 재확인 권장.)
2. **트랙B 나머지 신규기능**:
   - (a) **사진(Photos) 도구** — 업로드·갤러리·시트 연결 (작업/양식 패턴 미러링, 시각 임팩트 높음 → 우선).
   - (b) **프로젝트 템플릿 워크플로우** — ACC B그룹 13화면(생성 2단계 모달·샘플 갤러리·템플릿 상세·구성원 시드·알림 매트릭스).
   - (c) 홈 잔여 위젯(진행률=일정 기반 / 브리지). 날씨=외부 API=HUMAN_GATE 제외.
3. **S8 — 사이드카 AI 챗**: `prompts/10-s8_0-sidecar-bootstrap.md` FROZEN 기준 S8.0 착수. ⚠️ **GATE-2**(프론트 격리 접점=App.tsx+BuildSheetsView 재기술)·**GATE-3**(owner 프라이버시)는 S8.3/S8.1 freeze 전 결정 필요. LLM egress=HUMAN_GATE.
4. **S10 — XD 온톨로지**: 도면 entity TypeDB 실적재 + `equipmentEntityId` 바인딩(GATE-1에서 S8→S10 연기 확정). TypeDB 컨테이너 기동 필요(현재 Docker 미기동, json 폴백 중).
5. (부채) 검색 퍼지/랭킹 · 색맹 대응 · 홈 active vs 이슈탭 카운트 정합.

---

## 이전 상태 (2026-07-01, 세션 11 — S8 설계 v2 격리형 사이드카 FROZEN)

- **단계**: **S8 설계 FROZEN(구현 전).** 초안(v1 통합형)을 사용자 지시("기존과 별개로 동작")로 **완전 격리형 사이드카**로 재설계 → `docs/buildout-loop/S8-ai-chat-design.md` **STATUS: v2 FROZEN**.
- **공동설계 9결정 확정**: 핵심4(tool-use 그라운딩·제공자 로컬기본·프로젝트+사용자 대화·읽기 Q&A+딥링크) + **격리4**(별도 8001 프로세스·8000 공개 HTTP만 호출[기존 import 0]·src/ai 격리+BuildShell 1곳 마운트+킬스위치·강한 격리 불변식) + **OPEN-1=(a) 순수 클라이언트**(8000 완전 무수정, 장비-그래프 Q&A는 v1 밖).
- **격리 Done-When (e~g)**: flag OFF→기존 build/98 test/78 pytest GREEN·기존 routes_*/_*.json diff=0 / 8001 죽여도 8000 정상 / backend/ai가 기존 import 0(grep). "별개 동작"을 채점 가능한 기준으로 못박음.
- **로드맵(사이드카 개정)**: S8.0 8001 부트스트랩+데이터표면 / S8.1 ai_store+provider(로컬·Mock) / S8.2 tool-use+8000 HTTP 툴(respx 스텁) / S8.3 src/ai 드로어+SSE+BuildShell 마운트+flag / S8.4 딥링크 xd:navigate 브리지+egress 게이트+클라우드 어댑터 / S8.5 3렌즈+reconcile+킬스위치 불변식. S9=액션.
- **설계 검수 (독립 4렌즈, 구현 전)**: 렌즈1 아키텍처·렌즈2 메타프롬프트·렌즈3 코드대조·렌즈4 완성도. **백엔드 격리(별도 8001·import0·diff0)·OPEN-1(a)·S8.0 부트스트랩은 검증 통과.** 발견: **BLOCKER 2**(렌즈4 온톨로지 산출물 실종·렌즈1 BuildShell 허상)+**MAJOR 다수**(그라운딩/환각 이밸·ai_store 동시성·프론트 격리 미채점·owner 레이스·챗 a11y·라이브 스모크 재현). **즉시 교정 반영**(prompts/10 재freeze: health↔시트수·스모크 전제·K7 공허·CORS·경로 / 설계 §9 신설: BuildShell·`/api/files`·owner 정정). **미결 3게이트 → `HUMAN_GATE.md`**.
- **다음(세션12)**: **① GATE-1 결정 최우선** — 온톨로지 바인딩(LOOP.md L34 "핵심 차별화") 처분: 폐기/S10 연기/S8 재편입 3지. **미결 시 S8 DONE 경로 없음.** ② 그 후 S8.0 구현(`prompts/10` 교정 FROZEN, `backend/ai/` 신설, K1~K10). GATE-2/3은 S8.3/S8.1 FROZEN 전.

### 세션 11 진입점 (설계+검수 완료, 구현 미착수)
- S8 설계 v2 + S8.0 메타프롬프트(`prompts/10`) **검수 교정 반영 FROZEN**. 4렌즈 검수 결과 = `EVIDENCE.md` "S8 설계 검수" 블록, 미결 = `HUMAN_GATE.md`(GATE-1/2/3).
- **세션12 = GATE-1 결정(AskUserQuestion 3지) → 반영(LOOP/PLAN/EVIDENCE) → S8.0 구현 진입.** 재기동법 세션6 블록과 동일 + **8001 신규**(backend/ai/.venv 자체, `python -m uvicorn main_ai:app --port 8001`, 라이브 스모크 전 Study_Project에 도면 1건 업로드 필요).

---

## 이전 상태 (2026-07-01, 세션 10 — S7 검증 마무리 DONE: J7 Build UI 게이팅 + 독립 3렌즈 + 결함 전량 수리 + 디바이스 e2e + reconcile)

- **단계**: **S7 DONE.** 세션 9 이월분(3렌즈·reconcile·J7 Build 콘텐츠 UI 게이팅·J11 e2e 확장)을 전량 완결. acceptance **J1~J12 전부 MET**(NARROWED/UNMET 0), 세션9 NARROWED였던 **J11 device 해소**.
- **J7 구현**: `canEdit = currentRole !== "뷰어"`를 App→BuildSheetsView→FilesView/IssuesView/SheetViewerShell(+MarkupToolRail/IssueDetailPanel/MarkupPropertyPanel/MeasurePanel)로 스레딩. 뷰어=업로드·폴더·마크업/측정/이슈 작성·수정·삭제 비활성/숨김 + 전역 `:disabled` 시각 처리. 게이팅 단위 6.
- **독립 3렌즈 + 수리**: 렌즈1(백엔드 적대) **BLOCKER 2**(create_project 권한상승·시드 id 덮어쓰기)+**MAJOR 3**(이슈 실file 우회·마지막 관리자 강등/제거 락아웃) / 렌즈2(프론트) **MAJOR 2**(캔버스 단일의존 fail-open·FilesView 프로젝트 스코프 불일치) / 렌즈3(Done-When 비평). **전량 수리 + 회귀 테스트**(백엔드 4·프론트 6). 라이브 서버 재검증 403/400.
- **e2e 추가 적발**: 새 프로젝트 생성 후 `me.roles` stale로 canManage 잠김 → `submitProject` getMe 재로드 수리·device 확인.
- **게이트(전부 PASS)**: build · npm test **98** · pytest **78**(신규 게이팅6+수리회귀4, 회귀 0) · git diff clean.
- **디바이스 e2e(콘솔0)**: J1 전환·J7 뷰어 게이팅(파일·이슈·툴레일 DOM disabled 확인)·J5 브라우저 403·J3 역할변경 영속·J2 프로젝트 영속·canManage 수리. `evidence/s7-03·05·06·07·08·10`.
- **다음**: **S8 XD 온톨로지 + AI 분석**(도면 entity TypeDB 적재 + equipmentEntityId 바인딩, prompts/10 작성부터). **AI(LLM)=HUMAN_GATE**.

### 세션 10 진입점
- S7 DONE. **S8(AI 챗 어시스턴트) 설계 초안 작성** — `docs/buildout-loop/S8-ai-chat-design.md`(STATUS: DRAFT). 공동설계 4결정 확정(Tool-use 그라운딩·제공자 추상화 기본 로컬·프로젝트+사용자 대화 스코프·v1 읽기 Q&A+딥링크). 로드맵 S8.0~S8.5.
- **다음 세션 = 이 설계 검수** → 승인 시 S8.0(TypeDB 온톨로지 적재 점검)부터, per-stage 메타프롬프트(`prompts/10~`) FROZEN 후 구현. 미승인 항목 수정 후 재검수. 재기동법 세션6 블록과 동일(XD_STORE=auto/json, backend .venv python uvicorn 8000, npm run dev 5173).

---

## 이전 상태 (2026-06-30, 세션 9 — S7 인증(로컬 모의)+RBAC 강제+구성원/프로젝트 영속 구현 DONE · 검증 부분완료 · 커밋)

- **단계**: **S7 구현 완료, 검증 부분완료(사용자 세션 종료 요청).** 메타프롬프트 `prompts/09-s7-auth-rbac-members.md` FROZEN(4결정: **로컬 모의 사용자 전환 · 백엔드 역할 기반 강제(403) · 구성원+프로젝트 둘 다 영속 · 정규화 역할 모델**). acceptance J1~J12.
- **구현 요약**: 백엔드 `store.py`(member/project/project_member CRUD+current_user, seed-on-create), `auth.py` 신설(역할위계 뷰어<편집자<관리자 `require_role*`, 미구성 프로젝트 미강제=레거시 보존), `routes_auth.py` 신설(`/api/auth/me`·`/api/projects`·구성원 CRUD), 기존 mutation 라우트에 `require_role(편집자)` 적용, schema entity. 프론트 `api/admin.ts`, `App.tsx`(현재 사용자 로드·하드코딩 제거·사용자 전환 메뉴·프로젝트 백엔드·canManage), `ProjectAdminView`(구성원 백엔드+역할변경+게이트), `BuildManagementView` 실데이터.
- **게이트(전부 PASS)**: build · npm test **92** · pytest **74**(신규 S7 6, **기존 68 회귀 0**) · git diff clean.
- **검증 입증**: RBAC 라이브 403(뷰어)/200(관리자) 브라우저 fetch. e2e device(콘솔 0): J1 사용자 전환(개혁↔고객열람자 헤더/아바타 반영·하드코딩 제거)·J2 프로젝트 2개 영속·J7 권한 UI(뷰어 비활성/관리자 활성, `evidence/s7-01·02`)·구성원 3행 실데이터. unit이 J3/J4/J5/J6/J9 커버.
- **다음 세션 이월(S7 DONE 선언 전)**: 독립 검증팀 3렌즈·Done-When reconcile(J1~J12)·**J7 Build 콘텐츠 UI 게이팅**(업로드/폴더/마크업/이슈 버튼은 서버 403 차단되나 UI 사전 비활성 미적용)·J11 e2e 확장(구성원 추가/역할변경 device·프로젝트 생성 복원).

### 세션 9 진입점
- `prompts/09` FROZEN·구현 완료·자동 게이트 GREEN·RBAC 라이브+핵심 UI e2e 입증. 다음 = **S7 검증 마무리**(3렌즈 → reconcile → J7 Build UI 게이팅 → 커밋) 후 S7 DONE, 그 다음 S8(온톨로지+AI, AI=HUMAN_GATE). 재기동법 세션6 블록과 동일.

---

## 이전 상태 (2026-06-30, 세션 8 — S6 Build 홈 위젯 실데이터 + 전역 검색 DONE)

- **단계**: **S6 DONE.** 메타프롬프트 `prompts/08-s6-home-search.md` FROZEN(AskUserQuestion 4결정: **미구현 위젯 정직한 빈 상태 · 카운트+이슈 분석 차트[신규 의존성 0] · 백엔드 `/api/search`+상단 전역검색 · 검색 대상 시트+이슈+파일/폴더 전부**). acceptance **I1~I14 전부 MET**(EVIDENCE 하단 S6 reconcile).
- **구현 요약**: 백엔드 `routes_search.py` 신설(`GET /api/search` 시트·이슈·파일·폴더 교차 부분일치+딥링크 식별자+상한/truncated, read-only seed=False), `main.py` 등록, `store.list_folders` seed 파라미터. 프론트 `homeStats.ts` 신설(순수 집계), `BuildHomeView` 재작성(인라인 하드코딩 제거→실데이터 집계+정직한 빈 상태+경량 SVG/CSS 이슈 차트), `GlobalSearch.tsx` 신설(상단 전역검색·디바운스·결과 패널·딥링크), `drawings.ts` `searchProject`, `BuildSheetsView`(검색 배선·딥링크·드로잉 로드 모든 섹션), `IssuesView` focusIssueId·`FilesView` focusFolderId.
- **게이트(전부 PASS)**: build · npm test **91** · pytest **68**(S6 검색 7) · git diff --check clean.
- **브라우저 e2e(device)**: 홈 개요 실데이터(시트15·파일7·폴더11·저장 26.7MB·진행중 이슈3·최근활동 실업로드)·종합 이슈 차트·정직한 빈 상태 + 전역 검색(EE→시트2+파일2·케이블→이슈·Drawings→폴더·plan→시트3+파일1) + 딥링크(시트→뷰어/이슈→이슈탭+선택/폴더→파일+폴더). 콘솔 0. 스크린샷 `evidence/s6-01~04`.
- **독립 검증팀 3렌즈**: 백엔드 적대적(**MAJOR**=GET 검색이 폴더 seed 부작용)·프론트 비기능/a11y(조건부 MAJOR=홈 active vs 이슈탭 전체 카운트, MINOR a11y/정리)·Done-When 비평가(I1~I14 MET·침묵 좁힘 0). **MAJOR seed 수리·재검증**(seed=False, 라이브 phantom→folders:[], 회귀 1) + 프론트 MINOR 수리(미사용 import·indexOf·combobox ARIA·검색 name).

### 세션 8 진입점 (S6 이후)
- `prompts/08` FROZEN·I1~I14 MET·커밋 완료. 다음 = **S7**(인증/RBAC + 프로젝트/구성원 영속, prompts/09 작성부터 — 프로덕션 auth는 HUMAN_GATE, 로컬 범위). 재기동법은 세션6 블록과 동일.

---

## 이전 상태 (2026-06-30, 세션 8 — S5 이슈 영속+핀 연계 검증 마무리 DONE)

- **단계**: **S5 DONE.** 세션 7 구현+부분검증 → 세션 8에서 이월분(H7·H10 e2e·독립 3렌즈·reconcile·커밋) 마무리. 메타프롬프트 `prompts/07-s5-issues-pins.md` FROZEN(4결정: **독립 Issue 엔티티 · ACC식 상태 4종+메타 · 양방향 점프 · 핀 선택적+S4 좌표계**). acceptance **H1~H13 전부 MET**(EVIDENCE 하단 S5 reconcile).
- **구현 요약**: 백엔드 `store.py`(이슈 CRUD Json·TypeDB+`_issues.json`, soft delete, 상태머신/핀좌표/카테고리집계), `routes_issue.py` 신설(prefix `/api/issues` — 도면 라우트 경로충돌 회피), `schema/04-drawings.tql`(issue entity), `main.py` 등록. 프론트 `drawings.ts`(Issue API), `IssuesView`(전역 실데이터·필터·검색·작성·상태변경·핀 딥링크), `IssueAddPanel`(실집계+시트 이슈목록), `IssueCreateForm`·`IssueDetailPanel` 신설, `VectorCanvas`(world 핀)·`MarkupCanvas`(image 핀), `SheetViewerShell`(이슈 배선·focusIssue), `BuildSheetsView`(딥링크).
- **게이트(전부 PASS)**: build · npm test **83** · pytest **61**(S5 10 = 세션7 8 + 세션8 회귀 2) · git diff --check clean.
- **브라우저 e2e(device)**: 세션7 H1~H6·H8·H12(실 DXF world 140819.7,36724.7) + **세션8 H7**(무핀 전역 이슈 pin:null) + **H10**(PDF 단선결선도 image 핀 [0.5,0.5] 생성·영속·새로고침 복원·딥링크). 콘솔 0. 스크린샷 `evidence/s5-01~04`.
- **독립 검증팀 3렌즈**: 백엔드 적대적(**MAJOR-1**=PATCH 핀-위치 불변식 미검증 + MINOR world핀 비유한 수락)·프론트 비기능/a11y(MINOR 딥링크 focus 잔존 등)·Done-When 비평가(H1~H13 MET, 침묵 좁힘 0). **MAJOR-1+H12위협 MINOR+프론트 딥링크 MINOR 수리·재검증**(라이브 부유핀 PATCH→400·유령시트→404, 회귀 2 추가).

### 세션 8 진입점
- `prompts/07` FROZEN·H1~H13 MET·커밋 완료. 다음 = **S6**(Build 홈 위젯 실데이터+전역 검색, prompts/08 작성부터). 재기동법은 세션6 블록과 동일(XD_STORE=auto/json, backend .venv python uvicorn 8000, npm run dev 5173).

---

## 이전 상태 (2026-06-29, 세션 6 — S4 마크업·측정·시트비교 DONE)

- **단계**: **S4 DONE.** 뷰어 affordance(마크업·측정·시트비교)를 실동작+영속으로 교체. 메타프롬프트 `prompts/05-s4-markup-measure-compare.md` FROZEN, acceptance **E1~E13 전부 MET**(EVIDENCE 하단 S4). **미커밋**(diff --check clean, 커밋은 사용자 지시 시).
- **freeze 4결정 반영**: (Q1)마크업+측정+비교 한 스테이지 · (Q2)벡터 world + PDF 정규화 이중트랙(coord_space) · (Q3)측정 DXF 자동(doc.units)만·PDF 제외 · (Q4)클라 색상오버레이 + 백엔드 픽셀 diff 둘 다.
- **구현 요약**: backend `store.py`(markup/measurement CRUD Json·TypeDB+`_markups.json`/`_measurements.json`), `vector.py`(`$INSUNITS`→units+캐시 스키마가드), `compare.py`(PIL diff 마스크), `routes_markup.py`(신설), `schema/04-drawings.tql`(entity 추가), `/vector` no-cache. 프론트 `VectorCanvas.tsx`(world↔screen 오버레이+드로잉+측정+히트테스트), `MarkupCanvas.tsx`(PDF 정규화 SVG, draftRef), `geometry.ts`(측정 순수함수), `SheetViewerShell.tsx`(오케스트레이션), 패널 5종 실데이터, `CompareModal`/`CompareOverlay`(버전 색상합성+diff), `drawings.ts` API, `viewerData.ts` 데모 제거.
- **검증(device)**: DXF에 도형/클라우드/폴리라인/다각형/텍스트 그리기→**새로고침 복원**(world 좌표)→선택/색상편집/삭제 영속→측정 **선형 43.645m·면적 615.83㎡·지름 27.258m**(mm 자동 실척)→PDF 마크업(정규화 [0,1])·측정 비활성→plan v1/v2 비교(이전=빨강/현재=파랑 합성+투명도/스와이프 + 백엔드 diff **변경 2.00%** 마스크). 콘솔 error/warn/issue **0**. 스크린샷 `evidence/s4-01~05`.
- **게이트**: build PASS · npm test **76**(geometry 6 신규) · backend pytest **51**(S4 12 신규) · git diff clean.
- **독립 검증팀 3렌즈**: 백엔드 적대적(PASS, MINOR 2=TypeDB 그래프 drift 무해)·프론트 코드(PASS 조건부, **MAJOR-1 적발**=VectorCanvas 클릭선택 client/local 좌표혼용)·Done-When 비평가(E1~E13 MET·NARROWED 0). **MAJOR-1+MINOR-2/3 수리·재검증**(캔버스 클릭선택 복구 device 확인, 무한스피너 차단, 리스트 coord_space 일치), E5 지름 device 보강, 콘솔 정리(willReadFrequently+select name).
- **자체 적발·수리 실버그**: 벡터 캐시 units 누락(스키마가드)·이미지 CORS 캐시충돌(cors=1+no-cache)·MarkupCanvas stale클로저(draftRef)·setPointerCapture throw(try/catch).
- **남은 위험(비차단)**: TypeDB 그래프 직접적재(JSON 미러 SoT)·CompareOverlay 다해상도 stretch정렬·수동 캘리브레이션/PDF측정·이슈 영속=S5.

### 세션 6 진입점
- `prompts/05` FROZEN·E1~E13 MET. 다음=**S5 이슈 영속+뷰어 핀 연계**(마크업↔이슈, `IssuesView`·`IssueAddPanel`·`demoIssuePins` 실동작). prompts/07 작성부터.

---

## 이전 상태 (2026-06-29, 세션 5 — S2.5 멀티페이지 스케일 강건화 DONE)

- **단계**: **S2.5 DONE.** 실측(제주 BESS 68p/94MB 전기도면)으로 도출한 스케일 부채 3건 해소. 메타프롬프트 `prompts/06-s2_5-multipage-scale.md` FROZEN, acceptance **F1~F10 전부 MET**(EVIDENCE 하단 S2.5). **미커밋**(diff --check clean, 커밋은 사용자 지시 시).
- **공동설계 freeze**: P1=라벨앵커+폴백 · P2=클라 페이지네이션(50/페이지) · P3=용량 가시화(현행 보관 유지).
- **실측 before→after(동일 도면)**: 시트번호 추출 **0%→98%(67/68)** · 고유제목 1→67 · 공종 100%G→67 E(전기) · storage_bytes None→118MB 노출.
- **구현 요약**: backend `sheet_meta.py`(좌표 라벨앵커 `_spatial_value`/`_spatial_number`/`_spatial_title` — `DWG NO`/`DWG. TITLE` 바로 아래 값 공간 페어링, `get_text` 순서 비의존 + 다중토큰 공종 `_discipline`[ESS-EE-DWG→E] + 멀티페이지 `_title` + 날짜 가드), `conversion.py`(`_page_lines`로 dict 라인 추출→전달), `routes_drawing.py`(`_storage_bytes`+`_with_urls` 노출). 프론트 `SheetsListView.tsx`(클라 페이지네이션 50/페이지·필터 리셋·경계), `FilesView.tsx`(크기=원본+파생), `drawings.ts`(storage_bytes), 옛 countLabel 정리.
- **검증**: build PASS · npm test **70**(페이지네이션 5 추가) · backend pytest **39**(S2.5 11) · git diff clean · 브라우저 e2e(제주 68p→실 번호/제목/공종·페이지네이션 81개 2페이지·용량 118.8MB·콘솔 0, 스크린샷 `evidence/s2_5-*.png`).
- **독립 검증팀 3렌즈**: 백엔드 적대적(F1·F2·F3·F7 실데이터 PASS, **MAJOR-1 적발**=단일파일 제목 좌표우회 F4 회귀)·프론트 비기능(F5·F6·F8·F9 PASS, MINOR a11y)·Done-When 비평가(F1~F10 MET). **MAJOR-1 수리**(좌표 제목 `if lines and multipage:`로 멀티페이지 한정, 청주 5개 단일파일 제목=stem device 재검증·F4 회귀 0) + MINOR-4(날짜 둔갑 가드) 수리·회귀 테스트 2건 추가.
- **잔여 후속 부채**(비차단): 멀티벤더 양식 날짜/노이즈 오염·below창·공종 첫글자폴백 오분류 · 용량 stat rglob 캐시 · 페이저 aria-live · OCR/스캔 PDF.

### 세션 5 진입점
- `prompts/06-s2_5-multipage-scale.md` FROZEN. 다음=S4(마크업·측정·비교, `prompts/05` 이미 FROZEN).

---

## 이전 상태 (2026-06-25, 세션 4 — S3 파일/폴더 관리 DONE)

- **단계**: **S3 DONE.** 폴더 트리 CRUD + 명시적 버전세트 + 권한 메타(표시·편집) + 다운로드/삭제. 정적 `buildFilesData` 11폴더 시드 제거 → 백엔드 seed-on-create(ACC 기본 9폴더+PDFs). 메타프롬프트 `prompts/04-s3-files-folders.md` FROZEN, acceptance **D1~D9 전부 MET**(EVIDENCE 하단 S3 섹션). **미커밋(이 세션에서 커밋 예정).**
- **공동설계 4결정(freeze)**: 권한=메타+표시까지(인증/RBAC 강제는 S7) · 영속=DrawingStore 확장(folder 엔티티+drawing.folder_id, Json·TypeDB 양 백엔드) · 버전=명시적 버전세트(보관·이력·최신 1행) · 폴더 시드=백엔드 seed-on-create.
- **구현 요약**: backend `store.py`(folder CRUD+버전세트 `add_version`/`list_versions`/`delete_drawing`+`list_drawings(folder_id,latest_only)`, TypeDB는 _MIRROR 위임), `routes_files.py`(신설 폴더 CRUD), `routes_drawing.py`(`/versions`·`/download`·DELETE·folder_id·share 상속). 프론트 `drawings.ts`(folder/version/download API+`Folder`·`share_status` 타입), `FilesView.tsx`(전면 개편: 실 폴더트리·CRUD·폴더 타깃 업로드·실데이터 테이블·행메뉴·버전이력 모달·공유 편집), `buildFilesData.ts` 삭제.
- **검증**: build PASS · npm test **65**(FilesView 8 추가) · backend pytest **28**(S3 13) · git diff clean · 브라우저 e2e(seed트리·폴더생성·폴더타깃 업로드·버전 v2+이력·다운로드·삭제·콘솔0, 스크린샷 `evidence/s3-*.png`).
- **독립 검증팀 3렌즈**: 백엔드 적대적(BLOCKER-1 레거시 버전 중복·MAJOR-2 version_no 경합·MAJOR-3 PATCH parent 미검증·MINOR-4 delete depth 적발)·프론트 비기능(D7 파일 공유 대리표시·편집UI 부재 적발)·Done-When 비평가(D7 NARROWED). **전부 수리·재검증**(회귀 테스트 6건 추가, e2e 재확인).
- **남은 위험**(비차단): 설명 컬럼 placeholder(Drawing description 모델 부재) · TypeDB folder 직접쿼리화 후속 · 파일 단위 공유 override(현재 폴더 상속) · 인증/RBAC 강제=S7.

### 세션 4 진입점 (S3 메타프롬프트)
- `prompts/04-s3-files-folders.md` FROZEN(공동설계 4결정). 다음=S4(마크업·측정·비교 실연산+영속).

---

## 이전 상태 (2026-06-25, 세션 3 — S2 시트 레지스터 DONE)

- **단계**: **S2 DONE.** PDF 페이지 분할→시트 목록 실데이터 완전 교체 + 타이틀블록 휴리스틱(번호/제목/공종+폴백) + paperspace 다중 분리. 메타프롬프트 `prompts/03-s2-sheet-register.md` FROZEN, acceptance **C1~C8 전부 MET**(EVIDENCE 하단 S2 섹션). **커밋 `877518d`.**
- **구현 요약**: backend `sheet_meta.py`(휴리스틱 추출), `conversion.py`(PDF 페이지 분할 메타·paperspace 분리·Sheet 메타필드), `GET /api/drawings` `_with_urls`(png_url 부여·png_path 제거). 프론트 `BuildSheetsView`(실데이터 fetch+poll·정적 시드 제거·공종 필터·자연정렬), `drawingsToSheets`, `SheetDisciplineCode` string화.
- **검증**: build PASS · npm test **57** · backend pytest **15** · git diff clean · 브라우저 e2e(8p PDF→8시트 C1·EE-01-006 추출 C2·실데이터 교체 C3·공종필터 C4·시트열기 실 PDF 렌더 C6·콘솔 0 C8, 스크린샷 `evidence/s2-*.png`).
- **독립 검증팀 3렌즈 통과**: 백엔드 적대적(C1·C2·C5·C7)·프론트 비기능(C3·C4·C6·C7·C8)·Done-When 비평가(C1~C8 MET). BLOCKER 0. MAJOR 1(휴리스틱 장비태그 노이즈) + MINOR(png_path 노출·select name·stale 필터) **수리·재검증 완료**(pytest 15).
- **버그 수정**: 목록 API png_url 누락→뷰어 정적폴백(브라우저 적발) `_with_urls`로 수정.
- **남은 위험**: 멀티페이지 번들 대부분 Page N 폴백(휴리스틱 취약, freeze 수용) · 빈 paperspace=modelspace 단일(자동분할 후속) · 버전 S3 · TypeDB 직접쿼리 후속.

### 세션 3 진입점 (S2 메타프롬프트)
- `prompts/03-s2-sheet-register.md` FROZEN(공동설계 3결정: 순수레지스터+paperspace·실데이터 완전교체·타이틀블록 휴리스틱).

---

## 이전 상태 (2026-06-25, 세션 3 — S1.5 렌더 bake-off DONE)

- **단계**: **S1.5 DONE.** 2-way 렌더 bake-off(①하이브리드 래스터 PNG vs ②오픈소스 벡터 canvas2D) 풀 구현 + 승자(②벡터) 채택 전환. 메타프롬프트 `prompts/02-s1_5-render-bakeoff.md` FROZEN, acceptance **B1~B7 전부 MET**(EVIDENCE 하단 S1.5 섹션). **커밋 `2284512`.**
- **구현 요약**: backend `vector.py`(ezdxf recording 백엔드로 폭넓은 엔티티 추출→JSON: LINE/LWPOLYLINE/ARC/CIRCLE/ELLIPSE/TEXT/MTEXT/INSERT 중첩/HATCH/DIMENSION) + `/api/drawings/{id}/vector`(캐시·FileResponse·traversal 방어·PDF 400) + `dxf_path` 영속. 프론트 `VectorCanvas.tsx`(canvas2D 무손실 줌·팬·핏·레이어 토글·어두운 CAD 배경) + `SheetViewerShell` 엔진 토글(승자=벡터 기본, ①래스터 보존).
- **검증**: `npm run build` PASS · `npm test` **56 PASS** · backend `pytest` **6 PASS** · `git diff --check` clean · 브라우저 end-to-end(벡터 기본 렌더·무손실 줌·레이어 토글·래스터 토글·콘솔 0, 스크린샷 `evidence/s15-*.png`).
- **독립 검증팀 3렌즈 통과**: 백엔드 적대적(B1·B2·B4·B6 PASS)·프론트 비기능(B3·B5·B6·B7 PASS)·Done-When 비평가(B1~B7 MET, Q1~Q3 준수, narrowing 0). BLOCKER/MAJOR 0. 검증 부채 3건(B2 회귀 강화·500 경로노출·비원자 캐시) **수리·재검증 완료**.
- **bake-off 결론**: ②벡터 승자(무손실 줌+레이어 토글+벡터 인터랙션, 둘 다 비종속이라 채택이 게이트 무관). ③APS는 사용자 결정으로 **전략상 배제**(평가 안 함).
- **남은 위험**: 벡터 JSON ~8.5MB(텍스트 path 多) 최적화 후속 · 벡터 위 마크업/측정 좌표연동 = S4 · canvas2D 초대형 도면 offscreen 캐시 후속.

### 세션 3 진입점 (S1.5 메타프롬프트)
- `prompts/02-s1_5-render-bakeoff.md` FROZEN(공동설계 3결정: APS 제외 2-way·폭넓은 커버리지·승자 채택 전환).

---

## 이전 상태 (2026-06-25, 세션 2 — S1 walking skeleton 동작 완료)

- **단계**: **S1 업로드→변환→뷰어 walking skeleton 동작 완료.** 실 dwg/pdf 업로드→변환→뷰어 실 도면 렌더 end-to-end 입증. `npm run build` PASS · `npm test` **54 PASS** · backend `pytest` **2 PASS** · 브라우저 콘솔 0 · `git diff --check` clean. 메타프롬프트 A1~A8 전부 MET(증거 `EVIDENCE.md`). **미커밋.**
- **S1 구현 요약**: `backend/`(FastAPI+DrawingStore 추상화+ODA/ezdxf/PyMuPDF 변환, Study_TypeDB 이식·런타임 비의존) + 프론트(`src/api/drawings.ts`·FilesView 실업로드·MarkupCanvas 실PNG·Sheet.imageUrl).
- **독립 검증팀(2렌즈) 통과**: 적대적 엣지 + 코드리뷰가 2 BLOCKER(JSON store race 카탈로그 유실 / project_name traversal) + #7(TypeDB 미러 누락) 적발 → **전부 수정·재검증**(동시10→10/10·index valid, traversal 400, pytest 4 PASS).
- **TypeDB 활성화 완료**: typedb/typedb:3.7.3 Docker + typedb-driver 3.7.0 고정 → `store_backend=typedb`, 스키마 적용, drawing_file 실 적재·조회 확인.
- **커밋**: S1 walking skeleton=`e146fc8`. 검증 수정+TypeDB=후속 커밋.
- **남은 위험**: 나머지 2엔진(오픈소스·APS) 충실화 = S1.5. TypeDB 조회 직접 쿼리화 = S2+. paperspace 빈 DWG 시트분리 = S2.

### 세션 1 (계획 수립)
- 루프 **계획 수립 완료, S1 메타프롬프트 FROZEN**.
- **확정된 4결정**(`LOOP.md` Frozen decisions):
  1. 목표 = ACC 실기능 전체 구현(외관은 appearance-loop DONE).
  2. 백엔드 = xd 소유 독립 로컬 풀스택(Study_TypeDB 코드 이식, 런타임 비의존).
  3. 도면 렌더 = 하이브리드·오픈소스·APS 3-way bake-off 비교.
  4. 첫 슬라이스 = S1 업로드→변환→뷰어.
- **선행 근거**:
  - 현 앱 = 100% 정적 외관(의존성에 dxf/dwg/pdf/three 없음, `type=file`+FileReader 없음, viewerData 주석 "실제 드로잉/영속/연산 없음").
  - `Study_TypeDB`(`D:\_Project\Study_TypeDB`) = 동작 백엔드(FastAPI+TypeDB 3.7.3+ezdxf, 250 test PASS). 도면 API/서비스/온톨로지(`04-drawings.tql`)가 S1과 거의 일치 → **이식 소스**.
  - 변환 도구체인 검증됨: ODA File Converter(설치), ezdxf, PyMuPDF(fitz), matplotlib, Pillow.
  - 테스트 도면: `D:\_Project` 전역 dwg 822·pdf 901·dxf 25. xd 레포 내 `reference/old-prototypes/.../dwg/`에 다분야 도면.

## 다음 작업 — S1~S6 DONE, S7 구현완료(검증 이월), 다음은 S7 검증 마무리→S8

**S1**(e146fc8+f7b1a99) · **S1.5**(`2284512`) · **S2**(`877518d`) · **S3**(`dbb1b6f`) · **S2.5**(`82ae45f`) · **S4**(`0051f87`) · **S5**(`83996d9`) · **S6**(`776ae88`) · **S7**(`d119178`+세션10 검증 마무리) **DONE**. 다음 진입:
- **S8 XD 온톨로지 + AI 분석**: 도면 entity TypeDB 적재 + equipmentEntityId 바인딩(Study_TypeDB analysis_result 계승). **AI(LLM)=HUMAN_GATE**. prompts/10 공동설계부터.
- (참고) S6 후속 부채: 홈 active vs 이슈탭 전체 카운트 차이(닫힘 전용뷰)·검색 퍼지/하이라이트/랭킹·차트 색맹 대응·구성원/작업/브리지/양식/날씨/진행률 백엔드.
- (참고) S5 후속 부채: 삭제됨 이슈 편집·"열린 이슈" 탭 닫힘 노출·핀 색맹 대체·이슈 첨부/댓글/알림·TypeDB 그래프 직접쿼리화·권한 enforcement(S7).
- (참고) S3 후속 부채: 설명 컬럼 실데이터·TypeDB folder 직접쿼리화·파일 단위 공유 override·인증/RBAC(S7). S2 후속: 멀티페이지 타이틀블록 강추출·빈 paperspace 자동분할.

### ⚙️ 다음 세션 재기동 방법 (중요)
1. **TypeDB 컨테이너**: `docker ps`로 `typedb-server`(typedb/typedb:3.7.3, 포트 1729) 확인. 없으면 `docker start typedb-server`(또는 Study_TypeDB README의 run 명령).
2. **백엔드**: `cd backend && XD_STORE=auto .venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000` (venv=64bit, typedb-driver==3.7.0 고정). `XD_STORE=json`이면 TypeDB 없이 폴백.
3. **프론트**: `npm run dev` (vite, 5173/5174). 백엔드 URL은 `src/api/drawings.ts` BACKEND_BASE=http://127.0.0.1:8000.
4. **검증**: `npm test`(57) · `cd backend && .venv/Scripts/python.exe -m pytest tests/`(15) · 브라우저 Build→파일→업로드→시트목록(실데이터)→시트 열기.
5. **주의**: 활성 `python`은 32비트(matplotlib 없음) — backend는 반드시 `backend/.venv/Scripts/python.exe`(64bit) 사용.

## 미해결 / 메모

- 외관 17화면 브라우저 스크린샷 전수 점검은 fork가 미완(audit 폴더 빈 상태). 외관 자체는 appearance-loop에서 DONE·52 test PASS·전 항목 MET로 검증됨. 사용자가 원하면 직접 재점검 가능.
- 마일스톤 체크리스트는 `PLAN.md` 참조. S1만 메타프롬프트 작성, S2~S8은 해당 마일스톤 진입 시 작성.

---

## 세션 17 (2026-07-03) — S8.4 egress 감사/게이트 DONE  ⬅ 최신(상단 세션16 블록은 이것으로 갱신 대체)

**S8.4 DONE.** `prompts/12-s8_4-egress-audit.md` FROZEN(3결정 공동설계: 감사=메타데이터만·킬스위치=런타임 API 토글·키=마스킹+유출가드+상태). 독립 적대 검증자(general-purpose) **M1~M9 PASS·M10 MET·BLOCKER/MAJOR 코드결함 0 → DONE 선언 가능**. reconcile 전항목 MET(NARROWED/UNMET 0). **미푸시 커밋 누적 — push 미결.**

- 신설: `egress.py`(mode 플래그·effective_provider 킬스위치·mask_key/masked_preview 유출가드·record/read 메타데이터 감사·status, backend import 0), `routes_egress.py`(`POST /api/egress/mode`·`GET /status`·`GET /audit`), `tests/test_egress.py`(10건). 배선: `routes_chat.py`(킬스위치 effective_provider + 턴당 감사 record) · `main_ai.py`(라우터 등록 + 부팅 키 마스킹 검증).
- 자체검증: 사이드카 pytest **36**(26→+10)·backend **97**·vitest **116**·npm build ✓·격리 8000 diff 0. 라이브 device(단일 클린 8001): status 키 마스킹 `sk-…SF8A`·킬스위치 ON→챗 actual provider=mock(egress0)·감사 메타데이터만(본문·키 없음)·잘못된 mode 400·openai 복귀.
- **검증자 환경지적 처분**: 8001에 이전 세션 잔류 uvicorn이 남아 신규와 레이스(라이브 킬스위치 교차검증 훼손 + 그 사이 실 GPT egress 1~2회 청구) → 잔류 종료·단일 클린 재기동·device 재검증. 코드는 단일 프로세스 설계(Q2) 전제라 무결. 증거 `EVIDENCE.md` S8.4 블록.
- **병행**: 사용자 자동 데모 시스템(`demo/`) 개발/테스트와 병행. 나는 별도 Chrome(포트 9223·독립 프로필)를 제로설치 Node CDP 드라이버(`scratchpad/cdp.js`)로 몰며 옆에서 검증(허브 렌더 확인). 데모는 세션 중 사용자가 종료.
- **다음 = S8.5**(S8.1/8.3/8.4 독립 3렌즈 consolidated + S8 전체 Done-When reconcile → S8 DONE 게이트). 이후 S10 온톨로지. 미푸시 커밋 push 결정 대기.

## 세션 17 (2026-07-03) — S8.5 독립 3렌즈+reconcile → **S8 DONE** ✅

**S8(AI 사이드카 챗) DONE.** `prompts/13-s8_5-review-reconcile.md` FROZEN(2결정 AFK자율=추천안: 렌즈범위 미검증분집중·DONE차단선 BLOCKER+MAJOR). 독립 3렌즈(별도 general-purpose 에이전트):
- 렌즈1 백엔드 적대: **BLOCKER/MAJOR 0**(격리·툴그라운딩·프롬프트인젝션저항·킬스위치·감사·ai_store원자성 견고). MINOR 5 부채.
- 렌즈2 프론트/a11y: **MAJOR 1 수리**(드로어 닫을때 FAB focus반환 없음 WCAG2.4.3 → `ChatDrawer.tsx` fabRef+반환effect). MINOR 3 부채.
- 렌즈3 Done-When 비평: **product 4요소 전부 MET(device)·좁힘 0**(격리8001·8000HTTP그라운딩·실데이터·실gpt-5.5, 라이브 실 openai 1턴 실증).
- 회귀 0: vitest **116**(8000 down 클린)·사이드카 **36**·backend **97**·build·격리 8000 diff0·src 변경 ChatDrawer 1파일. reconcile NARROWED/UNMET 0. 증거 `EVIDENCE.md` S8.5.
- **밤샘 자율 모드**(사용자 확정: 비게이트 전부+신규 mock/설계·제한없이 끝까지): 다음 **S10 온톨로지**(실동작)→S11/S12(mock+egress게이트)→S13(설계+인증게이트). 게이트는 안 넘고 `HUMAN_GATE.md`에 남김.

## 세션 17 (2026-07-03) — S10 온톨로지 적재+바인딩 DONE ✅ (밤샘 자율)

**S10 DONE.** `prompts/14-s10-ontology.md` FROZEN(밤샘 자율=추천안: equipment 큐레이트시드·TypeDB권위+8000+사이드카툴). GATE-1 연기분 실현.
- 신설: `backend/schema/05-ontology.tql`(equipment+appears_on)·`backend/ontology.py`(TypeDB권위·드라이버재사용·미러폴백·실 READ쿼리)·`backend/routes_ontology.py`·`scripts/seed_ontology.py`(큐레이트 전기장비10, 단선6·BESS4 바인딩, 멱등). 사이드카 `list_equipment`·`get_equipment`(9종). main.py 등록.
- 독립 검증자 **O1~O8 전항목 PASS·BLOCKER/MAJOR 0**. 진실성 4중 일치(TypeDB10=route10=미러10=시드10), appears_on 44관계. 실 gpt-5.5가 자율 list_equipment 선택→"장비10개" 표(환각0). MINOR2 부채(get_equipment 미러역인덱스·단건라우트 비스코프).
- 자율 해결 실이슈2: TypeDB 2드라이버연결 패닉→store 드라이버 재사용 / 시트바인딩0→drawing_sheet put 스텁.
- 회귀0: backend **97**·사이드카 **39**·build·격리 import0·vitest 116(프론트 무변경). 증거 `EVIDENCE.md` S10.
- **다음 = S11 이메일 발송**(mock 인프라까지 자율, 실 SMTP/서비스 egress=HUMAN_GATE).

## 세션 17 (2026-07-03) — S11 이메일 인프라 DONE ✅ + S10 서버 안정화 (밤샘 자율)

**S11 DONE(mock 수준).** `prompts/15` FROZEN. `email_service.py`(provider 추상화·템플릿·감사 메타데이터만·킬스위치)+`routes_email.py`(4라우트, RBAC)+GATE-5(실 이메일 egress=사용자 결정). 독립 검증자 **P1~P6 PASS·외부 egress 0 실증**, 발견 MINOR2(outbox 교차본문노출·mode 무인증)→**수리**(스코프필터+RBAC). backend **104**·build.
- **S10 안정화**: TypeDB Python 드라이버 간헐 패닉(overflow subtracting durations, 프로세스 abort)이 서버 크래시 유발 → 8000은 온톨로지를 **JSON 미러 읽기**(TypeDB+미러 동시기록 동기), TypeDB=시드 쓰기 권위(`XD_ONTOLOGY_DIRECT_TYPEDB=1`). 서버 크래시 제거.
- **다음 = S12 이슈 이메일 알림**(이슈 생성/상태변경 훅→구독자 mock 발송, S11 위). 실 발송은 GATE-5 후.
