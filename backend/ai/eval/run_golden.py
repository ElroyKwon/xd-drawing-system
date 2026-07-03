"""S8.2 골든 라이브 이밸 러너 — 8001 사이드카에 각 문항 1턴 POST.

각 문항을 신규 대화로 실행(독립), 답변·툴콜을 수집해 eval/results.json(UTF-8)에
증분 저장한다. 채점(표준 환각 기준)은 사람/검증자가 결과를 읽고 per-문항 판정한다.

사용법: 8000+8001 실기동 상태에서
  backend/ai/.venv/Scripts/python.exe eval/run_golden.py
"""
from __future__ import annotations

import json
import os
import sys

import httpx

HERE = os.path.dirname(os.path.abspath(__file__))
AI_BASE = os.environ.get("XD_AI_BASE", "http://127.0.0.1:8001")


def main() -> None:
    with open(os.path.join(HERE, "golden.json"), encoding="utf-8") as f:
        spec = json.load(f)
    project = spec["project"]
    out_path = os.path.join(HERE, "results.json")

    def flush():
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump({"project": project, "results": out}, fh,
                      ensure_ascii=False, indent=2)

    out = []
    for item in spec["questions"]:
        try:
            resp = httpx.post(
                f"{AI_BASE}/api/chat",
                json={"project": project, "message": item["q"], "provider": "openai"},
                timeout=120.0,
            )
            resp.raise_for_status()
            data = resp.json()
            out.append({
                "id": item["id"], "kind": item["kind"], "q": item["q"],
                "expect": item["expect"],
                "answer": data.get("answer"),
                "tool_calls": [
                    {"name": c["name"], "arguments": c.get("arguments"),
                     "result_summary": c.get("result_summary")}
                    for c in data.get("tool_calls", [])
                ],
                "provider": data.get("provider"),
            })
            print(f"[{item['id']}] done", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            out.append({"id": item["id"], "kind": item["kind"], "q": item["q"],
                        "error": str(e)})
            print(f"[{item['id']}] ERROR {e}", file=sys.stderr)
        flush()  # 증분 저장 — 중간 실패해도 결과 보존
    print(f"wrote {len(out)} results to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
