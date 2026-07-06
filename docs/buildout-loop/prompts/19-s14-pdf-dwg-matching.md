# S14 — PDF 시트 ↔ DWG 소스 매칭 + 버전 기반 (Phase 1: 토대)  [STATUS: FROZEN 2026-07-06]

> ai-loop 스테이지 계약. `LOOP.md`·`PLAN.md` freeze 결정과 S1(`prompts/01`)~S13(`prompts/17`) 결과를 상속한다. 특히 S1(업로드·변환·뷰어)·S1.5(벡터 렌더)·S2/S2.5(시트 레지스터)·S3(파일/폴더·버전세트)·S5(이슈 영속)·S7(인증/RBAC) 위에 얹는다. 구현 에이전트가 이 텍스트를 그대로 입력받아 자율 실행하고, **별도 검증팀이 아래 Acceptance checklist(N1~N9)로 항목별 채점**한다. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).

## 배경 — 왜 이 스테이지가 필요한가 (2026-07-06 진단)

현행 시스템은 DWG·DXF·PDF를 **각자 독립된 파일**로만 다룬다. DWG 벡터 뷰어는 실재하나(DWG→ODA→DXF→ezdxf 벡터JSON→canvas2D), **PDF 시트와 소스 DWG를 잇는 링크 필드가 데이터 모델에 전혀 없다**(같은 폴더에 나란히 있는 남남). `version_set_id`는 같은 파일의 바이트 버전 체인일 뿐 PDF↔DWG 의미가 없고, DWG→PDF 변환·시트 supersede·이슈↔수정도면 연결도 존재하지 않는다. 즉 실제 도면관리의 핵심 업무 흐름 — **시트(PDF) ↔ 원본 DWG를 묶고, 현장 이슈를 걸고, 수정돼 돌아온 DWG를 버전으로 물려 신규 PDF로 시트를 갱신하는 왕복** — 이 스코프에 든 적이 없다. S14는 그 왕복의 **1차 토대(매칭 + 버전 정체성)**를 세운다.

## Stage goal / Done-When

설계사가 **DWG(들) + 발행 PDF(들)를 한 세트(package/transmittal)로 제출**하면, 담당자가 **각 PDF 시트에 소스 DWG를 수동으로 연결**하고, 각 시트에 **버전을 가로지르는 영속 정체성(`sheet_key`) + 리비전(`rev`)**을 부여하며, 시트 상세에서 **연결된 소스 DWG를 벡터 뷰어로 열어 왕래(PDF↔DWG traversal)**할 수 있게 한다.

**완료 정의**: (a) N개 DWG + M개 PDF를 한 세트로 업로드하면 하나의 package로 묶인다. (b) 매핑 화면에서 각 PDF 시트에 소스 DWG(들)를 수동으로 연결하고, 발행(publish)하면 시트마다 `sheet_key`+`rev`가 확정·영속되며 새로고침 후 복원된다. (c) 시트 상세에서 "소스 DWG 열기"로 연결된 DWG를 기존 VectorCanvas 벡터 뷰어에 렌더한다. (d) 미매핑 시트/미링크 DWG는 시각적으로 명확히 구분되되 발행을 막지 않는다(loose 허용). (e) 기존 이슈/마크업/버전/검색/권한 기능 회귀 0, 콘솔 0.

## 현장 절차 계승 (2026-07-06 인터뷰 확정 — 반드시 실행 전 반영)

deep-interview로 실제 현장 도면관리 왕복 절차를 확정했다. 구현은 이 절차를 그대로 따른다.

- **DWG도 정식 자산**이다. DWG=소스, PDF=게시 시트. 둘 다 버전관리 대상.
- **세트 제출이 기본**이다. 설계사가 DWG와 발행용 PDF를 함께 낸다. **DWG만 올려도 뷰어·레이어 등 가능한 기능은 전부 제공**하되, 시트 경계의 진실은 PDF가 규정한다(도면 작성자마다 시트 정리가 너무 제각각이라 DWG만으로는 시트 자동인식을 신뢰할 수 없다).
- **매칭 그레인은 N:M(주로 1:N, 2:N)** — 하나(또는 몇 개)의 DWG가 여러 PDF 시트를 만든다. 시트별로 소스 DWG를 연결한다.
- **매핑은 업로드 시 수동 확정**이다. 파일명 규칙이 제각각이라 자동은 신뢰 못 한다 — 시스템은 약한 힌트(시트번호/파일명 근접)만 제안하고, 담당자가 눈으로 보고 확정한다.
- **DWG→PDF 자동변환은 이번 범위 밖**(세트 제출이 진실 소스이므로 불필요). 로드맵 후반 옵션.

