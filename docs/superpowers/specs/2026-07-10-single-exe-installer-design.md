# FROZEN 스펙 — 단일 설치 exe (setup.exe) 배포 (2026-07-10)

> 사용자 결정: **설치 마법사 `setup.exe`(형태 B)** + **DWG·PDF 둘 다**(ODA 동봉). 기준선 **JSON store**(TypeDB 제외 — 버전업 별도 트랙).
> 외부 배포 = 방금 확정한 "설치/배포 가이드" 백로그의 첫 산출물.

## Goal / Done-When

고객 PC에서 `setup.exe` **하나**를 실행 → 설치 → 바탕화면/시작메뉴 바로가기 클릭 → 로컬 브라우저에 **XD 도면관리 시스템**이 뜨고, PDF·DWG 업로드/변환/뷰어/이슈/협업/메타그래프가 **인터넷·Docker·별도 설치 없이** 동작. 제거는 표준 제거로 깨끗이.

- [ ] `setup.exe` 단일 실행으로 전체 설치(백엔드·AI·프론트·ODA·데이터폴더·바로가기).
- [ ] 바로가기 클릭 → supervisor exe가 서버 기동 + 브라우저 자동 오픈(127.0.0.1:8000).
- [ ] **오프라인 자립**: Python·Node 미설치 PC에서 동작(전부 freeze). JSON store(TypeDB 불요).
- [ ] **PDF 완전 자립** + **DWG는 동봉 ODA로 변환**.
- [ ] 데이터는 쓰기 가능 경로(`%LOCALAPPDATA%\XD-Drawing\data`)에 영속, 재설치/업그레이드에도 보존.
- [ ] 표준 제거(프로그램 추가/제거) 지원.

## 런타임 구조 (설치 후)

```
%PROGRAMFILES%\XD-Drawing\
  xd-server.exe        ← supervisor(=PyInstaller onedir 엔트리). 클릭 시:
                         · 백엔드(FastAPI) 127.0.0.1:8000  — 프론트 dist 까지 단일 오리진 서빙
                         · AI 사이드카     127.0.0.1:8001  — 키 없으면 mock
                         · (extract 8002 = 관리자 옵션, 기본 미기동)
                         · 브라우저 자동 오픈
  _internal\...        ← PyInstaller onedir 런타임(파이썬·의존성·frontend·backend 소스)
  ODAFileConverter\    ← 동봉 ODA(또는 설치 시 prerequisite 설치)
%LOCALAPPDATA%\XD-Drawing\data\uploads\   ← 도면·JSON store(쓰기 가능·영속)
```

- **단일 오리진 키스톤(구현 완료)**: 백엔드가 `dist/`를 루트에 서빙(`config.FRONTEND_DIST` 존재 시 `StaticFiles` 마운트, `/api·/health·/files` 우선). → 프론트 별도 서버 불필요.
- **프론트 빌드 플래그**: 패키징 빌드는 `VITE_BACKEND_BASE=""`(상대경로)로 빌드 → 어느 포트/호스트든 same-origin 호출.
- **격리 주의**: 데스크톱 단일사용자 설치에서는 supervisor가 백엔드/AI를 **스레드**로 기동(프로세스 격리 완화). 8000 egress 0 등 보안 불변식은 로컬 경계라 수용. (원격/멀티유저 배포는 GATE-6 별도.)

## 빌드 파이프라인

1. **프론트**: `VITE_BACKEND_BASE="" npm run build` → `dist/`.
2. **build venv**(모든 의존성 병합): `py -3.12 -m venv packaging/build-venv` → `pip install -r backend/requirements.txt -r backend/ai/requirements.txt pyinstaller`.
3. **freeze**: `pyinstaller packaging/xd-server.spec` → `dist/xd-server/`(onedir, `xd-server.exe`). dist·backend·frontend·필요 데이터파일 동봉, `XD_UPLOADS_DIR`/`XD_FRONTEND_DIST`는 exe-인접/APPDATA로 런타임 해석.
4. **installer**: `iscc packaging/installer.iss` → `dist/XD-Drawing-Setup.exe`. onedir + ODA + 바로가기 + 제거 + 데이터폴더 생성.

## 합격기준 (FROZEN)
- **P1** `setup.exe` 무인 설치 후 바로가기 클릭 → 브라우저에 앱 로드(콘솔 에러 0).
- **P2** Python/Node 미설치 클린 PC에서 동작(freeze 자립).
- **P3** PDF 업로드→분할→뷰어 동작(ODA 없이도). **P4** DWG 업로드→ODA 변환→벡터 뷰어.
- **P5** 이슈 생성·댓글(다른 ID)·상태·버전세트·메타그래프 조회 동작(JSON store).
- **P6** 데이터가 `%LOCALAPPDATA%`에 영속, 앱 재기동/업그레이드 후 유지.
- **P7** 표준 제거로 프로그램 제거(데이터폴더 유지 여부 옵션).

## 🚧 HUMAN_GATE (사람/시스템 단계 — 자율 불가)
- **GATE-INSTALLER**: **Inno Setup 6 설치**(빌드 PC에 `ISCC.exe` 필요). 미설치 → `.iss`까지 authored, 최종 `setup.exe` 컴파일은 설치 후.
- **GATE-ODA-LICENSE**: ODA File Converter **재배포 라이선스**. 설치본에 동봉하려면 ODA 재배포 권리 확인 필요(법무/구매). 대안: 설치 시 ODA를 prerequisite로 사용자가 별도 설치하도록 안내(동봉 회피).
- **GATE-CODESIGN(권장)**: 코드사인 인증서 없으면 SmartScreen 경고. 고객 납품 시 서명 권장(선택).

## Out of scope
- 원격/멀티유저·SSO(GATE-6) · 실 이메일(GATE-5) · TypeDB 연동 · 자동 업데이트 · macOS/Linux 패키지 · extract(8002) 비전 트랙 기본 포함(관리자 옵션으로만).

## 진행 상태(이 세션)
- ✅ **키스톤 구현·검증**: 백엔드 단일 오리진 서빙(`/`→index.html·`/health`·`/api`·`/assets` 전부 200).
- ✅ **스캐폴딩 authored**: `packaging/serve_all.py`(supervisor) · `xd-server.spec`(PyInstaller) · `installer.iss`(Inno) · `packaging/README.md`(빌드 가이드).
- ⬜ **다음**: build-venv + PyInstaller freeze 실행(반복 튜닝: matplotlib/pymupdf hidden-data) → onedir 검증 → (Inno 설치 후) `setup.exe` 컴파일.
