; Inno Setup 6 스크립트 — XD Drawing System 단일 setup.exe
; 컴파일:  "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" packaging\installer.iss
; 산출:    packaging\Output\XD-Drawing-Setup.exe
; 전제:    pyinstaller 로 dist\xd-server\ (onedir) 가 먼저 생성돼 있어야 함.

#define AppName "XD Drawing System"
#define AppVer "1.0.0"
#define AppPublisher "LS Sauter"
#define AppExe "xd-server.exe"

[Setup]
AppName={#AppName}
AppVersion={#AppVer}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\XD-Drawing
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=XD-Drawing-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; 데이터는 %LOCALAPPDATA% 에 앱이 런타임 생성(설치 제거해도 도면 보존)
UninstallDisplayName={#AppName}
PrivilegesRequired=admin

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Files]
; PyInstaller onedir 전체(백엔드·AI·프론트·파이썬 런타임 포함)
Source: "..\dist\xd-server\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
; DWG 변환용 ODA File Converter 동봉 (GATE-ODA-LICENSE: 재배포 라이선스 확인 후 활성화)
; Source: "C:\Program Files\ODA\ODAFileConverter 27.1.0\*"; DestDir: "{app}\ODAFileConverter"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "바탕화면 바로가기 생성"; GroupDescription: "추가 작업:"

[Run]
Filename: "{app}\{#AppExe}"; Description: "지금 XD Drawing System 실행"; Flags: nowait postinstall skipifsilent

; 참고:
;  - 동봉 ODA 사용 시 backend 가 ODA 경로를 알도록 런타임에 ODA_EXE 환경변수를
;    {app}\ODAFileConverter\ODAFileConverter.exe 로 지정(supervisor 또는 [Registry]/배치로 설정).
;  - 코드사인 인증서 있으면 SignTool 로 setup.exe 서명 권장(SmartScreen 회피).
