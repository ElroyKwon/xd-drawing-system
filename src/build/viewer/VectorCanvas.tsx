import { Layers, Loader2, Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchVector, type VectorData } from "../../api/drawings";

type View = { scale: number; tx: number; ty: number };

/**
 * S1.5 ②오픈소스 벡터 렌더러 (canvas2D, 비종속).
 *
 * 백엔드 `/vector` JSON(폴리라인·채움)을 무손실 줌·팬·핏·레이어 토글로 렌더한다.
 * CAD 모델공간 관습에 따라 어두운 배경을 써서 흰/시안 등 추출 색상이 모두 보인다.
 * 좌표계: world(x↑) → screen(y↓) 변환(sx = tx + x·scale, sy = ty − y·scale).
 */
export default function VectorCanvas({ fileId }: { fileId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<VectorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showLayers, setShowLayers] = useState(false);
  const viewRef = useRef<View>({ scale: 1, tx: 0, ty: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    setHidden(new Set());
    fetchVector(fileId)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [fileId]);

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
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, w, h);
    if (data) {
      const { scale, tx, ty } = viewRef.current;
      const sx = (x: number) => tx + x * scale;
      const sy = (y: number) => ty - y * scale;
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
    ctx.restore();
  }, [data, hidden]);

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

  // 데이터 도착 시 핏
  useEffect(() => {
    if (data) fit();
  }, [data, fit]);
  // 레이어 토글 시 재렌더
  useEffect(() => {
    scheduleDraw();
  }, [hidden, scheduleDraw]);

  // 리사이즈 추적
  useEffect(() => {
    const ro = new ResizeObserver(() => scheduleDraw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [scheduleDraw]);

  // 줌(휠) — passive:false로 스크롤 차단하고 커서 기준 무손실 확대
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

  // 팬(드래그)
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    dragRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const dr = dragRef.current;
    if (!dr) return;
    viewRef.current.tx += e.clientX - dr.x;
    viewRef.current.ty += e.clientY - dr.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    scheduleDraw();
  }
  function endPan() {
    dragRef.current = null;
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

  return (
    <div className="vector-viewer" ref={wrapRef} aria-label="벡터 도면 렌더">
      <canvas
        ref={canvasRef}
        className="vector-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerLeave={endPan}
      />
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
                  <input
                    type="checkbox"
                    checked={!hidden.has(layer)}
                    onChange={() => toggleLayer(layer)}
                  />
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
