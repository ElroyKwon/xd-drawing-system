import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import KnowledgeGraphView from "./KnowledgeGraphView";

afterEach(() => vi.restoreAllMocks());

describe("KnowledgeGraphView", () => {
  it("그래프를 불러와 노드 수·범례를 표시한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      nodes: [{ id: "eq:E1", type: "equipment", ref_id: "E1", label: "MTR-1", props: {} },
              { id: "sh:s1", type: "sheet", ref_id: "s1", label: "E-101", props: {} }],
      edges: [{ src: "eq:E1", dst: "sh:s1", type: "appears_on", confidence: 1, track: "curated", evidence: null }],
    }), { status: 200 }));
    render(<KnowledgeGraphView projectName="P1" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/노드 2/)).toBeInTheDocument());
  });
});
