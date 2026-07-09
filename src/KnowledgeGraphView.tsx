// ④ 지식그래프 전용 뷰 — canvas force 그래프(xg-web web/nms.js 이식, 결정적 kgForce.layout).
// 노드 색=type, 엣지 track=curated 실선·llm 점선(미검증), 클릭=인스펙트.

import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchGraph, type KgGraph, type KgNode } from "./api/kg";
import { layout, type Pos } from "./kgForce";

const TYPE_COLOR: Record<string, string> = {
  equipment: "#2563eb",
  sheet: "#059669",
  issue: "#dc2626",
  task: "#d97706",
  file: "#6b7280",
  tag: "#7c3aed",
  note: "#0891b2",
};

const W = 900;
const H = 640;

type KnowledgeGraphViewProps = {
  projectName: string;
  onBack: () => void;
};

export default function KnowledgeGraphView({ projectName, onBack }: KnowledgeGraphViewProps) {
  const [graph, setGraph] = useState<KgGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KgNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let live = true;
    fetchGraph(projectName)
      .then((g) => { if (live) setGraph(g); })
      .catch((e) => { if (live) setError(String(e)); });
    return () => { live = false; };
  }, [projectName]);

  const pos: Pos = useMemo(
    () => (graph ? layout(graph.nodes, graph.edges, W, H, 200) : {}),
    [graph],
  );

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !graph) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (const e of graph.edges) {
      const a = pos[e.src], b = pos[e.dst];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = e.track === "llm" ? "rgba(120,120,120,0.5)" : "rgba(60,60,60,0.7)";
      ctx.setLineDash(e.track === "llm" ? [4, 4] : []);
      ctx.lineWidth = e.confidence < 0.7 ? 0.6 : 1.2;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const nd of graph.nodes) {
      const p = pos[nd.id];
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = TYPE_COLOR[nd.type] || "#374151";
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.font = "11px sans-serif";
      ctx.fillText(nd.label, p.x + 8, p.y + 3);
    }
  }, [graph, pos]);

  function onCanvasClick(ev: React.MouseEvent<HTMLCanvasElement>) {
    if (!graph) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    const hit = graph.nodes.find((nd) => {
      const p = pos[nd.id];
      return p && Math.hypot(p.x - x, p.y - y) <= 8;
    });
    setSelected(hit || null);
  }

  return (
    <section className="kg-view">
      <header className="build-topbar">
        <div className="build-context">
          <button className="ghost-action" type="button" onClick={onBack}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>뒤로</span>
          </button>
          <div className="project-context-stack">
            <span className="level-kicker">지식그래프</span>
            <strong>{projectName}</strong>
          </div>
        </div>
        {graph && (
          <span>
            노드 {graph.nodes.length} · 엣지 {graph.edges.length}
          </span>
        )}
      </header>

      {error && <p role="alert">불러오기 실패: {error}</p>}

      <div className="kg-legend">
        {Object.entries(TYPE_COLOR).map(([t, c]) => (
          <span key={t} style={{ color: c }}>● {t}</span>
        ))}
        <span>— curated 실선 · llm 점선(미검증)</span>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={onCanvasClick}
        style={{ border: "1px solid #e5e7eb", cursor: "pointer" }}
      />

      {selected && (
        <aside className="kg-inspect">
          <strong>{selected.label}</strong> <em>{selected.type}</em>
          {selected.ref_id && <div>ref: {selected.ref_id}</div>}
        </aside>
      )}
    </section>
  );
}
