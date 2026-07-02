import { Layers, Loader2, Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchVector, type Issue, type Markup, type Measurement, type VectorData, type VectorUnits } from "../../api/drawings";
import type { MarkupTool, MeasureType } from "./viewerData";
import { distance as dist, measureValue, type Pt } from "./geometry";

const ISSUE_STATUS_COLOR: Record<string, string> = {
  열림: "#e8590c",
  진행중: "#1971c2",
  답변됨: "#2f9e44",
  닫힘: "#868e96"
};

type View = { scale: number; tx: number; ty: number };

/** 진행 중 드로잉 초안(world 좌표). */
type Draft = { tool: MarkupTool; pts: Pt[] } | null;
type TextDraft = { world: Pt; screen: Pt } | null;

const DRAG_TOOLS: MarkupTool[] = ["도형", "클라우드", "펜"];
const SEQ_TOOLS: MarkupTool[] = ["폴리라인", "다각형"];

/** 도구별 기본 색. */
function toolColor(tool: MarkupTool | string): string {
  switch (tool) {
    case "클라우드":
      return "#e8590c";
    case "폴리라인":
      return "#1971c2";
    case "다각형":
      return "#2f9e44";
    case "측정":
      return "#f59f00";
    default:
      return "#d8232a";
  }
}

/**
 * S1.5 ②벡터 렌더러 + S4 마크업/측정 오버레이.
 *
 * 벡터 도면(canvas2D, world 좌표)을 무손실 줌·팬·핏·레이어 토글로 렌더하고,
 * 같은 draw 루프에서 마크업/측정 오버레이를 world→screen 변환으로 함께 그려
 * 줌/핏을 바꿔도 마크업이 도면에 고정된다(좌표계 단일 진실원).
 * 도구가 선택되면 드래그/클릭으로 world 좌표 마크업·측정을 생성한다.
 */
