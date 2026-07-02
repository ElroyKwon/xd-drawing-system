import { useEffect, useRef, useState } from "react";
import type { Sheet } from "../../buildSheetsData";
import type { Issue, Markup } from "../../api/drawings";
import type { MarkupTool } from "./viewerData";

type Pt = [number, number];

const DRAG_TOOLS: MarkupTool[] = ["도형", "클라우드", "펜"];
const SEQ_TOOLS: MarkupTool[] = ["폴리라인", "다각형"];

const ISSUE_STATUS_COLOR: Record<string, string> = {
  열림: "#e8590c",
  진행중: "#1971c2",
  답변됨: "#2f9e44",
  닫힘: "#868e96"
};

function toolColor(tool: MarkupTool | string): string {
  switch (tool) {
    case "클라우드":
      return "#e8590c";
    case "폴리라인":
      return "#1971c2";
    case "다각형":
      return "#2f9e44";
    default:
      return "#d8232a";
  }
}

function pct(p: Pt): { x: string; y: string } {
  return { x: `${p[0] * 100}%`, y: `${p[1] * 100}%` };
}

function bbox(pts: Pt[]) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

function MarkupGlyph({ markup, selected }: { markup: Markup; selected: boolean }) {
  const color = markup.style?.color || "#d8232a";
  const pts = markup.geometry;
  if (!pts.length) return null;
  const sw = 0.4; // SVG viewBox 0..100 기준 선 두께
  const scaled = pts.map((p) => [p[0] * 100, p[1] * 100] as Pt);
  const pointsAttr = scaled.map((p) => `${p[0]},${p[1]}`).join(" ");
  const common = { stroke: color, strokeWidth: selected ? sw * 1.8 : sw, fill: "none", vectorEffect: "non-scaling-stroke" as const };

  if (markup.kind === "텍스트") {
    return (
      <text x={scaled[0][0]} y={scaled[0][1]} fill={color} fontSize="3"
        stroke="#fff" strokeWidth={1} strokeLinejoin="round"
        style={{ paintOrder: "stroke" }}>
        {markup.text || "텍스트"}
      </text>
    );
  }
  if (markup.kind === "도형" || markup.kind === "클라우드") {
    const b = bbox(scaled);
    return (
      <rect
        x={b.x}
        y={b.y}
        width={b.w}
        height={b.h}
        rx={markup.kind === "클라우드" ? 2 : 0}
        strokeDasharray={markup.kind === "클라우드" ? "2 1.4" : undefined}
        {...common}
      />
    );
  }
  if (markup.kind === "다각형") {
    return <polygon points={pointsAttr} {...common} fill={color} fillOpacity={0.12} />;
  }
  return <polyline points={pointsAttr} {...common} />;
}

