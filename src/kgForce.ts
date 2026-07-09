export type FNode = { id: string };
export type FEdge = { src: string; dst: string };
export type Pos = Record<string, { x: number; y: number }>;

/** 결정적 force-directed 레이아웃(반발+스프링+중심). 난수 없음 — 초기 좌표는 원형 배치.
 *  xg-web web/nms.js forceLayout 이식(Obsidian식). */
export function layout(nodes: FNode[], edges: FEdge[], W: number, H: number, iters = 200): Pos {
  const n = nodes.length;
  const pos: Pos = {};
  nodes.forEach((nd, i) => {
    const ang = (2 * Math.PI * i) / Math.max(1, n);
    pos[nd.id] = {
      x: W / 2 + Math.cos(ang) * (Math.min(W, H) / 3),
      y: H / 2 + Math.sin(ang) * (Math.min(W, H) / 3),
    };
  });
  const k = Math.sqrt((W * H) / Math.max(1, n));
  for (let it = 0; it < iters; it++) {
    const disp: Pos = {};
    nodes.forEach((nd) => (disp[nd.id] = { x: 0, y: 0 }));
    // 반발(모든 쌍).
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos[nodes[i].id], b = pos[nodes[j].id];
        let dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (k * k) / d;
        dx /= d; dy /= d;
        disp[nodes[i].id].x += dx * f; disp[nodes[i].id].y += dy * f;
        disp[nodes[j].id].x -= dx * f; disp[nodes[j].id].y -= dy * f;
      }
    }
    // 스프링(엣지).
    for (const e of edges) {
      const a = pos[e.src], b = pos[e.dst];
      if (!a || !b) continue;
      let dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d * d) / k;
      dx /= d; dy /= d;
      disp[e.src].x -= dx * f; disp[e.src].y -= dy * f;
      disp[e.dst].x += dx * f; disp[e.dst].y += dy * f;
    }
    const t = (1 - it / iters) * (k / 2);
    for (const nd of nodes) {
      const dp = disp[nd.id];
      const dl = Math.sqrt(dp.x * dp.x + dp.y * dp.y) || 0.01;
      const p = pos[nd.id];
      p.x += (dp.x / dl) * Math.min(dl, t);
      p.y += (dp.y / dl) * Math.min(dl, t);
      p.x = Math.max(0, Math.min(W, p.x));
      p.y = Math.max(0, Math.min(H, p.y));
    }
  }
  return pos;
}
