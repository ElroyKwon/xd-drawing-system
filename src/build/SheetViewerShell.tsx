import {
  ArrowLeft,
  Download,
  Grid2X2,
  Maximize2,
  MessageSquare,
  Move,
  MousePointer2,
  Pencil,
  Ruler,
  Square,
  Type
} from "lucide-react";
import { useState } from "react";
import type { Sheet } from "../buildSheetsData";

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
  const [activePanel, setActivePanel] = useState<"마크업" | "이슈">("마크업");

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

      <div className="viewer-grid">
        <aside className="viewer-panel">
          <div className="viewer-panel-tabs" role="tablist" aria-label="뷰어 패널">
            <button type="button" role="tab" aria-selected={activePanel === "마크업"} onClick={() => setActivePanel("마크업")}>
              마크업
            </button>
            <button type="button" role="tab" aria-selected={activePanel === "이슈"} onClick={() => setActivePanel("이슈")}>
              이슈
            </button>
          </div>
          {activePanel === "마크업" ? (
            <div className="viewer-panel-body">
              <Pencil size={20} aria-hidden="true" />
              <strong>마크업 없음</strong>
              <span>펜, 도형, 화살표, 검색 affordance만 표시합니다.</span>
            </div>
          ) : (
            <div className="viewer-panel-body">
              <MessageSquare size={20} aria-hidden="true" />
              <strong>이슈 없음</strong>
              <span>핀, 상세 필드, 댓글, 활동 로그 affordance만 표시합니다.</span>
            </div>
          )}
        </aside>

        <div className="viewer-stage">
          <div className="static-sheet" aria-label="정적 시트 렌더">
            <span>정적 시트 렌더</span>
            <div className="drawing-title">{selectedSheet.number}</div>
            <div className="drawing-gridline vertical-one" />
            <div className="drawing-gridline vertical-two" />
            <div className="drawing-gridline horizontal-one" />
            <div className="drawing-gridline horizontal-two" />
            <div className="drawing-room room-large" />
            <div className="drawing-room room-small" />
            <div className="drawing-callout">A</div>
          </div>
          <div className="viewer-bottom-controls" aria-label="뷰어 하단 컨트롤">
            <button type="button" aria-label="선택">
              <MousePointer2 size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-label="이동">
              <Move size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-label="맞춤">
              <Maximize2 size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-label="측정">
              <Ruler size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-label="시트 비교">
              <Grid2X2 size={18} aria-hidden="true" />
              <span>시트 비교</span>
            </button>
          </div>
        </div>

        <aside className="viewer-tool-rail" aria-label="뷰어 도구">
          <button type="button" aria-label="텍스트">
            <Type size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="도형">
            <Square size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="펜">
            <Pencil size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="이슈 핀">
            <MessageSquare size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="측정 도구">
            <Ruler size={18} aria-hidden="true" />
          </button>
        </aside>
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
    </section>
  );
}
