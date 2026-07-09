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


def _import_offenders(path: str, banned: set[str]) -> set[str]:
    """backend/extract 파일이 banned(backend 로컬) 모듈을 당기는 모든 경로를 잡는다.

    정적 절대 import·별칭뿐 아니라 스펙이 경고한 우회 벡터도 검사:
      - 상대 import level≥2 (`from ..store`) = 패키지 밖(backend)으로 상승 → 무조건 위반
      - 상대 import level==1 로 banned 이름 당기기
      - 동적 import (`__import__("store")`, `importlib.import_module("store")`) — 리터럴이면
        banned 검사, 비리터럴이면 보수적으로 위반(정적 판정 불가 = 격리 미보장)
    """
    tree = ast.parse(open(path, encoding="utf-8").read(), filename=path)
    bad: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                if a.name.split(".")[0] in banned:
                    bad.add(a.name)
        elif isinstance(node, ast.ImportFrom):
            if node.level >= 2:
                bad.add(f"relative(level={node.level}):{node.module or ''}")
            elif node.level == 0 and node.module and node.module.split(".")[0] in banned:
                bad.add(node.module)
            elif node.level == 1:
                for a in node.names:
                    if a.name in banned:
                        bad.add(f".{a.name}")
        elif isinstance(node, ast.Call):
            fn = node.func
            fname = fn.id if isinstance(fn, ast.Name) else (fn.attr if isinstance(fn, ast.Attribute) else None)
            if fname in ("__import__", "import_module"):
                arg = node.args[0] if node.args else None
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    if arg.value.split(".")[0] in banned:
                        bad.add(f"dynamic:{arg.value}")
                else:
                    bad.add(f"dynamic:{fname}(non-literal)")
    return bad


def test_extract_isolation_no_backend_imports():
    banned = _backend_local_modules() - {"normalize", "provider", "main_extract"}
    offenders = {}
    for f in os.listdir(_EXTRACT):
        if not f.endswith(".py"):
            continue
        hit = _import_offenders(os.path.join(_EXTRACT, f), banned)
        if hit:
            offenders[f] = hit
    assert not offenders, f"backend/extract 격리 위반(backend 모듈 import): {offenders}"


def test_isolation_guard_catches_evasions(tmp_path):
    # guard 가 스펙이 경고한 우회 벡터를 실제로 잡는지(=O12 판정이 견고한지) 증명.
    banned = {"store"}
    probes = [
        "import store",
        "import store as s",
        "from store import get_store",
        "from ..store import get_store",
        "import importlib\nimportlib.import_module('store')",
        "__import__('store')",
        "import importlib\nmod = 'st' + 'ore'\nimportlib.import_module(mod)",  # 비리터럴 → 보수적 위반
    ]
    for i, src in enumerate(probes):
        p = tmp_path / f"probe{i}.py"
        p.write_text(src, encoding="utf-8")
        assert _import_offenders(str(p), banned), f"guard가 우회를 못 잡음: {src!r}"
    # 정상 flat import 는 위반이 아니어야 한다(거짓양성 방지).
    ok = tmp_path / "ok.py"
    ok.write_text("import os\nimport re\nfrom normalize import normalize\nfrom . import provider",
                  encoding="utf-8")
    assert not _import_offenders(str(ok), banned)


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
