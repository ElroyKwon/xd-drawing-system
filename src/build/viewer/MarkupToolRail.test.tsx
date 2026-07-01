import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarkupToolRail from "./MarkupToolRail";

// J7: 뷰어(canEdit=false)는 작성 도구가 잠기고 '선택'만 사용 가능해야 한다.
describe("MarkupToolRail 권한 게이팅", () => {
  it("enables all tools when editable (default)", () => {
    render(<MarkupToolRail activeTool="선택" onSelectTool={vi.fn()} />);
    expect(screen.getByRole("button", { name: "도형" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "이슈 핀" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "측정" })).toBeEnabled();
  });

  it("locks every tool except 선택 for viewers", () => {
    render(<MarkupToolRail activeTool="선택" onSelectTool={vi.fn()} canEdit={false} />);
    // 선택(팬/줌·기존 항목 조회)만 허용.
    expect(screen.getByRole("button", { name: "선택" })).toBeEnabled();
    // 작성 도구는 전부 잠금.
    for (const label of ["텍스트", "도형", "클라우드", "폴리라인", "다각형", "펜", "지우개", "이슈 핀", "측정"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
  });
});
