// ④ 프론트 지식그래프 API 클라이언트 — 조회 전용(GET), 8000 백엔드 kg 라우트만 호출.
// 격리: api/drawings.ts BACKEND_BASE 계승(packages.ts fetch 패턴과 동일).

import { BACKEND_BASE } from "./drawings";

export type KgNode = {
  id: string;
  type: string;
  ref_id: string | null;
  label: string;
  props: Record<string, unknown>;
};

export type KgEdge = {
  src: string;
  dst: string;
  type: string;
  confidence: number;
  track: "curated" | "rule" | "llm";
  evidence: string | null;
};

export type KgGraph = { nodes: KgNode[]; edges: KgEdge[]; built_at?: string | null };

async function jsonOrThrow<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new Error(`${what} 실패 (${res.status}): ${await res.text()}`);
  return res.json();
}

/** 시각화용 서브그래프(scope 필터, 미지정 시 프로젝트 전체). */
export async function fetchGraph(projectName: string, scope?: string): Promise<KgGraph> {
  const url = new URL(`${BACKEND_BASE}/api/kg/graph`);
  url.searchParams.set("project_name", projectName);
  if (scope) url.searchParams.set("scope", scope);
  return jsonOrThrow(await fetch(url.toString()), "지식그래프 조회");
}

/** 특정 노드의 N홉 이웃. */
export async function fetchNeighbors(
  projectName: string,
  id: string,
  depth = 1,
): Promise<KgGraph & { found: boolean }> {
  const url = new URL(`${BACKEND_BASE}/api/kg/neighbors`);
  url.searchParams.set("project_name", projectName);
  url.searchParams.set("id", id);
  url.searchParams.set("depth", String(depth));
  return jsonOrThrow(await fetch(url.toString()), "이웃 노드 조회");
}
