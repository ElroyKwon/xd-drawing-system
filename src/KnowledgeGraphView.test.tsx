import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act, within } from "@testing-library/react";

// react-force-graph-2d 는 canvas 기반이라 jsdom 에서 렌더 불가 → 목킹하고, 전달된 props(onLinkClick 등)를
// 캡처해 콜백을 직접 호출함으로써 write-back 상호작용을 검증한다.
const { fgState } = vi.hoisted(() => ({ fgState: { props: null as Record<string, unknown> | null } }));
vi.mock("react-force-graph-2d", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => { fgState.props = props; return null; },
}));

import KnowledgeGraphView from "./KnowledgeGraphView";
import * as kgApi from "./api/kg";

const twoNodeGraph = () =>
  new Response(JSON.stringify({
    nodes: [{ id: "eq:E1", type: "equipment", ref_id: "E1", label: "MTR-1", props: {} },
            { id: "sh:s1", type: "sheet", ref_id: "s1", label: "E-101", props: {} }],
    edges: [{ src: "eq:E1", dst: "sh:s1", type: "appears_on", confidence: 1, track: "curated", evidence: null }],
  }), { status: 200 });

const llmGraph = () =>
  new Response(JSON.stringify({
    nodes: [{ id: "eq:E1", type: "equipment", ref_id: "E1", label: "MTR-1", props: {} },
            { id: "eq:E2", type: "equipment", ref_id: "E2", label: "VCB-1", props: {} }],
    edges: [{ src: "eq:E1", dst: "eq:E2", type: "relates_to", confidence: 0.6, track: "llm", evidence: "공출현" }],
  }), { status: 200 });

afterEach(() => { vi.restoreAllMocks(); fgState.props = null; });

describe("KnowledgeGraphView", () => {
  it("그래프를 불러와 노드 수·범례를 표시한다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(twoNodeGraph());
    render(<KnowledgeGraphView projectName="P1" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText("노드 2개, 엣지 1개")).toBeInTheDocument());
    const nodeLegend = screen.getByRole("group", { name: "노드 유형" });
    expect(within(nodeLegend).getByText("설비")).toBeInTheDocument();
    expect(within(nodeLegend).getByText("시트")).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "그래프 조작 안내" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "전체보기" })).toBeInTheDocument();
  });

  it("projectName 전환 시 stale 그래프를 지우고 실패는 에러로 표시한다", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(twoNodeGraph())
      .mockResolvedValueOnce(new Response("boom", { status: 500 }));

    const { rerender } = render(<KnowledgeGraphView projectName="P1" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText("노드 2개, 엣지 1개")).toBeInTheDocument());

    rerender(<KnowledgeGraphView projectName="P2" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/불러오기 실패/));
    expect(screen.queryByLabelText("노드 2개, 엣지 1개")).not.toBeInTheDocument();
  });
});

describe("KnowledgeGraphView edge write-back", () => {
  it("llm 엣지 클릭 시 확인/거부 버튼이 뜨고, 확인은 confirmEdge 후 그래프를 재조회한다", async () => {
    const confirmSpy = vi.spyOn(kgApi, "confirmEdge").mockResolvedValue(
      { ok: true, edge_key: "eq:E1|eq:E2|relates_to", new_track: "curated" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(llmGraph());

    render(<KnowledgeGraphView projectName="P1" onBack={() => {}} />);
    await waitFor(() => expect(screen.getByLabelText("노드 2개, 엣지 1개")).toBeInTheDocument());

    // ForceGraph 목킹이 캡처한 onLinkClick 을 직접 호출(force-graph 는 source/target 을 노드 객체로 준다).
    const onLinkClick = fgState.props?.onLinkClick as (l: unknown) => void;
    act(() => {
      onLinkClick({
        source: { id: "eq:E1" }, target: { id: "eq:E2" },
        type: "relates_to", track: "llm", confidence: 0.6, evidence: "공출현",
      });
    });

    await waitFor(() => expect(screen.queryByTestId("edge-actions")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /확인/ }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith("P1", "eq:E1", "eq:E2"));
  });
});
