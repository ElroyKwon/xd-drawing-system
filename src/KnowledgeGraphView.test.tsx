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

import { pickEdge } from "./KnowledgeGraphView";
import * as kgApi from "./api/kg";
import { layout } from "./kgForce";

const llmGraph = () =>
  new Response(JSON.stringify({
    nodes: [{ id: "eq:E1", type: "equipment", ref_id: "E1", label: "MTR-1", props: {} },
            { id: "eq:E2", type: "equipment", ref_id: "E2", label: "VCB-1", props: {} }],
    edges: [{ src: "eq:E1", dst: "eq:E2", type: "relates_to", confidence: 0.6, track: "llm", evidence: "공출현" }],
  }), { status: 200 });

describe("KnowledgeGraphView edge write-back", () => {
  it("pickEdge 는 선분에 가까운 점에서 엣지를 고르고 먼 점에선 null", () => {
    const pos = { "eq:E1": { x: 0, y: 0 }, "eq:E2": { x: 100, y: 0 } };
    const edges = [{ src: "eq:E1", dst: "eq:E2", type: "relates_to", confidence: 0.6, track: "llm" as const, evidence: null }];
    expect(pickEdge(edges, pos, 50, 2)?.src).toBe("eq:E1");  // 선분 위 근처.
    expect(pickEdge(edges, pos, 50, 80)).toBeNull();          // 선분에서 멂.
  });

  it("llm 엣지 선택 시 확인/거부 버튼이 뜨고, 확인은 confirmEdge 후 그래프를 재조회한다", async () => {
    const { render, screen, waitFor, fireEvent } = await import("@testing-library/react");
    const confirmSpy = vi.spyOn(kgApi, "confirmEdge").mockResolvedValue(
      { ok: true, edge_key: "eq:E1|eq:E2|relates_to", new_track: "curated" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(llmGraph());

    const KnowledgeGraphView = (await import("./KnowledgeGraphView")).default;
    render(<KnowledgeGraphView projectName="P1" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByText(/엣지 1/)).toBeInTheDocument());

    // jsdom은 getBoundingClientRect가 0을 반환하므로, 결정적 layout으로 엣지 중점을
    // 계산해 rect.left/top을 음수로 스텁 → (0,0) 클릭이 엣지 선분 위에 떨어지게 한다.
    const nodes = [{ id: "eq:E1" }, { id: "eq:E2" }];
    const edges = [{ src: "eq:E1", dst: "eq:E2" }];
    const p = layout(nodes, edges, 900, 640, 200);
    const midX = (p["eq:E1"].x + p["eq:E2"].x) / 2;
    const midY = (p["eq:E1"].y + p["eq:E2"].y) / 2;
    const canvas = document.querySelector("canvas")!;
    canvas.getBoundingClientRect = () =>
      ({ left: -midX, top: -midY, right: 0, bottom: 0, width: 900, height: 640, x: -midX, y: -midY, toJSON() {} }) as DOMRect;
    fireEvent.click(canvas, { clientX: 0, clientY: 0 });

    await waitFor(() => expect(screen.queryByTestId("edge-actions")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /확인/ }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith("P1", "eq:E1", "eq:E2"));
  });
});
