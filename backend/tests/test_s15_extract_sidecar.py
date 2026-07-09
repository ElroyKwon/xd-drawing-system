"""S15 단계5 — 8002 추출 사이드카 격리(O12) + 8000 훅 기본 off 회귀(O4).

O12: backend/extract/*.py 는 기존 backend 로컬 모듈을 import 하지 않는다(AST 검사).
O4 : XD_EXTRACT_LLM 기본 off → 8000 은 8002 를 호출하지 않고 규칙 결과를 그대로 쓴다.
"""
import ast
import os

import config
import sheet_indexing

_HERE = os.path.dirname(__file__)
_BACKEND = os.path.normpath(os.path.join(_HERE, ".."))
_EXTRACT = os.path.join(_BACKEND, "extract")


def _backend_local_modules() -> set[str]:
    """backend/ 최상위 .py 파일 stem = 로컬 모듈 이름(store·config·rule_extract…)."""
    return {
        f[:-3] for f in os.listdir(_BACKEND)
        if f.endswith(".py") and f != "__init__.py"
    }


def _imported_toplevel(path: str) -> set[str]:
    tree = ast.parse(open(path, encoding="utf-8").read(), filename=path)
    mods: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                mods.add(a.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.level == 0 and node.module:  # 절대 import 만(상대 import 는 자기 패키지)
                mods.add(node.module.split(".")[0])
    return mods


def test_extract_isolation_no_backend_imports():
    banned = _backend_local_modules() - {"normalize", "provider", "main_extract"}
    offenders = {}
    for f in os.listdir(_EXTRACT):
        if not f.endswith(".py"):
            continue
        hit = _imported_toplevel(os.path.join(_EXTRACT, f)) & banned
        if hit:
            offenders[f] = hit
    assert not offenders, f"backend/extract 격리 위반(backend 모듈 import): {offenders}"


def test_extract_has_own_requirements():
    # 자체 venv 계약: 사이드카는 독립 의존을 선언한다(설치 재현성).
    assert os.path.exists(os.path.join(_EXTRACT, "requirements.txt"))


def test_hook_noop_when_llm_off(monkeypatch):
    # O4: 기본 off → _llm_augment 는 규칙 결과를 손대지 않고 그대로 반환(8002 미접촉).
    monkeypatch.setattr(config, "EXTRACT_LLM", False)
    rule_result = {"text_index": "PP-380V", "source_kind": "pdf",
                   "tags": [{"tag": "PP-380V", "confidence": 0.92, "src": "rule"}]}
    out = sheet_indexing._llm_augment(rule_result, "f1", "s1")
    assert out is rule_result  # 동일 객체 — 게이트 off 경로는 사이드카 미호출


def test_hook_swallows_sidecar_failure(monkeypatch):
    # 게이트 on 이어도 8002 미기동/오류면 규칙 결과 유지(변환을 막지 않음).
    monkeypatch.setattr(config, "EXTRACT_LLM", True)
    monkeypatch.setattr(config, "EXTRACT_ADDR", "127.0.0.1:59999")  # 죽은 포트
    rule_result = {"text_index": "PP-380V", "source_kind": "pdf",
                   "tags": [{"tag": "PP-380V", "confidence": 0.92, "src": "rule"}]}
    out = sheet_indexing._llm_augment(rule_result, "f1", "s1")
    assert out == rule_result  # 사이드카 실패 → 규칙 결과 그대로
