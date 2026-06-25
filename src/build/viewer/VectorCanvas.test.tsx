import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VectorCanvas from "./VectorCanvas";

vi.mock("../../api/drawings", () => ({
  fetchVector: vi.fn(),
}));
import { fetchVector } from "../../api/drawings";

const sample = {
  strokes: [{ pts: [[0, 0], [10, 10]] as [number, number][], color: "#ffffff", layer: "A", width: 1 }],
  fills: [{ pts: [[0, 0], [10, 0], [10, 10]] as [number, number][], color: "#00ff00", layer: "B" }],
  points: [],
  layers: ["A", "B"],
  bbox: [0, 0, 10, 10] as [number, number, number, number],
  stats: {},
};

beforeEach(() => {
  // jsdom 미구현 API 목킹: ResizeObserver + canvas 2D 컨텍스트.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
  vi.mocked(fetchVector).mockReset();
});

describe("VectorCanvas — S1.5 ②벡터 렌더러", () => {
  it("벡터 데이터를 받아 컨트롤과 레이어 토글을 렌더한다", async () => {
    vi.mocked(fetchVector).mockResolvedValue(sample);
    render(<VectorCanvas fileId="f1" />);

    // 로딩 상태 → 데이터 도착 후 컨트롤
    expect(screen.getByText(/벡터 로딩 중/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "레이어" })).toBeInTheDocument());

    // 레이어 패널 열기 + 토글
    fireEvent.click(screen.getByRole("button", { name: "레이어" }));
    const cbA = screen.getByLabelText("A") as HTMLInputElement;
    expect(cbA.checked).toBe(true);
    fireEvent.click(cbA);
    expect(cbA.checked).toBe(false);
    expect(fetchVector).toHaveBeenCalledWith("f1");
  });

  it("벡터 조회 실패 시 에러 메시지를 보여준다", async () => {
    vi.mocked(fetchVector).mockRejectedValue(new Error("400: PDF"));
    render(<VectorCanvas fileId="f2" />);
    await waitFor(() => expect(screen.getByText(/벡터 렌더 불가/)).toBeInTheDocument());
  });
});
