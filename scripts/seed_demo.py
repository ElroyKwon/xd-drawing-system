#!/usr/bin/env python3
"""데모용 실데이터 시딩: 테스트 산물 정리 + 현실적 전기설계 이슈 + 핀 + 마크업.

uploads/ 는 gitignore 대상이라 데모 데이터가 git에 남지 않는다. 이 스크립트가
'재현 가능한 산출물'이다. 도면은 파일명으로 찾아 file_id 하드코딩을 피한다.

설계 원칙(실무 마크업처럼 보이게):
  - 이슈를 한 시트에 몰지 않고 여러 시트에 분산(겹침 방지).
  - 라벨은 기계적 "이슈 #N"이 아니라 이슈 내용을 압축한 짧은 실무 주석.
  - 리비전 클라우드는 작게, 텍스트 라벨은 핀에서 오프셋 배치.
  - 재실행 시 대상 시트의 기존 마크업/시드 이슈를 모두 지우고 새로 그림(멱등).

실행: python seed_demo.py  (백엔드가 127.0.0.1:8000 에서 떠 있어야 함)
"""
from __future__ import annotations

import json
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")  # Windows cp949 콘솔 출력 크래시 방지

BASE = "http://127.0.0.1:8000"


def api(method: str, path: str, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"  ! {method} {path} -> {e.code} {e.read().decode()[:200]}")
        return None


def find_sheet(drawings, filename_substr, sheet_index=0):
    for d in drawings:
        if filename_substr in d.get("filename", ""):
            sheets = d.get("sheets") or []
            if sheet_index < len(sheets):
                s = sheets[sheet_index]
                return d["file_id"], s["sheet_id"], s.get("source", "")
    return None, None, None


def coord_space_for(source: str) -> str:
    return "world" if source in ("modelspace", "dxf") else "image"


# 도면 역할 → 파일명
KEY_MAP = {
    "single_line": "EE-01-006_단선결선도",
    "dwg_panel": "original.dwg",            # world 좌표 DWG (분전반/배치)
    "bess": "제주_BESS_전기도면_8p",
}

