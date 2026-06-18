import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import BuildSheetsView from "./BuildSheetsView";

function renderBuildSheets() {
  return {
    user: userEvent.setup(),
    ...render(<BuildSheetsView onBackToProjects={() => undefined} />)
  };
}

function sheetRows() {
  return screen.getAllByTestId("sheet-row");
}

describe("BuildSheetsView", () => {
  it("renders the Build shell and sheets table for Study_Project", () => {
    renderBuildSheets();

    expect(screen.getByText("Build")).toBeInTheDocument();
    expect(screen.getByText("Study_Project")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "시트" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "시트" })).toHaveAttribute("aria-label", "시트");
    expect(screen.getByRole("button", { name: "구성원" })).toHaveAttribute("aria-label", "구성원");
    expect(screen.getByRole("heading", { name: "시트" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("시트 검색 및 필터")).toBeInTheDocument();

    ["번호", "버전 세트", "공종", "태그", "최종 수정자"].forEach((column) => {
      expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
    });

    expect(sheetRows()).toHaveLength(6);
    expect(screen.getByText("A001")).toBeInTheDocument();
    expect(screen.getByText("P101")).toBeInTheDocument();
    expect(screen.getByText("6 중 1-6 표시")).toBeInTheDocument();
  });

  it("filters sheets by number, title, discipline, and tag", async () => {
    const { user } = renderBuildSheets();
    const search = screen.getByPlaceholderText("시트 검색 및 필터");

    await user.type(search, "A101");
    expect(sheetRows()).toHaveLength(1);
    expect(within(sheetRows()[0]).getByText("A101")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "mechanical");
    expect(sheetRows()).toHaveLength(1);
    expect(within(sheetRows()[0]).getByText("M101")).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "전기");
    expect(sheetRows()).toHaveLength(1);
    expect(within(sheetRows()[0]).getByText("E101")).toBeInTheDocument();

    await user.clear(search);
    expect(sheetRows()).toHaveLength(6);
  });

  it("updates the selected view toggle while keeping the list usable", async () => {
    const { user } = renderBuildSheets();

    await user.click(screen.getByRole("button", { name: "격자 보기" }));
    expect(screen.getByRole("button", { name: "격자 보기" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("격자 보기는 다음 slice에서 확장됩니다. 현재는 목록으로 시트 메타데이터를 검토합니다.")).toBeInTheDocument();
    expect(sheetRows()).toHaveLength(6);

    await user.click(screen.getByRole("button", { name: "목록 보기" }));
    expect(screen.getByRole("button", { name: "목록 보기" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("격자 보기는 다음 slice에서 확장됩니다. 현재는 목록으로 시트 메타데이터를 검토합니다.")).not.toBeInTheDocument();
  });

  it("names sheet selection checkboxes for browser form-field checks", () => {
    renderBuildSheets();

    expect(screen.getByRole("textbox", { name: "시트 검색" })).toHaveAttribute("name", "sheet-search");
    expect(screen.getByRole("checkbox", { name: "모든 시트 선택" })).toHaveAttribute("name", "all-sheets");
    expect(screen.getByRole("checkbox", { name: "A001 선택" })).toHaveAttribute("name", "sheet-a001");
  });
});