## Co-design log (2026-07-06 사용자 확정 — deep-interview 8결정 freeze)

- **(D1) DWG = 정식 관리 자산.** DWG(소스)·PDF(게시 시트) 둘 다 시스템이 버전관리. 설계사가 DWG를 올리고 시트를 게시.
- **(D2) 세트 제출 기본 + DWG 단독 허용.** 기본은 `DWG(들) + PDF(들)` 세트 업로드. DWG만 올려도 벡터 뷰어/레이어 등 가능한 기능은 제공하되, 정식 시트 경계는 PDF가 규정.
- **(D3) 매칭 그레인 = N:M(1:N·2:N 위주).** 시트별로 소스 DWG(들)를 연결. 세트 통짜 묶음이 아니라 낱장 링크.
- **(D4) 매핑 = 업로드 시 수동 확정.** 파일명 규칙 제각각 → 시스템은 약한 힌트만 제안, 자동 확정 없음. 이후 버전은 `sheet_key`로 승계.
- **(D5) 버전 = 이중 구조.** 시트별 `rev`(A/B/C…) + 발행분(package/transmittal) 이벤트로 "어떤 시트들이 언제 함께 왔는지" 추적. 최신 시트가 이전 버전을 supersede(이력 보존) — **단 supersede diff/verify 자체는 Phase 2**.
- **(D6) 이슈 종결 = 연결 + 검증 게이트.** 재발행 시 해결 이슈 지정 → "검증 대기" → 제기자 확인 후 Close. 재발행은 종결 경로 중 하나 — **전체가 Phase 2**.
- **(D7) 1차 범위 = 토대.** 데이터 모델(package·sheet_key·sheet_source) + 세트 업로드·수동 매핑 UI + 소스 DWG 열기까지. 재발행/supersede/이슈연결은 다음 스테이지.
- **(D8) 자동변환 제외(로드맵 유지).** DWG→PDF 자동변환은 이번 범위 밖. 후속에 "DWG만 → 임시 PDF 자동생성" 옵션으로.
- **(가정) 기존 레코드 무변경.** drawing/sheet/folder/version_set 스키마는 한 줄도 안 건드린다. package·sheet_source는 **새 JSON 파일**로 외부 조인(S5 `_issues.json` 패턴 계승). 시트가 drawing 레코드에 임베드돼 재변환 시 덮어써지므로, `sheet_key`를 시트에 되쓰면 유실된다 — 반드시 외부 파일에 보관.
- **(가정) 변환 파이프라인 재사용.** 세트 업로드도 기존 `POST /api/drawings`(PDF→시트, DWG→DXF→벡터)를 그대로 쓴다. 변환 코드는 손대지 않는다. package는 이미 업로드된 file_id를 귀속하는 얇은 레이어.
- **(가정) sheet_key 발급 시점 = publish.** draft 단계는 매핑을 자유롭게 편집, publish가 `sheet_key`/`rev`를 확정(freeze). 신규=rev "A", 기존 계승=next rev + 이전 링크 `is_current=false`(Phase 1은 계승 선택지 노출까지, 실제 diff/verify는 Phase 2).
- **(가정) 직교 3축.** 폴더=물리 위치, version_set=파일 바이트 버전, sheet_key/rev=시트 정체성. package는 이들을 참조만(대체 안 함). 기존 조회(list_drawings/folders/versions) 무변경, sheet_source는 추가 조인 레이어로만 얹힌다.

## 데이터 모델 (기존 무변경 + 새 JSON 2개)

**① `_packages.json` (발행분/transmittal)**
```
{ package_id: "pkg_<uuid>", project_name, folder_id|null, title,
  issued_by(member_id), issued_at, created_at, published_at|null,
  dwg_file_ids: [file_id...],   // file_format in {dwg,dxf}
  pdf_file_ids: [file_id...],   // file_format == pdf
  status: "draft" | "published" }
```