export default function MarkupCanvas({
  selectedSheet,
  markups,
  issues = [],
  activeTool,
  selectedMarkupId,
  selectedIssueId = null,
  onSelectMarkup,
  onSelectIssue,
  onPlacePin,
  onCommitMarkup
}: {
  selectedSheet: Sheet;
  markups: Markup[];
  issues?: Issue[];
  activeTool: MarkupTool;
  selectedMarkupId: string | null;
  selectedIssueId?: string | null;
  onSelectMarkup: (id: string | null) => void;
  onSelectIssue?: (id: string | null) => void;
  onPlacePin?: (pt: Pt) => void;
  onCommitMarkup: (m: { kind: string; geometry: Pt[]; text?: string; color: string }) => void;
}) {
  const hasImage = Boolean(selectedSheet.imageUrl);
  const svgRef = useRef<SVGSVGElement>(null);
  // 진행 중 초안은 ref가 진실원(단일 제스처 내 stale 클로저 방지). tick은 미리보기 리렌더용.
  const draftRef = useRef<Pt[]>([]);
  const [, setTick] = useState(0);
  const [textDraft, setTextDraft] = useState<Pt | null>(null);
  const downRef = useRef<{ x: number; y: number; n: Pt } | null>(null);

  const isDrag = DRAG_TOOLS.includes(activeTool);
  const isSeq = SEQ_TOOLS.includes(activeTool);
  const isText = activeTool === "텍스트";
  const isPin = activeTool === "이슈 핀";
  const drawing = isDrag || isSeq || isText;
  const imagePins = issues.filter((i) => i.pin && i.pin.coord_space === "image");

  function setDraft(pts: Pt[]) {
    draftRef.current = pts;
    setTick((t) => t + 1);
  }

  // 도구가 바뀌면 진행 중 초안 폐기.
  useEffect(() => {
    draftRef.current = [];
    setTextDraft(null);
  }, [activeTool]);

  function toNorm(e: React.PointerEvent): Pt {
    const rect = svgRef.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    ];
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!hasImage) return;
    const n = toNorm(e);
    downRef.current = { x: e.clientX, y: e.clientY, n };
    if (isDrag) {
      setDraft([n, n]);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* 합성 포인터 등 캡처 불가 시 무시(best-effort) */
      }
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!isDrag || !downRef.current) return;
    const n = toNorm(e);
    const prev = draftRef.current;
    setDraft(activeTool === "펜" ? [...prev, n] : [prev[0] || n, n]);
  }

  function onPointerUp(e: React.PointerEvent) {
    const down = downRef.current;
    downRef.current = null;
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (isDrag) {
      const pts = draftRef.current;
      setDraft([]);
      if (pts.length >= 2 && moved > 3) {
        onCommitMarkup({ kind: activeTool, geometry: activeTool === "펜" ? pts : [pts[0], pts[pts.length - 1]], color: toolColor(activeTool) });
      }
      return;
    }
    if (moved >= 4) return; // 드래그는 클릭으로 보지 않음
    if (isSeq) {
      setDraft([...draftRef.current, down.n]);
    } else if (isText) {
      setTextDraft(down.n);
    } else if (isPin) {
      onPlacePin?.(down.n);
    } else {
      // 선택: 히트테스트
      hitTest(down.n);
    }
  }

  function onDoubleClick() {
    const pts = draftRef.current;
    if (!isSeq || pts.length < 2) {
      setDraft([]);
      return;
    }
    setDraft([]);
    if (activeTool === "다각형" && pts.length >= 3) {
      onCommitMarkup({ kind: "다각형", geometry: pts, color: toolColor("다각형") });
    } else if (activeTool === "폴리라인") {
      onCommitMarkup({ kind: "폴리라인", geometry: pts, color: toolColor("폴리라인") });
    }
  }

  function hitTest(n: Pt) {
    // 이슈 핀 우선(작은 타겟). 정규화 좌표 거리.
    for (let i = imagePins.length - 1; i >= 0; i--) {
      const p = imagePins[i].pin!.point;
      if (Math.hypot(n[0] - p[0], n[1] - p[1]) < 0.025) {
        onSelectIssue?.(imagePins[i].issue_id);
        onSelectMarkup(null);
        return;
      }
    }
    for (let i = markups.length - 1; i >= 0; i--) {
      const b = bbox(markups[i].geometry);
      const pad = 0.02;
      if (n[0] >= b.x - pad && n[0] <= b.x + b.w + pad && n[1] >= b.y - pad && n[1] <= b.y + b.h + pad) {
        onSelectMarkup(markups[i].markup_id);
        onSelectIssue?.(null);
        return;
      }
    }
    onSelectMarkup(null);
    onSelectIssue?.(null);
  }

  function commitText(value: string) {
    const td = textDraft;
    setTextDraft(null);
    if (td && value.trim()) {
      onCommitMarkup({ kind: "텍스트", geometry: [td], text: value.trim(), color: toolColor("텍스트") });
    }
  }

  if (!hasImage) {
    return (
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
    );
  }

  return (
    <div className="static-sheet has-image" aria-label="도면 렌더">
      <div className="markup-stage">
        <img className="sheet-render-image" src={selectedSheet.imageUrl} alt={`${selectedSheet.number} 도면 렌더`} draggable={false} />
        <svg
          ref={svgRef}
          className="markup-overlay"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ cursor: drawing || isPin ? "crosshair" : "default" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDoubleClick}
          aria-label="마크업 오버레이"
        >
          {markups.map((m) => (
            <g key={m.markup_id} className="markup-glyph" data-kind={m.kind}>
              <MarkupGlyph markup={m} selected={m.markup_id === selectedMarkupId} />
            </g>
          ))}
          {imagePins.map((issue) => {
            const p = issue.pin!.point;
            const cx = p[0] * 100;
            const cy = p[1] * 100;
            const selected = issue.issue_id === selectedIssueId;
            const color = ISSUE_STATUS_COLOR[issue.status] ?? "#e8590c";
            return (
              <g key={issue.issue_id} className="issue-pin-glyph" data-status={issue.status}>
                <path
                  d={`M ${cx} ${cy} C ${cx - 2.2} ${cy - 2.6}, ${cx - 2.2} ${cy - 5.4}, ${cx} ${cy - 5.4} C ${cx + 2.2} ${cy - 5.4}, ${cx + 2.2} ${cy - 2.6}, ${cx} ${cy} Z`}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth={selected ? 0.7 : 0.4}
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={cx} cy={cy - 4} r={selected ? 1.6 : 1.2} fill="#ffffff" />
                {selected ? (
                  <circle cx={cx} cy={cy - 4} r={3.4} fill="none" stroke="#ffd43b" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
                ) : null}
              </g>
            );
          })}
          {draftRef.current.length >= 2 && (
            <polyline
              points={draftRef.current.map((p) => `${p[0] * 100},${p[1] * 100}`).join(" ")}
              stroke={toolColor(activeTool)}
              strokeWidth={0.5}
              strokeDasharray="2 1.5"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        {textDraft ? (
          <input
            className="markup-text-input"
            autoFocus
            aria-label="텍스트 마크업 입력"
            style={{ left: `${textDraft[0] * 100}%`, top: `${textDraft[1] * 100}%` }}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText((e.target as HTMLInputElement).value);
              else if (e.key === "Escape") setTextDraft(null);
            }}
            onBlur={(e) => commitText(e.target.value)}
          />
        ) : null}
      </div>
    </div>
  );
}
