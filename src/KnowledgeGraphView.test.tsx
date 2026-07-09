import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import KnowledgeGraphView from "./KnowledgeGraphView";

const twoNodeGraph = () =>
  new Response(JSON.stringify({
    nodes: [{ id: "eq:E1", type: "equipment", ref_id: "E1", label: "MTR-1", props: {} },
            { id: "sh:s1", type: "sheet", ref_id: "s1", label: "E-101", props: {} }],
    edges: [{ src: "eq:E1", dst: "sh:s1", type: "appears_on", confidence: 1, track: "curated", evidence: null }],
  }), { status: 200 });

afterEach(() => vi.restoreAllMocks());

describe("KnowledgeGraphView", () => {
  it("그래프를 불러와 노드 수·범례를 표시한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(twoNodeGraph());
    render(<KnowledgeGraphView projectName="P1" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/노드 2/)).toBeInTheDocument());
  });

  it("projectName 전환 시 stale 그래프를 지우고 실패는 에러로 표시한다", async () => {
    // P1: 성공(2노드), P2: 500 → fetchGraph가 throw.
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(twoNodeGraph())
      .mockResolvedValueOnce(new Response("boom", { status: 500 }));

    const { rerender } = render(<KnowledgeGraphView projectName="P1" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/노드 2/)).toBeInTheDocument());

    rerender(<KnowledgeGraphView projectName="P2" onBack={() => {}} />);
    // 실패 시: 이전 프로젝트 노드 수는 사라지고 에러 알림이 뜬다.
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/불러오기 실패/));
    expect(screen.queryByText(/노드 2/)).not.toBeInTheDocument();
  });
});
