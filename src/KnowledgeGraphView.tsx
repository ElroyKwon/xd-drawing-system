// ④ 지식그래프 전용 뷰 — react-force-graph-2d 물리 시뮬레이션(Neo4j 브라우저式).
// 노드 색=type, 엣지 track=curated 실선·llm 점선(미검증). 노드 드래그·휠 줌·팬 내장.
// llm 엣지 클릭 → 확인(승격)/거부(숨김) write-back.

import { ArrowLeft, Info, Maximize2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { confirmEdge, fetchGraph, rejectEdge, type KgEdge, type KgGraph, type KgNode } from "./api/kg";

const TYPE_COLOR: Record<string, string> = {
  equipment: "#2563eb",
  sheet: "#059669",
  issue: "#dc2626",
  task: "#d97706",
  file: "#6b7280",
  tag: "#7c3aed",
  note: "#0891b2",
};

const TYPE_LABEL: Record<string, string> = {
  equipment: "설비",
  sheet: "시트",
  issue: "이슈",
  task: "작업",
  file: "파일",
  tag: "태그",
  note: "노트",
};

type KnowledgeGraphViewProps = {
  projectName: string;
  onBack: () => void;
};

export default function KnowledgeGraphView({ projectName, onBack }: KnowledgeGraphViewProps) {
  const [graph, setGraph] = useState<KgGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<KgNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<KgEdge | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [dims, setDims] = useState({ w: 1200, h: 680 });

  useEffect(() => {
    let live = true;
    setError(null);
    setGraph(null);
    setSelected(null);
    setSelectedEdge(null);
    fetchGraph(projectName)
      .then((g) => { if (live) setGraph(g); })
      .catch((e) => { if (live) setError(String(e)); });
    return () => { live = false; };
  }, [projectName]);

  const reload = () => {
    fetchGraph(projectName)
      .then((g) => setGraph(g))
      .catch((e) => setError(String(e)));
  };

  // KgGraph → force-graph 데이터(노드 name=라벨, 링크 source/target=엣지 양끝).
  const data = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    return {
      nodes: graph.nodes.map((n) => ({ ...n, name: n.label })),
      links: graph.edges.map((e) => ({
        source: e.src, target: e.dst, type: e.type, track: e.track,
        confidence: e.confidence, evidence: e.evidence ?? null,
      })),
    };
  }, [graph]);

  // 컨테이너 폭에 맞춰 캔버스 크기(반응형).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setDims({ w: el.clientWidth || 1200, h: 680 });
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onLinkClick(link: any) {
    setSelected(null);
    const src = typeof link.source === "object" ? link.source.id : link.source;
    const dst = typeof link.target === "object" ? link.target.id : link.target;
    setSelectedEdge({
      src, dst, type: link.type, track: link.track,
      confidence: link.confidence, evidence: link.evidence ?? null,
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onNodeClick(node: any) {
    setSelectedEdge(null);
    setSelected(node);
  }

  function fitAll() {
    if (fgRef.current) fgRef.current.zoomToFit(400, 50);
  }

  async function onConfirm() {
    if (!selectedEdge) return;
    try {
      await confirmEdge(projectName, selectedEdge.src, selectedEdge.dst);
      setSelectedEdge(null);
      reload();
    } catch (e) {
      setError(String(e));
    }
  }

  async function onReject() {
    if (!selectedEdge) return;
    try {
      await rejectEdge(projectName, selectedEdge.src, selectedEdge.dst);
      setSelectedEdge(null);
      reload();
    } catch (e) {
      setError(String(e));
    }
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
            <span className="level-kicker">메타그래프</span>
            <strong>{projectName}</strong>
          </div>
        </div>
        {graph && (
          <div className="kg-stats" aria-label={`노드 ${graph.nodes.length}개, 엣지 ${graph.edges.length}개`}>
            <span>노드 <strong>{graph.nodes.length}</strong></span>
            <span>엣지 <strong>{graph.edges.length}</strong></span>
          </div>
        )}
      </header>

      {error && <p className="kg-error" role="alert">불러오기 실패: {error}</p>}

      <div className="kg-toolbar" aria-label="메타그래프 도구">
        <div className="kg-toolbar-section" role="group" aria-label="노드 유형">
          <span className="kg-toolbar-title">노드 유형</span>
          <div className="kg-node-legend">
            {Object.entries(TYPE_COLOR).map(([type, color]) => (
              <span className="kg-legend-chip" key={type} title={type}>
                <span className="kg-node-dot" style={{ backgroundColor: color }} aria-hidden="true" />
                {TYPE_LABEL[type] ?? type}
              </span>
            ))}
          </div>
        </div>

        <div className="kg-toolbar-actions">
          <div className="kg-edge-legend" role="group" aria-label="관계 유형">
            <span className="kg-edge-kind">
              <span className="kg-edge-line" aria-hidden="true" />
              <span>검증 관계 <small>curated 실선</small></span>
            </span>
            <span className="kg-edge-kind">
              <span className="kg-edge-line is-dashed" aria-hidden="true" />
              <span>AI 제안 관계 <small>llm 점선 · 미검증</small></span>
            </span>
          </div>
          <button className="secondary-action kg-fit-button" type="button" onClick={fitAll}>
            <Maximize2 size={16} aria-hidden="true" />
            전체보기
          </button>
        </div>
      </div>

      <div className="kg-guide" role="note" aria-label="그래프 조작 안내">
        <Info size={16} aria-hidden="true" />
        <strong>그래프 조작</strong>
        <span><kbd>휠</kbd> 확대·축소</span>
        <span><kbd>배경 드래그</kbd> 화면 이동</span>
        <span><kbd>노드 드래그</kbd> 재배치</span>
        <span><kbd>클릭</kbd> 상세 보기</span>
      </div>

      <div
        ref={wrapRef}
        className="kg-canvas"
        style={{ height: dims.h }}
      >
        <ForceGraph2D
          ref={fgRef}
          graphData={data}
          width={dims.w}
          height={dims.h}
          backgroundColor="#fafafa"
          nodeRelSize={5}
          nodeColor={(n: KgNode) => TYPE_COLOR[n.type] || "#374151"}
          nodeLabel={(n: KgNode & { name?: string }) => `${n.name ?? n.label} · ${n.type}`}
          nodeCanvasObjectMode={() => "after"}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
            if (scale < 1.4) return;  // 충분히 확대했을 때만 라벨(겹침 방지).
            const raw = node.name ?? node.label ?? "";
            const lab = raw.length > 24 ? raw.slice(0, 23) + "…" : raw;
            ctx.font = `${11 / scale}px sans-serif`;
            ctx.fillStyle = "#111827";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(lab, node.x + 7 / scale, node.y);
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkColor={(l: any) => (l.track === "llm" ? "rgba(148,163,184,0.6)" : "rgba(71,85,105,0.55)")}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkLineDash={(l: any) => (l.track === "llm" ? [3, 3] : null)}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkWidth={(l: any) => (l.confidence < 0.7 ? 0.8 : 1.6)}
          onNodeClick={onNodeClick}
          onLinkClick={onLinkClick}
          cooldownTicks={120}
          onEngineStop={fitAll}
        />
      </div>

      {selected && (
        <aside className="kg-inspect">
          <strong>{selected.label}</strong> <em>{selected.type}</em>
          {selected.ref_id && <div>ref: {selected.ref_id}</div>}
        </aside>
      )}

      {selectedEdge && (
        <aside className="kg-inspect" data-testid="edge-selected">
          <strong>{selectedEdge.src} ↔ {selectedEdge.dst}</strong> <em>{selectedEdge.type}</em>
          <div>track: {selectedEdge.track}{selectedEdge.track === "llm" ? " (미검증)" : ""}</div>
          {selectedEdge.evidence && <div>근거: {selectedEdge.evidence}</div>}
          {selectedEdge.track === "llm" && (
            <div data-testid="edge-actions" style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button type="button" onClick={onConfirm}>확인(승격)</button>
              <button type="button" onClick={onReject}>거부(숨김)</button>
            </div>
          )}
        </aside>
      )}
    </section>
  );
}