# 이슈 스펙: (제목, 유형, 카테고리, 담당, 상태, 설명, 도면키, 시트idx, [x,y]핀, 라벨, 핀유무)
# 한 시트당 최대 1~3개, 서로 떨어진 위치로 분산.
ISSUE_SPECS = [
    # --- 단선결선도(EE-01-006): 3개, 좌상/우상/우하로 분산 ---
    ("단선결선도 주차단기(ACB) 정격 표기 불명확 — 현장 명판과 대조 필요",
     "현장 확인", "quality", "시공 전기팀", "진행중",
     "6.6kV 인입 주차단기(ACB) 정격이 도면과 현장 명판에서 상이하게 확인됨. 명판 실사진 대조 후 도면 정정 요망.",
     "single_line", 0, [0.205, 0.30], "정격 표기 확인", True),
    ("22.9kV 인입 케이블 규격이 부하계산서와 불일치 (CV 325→400sq 검토)",
     "설계 검토", "quality", "전기 설계팀", "열림",
     "단선결선도상 인입 간선 CV 325sq이나 최종 부하계산 기준 허용전류 부족. 400sq 상향 또는 병렬 포설 검토.",
     "single_line", 0, [0.74, 0.30], "CV 400sq 검토", True),
    ("접지 계통(TN-S) 주접지선 굵기 미표기",
     "설계 검토", "coordination", "전기 감리", "열림",
     "주접지단자함(MET) 이후 보호도체 굵기 미명기. 내선규정 기준 굵기 표기 추가 필요.",
     "single_line", 0, [0.74, 0.66], "접지선 굵기", True),
    # --- DWG(배치/분전반, world 좌표): 3개, 넓은 도면에 분산 ---
    ("현장 분전반 위치가 도면 표기와 상이 — CAD 수정 요청",
     "현장 확인", "clash", "도면 검토자", "진행중",
     "현장 분전반 설치 위치가 배치도 표기와 다름. 실측 반영해 CAD 도면 위치 수정 요청.",
     "dwg_panel", 0, [55000.0, 42000.0], "위치 상이", True),
    ("케이블 트레이와 급배기 덕트 간섭 — 천장 유효고 부족",
     "간섭", "clash", "BIM 조정자", "진행중",
     "전기 케이블 트레이(300W)가 기계 급기덕트와 교차하는 구간에서 천장 유효고 부족. 레벨 하향/우회 협의.",
     "dwg_panel", 0, [128000.0, 44000.0], "트레이 간섭", True),
    ("수전실 유지보수 이격거리 법규 미달 우려",
     "현장 확인", "coordination", "전기 감리", "열림",
     "수배전반 전면 유지보수 통로 폭이 법정 이격거리(1.5m)에 근접. 실측 확인 및 배치 조정 검토.",
     "dwg_panel", 0, [205000.0, 22000.0], "이격거리", True),
    # --- BESS 8p: 페이지마다 1개씩 분산 ---
    ("변압기 2차측 주차단기 정격 재확인 (630AF/500AT)",
     "현장 확인", "quality", "시공 전기팀", "답변됨",
     "TR-1 2차측 ACB 630AF/500AT 표기. 변압기 용량(500kVA) 대비 정격전류·차단용량 적정성 재검토 완료.",
     "bess", 0, [0.38, 0.40], "정격 재확인", True),
    ("비상발전기 연동 ATS 용량·전환시간 검토 필요",
     "협의", "coordination", "전기 설계팀", "열림",
     "비상 계통 ATS 정격이 부하 분리 기준과 일치하는지, 전환시간(≤10s) 사양 명기 여부 협의.",
     "bess", 1, [0.42, 0.46], "ATS 용량", True),
    ("조명 분전반 LP-2F 회로 수 초과 — 분전반 증설 필요",
     "설계 검토", "quality", "전기 설계팀", "열림",
     "2층 조명 부하 회로 수가 분전반 수용 회로를 초과. 예비회로 확보 위해 증설 또는 회로 재분배 필요.",
     "bess", 3, [0.40, 0.44], "회로 증설", True),
    ("피뢰 인하도선 경로가 외벽 창호와 간섭",
     "간섭", "clash", "BIM 조정자", "진행중",
     "피뢰침 인하도선 경로가 3층 커튼월 창호 위치와 겹침. 우회 경로 또는 매입 방식 재검토.",
     "bess", 5, [0.56, 0.36], "인하도선 우회", True),
    ("BESS PCS반 방열·환기 계획 도면 누락",
     "품질", "quality", "전기 설계팀", "답변됨",
     "PCS·배터리랙 발열량 대비 강제환기/공조 계획 미반영. 기계팀 협의 후 환기량 산정 반영 완료.",
     "bess", 7, [0.46, 0.50], "환기 계획", True),
    # --- 핀 없는 전역 협의 이슈(시트 간 불일치) ---
    ("전기·기계 도면 간 케이블 트레이 경로 협의 필요 — 시트 간 표기 불일치",
     "협의", "coordination", "BIM 조정자", "열림",
     "전기 트레이 경로와 기계 도면 트레이 표기가 시트 간 불일치. 조정 회의로 기준 경로 확정 필요.",
     None, 0, None, None, False),
]


# ---------------------------------------------------------------------------
# 1) 정리
# ---------------------------------------------------------------------------
def cleanup(drawings):
    print("[1] 테스트 산물 정리 + 이전 시드 초기화(멱등)")
    # 데모 대상 프로젝트의 활성 이슈 전부 삭제 후 새로 생성(제목 드리프트에 견고한 완전 멱등).
    issues = api("GET", "/api/issues?project_name=Study_Project") or []
    for i in issues:
        api("DELETE", f"/api/issues/{i['issue_id']}")
    print(f"  - Study_Project 이슈 초기화: {len(issues)}건 삭제")
    # 시트 0개 junk 업로드 삭제
    for d in list(drawings):
        if d.get("filename") == "d.pdf" and not (d.get("sheets") or []):
            api("DELETE", f"/api/drawings/{d['file_id']}")
    # 대상 시트의 기존 마크업 전부 삭제(오래된 테스트 마크업 포함) — 깨끗한 새 그림
    target_fids = set()
    for (_, _, _, _, _, _, dkey, sidx, *_rest) in ISSUE_SPECS:
        if dkey:
            fid, _, _ = find_sheet(drawings, KEY_MAP[dkey], sidx)
            if fid:
                target_fids.add(fid)
    for d in drawings:
        if d["file_id"] not in target_fids:
            continue
        for s in (d.get("sheets") or []):
            mks = api("GET", f"/api/drawings/{d['file_id']}/markups?sheet_id={s['sheet_id']}") or []
            for m in mks:
                api("DELETE", f"/api/drawings/{d['file_id']}/markups/{m['markup_id']}")


