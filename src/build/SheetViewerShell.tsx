import { ArrowLeft, Download, Grid2X2, Maximize2, Minus, Move, Plus, RotateCw } from "lucide-react";
import { useState } from "react";
import type { Sheet } from "../buildSheetsData";
import CalibrationModal from "./viewer/CalibrationModal";
import CompareModal from "./viewer/CompareModal";
import CompareOverlay from "./viewer/CompareOverlay";
import IssueAddPanel from "./viewer/IssueAddPanel";
import MarkupCanvas from "./viewer/MarkupCanvas";
import MarkupListPanel from "./viewer/MarkupListPanel";
import MarkupPropertyPanel from "./viewer/MarkupPropertyPanel";
import MarkupToolRail from "./viewer/MarkupToolRail";
import VectorCanvas from "./viewer/VectorCanvas";
import MeasurePanel from "./viewer/MeasurePanel";
import {
  demoIssuePins,
  demoMarkups,
  issueCategories,
  measureRows,
  measureTypes,
  type MarkupTool,
  type MeasureType,
  type ViewerLeftTab
} from "./viewer/viewerData";

const leftTabs: ViewerLeftTab[] = ["마크업", "마크업 로그", "이슈"];

export default function SheetViewerShell({
  projectName,
  selectedSheet,
  sheets,
  onBack
}: {
  projectName: string;
  selectedSheet: Sheet;
  sheets: Sheet[];
  onBack: () => void;
}) {
  const [activeTool, setActiveTool] = useState<MarkupTool>("선택");
  const [leftTab, setLeftTab] = useState<ViewerLeftTab>("마크업");
  const [selectedMarkupId, setSelectedMarkupId] = useState<string | null>(null);
  const [selectedIssueCategory, setSelectedIssueCategory] = useState<string | null>(null);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [activeMeasureType, setActiveMeasureType] = useState<MeasureType>("선형");
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareSheetB, setCompareSheetB] = useState<Sheet | null>(null);
  const [compareResultOpen, setCompareResultOpen] = useState(false);

  // S1.5 렌더 bake-off: ②벡터(승자, 기본) ↔ ①래스터(PNG) 토글.
  // DWG/DXF(벡터 산출물 보유)만 토글을 노출하고, 승자인 벡터를 기본 엔진으로 둔다.
  const vectorCapable = Boolean(selectedSheet.fileId) && selectedSheet.source !== "pdf-page";
  const [renderEngine, setRenderEngine] = useState<"vector" | "raster">(
    vectorCapable ? "vector" : "raster"
  );
  const showVector = vectorCapable && renderEngine === "vector";

  const selectedMarkup = demoMarkups.find((markup) => markup.id === selectedMarkupId) ?? null;
  // 비교 결과 모드에서는 우측 보조 패널을 띄우지 않는다(컨텍스트 누수 방지).
  const hasAside = !compareResultOpen && (measureOpen || Boolean(selectedMarkup));

  function selectTool(tool: MarkupTool) {
    setActiveTool(tool);
    if (tool === "측정") {
      setSelectedMarkupId(null);
      setMeasureOpen(true);
    } else {
      // 측정 외 도구를 고르면 측정 패널을 닫아 도구-패널 상태를 일치시킨다.
      setMeasureOpen(false);
    }
  }

  function closeMeasure() {
    setMeasureOpen(false);
    setActiveTool("선택");
  }

  function selectMarkup(id: string) {
    setSelectedMarkupId((current) => (current === id ? null : id));
    setMeasureOpen(false);
  }

  function runCompare() {
    if (!compareSheetB) {
      return;
    }
    // 비교 진입 시 마크업/측정 상태를 리셋해 비교 모드 위 패널 중첩을 막는다.
    setMeasureOpen(false);
    setSelectedMarkupId(null);
    setActiveTool("선택");
    setCompareOpen(false);
    setCompareResultOpen(true);
  }

  function closeCompareResult() {
    setCompareResultOpen(false);
    setCompareSheetB(null);
  }

  return (
    <section className="viewer-shell" aria-label="2D 시트 뷰어">
      <header className="viewer-header">
        <button className="ghost-action" type="button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          시트 목록
        </button>
        <div>
          <h1>{selectedSheet.number}</h1>
          <p>{selectedSheet.title}</p>
          <span>{projectName}</span>
        </div>
        <button className="secondary-action" type="button">
          <Download size={16} aria-hidden="true" />
          내보내기
        </button>
      </header>

      <div className={`viewer-grid${hasAside ? " has-aside" : ""}`}>
        <aside className="viewer-panel">
          <div className="viewer-panel-tabs" role="tablist" aria-label="뷰어 패널">
            {leftTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={leftTab === tab}
                onClick={() => setLeftTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          {leftTab === "이슈" ? (
            <IssueAddPanel
              categories={issueCategories}
              selectedCategoryId={selectedIssueCategory}
              onSelectCategory={(id) => setSelectedIssueCategory((current) => (current === id ? null : id))}
            />
          ) : (
            <MarkupListPanel
              markups={demoMarkups}
              selectedMarkupId={selectedMarkupId}
              isLog={leftTab === "마크업 로그"}
              onSelectMarkup={selectMarkup}
            />
          )}
        </aside>

        <div className="viewer-stage">
          {compareResultOpen && compareSheetB ? (
            <CompareOverlay sheetA={selectedSheet} sheetB={compareSheetB} onClose={closeCompareResult} />
          ) : (
            <>
              {vectorCapable ? (
                <div className="render-engine-toggle" role="group" aria-label="렌더 엔진">
                  <button type="button" aria-pressed={renderEngine === "vector"} onClick={() => setRenderEngine("vector")}>
                    벡터
                  </button>
                  <button type="button" aria-pressed={renderEngine === "raster"} onClick={() => setRenderEngine("raster")}>
                    래스터
                  </button>
                </div>
              ) : null}
              {showVector ? (
                <VectorCanvas fileId={selectedSheet.fileId as string} />
              ) : (
                <MarkupCanvas
                  selectedSheet={selectedSheet}
                  markups={demoMarkups}
                  issuePins={demoIssuePins}
                  selectedMarkupId={selectedMarkupId}
                  onSelectMarkup={selectMarkup}
                />
              )}
              {!showVector && (
              <div className="viewer-bottom-controls" aria-label="뷰어 하단 컨트롤">
                <button type="button" aria-label="이동">
                  <Move size={18} aria-hidden="true" />
                </button>
                <button type="button" aria-label="축소">
                  <Minus size={18} aria-hidden="true" />
                </button>
                <button type="button" aria-label="확대">
                  <Plus size={18} aria-hidden="true" />
                </button>
                <button type="button" aria-label="맞춤">
                  <Maximize2 size={18} aria-hidden="true" />
                </button>
                <button type="button" aria-label="회전">
                  <RotateCw size={18} aria-hidden="true" />
                </button>
                <button type="button" aria-pressed={compareOpen} onClick={() => setCompareOpen(true)}>
                  <Grid2X2 size={18} aria-hidden="true" />
                  <span>시트 비교</span>
                </button>
              </div>
              )}
            </>
          )}
        </div>

        {hasAside &&
          (measureOpen ? (
            <MeasurePanel
              measureTypes={measureTypes}
              activeMeasureType={activeMeasureType}
              measureRows={measureRows}
              onSelectMeasureType={setActiveMeasureType}
              onCalibrate={() => setCalibrationOpen(true)}
              onClose={closeMeasure}
            />
          ) : selectedMarkup ? (
            <MarkupPropertyPanel markup={selectedMarkup} onClose={() => setSelectedMarkupId(null)} />
          ) : null)}

        <MarkupToolRail activeTool={activeTool} onSelectTool={selectTool} />
      </div>

      <footer className="sheet-filmstrip" aria-label="필름스트립">
        <strong>필름스트립</strong>
        <div>
          {sheets.map((sheet) => (
            <button key={sheet.id} type="button" aria-current={sheet.id === selectedSheet.id ? "page" : undefined}>
              {sheet.number}
            </button>
          ))}
        </div>
      </footer>

      {calibrationOpen && (
        <CalibrationModal onClose={() => setCalibrationOpen(false)} onConfirm={() => setCalibrationOpen(false)} />
      )}
      {compareOpen && (
        <CompareModal
          currentSheet={selectedSheet}
          sheets={sheets}
          sheetB={compareSheetB}
          onSelectB={setCompareSheetB}
          onClose={() => setCompareOpen(false)}
          onCompare={runCompare}
        />
      )}
    </section>
  );
}
