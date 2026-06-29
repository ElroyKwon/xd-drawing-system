"""도면 변환 파이프라인 (S1-c).

Study_TypeDB `dxf_service` 이식 + 갭 보강:
- DWG→DXF: ODA File Converter CLI 연동 (원본은 미구현 placeholder였음)
- 시트/PNG: Paper Space layout 우선, 없으면 Model Space fallback
- PDF: PyMuPDF 페이지 렌더 (S1은 단순 표시)
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

import config

logger = logging.getLogger(__name__)


@dataclass
class Sheet:
    sheet_id: str
    sheet_name: str
    sheet_index: int
    png_path: Optional[str] = None  # 절대경로
    source: str = ""                # "paperspace" | "modelspace" | "pdf-page"
    # S2: 시트 레지스터 메타(휴리스틱 추출)
    sheet_number: str = ""
    sheet_title: str = ""
    discipline_code: str = "G"
    discipline_label: str = "G (기타)"
    meta_source: str = ""           # filename+page | title-block | filename | page-index | layout

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ConversionResult:
    status: str = "pending"          # pending|converting|completed|failed
    sheets: list = field(default_factory=list)
    dxf_path: Optional[str] = None
    error: Optional[str] = None
    scan: dict = field(default_factory=dict)  # layers/blocks/extents 등 스캔 요약


# ---------------------------------------------------------------------------
# DWG → DXF (ODA File Converter)
# ---------------------------------------------------------------------------

def convert_dwg_to_dxf(dwg_path: str, out_dxf_path: str, oda_exe: str = None) -> str:
    """ODA File Converter CLI로 단일 DWG를 DXF로 변환.

    ODA는 폴더 단위로 동작하므로 임시 in/out 폴더를 거친다.
    CLI: ODAFileConverter <in> <out> <ver> <type> <recurse> <audit> [filter]
    """
    oda_exe = oda_exe or config.ODA_EXE
    if not os.path.exists(oda_exe):
        raise FileNotFoundError(f"ODA File Converter not found: {oda_exe}")

    dwg_path = os.path.abspath(dwg_path)
    out_dxf_path = os.path.abspath(out_dxf_path)
    tmp = Path(tempfile.mkdtemp(prefix="xd_oda_"))
    try:
        in_dir = tmp / "in"
        out_dir = tmp / "out"
        in_dir.mkdir()
        out_dir.mkdir()
        staged = in_dir / Path(dwg_path).name
        shutil.copy2(dwg_path, staged)

        cmd = [
            oda_exe,
            str(in_dir),
            str(out_dir),
            "ACAD2018",   # output version
            "DXF",        # output type
            "0",          # recurse
            "1",          # audit
            "*.DWG",      # filter
        ]
        logger.info("ODA convert: %s", " ".join(cmd))
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        # ODA는 성공해도 비표준 종료코드를 낼 수 있어 산출물 존재로 판정한다.
        produced = list(out_dir.glob("*.dxf")) + list(out_dir.glob("*.DXF"))
        if not produced:
            raise RuntimeError(
                f"ODA produced no DXF (rc={proc.returncode}): "
                f"{(proc.stderr or proc.stdout or '')[:300]}"
            )
        os.makedirs(os.path.dirname(out_dxf_path), exist_ok=True)
        shutil.copy2(str(produced[0]), out_dxf_path)
        logger.info("ODA DXF produced: %s", out_dxf_path)
        return out_dxf_path
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


# ---------------------------------------------------------------------------
# DXF → 시트 PNG (paperspace 우선, modelspace fallback)
# ---------------------------------------------------------------------------

def _render_layout_png(doc, layout, out_png: str, dpi: int) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from ezdxf.addons.drawing import RenderContext, Frontend
    from ezdxf.addons.drawing.matplotlib import MatplotlibBackend

    fig = plt.figure(dpi=dpi)
    try:
        ax = fig.add_axes([0, 0, 1, 1])
        ax.set_axis_off()
        ctx = RenderContext(doc)
        backend = MatplotlibBackend(ax)
        Frontend(ctx, backend).draw_layout(layout, finalize=True)
        fig.savefig(out_png, dpi=dpi, facecolor="white")
    finally:
        plt.close(fig)  # 예외 시에도 figure 누수 방지


def render_dxf_sheets(dxf_path: str, file_id: str, base_dir: str, filename: str = "", dpi: int = None) -> tuple:
    """DXF를 시트(PNG)로 분리. (sheets, scan) 반환.

    S2: 다중 paperspace 레이아웃을 각각 시트로 분리(viewport-only 레이아웃 포함).
    빈 paperspace(엔티티 0)인 DWG는 modelspace 단일 시트로 폴백(modelspace 자동분할은 범위 밖).
    """
    import ezdxf
    from sheet_meta import discipline_from_filename
    dpi = dpi or config.RENDER_DPI
    doc = ezdxf.readfile(dxf_path)

    paper_layouts = [l for l in doc.layouts if l.name.lower() != "model"]
    # paperspace layout에 그릴 엔티티(viewport 포함)가 있는 것만 시트로 채택.
    paper_layouts = [l for l in paper_layouts if len(list(l)) > 0]

    sheets_dir = Path(base_dir) / "sheets"
    sheets_dir.mkdir(parents=True, exist_ok=True)
    sheets: list[Sheet] = []
    dcode, dlabel = discipline_from_filename(filename)
    stem = os.path.splitext(os.path.basename(filename or ""))[0] or "도면"

    if paper_layouts:
        for i, layout in enumerate(paper_layouts):
            sid = f"{file_id}_sheet_{i+1:03d}"
            png = sheets_dir / f"{sid}.png"
            try:
                _render_layout_png(doc, layout, str(png), dpi)
                # 레이아웃명을 시트번호로(없으면 stem-N), 제목은 파일명 stem.
                num = layout.name if layout.name else f"{stem}-{i+1}"
                sheets.append(Sheet(sid, layout.name, i, str(png), "paperspace",
                                    sheet_number=num, sheet_title=stem,
                                    discipline_code=dcode, discipline_label=dlabel,
                                    meta_source="layout"))
            except Exception as e:  # noqa: BLE001
                logger.error("paperspace render fail %s: %s", layout.name, e)
    if not sheets:
        # Model Space fallback (paperspace 비었거나 렌더 실패)
        sid = f"{file_id}_sheet_001"
        png = sheets_dir / f"{sid}.png"
        _render_layout_png(doc, doc.modelspace(), str(png), dpi)
        logger.info("paperspace 비어 modelspace 단일 렌더: %s", file_id)
        sheets.append(Sheet(sid, "Model", 0, str(png), "modelspace",
                            sheet_number=stem, sheet_title=stem,
                            discipline_code=dcode, discipline_label=dlabel,
                            meta_source="filename"))

    msp = doc.modelspace()
    scan = {
        "dxf_version": doc.dxfversion,
        "layouts": len(list(doc.layouts)),
        "layers": len(doc.layers),
        "blocks": len(doc.blocks),
        "modelspace_entities": len(list(msp)),
    }
    return sheets, scan


# ---------------------------------------------------------------------------
# PDF → 페이지 PNG (PyMuPDF)
# ---------------------------------------------------------------------------

def _page_lines(page) -> list[dict]:
    """PDF 페이지를 라인 단위 {text,x0,y0,x1,y1} 목록으로(좌표 라벨 페어링용)."""
    out: list[dict] = []
    try:
        data = page.get_text("dict")
    except Exception:  # noqa: BLE001
        return out
    for b in data.get("blocks", []):
        for l in b.get("lines", []):
            txt = "".join(s.get("text", "") for s in l.get("spans", [])).strip()
            if not txt:
                continue
            x0, y0, x1, y1 = l["bbox"]
            out.append({"text": txt, "x0": x0, "y0": y0, "x1": x1, "y1": y1})
    return out


def render_pdf_sheets(pdf_path: str, file_id: str, base_dir: str, filename: str = "", dpi: int = None) -> tuple:
    """PDF를 페이지별 시트(PNG)로 분할(S2). 각 페이지 텍스트로 시트 메타 휴리스틱 추출."""
    import fitz  # PyMuPDF
    from sheet_meta import extract_sheet_meta
    dpi = dpi or config.RENDER_DPI
    sheets_dir = Path(base_dir) / "sheets"
    sheets_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    sheets: list[Sheet] = []
    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    multipage = doc.page_count > 1
    for i, page in enumerate(doc):
        sid = f"{file_id}_sheet_{i+1:03d}"
        png = sheets_dir / f"{sid}.png"
        page.get_pixmap(matrix=mat).save(str(png))
        # S2.5: 좌표 포함 라인(text+bbox)으로 타이틀블록 라벨-값 공간 페어링.
        lines = _page_lines(page)
        meta = extract_sheet_meta(page.get_text(), filename, i,
                                  lines=lines, page_size=(page.rect.width, page.rect.height),
                                  multipage=multipage)
        sheets.append(Sheet(sid, meta["number"], i, str(png), "pdf-page",
                            sheet_number=meta["number"], sheet_title=meta["title"],
                            discipline_code=meta["discipline_code"],
                            discipline_label=meta["discipline_label"],
                            meta_source=meta["meta_source"]))
    scan = {"pages": len(doc)}
    doc.close()
    return sheets, scan


# ---------------------------------------------------------------------------
# 통합 워크플로
# ---------------------------------------------------------------------------

def process_drawing(file_path: str, file_id: str, file_format: str, base_dir: str, filename: str = "") -> ConversionResult:
    """포맷별 변환→시트→PNG. 예외는 status=failed로 흡수. filename은 시트 메타 추출용."""
    res = ConversionResult(status="converting")
    fmt = file_format.lower()
    try:
        if fmt == "dwg":
            dxf_path = os.path.join(base_dir, "converted.dxf")
            convert_dwg_to_dxf(file_path, dxf_path)
            res.dxf_path = dxf_path
            sheets, scan = render_dxf_sheets(dxf_path, file_id, base_dir, filename)
        elif fmt == "dxf":
            res.dxf_path = file_path
            sheets, scan = render_dxf_sheets(file_path, file_id, base_dir, filename)
        elif fmt == "pdf":
            sheets, scan = render_pdf_sheets(file_path, file_id, base_dir, filename)
        else:
            raise ValueError(f"Unsupported format: {file_format}")
        res.sheets = [s.to_dict() for s in sheets]
        res.scan = scan
        res.status = "completed"
        logger.info("processed %s: %d sheets", file_id, len(sheets))
    except Exception as e:  # noqa: BLE001
        logger.exception("process_drawing failed: %s", file_id)
        res.status = "failed"
        res.error = str(e)
    return res