**② `_sheet_sources.json` (시트↔DWG 링크, 키=link_id)** — PDF 시트 1개당 1개 링크. `sheet_key ≠ sheet_number`(번호는 사람용 라벨 스냅샷).
```
{ link_id: "lnk_<uuid>",
  sheet_key: "sk_<uuid>",     // 시스템 발급, 버전 가로지르는 영속 시트 정체성
  rev: "A",                   // 시트별 리비전
  package_id, project_name,
  pdf_file_id(file_id), sheet_id("{pdf_file_id}_sheet_NNN"), sheet_index,
  sheet_number(발행시점 라벨 스냅샷),
  dwg_links: [ { dwg_file_id, layout_name|null } ],  // N:M 소스 DWG(들)
  is_current: true,           // 같은 sheet_key 중 최신 rev만 true(Phase1은 항상 true)
  created_at }
```

## Instruction (수행 단계 — 각 태스크는 독립 검증)

1. **S14-a store 엔티티**: `store.py` `DrawingStore` ABC에 package·sheet_source CRUD 추가 — `add_package/get_package/list_packages(project_name)/update_package`, `add_sheet_source/get_sheet_source/list_sheet_sources(*, project_name/package_id/sheet_key/pdf_file_id/sheet_id)/update_sheet_source/next_rev(sheet_key)`. `JsonDrawingStore`에 구현(`_packages.json`·`_sheet_sources.json` 초기화, 이슈 블록과 동일 lock/atomic `_write_at`). `TypeDBDrawingStore`는 **JSON 미러 SoT 위임만**(S5/S7 선례, 그래프 직접쿼리화 금지). `schema/04-drawings.tql`에 package·sheet_source entity를 문서적 완결성으로 추가하되 적재는 미러 위임.
2. **S14-b routes_package.py 라우트**: 신규 `backend/routes_package.py`, prefix `/api/packages`(+`/api/sheet-sources`) — `/api/drawings/{file_id}`가 하위 명사를 file_id로 오인하는 경로충돌 회피(S5 `routes_issue.py` 선례). `POST /api/packages`(draft 생성) / `GET /api/packages?project_name=` / `GET /api/packages/{package_id}`(package + 임베드 PDF 시트 목록 + DWG 시트/레이아웃 목록 + 현 sheet_source 링크) / `POST /api/packages/{package_id}/files`(업로드된 file_id 귀속) / `GET /api/packages/{package_id}/hints`(약한 매칭 제안) / `PUT /api/packages/{package_id}/mapping`(draft 부분저장, sheet_key 미확정 허용) / `POST /api/packages/{package_id}/publish`(매핑 확정·sheet_key 발급/계승·rev 확정·sheet_source 영속). 모든 mutation `require_role(project_name,"편집자")`(S7 선례), GET 무강제. `main.py`에 라우터 등록.
3. **S14-c hints 로직**: `sheet_meta._normalize` 재사용 — PDF 시트 `sheet_number`와 DWG 시트 `sheet_name`(paperspace 레이아웃명)·파일 stem을 정규화 비교(정확일치>접두일치>토큰겹침 점수). **자동 확정 아님** — 제안 힌트만 반환.
4. **S14-d publish 로직**: 링크별 — `sheet_key` null이면 `sk_<uuid>` 신규+rev "A"; 값 있으면 `next_rev(key)` + 이전 링크 `is_current=false`. `add_sheet_source` 후 package `status="published"`·`published_at` set. 미매핑 시트/미링크 DWG는 **허용**하되 응답에 `unmapped_sheets`·`unlinked_dwgs` 요약 포함(가시화). 영속 후 reload 동일.
5. **S14-e 프론트 API 클라이언트**: `src/api/packages.ts` 신설 — 타입 `Package`·`SheetSourceLink`·`DwgLink` + `createPackage`·`listPackages`·`getPackage`·`addPackageFiles`·`getPackageHints`·`savePackageMapping`·`publishPackage`·`listSheetSources(projectName, sheetId)`. `BACKEND_BASE`·fetch 에러 패턴(api/drawings.ts) 계승.
6. **S14-f 세트 발행 진입점 + 업로드**: `FilesView.tsx` 액션바에 "세트 발행" 버튼(`disabled={!canEdit}`) → `src/build/package/PublishSetModal.tsx`. 기존 `FileUploadModal` 멀티파일 업로드 로직을 재사용/추출해 DWG(들)+PDF(들)를 한 번에 업로드 → 반환 file_id를 draft package에 귀속(`createPackage`→`addPackageFiles`). 현재 `selectedFolderId`를 package.folder_id 기본값으로. DWG-only 업로드 허용(빈 시트 목록은 정직한 안내 상태).
7. **S14-g 매핑 화면**: `src/build/package/SheetSourceMapper.tsx` — 좌=PDF 시트 카드(페이지 썸네일 + 추출 `sheet_number` 힌트 + rev/sheet_key 상태 배지 "미매핑"/"매핑됨"), 우=DWG 목록(파일별 paperspace 레이아웃 펼침). **네이티브 HTML5 `draggable`/`onDrop`으로** DWG(레이아웃)를 시트 카드에 지정(DnD 라이브러리 의존성 0). 각 시트에 `sheet_key` 신규발급/기존계승 셀렉트. `getPackageHints`의 약한 제안을 칩으로 표시(원클릭 수락). **a11y: 드래그 대체로 키보드/버튼("이 DWG를 시트에 지정") 경로 병행.** 미매핑 시트/미링크 DWG는 시각적으로 구분. draft는 `savePackageMapping`로 부분저장 → 재오픈 시 `getPackage`로 복원. publish 후 요약(발행 N·미매핑 M·미링크 K) 표시 + Files 리프레시.
8. **S14-h 시트 상세 → 소스 DWG 열기**: `SheetViewerShell.tsx` 헤더 액션에 "소스 DWG 열기" 버튼 — 현재 시트가 PDF(`source==="pdf-page"`)이고 `listSheetSources(projectName, sheetId)`가 `dwg_links` 보유 시 노출. 클릭 → `dwg_links`의 `dwg_file_id`(+`layout_name`)로 대상 DWG 시트를 찾아 연다(여러 개면 선택 팝오버). `SheetViewerShell`에 `onOpenSheet?` prop 추가, `BuildSheetsView`에서 `openSheet` 배선. 대상 시트는 `source!=="pdf-page"`라 기존 VectorCanvas가 그대로 벡터 렌더(추가 뷰어 코드 0).
9. **검증**: 백엔드 pytest(package/sheet_source CRUD·next_rev A→B·is_current 내림·project 스코프·publish 미매핑 허용+요약·RBAC 403·에러계약), 프론트 vitest(매핑 상태전이 순수로직·모달 canEdit gating·회귀), `npm run build`·`npm test`(8000 내리고)·`git diff --check`. 브라우저 e2e(chrome-devtools 콘솔0): 세트 업로드→패키지1개 / 드래그 매핑→발행→새로고침 복원 / PDF 시트→소스 DWG 벡터 traversal / 미매핑 남긴 채 발행 loose. ODA 미설치 대비 **DXF 직접 업로드로 우회 검증**(합성 DXF paperspace 레이아웃명=layout_name). 증거 `docs/buildout-loop/evidence/s14-*.png`.