# ---------------------------------------------------------------------------
# 2) 이슈 + 핀
# ---------------------------------------------------------------------------
def seed_issues(drawings):
    print("[2] 현실적 전기설계 이슈 생성")
    created = []
    for spec in ISSUE_SPECS:
        title, typ, cat, assignee, status, desc, dkey, sidx, point, label, has_pin = spec
        body = {"title": title, "type": typ, "category": cat, "assignee": assignee,
                "status": status, "description": desc}
        cs = None
        if has_pin and dkey:
            file_id, sheet_id, source = find_sheet(drawings, KEY_MAP[dkey], sidx)
            if not file_id:
                print(f"  ! 도면 못 찾음: {dkey} — 건너뜀"); continue
            cs = coord_space_for(source)
            body.update({"file_id": file_id, "sheet_id": sheet_id,
                         "pin": {"point": point, "coord_space": cs}})
        r = api("POST", "/api/issues", body)
        if r:
            if has_pin and dkey:
                created.append((body["file_id"], body["sheet_id"], cs, point, label))
            print(f"  + [{status}] {title[:38]}{'  ('+cs+' 핀)' if cs else '  (전역)'}")
    return created


# ---------------------------------------------------------------------------
# 3) 마크업(작은 리비전 클라우드 + 오프셋 라벨)
# ---------------------------------------------------------------------------
def rect_around(point, cs):
    x, y = point
    dx, dy = (0.045, 0.032) if cs == "image" else (4500.0, 3200.0)
    return [[x - dx, y - dy], [x + dx, y - dy], [x + dx, y + dy],
            [x - dx, y + dy], [x - dx, y - dy]]


def seed_markups(created):
    print("[3] 마크업 드로잉(리비전 클라우드 + 실무 라벨)")
    cloud_style = {"color": "#e5484d", "width": 2, "opacity": 1}
    text_style = {"color": "#e5484d", "fontSize": 12, "bold": True}
    for (file_id, sheet_id, cs, point, label) in created:
        x, y = point
        api("POST", f"/api/drawings/{file_id}/markups", {
            "sheet_id": sheet_id, "kind": "클라우드", "coord_space": cs,
            "geometry": rect_around(point, cs), "style": cloud_style,
            "text": "", "author": "전기 감리"})
        # 라벨은 클라우드 위쪽에 오프셋(상단 근처면 아래로)
        if cs == "image":
            ty = y - 0.05 if y > 0.12 else y + 0.06
            lx = min(max(x - 0.03, 0.01), 0.85)
        else:
            ty = y + 4200.0
            lx = x - 3000.0
        api("POST", f"/api/drawings/{file_id}/markups", {
            "sheet_id": sheet_id, "kind": "텍스트", "coord_space": cs,
            "geometry": [[lx, ty]], "style": text_style,
            "text": label, "author": "전기 감리"})
        print(f"  + {label}  ({cs}, sheet …{sheet_id[-10:]})")