export default function VectorCanvas({
  fileId,
  activeTool = "선택",
  markups = [],
  measurements = [],
  issues = [],
  measureType = "선형",
  selectedMarkupId = null,
  selectedIssueId = null,
  focusPin = null,
  onSelectMarkup,
  onSelectIssue,
  onPlacePin,
  onCommitMarkup,
  onCommitMeasurement,
  onUnits,
}: {
  fileId: string;
  activeTool?: MarkupTool;
  markups?: Markup[];
  measurements?: Measurement[];
  issues?: Issue[];
  measureType?: MeasureType;
  selectedMarkupId?: string | null;
  selectedIssueId?: string | null;
  focusPin?: Pt | null;
  onSelectMarkup?: (id: string | null) => void;
  onSelectIssue?: (id: string | null) => void;
  onPlacePin?: (pt: Pt) => void;
  onCommitMarkup?: (m: { kind: string; geometry: Pt[]; text?: string; color: string }) => void;
  onCommitMeasurement?: (m: { type: MeasureType; geometry: Pt[]; value: number; unit: string }) => void;
  onUnits?: (units: VectorUnits | undefined) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<VectorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showLayers, setShowLayers] = useState(false);
  const [textDraft, setTextDraft] = useState<TextDraft>(null);
  const viewRef = useRef<View>({ scale: 1, tx: 0, ty: 0 });
  const draftRef = useRef<Draft>(null);
  const rafRef = useRef<number | null>(null);

  const isMeasure = activeTool === "측정";
  const isPin = activeTool === "이슈 핀";
  const isDrag = DRAG_TOOLS.includes(activeTool) || (isMeasure && (measureType === "선형" || measureType === "지름"));
  const isSeq = SEQ_TOOLS.includes(activeTool) || (isMeasure && measureType === "다각형 면적");
  const isText = activeTool === "텍스트";
  const isDrawing = isDrag || isSeq || isText;

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    setHidden(new Set());
    fetchVector(fileId)
      .then((d) => {
        if (!alive) return;
        setData(d);
        onUnits?.(d.units);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [fileId, onUnits]);

  // 도구가 바뀌면 진행 중 초안 폐기(도구-상태 일치).
  useEffect(() => {
    draftRef.current = null;
    setTextDraft(null);
  }, [activeTool, measureType]);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth;
    const h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const { scale, tx, ty } = viewRef.current;
    const sx = (x: number) => tx + x * scale;
    const sy = (y: number) => ty - y * scale;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, w, h);
    if (data) {
      for (const f of data.fills) {
        if (hidden.has(f.layer) || f.pts.length < 3) continue;
        ctx.beginPath();
        ctx.moveTo(sx(f.pts[0][0]), sy(f.pts[0][1]));
        for (let i = 1; i < f.pts.length; i++) ctx.lineTo(sx(f.pts[i][0]), sy(f.pts[i][1]));
        ctx.closePath();
        ctx.fillStyle = f.color;
        ctx.fill();
      }
      ctx.lineWidth = 1;
      for (const s of data.strokes) {
        if (hidden.has(s.layer) || s.pts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(sx(s.pts[0][0]), sy(s.pts[0][1]));
        for (let i = 1; i < s.pts.length; i++) ctx.lineTo(sx(s.pts[i][0]), sy(s.pts[i][1]));
        ctx.strokeStyle = s.color;
        ctx.stroke();
      }
    }

    // --- 마크업 오버레이 ---
    for (const m of markups) {
      drawMarkup(ctx, m, sx, sy, m.markup_id === selectedMarkupId);
    }
    // --- 측정 오버레이 ---
    for (const ms of measurements) {
      drawMeasurement(ctx, ms, sx, sy);
    }
    // --- 이슈 핀 오버레이(world 좌표) ---
    for (const it of issues) {
      if (it.pin && it.pin.coord_space === "world") {
        drawIssuePin(ctx, sx(it.pin.point[0]), sy(it.pin.point[1]), it.status, it.issue_id === selectedIssueId);
      }
    }
    // --- 진행 중 초안 ---
    const draft = draftRef.current;
    if (draft && draft.pts.length) {
      drawDraft(ctx, draft, sx, sy);
    }
    ctx.restore();
  }, [data, hidden, markups, measurements, issues, selectedMarkupId, selectedIssueId]);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  const fit = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !data?.bbox) return;
    const [minx, miny, maxx, maxy] = data.bbox;
    const w = cv.clientWidth || 1;
    const h = cv.clientHeight || 1;
    const bw = Math.max(maxx - minx, 1e-6);
    const bh = Math.max(maxy - miny, 1e-6);
    const scale = Math.min(w / bw, h / bh) * 0.95;
    const cx = (minx + maxx) / 2;
    const cy = (miny + maxy) / 2;
    viewRef.current = { scale, tx: w / 2 - cx * scale, ty: h / 2 + cy * scale };
    scheduleDraw();
  }, [data, scheduleDraw]);

  useEffect(() => {
    if (data) fit();
  }, [data, fit]);
  useEffect(() => {
    scheduleDraw();
  }, [hidden, markups, measurements, issues, selectedMarkupId, selectedIssueId, scheduleDraw]);

  // 딥링크: 목록에서 핀 있는 이슈로 점프하면 해당 world 좌표를 화면 중앙으로(줌 유지).
  useEffect(() => {
    if (!focusPin || !data) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const v = viewRef.current;
    v.tx = cv.clientWidth / 2 - focusPin[0] * v.scale;
    v.ty = cv.clientHeight / 2 + focusPin[1] * v.scale;
    scheduleDraw();
  }, [focusPin, data, scheduleDraw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => scheduleDraw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [scheduleDraw]);

  // 줌(휠) — 커서 기준 무손실 확대
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const v = viewRef.current;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const wx = (mx - v.tx) / v.scale;
      const wy = (v.ty - my) / v.scale;
      v.scale *= factor;
      v.tx = mx - wx * v.scale;
      v.ty = my + wy * v.scale;
      scheduleDraw();
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, [scheduleDraw]);

  // 좌표 변환 헬퍼
  const screenToWorld = useCallback((mx: number, my: number): Pt => {
    const v = viewRef.current;
    return [(mx - v.tx) / v.scale, (v.ty - my) / v.scale];
  }, []);
  const worldToScreen = useCallback((p: Pt): Pt => {
    const v = viewRef.current;
    return [v.tx + p[0] * v.scale, v.ty - p[1] * v.scale];
  }, []);

  // --- 포인터 상호작용 ---
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const downRef = useRef<{ sx: number; sy: number; world: Pt } | null>(null);

  function localPos(e: React.PointerEvent): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  function onPointerDown(e: React.PointerEvent) {
    const [mx, my] = localPos(e);
    const world = screenToWorld(mx, my);
    downRef.current = { sx: mx, sy: my, world };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 합성 포인터 등 캡처 불가 시 무시(best-effort) */
    }
    if (isDrag) {
      draftRef.current = { tool: activeTool, pts: [world, world] };
    } else if (activeTool === "선택" || (!isDrawing && !isMeasure)) {
      panRef.current = { x: e.clientX, y: e.clientY };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (panRef.current) {
      viewRef.current.tx += e.clientX - panRef.current.x;
      viewRef.current.ty += e.clientY - panRef.current.y;
      panRef.current = { x: e.clientX, y: e.clientY };
      scheduleDraw();
      return;
    }
    const draft = draftRef.current;
    if (isDrag && draft) {
      const [mx, my] = localPos(e);
      const world = screenToWorld(mx, my);
      if (activeTool === "펜") draft.pts.push(world);
      else draft.pts = [draft.pts[0], world];
      scheduleDraw();
    }
  }

  function commitDrag() {
    const draft = draftRef.current;
    draftRef.current = null;
    if (!draft || draft.pts.length < 2) return scheduleDraw();
    const a = draft.pts[0];
    const b = draft.pts[draft.pts.length - 1];
    if (activeTool === "펜") {
      if (draft.pts.length >= 2) onCommitMarkup?.({ kind: "펜", geometry: draft.pts, color: toolColor("펜") });
    } else if (isMeasure) {
      if (dist(a, b) > 0) emitMeasure([a, b]);
    } else {
      // 도형/클라우드: 두 모서리 bbox. 0크기는 무시.
      if (dist(a, b) > 0) onCommitMarkup?.({ kind: activeTool, geometry: [a, b], color: toolColor(activeTool) });
    }
    scheduleDraw();
  }

  function onPointerUp(e: React.PointerEvent) {
    const down = downRef.current;
    if (panRef.current) {
      panRef.current = null;
      // 거의 움직이지 않았으면 클릭 → 핀 배치(이슈 핀 도구) 또는 선택 히트테스트.
      // down.sx/sy는 로컬 좌표이므로 up도 로컬로 변환해 비교한다(client 혼용 금지).
      const [ux, uy] = localPos(e);
      if (down && Math.hypot(ux - down.sx, uy - down.sy) < 4) {
        if (isPin) onPlacePin?.(down.world);
        else hitTestSelect(down.sx, down.sy);
      }
      downRef.current = null;
      return;
    }
    if (isDrag) {
      commitDrag();
      downRef.current = null;
      return;
    }
    if (isSeq && down) {
      // 클릭으로 정점 추가(드래그면 무시)
      const [mx, my] = localPos(e);
      if (Math.hypot(mx - down.sx, my - down.sy) < 4) {
        const cur = draftRef.current;
        if (cur && cur.tool === activeTool) cur.pts.push(down.world);
        else draftRef.current = { tool: activeTool, pts: [down.world] };
        scheduleDraw();
      }
      downRef.current = null;
      return;
    }
    if (isText && down) {
      const [mx, my] = localPos(e);
      if (Math.hypot(mx - down.sx, my - down.sy) < 4) {
        setTextDraft({ world: down.world, screen: [mx, my] });
      }
    }
    downRef.current = null;
  }

  function hitTestSelect(mx: number, my: number) {
    // 이슈 핀 우선(작은 타겟). world 핀만 이 캔버스 대상.
    for (let i = issues.length - 1; i >= 0; i--) {
      const it = issues[i];
      if (!it.pin || it.pin.coord_space !== "world") continue;
      const [px, py] = worldToScreen(it.pin.point as Pt);
      // 핀은 tip=(px,py), 원형 헤드는 그 위(py-14). 두 지점 모두 너그럽게 히트.
      if (Math.hypot(mx - px, my - py) < 14 || Math.hypot(mx - px, my - (py - 14)) < 13) {
        onSelectIssue?.(it.issue_id);
        onSelectMarkup?.(null);
        return;
      }
    }
    if (onSelectMarkup) {
      // 위에서부터(나중에 그린 것 우선) bbox 히트테스트
      for (let i = markups.length - 1; i >= 0; i--) {
        const m = markups[i];
        const scr = m.geometry.map(worldToScreen);
        const xs = scr.map((p) => p[0]);
        const ys = scr.map((p) => p[1]);
        const pad = 8;
        if (mx >= Math.min(...xs) - pad && mx <= Math.max(...xs) + pad &&
            my >= Math.min(...ys) - pad && my <= Math.max(...ys) + pad) {
          onSelectMarkup(m.markup_id);
          onSelectIssue?.(null);
          return;
        }
      }
    }
    onSelectMarkup?.(null);
    onSelectIssue?.(null);
  }

  function onDoubleClick() {
    const draft = draftRef.current;
    if (!isSeq || !draft) return;
    // 더블클릭 마지막 중복 정점 정리
    const pts = collapseDuplicates(draft.pts, worldToScreen);
    draftRef.current = null;
    if (isMeasure) {
      if (pts.length >= 3) emitMeasure(pts);
    } else if (activeTool === "폴리라인") {
      if (pts.length >= 2) onCommitMarkup?.({ kind: "폴리라인", geometry: pts, color: toolColor("폴리라인") });
    } else if (activeTool === "다각형") {
      if (pts.length >= 3) onCommitMarkup?.({ kind: "다각형", geometry: pts, color: toolColor("다각형") });
    }
    scheduleDraw();
  }

  function emitMeasure(pts: Pt[]) {
    const toMeter = data?.units?.to_meter ?? null;
    const unitName = data?.units?.name ?? "unit";
    const { geometry, value, unit } = measureValue(measureType, pts, toMeter, unitName);
    onCommitMeasurement?.({ type: measureType, geometry, value, unit });
  }

  function commitText(value: string) {
    const td = textDraft;
    setTextDraft(null);
    if (td && value.trim()) {
      onCommitMarkup?.({ kind: "텍스트", geometry: [td.world], text: value.trim(), color: toolColor("텍스트") });
    }
  }

  function zoomAtCenter(factor: number) {
    const cv = canvasRef.current;
    if (!cv) return;
    const mx = cv.clientWidth / 2;
    const my = cv.clientHeight / 2;
    const v = viewRef.current;
    const wx = (mx - v.tx) / v.scale;
    const wy = (v.ty - my) / v.scale;
    v.scale *= factor;
    v.tx = mx - wx * v.scale;
    v.ty = my + wy * v.scale;
    scheduleDraw();
  }

  function toggleLayer(layer: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  const cursor = isDrawing || isMeasure || isPin ? "crosshair" : "grab";

  return (
    <div className="vector-viewer" ref={wrapRef} aria-label="벡터 도면 렌더">
      <canvas
        ref={canvasRef}
        className="vector-canvas"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={(e) => {
          if (isDrag) commitDrag();
          panRef.current = null;
          downRef.current = null;
          void e;
        }}
        onDoubleClick={onDoubleClick}
      />
      {textDraft ? (
        <input
          className="vector-text-input"
          autoFocus
          aria-label="텍스트 마크업 입력"
          style={{ left: textDraft.screen[0], top: textDraft.screen[1] }}
          defaultValue=""
          onKeyDown={(e) => {
            if (e.key === "Enter") commitText((e.target as HTMLInputElement).value);
            else if (e.key === "Escape") setTextDraft(null);
          }}
          onBlur={(e) => commitText(e.target.value)}
        />
      ) : null}

      {!data && !error ? (
        <div className="vector-status" role="status">
          <Loader2 size={28} className="spin" aria-hidden="true" />
          <span>벡터 로딩 중...</span>
        </div>
      ) : null}
      {error ? (
        <div className="vector-status vector-error" role="alert">
          <span>벡터 렌더 불가: {error}</span>
        </div>
      ) : null}

      {data ? (
        <div className="vector-controls" aria-label="벡터 뷰어 컨트롤">
          <button type="button" aria-label="축소" onClick={() => zoomAtCenter(1 / 1.2)}>
            <Minus size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="확대" onClick={() => zoomAtCenter(1.2)}>
            <Plus size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="맞춤" onClick={fit}>
            <Maximize2 size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="레이어" aria-pressed={showLayers} onClick={() => setShowLayers((s) => !s)}>
            <Layers size={18} aria-hidden="true" />
            <span>레이어 {data.layers.length}</span>
          </button>
        </div>
      ) : null}

      {data && showLayers ? (
        <div className="vector-layers" aria-label="레이어 토글">
          <strong>레이어</strong>
          <ul>
            {data.layers.map((layer) => (
              <li key={layer}>
                <label>
                  <input type="checkbox" checked={!hidden.has(layer)} onChange={() => toggleLayer(layer)} />
                  {layer}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 캔버스 렌더 헬퍼 (world→screen 변환 sx/sy 주입)
// ---------------------------------------------------------------------------

type Proj = (n: number) => number;

function strokePath(ctx: CanvasRenderingContext2D, pts: Pt[], sx: Proj, sy: Proj, close: boolean) {
  ctx.beginPath();
  ctx.moveTo(sx(pts[0][0]), sy(pts[0][1]));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(sx(pts[i][0]), sy(pts[i][1]));
  if (close) ctx.closePath();
}

function rectFrom(a: Pt, b: Pt, sx: Proj, sy: Proj) {
  const x0 = sx(a[0]);
  const y0 = sy(a[1]);
  const x1 = sx(b[0]);
  const y1 = sy(b[1]);
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

/** 리비전 클라우드: 사각형 둘레를 따라 작은 호(scallop)를 그린다. */
function drawCloud(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }) {
  const bump = 8;
  ctx.beginPath();
  const edges: [number, number, number, number][] = [
    [r.x, r.y, r.x + r.w, r.y],
    [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
    [r.x + r.w, r.y + r.h, r.x, r.y + r.h],
    [r.x, r.y + r.h, r.x, r.y],
  ];
  for (const [x0, y0, x1, y1] of edges) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / (bump * 2)));
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const mx = x0 + (x1 - x0) * ((t0 + t1) / 2);
      const my = y0 + (y1 - y0) * ((t0 + t1) / 2);
      ctx.moveTo(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0);
      ctx.arcTo(mx, my, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1, bump);
    }
  }
  ctx.stroke();
}

function drawMarkup(ctx: CanvasRenderingContext2D, m: Markup, sx: Proj, sy: Proj, selected: boolean) {
  const color = m.style?.color || "#d8232a";
  const width = (m.style?.width || 2) * (selected ? 1.6 : 1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = m.style?.opacity ?? 1;
  const pts = m.geometry;
  if (!pts || pts.length === 0) {
    ctx.restore();
    return;
  }
  if (m.kind === "텍스트") {
    const x = sx(pts[0][0]);
    const y = sy(pts[0][1]);
    ctx.font = "14px 'Malgun Gothic', sans-serif";
    const text = m.text || "텍스트";
    const w = ctx.measureText(text).width;
    // 가독성: 도면 위에서도 읽히도록 흰 배경 박스 + 얇은 색 테두리 위에 색 텍스트
    ctx.globalAlpha = m.style?.opacity ?? 1;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(x - 4, y - 18, w + 8, 22);
    ctx.strokeRect(x - 4, y - 18, w + 8, 22);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y - 2);
  } else if (m.kind === "도형") {
    const r = rectFrom(pts[0], pts[1] || pts[0], sx, sy);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  } else if (m.kind === "클라우드") {
    drawCloud(ctx, rectFrom(pts[0], pts[1] || pts[0], sx, sy));
  } else if (m.kind === "다각형") {
    strokePath(ctx, pts, sx, sy, true);
    ctx.globalAlpha = 0.12;
    ctx.fill();
    ctx.globalAlpha = m.style?.opacity ?? 1;
    ctx.stroke();
  } else {
    // 폴리라인 / 펜
    strokePath(ctx, pts, sx, sy, false);
    ctx.stroke();
  }
  if (selected) {
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    const scr = pts.map((p) => [sx(p[0]), sy(p[1])] as Pt);
    const xs = scr.map((p) => p[0]);
    const ys = scr.map((p) => p[1]);
    ctx.strokeRect(Math.min(...xs) - 6, Math.min(...ys) - 6, Math.max(...xs) - Math.min(...xs) + 12, Math.max(...ys) - Math.min(...ys) + 12);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawMeasurement(ctx: CanvasRenderingContext2D, ms: Measurement, sx: Proj, sy: Proj) {
  const color = "#f59f00";
  const pts = ms.geometry;
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  const closed = ms.type === "다각형 면적";
  strokePath(ctx, pts, sx, sy, closed);
  ctx.stroke();
  // 끝점 마커
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(sx(p[0]), sy(p[1]), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 라벨
  const cx = pts.reduce((s, p) => s + sx(p[0]), 0) / pts.length;
  const cy = pts.reduce((s, p) => s + sy(p[1]), 0) / pts.length;
  const label = `${ms.value.toFixed(2)} ${ms.unit}`;
  ctx.font = "12px 'Malgun Gothic', sans-serif";
  const w = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(cx - w / 2 - 4, cy - 9, w + 8, 16);
  ctx.fillStyle = "#ffd43b";
  ctx.fillText(label, cx - w / 2, cy + 3);
  ctx.restore();
}

/** 이슈 핀: tip이 (x,y)를 가리키는 물방울 마커 + 상태색. 선택 시 흰 링 강조. */
function drawIssuePin(ctx: CanvasRenderingContext2D, x: number, y: number, status: string, selected: boolean) {
  const color = ISSUE_STATUS_COLOR[status] || "#e8590c";
  const r = selected ? 9 : 7;
  const cy = y - r * 2; // 헤드 중심
  ctx.save();
  // tip → 헤드 물방울
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - r * 0.8, cy + r * 0.55);
  ctx.arc(x, cy, r, Math.PI * 0.8, Math.PI * 0.2, false);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = selected ? 2.5 : 1.5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  // 헤드 내부 점
  ctx.beginPath();
  ctx.arc(x, cy, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  if (selected) {
    ctx.beginPath();
    ctx.arc(x, cy, r + 4, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffd43b";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

function drawDraft(ctx: CanvasRenderingContext2D, draft: { tool: MarkupTool; pts: Pt[] }, sx: Proj, sy: Proj) {
  const color = toolColor(draft.tool === "측정" ? "측정" : draft.tool);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  const pts = draft.pts;
  if (draft.tool === "도형") {
    const r = rectFrom(pts[0], pts[pts.length - 1], sx, sy);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  } else if (draft.tool === "클라우드") {
    ctx.setLineDash([]);
    drawCloud(ctx, rectFrom(pts[0], pts[pts.length - 1], sx, sy));
  } else if (pts.length >= 2) {
    strokePath(ctx, pts, sx, sy, false);
    ctx.stroke();
  }
  // 정점 점
  ctx.setLineDash([]);
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(sx(p[0]), sy(p[1]), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 더블클릭 시 연속 중복(화면상 3px 이내) 정점 제거. */
function collapseDuplicates(pts: Pt[], toScreen: (p: Pt) => Pt): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    if (out.length === 0) {
      out.push(p);
      continue;
    }
    const a = toScreen(out[out.length - 1]);
    const b = toScreen(p);
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 3) out.push(p);
  }
  return out;
}
