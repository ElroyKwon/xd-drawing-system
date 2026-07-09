import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchGraph, fetchNeighbors } from "./kg";

afterEach(() => vi.restoreAllMocks());

describe("kg api", () => {
  it("fetchGraph 는 project_name 쿼리로 /api/kg/graph 를 부른다", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ nodes: [{ id: "eq:E1" }], edges: [] }), { status: 200 }));
    const g = await fetchGraph("P1");
    expect(spy.mock.calls[0][0]).toContain("/api/kg/graph?project_name=P1");
    expect(g.nodes[0].id).toBe("eq:E1");
  });

  it("fetchNeighbors 는 id·depth 를 넘긴다", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ found: true, nodes: [], edges: [] }), { status: 200 }));
    await fetchNeighbors("P1", "eq:E1", 2);
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("id=eq%3AE1");
    expect(url).toContain("depth=2");
  });
});
