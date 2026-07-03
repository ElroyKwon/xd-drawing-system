"""대화 영속 (S8.1) — 격리 JSON 스토어(`_ai_data/conversations.json`).

기존 8000 store와 무관(격리 불변식). 원자적 write(temp→replace)로 동시성 안전.
owner는 표시용이다 — S7 로컬 모의(전역 current_user)라 프라이버시 경계가 아니며,
전송 시점 요청 컨텍스트에서 고정한다(GATE-3 하향, 설계 §8 일관).
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

_DATA_DIR = Path(__file__).resolve().parent / "_ai_data"
_PATH = _DATA_DIR / "conversations.json"
_LOCK = threading.Lock()


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _load() -> dict:
    if not _PATH.exists():
        return {"conversations": {}}
    try:
        return json.loads(_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"conversations": {}}


def _save(data: dict) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _PATH.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, _PATH)  # 원자적 교체


def create_conversation(project: str, owner: Optional[str]) -> dict:
    with _LOCK:
        data = _load()
        cid = f"conv-{uuid.uuid4().hex[:12]}"
        conv = {
            "id": cid, "project": project, "owner": owner,
            "created_at": _now(), "updated_at": _now(), "messages": [],
        }
        data["conversations"][cid] = conv
        _save(data)
        return conv


def append_message(cid: str, role: str, content: str,
                   tool_calls: Optional[list] = None) -> Optional[dict]:
    with _LOCK:
        data = _load()
        conv = data["conversations"].get(cid)
        if conv is None:
            return None
        msg = {"role": role, "content": content, "ts": _now()}
        if tool_calls:
            msg["tool_calls"] = tool_calls
        conv["messages"].append(msg)
        conv["updated_at"] = _now()
        _save(data)
        return conv


def get_conversation(cid: str) -> Optional[dict]:
    return _load()["conversations"].get(cid)


def list_conversations(project: Optional[str] = None,
                       owner: Optional[str] = None) -> list[dict]:
    convs = list(_load()["conversations"].values())
    if project:
        convs = [c for c in convs if c.get("project") == project]
    if owner:
        convs = [c for c in convs if c.get("owner") == owner]
    convs.sort(key=lambda c: c.get("updated_at", ""), reverse=True)
    # 목록은 메시지 본문 제외(요약).
    return [{k: v for k, v in c.items() if k != "messages"} |
            {"message_count": len(c.get("messages", []))} for c in convs]