# ---------------------------------------------------------------------------
# 4) 작업(Tasks) — 전기 시공 현장의 현실적 작업 항목
# ---------------------------------------------------------------------------
# (제목, 담당, 상태, 우선순위, 기한, 설명)
TASK_SPECS = [
    ("수전실 접지저항 측정 결과 제출", "시공 전기팀", "진행중", "높음", "2026-07-10",
     "준공 전 접지저항 측정값 기록해 감리에 제출."),
    ("단선결선도 주차단기 정격 최종 승인", "전기 설계팀", "할 일", "높음", "2026-07-08",
     "차단기 정격(ACB) 현장 명판 대조 후 도면 최종 승인."),
    ("22.9kV 인입 케이블 발주 (CV 400sq)", "구매팀", "할 일", "높음", "2026-07-15",
     "부하계산 반영 규격으로 인입 간선 발주."),
    ("케이블 트레이 시공 상세도 작성", "BIM 조정자", "진행중", "보통", "2026-07-18",
     "덕트 간섭 구간 우회 반영한 트레이 시공 상세도."),
    ("비상발전기 시운전 계획 수립", "시공 전기팀", "할 일", "보통", "2026-07-22",
     "ATS 전환·부하 시험 포함 시운전 절차서 작성."),
    ("조명 분전반 회로 재분배 검토", "전기 설계팀", "진행중", "낮음", "2026-07-20",
     "LP-2F 회로 초과 해소 위한 회로 재분배."),
    ("접지 시스템 준공 검사 신청", "전기 감리", "완료", "보통", "2026-06-28",
     "TN-S 계통 준공 검사 신청 완료."),
    ("피뢰설비 설치 확인서 제출", "시공 전기팀", "완료", "보통", "2026-06-30",
     "인하도선 경로 변경 반영한 설치 확인서 제출 완료."),
]


def seed_tasks():
    print("[4] 작업(Tasks) 생성")
    # 멱등: 기존 작업 전부 삭제 후 재생성.
    for t in (api("GET", "/api/tasks?project_name=Study_Project") or []):
        api("DELETE", f"/api/tasks/{t['task_id']}")
    for (title, assignee, status, priority, due, desc) in TASK_SPECS:
        r = api("POST", "/api/tasks", {
            "title": title, "assignee": assignee, "status": status,
            "priority": priority, "due_date": due, "description": desc})
        if r:
            print(f"  + [{status}·{priority}] {title[:34]}")


# ---------------------------------------------------------------------------
# 5) 양식(Forms) — 전기 점검·안전·품질·검사 체크리스트
# ---------------------------------------------------------------------------
# (제목, 유형, 상태, 담당, 기한, [항목(체크여부)...])
FORM_SPECS = [
    ("수배전반 인수 점검표", "검사", "진행중", "전기 감리", "2026-07-12", [
        ("외관 손상 여부", True), ("절연저항 측정", True),
        ("결선 상태 확인", False), ("명판 사양 일치", False), ("보호계전기 정정값", False)]),
    ("접지 시스템 시공 점검표", "점검", "완료", "시공 전기팀", "2026-06-28", [
        ("접지극 매설 심도", True), ("접지저항 측정(≤10Ω)", True), ("본딩 연결 상태", True)]),
    ("전기실 소방·안전 점검표", "안전", "미시작", "안전관리자", "2026-07-25", [
        ("소화기 비치", False), ("피난 유도등", False), ("케이블 방화구획 관통부", False)]),
    ("케이블 포설 품질 점검표", "품질", "진행중", "BIM 조정자", "2026-07-19", [
        ("트레이 지지 간격", True), ("곡률 반경 준수", False), ("케이블 태그 부착", False)]),
    ("비상발전기 시운전 점검표", "검사", "미시작", "시공 전기팀", "2026-07-24", [
        ("연료 계통 점검", False), ("무부하 운전", False), ("ATS 절체 시험", False), ("부하 시험", False)]),
]


def seed_forms():
    print("[5] 양식(Forms) 생성")
    for f in (api("GET", "/api/forms?project_name=Study_Project") or []):
        api("DELETE", f"/api/forms/{f['form_id']}")
    for (title, ftype, status, assignee, due, items) in FORM_SPECS:
        r = api("POST", "/api/forms", {
            "title": title, "form_type": ftype, "status": status,
            "assignee": assignee, "due_date": due,
            "items": [{"label": lbl, "checked": chk} for (lbl, chk) in items]})
        if r:
            print(f"  + [{status}·{ftype}] {title}  (완료율 {r.get('completion')}%)")


