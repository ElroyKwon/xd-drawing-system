# packaging/ — 단일 설치 exe(setup.exe) 빌드

XD Drawing System을 **Python/Node 미설치 PC에서도 도는 설치형 `setup.exe` 하나**로 배포한다.
기준선 **JSON store**(TypeDB 제외). 설계·합격기준·게이트: `docs/superpowers/specs/2026-07-10-single-exe-installer-design.md`.

## 구성물
- `serve_all.py` — supervisor(설치형 exe 엔트리). 백엔드(8000, 프론트 dist 단일 오리진) + AI 사이드카(8001)를 스레드로 기동 + 브라우저 오픈. ✅ from-source 검증됨.
- `xd-server.spec` — PyInstaller onedir 스펙(파이썬·의존성·프론트·백엔드 동봉).
- `installer.iss` — Inno Setup 6 스크립트(onedir + ODA + 바로가기 + 제거).

## 빌드 절차 (Windows)

```powershell
# 0) 저장소 루트에서
cd D:\_Project\xd-drawing-system

# 1) 프론트 상대경로 빌드(same-origin) → dist\
$env:VITE_BACKEND_BASE=""; npm run build

# 2) 모든 의존성 병합한 build-venv
py -3.12 -m venv packaging\build-venv
packaging\build-venv\Scripts\pip install -r backend\requirements.txt -r backend\ai\requirements.txt pyinstaller

# 3) freeze → dist\xd-server\xd-server.exe (onedir)
packaging\build-venv\Scripts\pyinstaller packaging\xd-server.spec

#    검증: dist\xd-server\xd-server.exe 실행 → 브라우저 127.0.0.1:8000 에 앱 로드
#    (matplotlib/pymupdf hidden-data 누락 시 spec 의 collect_all 대상/hiddenimports 보강)

# 4) 설치본 컴파일 (Inno Setup 6 설치 필요 → GATE-INSTALLER)
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" packaging\installer.iss
#    산출: packaging\Output\XD-Drawing-Setup.exe
```

## 🚧 사람/시스템 단계 (자율 불가)
- **GATE-INSTALLER** — 빌드 PC에 **Inno Setup 6**(`ISCC.exe`) 설치 필요. 미설치 시 3단계(onedir)까지 자동, `setup.exe`는 설치 후 4단계.
- **GATE-ODA-LICENSE** — DWG 변환용 ODA File Converter **동봉 = 재배포 라이선스 확인 필요**. 확인 전에는 `installer.iss`의 ODA `Source:` 라인을 주석 유지하고, 설치 후 사용자가 ODA를 별도 설치하도록 안내(PDF는 ODA 없이 동작). 라이선스 확인되면 주석 해제.
- **GATE-CODESIGN(권장)** — 코드사인 인증서로 `setup.exe` 서명 시 SmartScreen 경고 회피.

## 데이터 위치
- 런타임 데이터(도면·JSON store) = `%LOCALAPPDATA%\XD-Drawing\data\uploads` (supervisor가 생성·영속). 앱 제거/업그레이드에도 보존.

## 현재 상태
- ✅ 단일 오리진 키스톤(백엔드가 프론트 서빙) + supervisor from-source 검증.
- ⬜ 남음: build-venv + PyInstaller freeze 실행(반복 튜닝) → onedir 검증 → (Inno 설치 후) setup.exe.
