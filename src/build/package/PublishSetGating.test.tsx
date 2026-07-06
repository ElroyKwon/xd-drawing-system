import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FilesView from "../FilesView";

// S14: "세트 발행" 버튼 canEdit 게이팅(뷰어=비활성, 서버 403과 일관).
vi.mock("../../api/drawings", async (importActual) => {
  const actual = await importActual<typeof import("../../api/drawings")>();
  return {
    ...actual,
    listFolders: vi.fn().mockResolvedValue([]),
    listDrawings: vi.fn().mockResolvedValue([]),
    getDrawing: vi.fn().mockResolvedValue(null),
  };
});

beforeEach(() => vi.clearAllMocks());

describe("세트 발행 버튼 게이팅 (S14 J7 일관)", () => {
  it("뷰어(canEdit=false)는 세트 발행 버튼이 비활성", async () => {
    render(<FilesView canEdit={false} />);
    const btn = await screen.findByRole("button", { name: /세트 발행/ });
    expect(btn).toBeDisabled();
  });

  it("편집자/관리자(canEdit=true)는 세트 발행 버튼이 활성", async () => {
    render(<FilesView canEdit={true} />);
    const btn = await screen.findByRole("button", { name: /세트 발행/ });
    expect(btn).toBeEnabled();
  });
});