## Inputs

- 백엔드: `backend/store.py`(DrawingStore·Json·TypeDB 확장), 신규 `backend/routes_package.py`, `backend/main.py`(라우트 등록), `backend/sheet_meta.py`(`_normalize` 재사용), `backend/schema/04-drawings.tql`(package·sheet_source entity), 신규 `backend/tests/test_s14_packages.py`.
- 프론트: `src/build/FilesView.tsx`("세트 발행" 버튼·`FileUploadModal` 업로드 로직), 신규 `src/build/package/PublishSetModal.tsx`·`src/build/package/SheetSourceMapper.tsx`, `src/build/SheetViewerShell.tsx`("소스 DWG 열기"·`onOpenSheet`), `src/build/BuildSheetsView.tsx`(`openSheet` 배선), `src/build/viewer/VectorCanvas.tsx`(재사용, 무변경), 신규 `src/api/packages.ts`.
- 스펙: 이 프롬프트, `docs/buildout-loop/PLAN.md`, 2026-07-06 인터뷰 확정(Co-design log). S5 이슈 영속 패턴(`prompts/07`)·S3 버전세트(`prompts/04`) 참고.
- 테스트 도면: S1~S4 검증 DXF/PDF 시트(실척 좌표·실 렌더). 합성 DXF는 paperspace 레이아웃명으로 layout_name 매핑 검증.

## Acceptance checklist (검증팀이 항목별 채점 — freeze 후 불변)