# ---------------------------------------------------------------------------
# 6) 사진(Photos) — 현장/검수 사진 (PIL로 생성한 라벨 플레이스홀더 이미지)
# ---------------------------------------------------------------------------
# (제목, 캡션, 배경색, 도면키|None, 시트idx) — 도면키가 있으면 해당 시트에 연결.
PHOTO_SPECS = [
    ("수배전반 반입 현장", "지하 전기실 수배전반 반입 및 위치 확인", (37, 73, 110), "single_line", 0),
    ("접지극 매설", "기초 접지극 매설 심도 확인(검수)", (46, 125, 74), "single_line", 0),
    ("케이블 트레이 시공", "3층 천장 케이블 트레이(300W) 포설", (176, 92, 12), "dwg_panel", 0),
    ("변압기 설치", "TR-1 유입식 변압기 설치 완료", (112, 72, 232), "bess", 0),
    ("비상발전기 반입", "옥외 비상발전기 반입·기초 앵커링", (25, 113, 194), "bess", 1),
    ("현장 전경", "타워동 전기 시공 전반 현황(주간)", (64, 80, 92), None, 0),
]


def _make_image(title: str, color: tuple) -> bytes:
    """제목 라벨이 들어간 640x480 플레이스홀더 이미지 PNG 바이트."""
    from io import BytesIO
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (640, 480), color)
    d = ImageDraw.Draw(img)
    # 단순 프레임 + 대각 그라디언트 느낌의 사각형 몇 개(사진처럼 보이게)
    d.rectangle([0, 0, 639, 479], outline=(255, 255, 255), width=6)
    d.rectangle([40, 40, 600, 300], outline=(255, 255, 255), width=2)
    d.text((48, 400), title, fill=(255, 255, 255))
    d.text((48, 430), "XD 현장 사진 (데모)", fill=(220, 230, 240))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _upload_photo(fields: dict, filename: str, data: bytes):
    """multipart/form-data 로 /api/photos 업로드(urllib, JSON api 헬퍼로는 불가)."""
    import uuid as _uuid
    boundary = "----xdseed" + _uuid.uuid4().hex
    parts = []
    for k, v in fields.items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    parts.append(
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
        f"Content-Type: image/png\r\n\r\n".encode() + data + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)
    req = urllib.request.Request(BASE + "/api/photos", data=body, method="POST",
                                 headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        print(f"  ! POST /api/photos -> {e.code} {e.read().decode()[:200]}")
        return None


def seed_photos(drawings):
    print("[6] 사진(Photos) 생성")
    # 멱등: 기존 사진 전부 삭제 후 재생성.
    for p in (api("GET", "/api/photos?project_name=Study_Project") or []):
        api("DELETE", f"/api/photos/{p['photo_id']}")
    for i, (title, caption, color, dkey, sidx) in enumerate(PHOTO_SPECS):
        sheet_id = ""
        if dkey:
            _, sid, _ = find_sheet(drawings, KEY_MAP[dkey], sidx)
            sheet_id = sid or ""
        data = _make_image(title, color)
        fields = {"project_name": "Study_Project", "title": title,
                  "caption": caption, "sheet_id": sheet_id, "uploaded_by": "현장 담당자"}
        r = _upload_photo(fields, f"site_{i+1}.png", data)
        if r:
            print(f"  + {title}{'  (시트 연결)' if sheet_id else '  (미연결)'}")


def main():
    me = api("GET", "/api/auth/me")
    if not me:
        print("백엔드 미응답 — 8000 기동 확인"); sys.exit(1)
    print(f"현재 사용자: {me['member']['name']}\n")
    drawings = api("GET", "/api/drawings") or []
    cleanup(drawings)
    drawings = api("GET", "/api/drawings") or []
    created = seed_issues(drawings)
    seed_markups(created)
    seed_tasks()
    seed_forms()
    seed_photos(drawings)
    issues = api("GET", "/api/issues") or []
    tasks = api("GET", "/api/tasks?project_name=Study_Project") or []
    forms = api("GET", "/api/forms?project_name=Study_Project") or []
    photos = api("GET", "/api/photos?project_name=Study_Project") or []
    print(f"\n완료: 활성 이슈 {len(issues)}건 (핀 {sum(1 for i in issues if i.get('pin'))}건) · 작업 {len(tasks)}건 · 양식 {len(forms)}건 · 사진 {len(photos)}장")


if __name__ == "__main__":
    main()
