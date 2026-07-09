# backend/extract 를 sys.path에 넣어 flat import(normalize·provider·main_extract)를 보장.
# 격리(O12): 기존 backend/ 는 경로에 넣지 않는다.
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