- [ ] N1. **세트 업로드 → 패키지 1개**: N개 DWG + M개 PDF를 한 세트로 업로드하면 하나의 package(draft)로 묶이고 dwg_file_ids/pdf_file_ids에 file_id가 귀속된다. 각 파일은 기존 변환 파이프라인으로 시트/벡터 생성(변환 코드 무변경).
- [ ] N2. **수동 매핑 영속·리로드**: 매핑 화면에서 각 PDF 시트에 소스 DWG(들)를 드래그/버튼으로 연결→저장→새로고침(getPackage)하면 매핑이 복원된다. 자동 확정 없음(힌트만).
- [ ] N3. **소스 DWG 열기(PDF↔DWG traversal)**: PDF 시트 상세에서 "소스 DWG 열기"→연결된 DWG가 기존 VectorCanvas 벡터 뷰어에 렌더된다. 여러 DWG면 선택 가능.
- [ ] N4. **sheet_key + rev 발급/계승**: publish 시 각 시트가 유니크한 `sheet_key`+`rev`를 갖는다. 신규=rev "A", 기존 계승=next rev + 이전 링크 `is_current=false`. `sheet_key`는 시트번호와 별개(라벨 아님)이며 외부 `_sheet_sources.json`에 보관(재변환에도 유실 없음).
- [ ] N5. **loose state 시각 구분**: 미매핑 PDF 시트·미링크 DWG가 시각적으로 명확히 구분되되 발행을 막지 않는다. publish 응답에 unmapped/unlinked 요약 포함. "미매핑 1 남긴 채 발행" 케이스 통과.
- [ ] N6. **직교성·무회귀**: 기존 drawing/sheet/folder/version_set 레코드 무변경. 기존 이슈/마크업/측정/비교/검색/권한/버전 기능 회귀 0. package는 폴더·version_set과 독립 축(참조만).
- [ ] N7. **백엔드 영속 모델 + RBAC**: `store.py` package·sheet_source CRUD(Json 구현 + TypeDB 미러 위임), `schema/04-drawings.tql` entity 추가. 모든 mutation `require_role(편집자)` 403, GET 무강제. next_rev·is_current·project 스코프 검증.
- [ ] N8. **테스트 게이트**: 백엔드 pytest + 프론트 `npm test` + `npm run build` + `git diff --check` clean. package/sheet_source CRUD·next_rev·publish 미매핑 허용·매핑 상태전이 커버. ODA 없이도 DXF 우회로 traversal 검증.
- [ ] N9. **브라우저 e2e + 콘솔 0**: 세트 업로드→패키지 / 드래그 매핑→발행→복원 / PDF→소스 DWG traversal / loose 발행 end-to-end 스크린샷, 콘솔 에러 0. a11y: 드래그 대체 키보드/버튼 경로 동작.

## Out of scope (S14에서 의도적으로 하지 않음 — Phase 2 이후)

- **DWG→PDF 자동변환** — 세트 제출이 진실 소스. 후속에 "DWG만 → 임시 PDF 자동생성" 옵션(로드맵 유지).
- **재발행/supersede 실행** — sheet_key 계승 선택지는 노출하되, 신·구 rev pixel-diff·is_current 승계 자동화·발행분 트랜스미탈 뷰는 Phase 2.
- **이슈 ↔ 해결버전 연결 + 검증 게이트** — 재발행이 이슈를 "검증 대기"로 전이→제기자 Close, 재발행 외 종결 경로. 전부 Phase 2.
- **시트 목록 배지(sheet_key/rev 노출)** — 매핑 화면·소스 열기에서 노출되면 N4 충족. 시트 목록 조인 배지는 여력 시.
- **TypeDB 직접 쿼리화**(JSON 미러 유지), DWG 자동 시트 인식(작성자 제각각이라 신뢰 불가 — 수동 매핑이 정답).

## Freeze 답 (사용자 확정 — deep-interview 2026-07-06)

1. DWG = **정식 관리 자산**(소스), PDF = 게시 시트, 둘 다 버전관리.
2. **세트 제출 기본** + DWG 단독은 뷰어까지 제공.
3. 매칭 그레인 **N:M(1:N·2:N)**, 시트별 소스 DWG 연결.
4. 매핑 = **업로드 시 수동 확정**(자동은 약한 힌트만).
5. 버전 = **이중 구조**(시트별 rev + 발행분 이벤트, 최신이 이전 supersede).
6. 이슈 종결 = **연결 + 검증 게이트**(재발행은 종결 경로 중 하나) — Phase 2.
7. 1차 = **토대**(package·sheet_key·sheet_source + 세트 업로드·수동 매핑 + 소스 DWG 열기).
8. **DWG→PDF 자동변환 제외**(로드맵 유지).

→ STATUS: FROZEN(2026-07-06). 실행·채점은 이 고정 텍스트 기준. 합격을 위해 기준을 도중에 고치지 않는다(기준 변경 = 스코프 변경 = HUMAN_GATE).
