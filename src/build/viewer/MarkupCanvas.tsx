import type { Sheet } from "../../buildSheetsData";
import type { DemoIssuePin, DemoMarkup } from "./viewerData";

function MarkupShape({ markup }: { markup: DemoMarkup }) {
  // SVG 기반(폴리라인·도형·다각형)은 viewBox 0~100 내부 좌표로 그린다.
  if (markup.kind === "텍스트") {
    return (
      <span className="demo-markup-text" style={{ borderColor: markup.color, color: markup.color }}>
        {markup.label}
      </span>
    );
  }
  if (markup.kind === "클라우드") {
    return <span className="demo-markup-cloud" style={{ borderColor: markup.color }} aria-hidden="true" />;
  }
  return (
    <svg className="demo-markup-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {markup.kind === "폴리라인" && (
        <polyline
          points="4,80 30,40 56,62 92,18"
          fill="none"
          stroke={markup.color}
          strokeWidth="6"
          markerEnd="url(#arrow)"
        />
      )}
      {markup.kind === "도형" && (
        <polygon points="50,8 92,92 8,92" fill="none" stroke={markup.color} strokeWidth="6" />
      )}
      {markup.kind === "다각형" && (
        <polygon
          points="10,18 78,6 94,60 52,94 8,70"
          fill={markup.color}
          fillOpacity="0.12"
          stroke={markup.color}
          strokeWidth="4"
          strokeDasharray="8 6"
        />
      )}
    </svg>
  );
}

export default function MarkupCanvas({
  selectedSheet,
  markups,
  issuePins,
  selectedMarkupId,
  onSelectMarkup
}: {
  selectedSheet: Sheet;
  markups: DemoMarkup[];
  issuePins: DemoIssuePin[];
  selectedMarkupId: string | null;
  onSelectMarkup: (id: string) => void;
}) {
  // S1: 업로드·변환된 실제 도면이면 PNG를 렌더하고, 정적 시드면 기존 데모 외관을 유지한다.
  const hasImage = Boolean(selectedSheet.imageUrl);

  return (
    <div className={`static-sheet${hasImage ? " has-image" : ""}`} aria-label={hasImage ? "도면 렌더" : "정적 시트 렌더"}>
      {hasImage ? (
        <img className="sheet-render-image" src={selectedSheet.imageUrl} alt={`${selectedSheet.number} 도면 렌더`} />
      ) : (
        <>
          <span>정적 시트 렌더</span>
          <div className="drawing-title">{selectedSheet.number}</div>
          <div className="drawing-gridline vertical-one" />
          <div className="drawing-gridline vertical-two" />
          <div className="drawing-gridline horizontal-one" />
          <div className="drawing-gridline horizontal-two" />
          <div className="drawing-room room-large" />
          <div className="drawing-room room-small" />
          <div className="drawing-callout">A</div>
        </>
      )}

      <svg width="0" height="0" aria-hidden="true">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
      </svg>

      {markups.map((markup) => (
        <button
          key={markup.id}
          type="button"
          className="demo-markup"
          data-kind={markup.kind}
          aria-label={`${markup.kind} 마크업: ${markup.label}`}
          aria-pressed={selectedMarkupId === markup.id}
          style={{
            left: `${markup.left}%`,
            top: `${markup.top}%`,
            width: `${markup.width}%`,
            height: `${markup.height}%`,
            color: markup.color
          }}
          onClick={() => onSelectMarkup(markup.id)}
        >
          <MarkupShape markup={markup} />
        </button>
      ))}

      {issuePins.map((pin) => (
        <span
          key={pin.id}
          className="demo-issue-pin"
          style={{ left: `${pin.left}%`, top: `${pin.top}%` }}
          aria-label={`이슈 핀 ${pin.label} (${pin.category})`}
        >
          {pin.label}
        </span>
      ))}
    </div>
  );
}
