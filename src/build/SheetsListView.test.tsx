import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Sheet } from "../buildSheetsData";
import SheetsListView, { SHEETS_PAGE_SIZE } from "./SheetsListView";

function makeSheets(n: number): Sheet[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    projectId: "p",
    number: `EE-${String(i + 1).padStart(3, "0")}`,
    title: `시트 ${i + 1}`,
    version: "1",
    versionSet: "-",
    disciplineCode: "E",
    disciplineLabel: "E (전기)",
    tag: "pdf-page",
    lastUpdatedBy: "업로드",
  }));
}

function renderList(sheets: Sheet[], extra?: Partial<Parameters<typeof SheetsListView>[0]>) {
  return render(
    <SheetsListView
      emptyMessage="없음"
      query=""
      sheets={sheets}
      viewMode="list"
      disciplines={["전체", "E"]}
      disciplineFilter="전체"
      sortKey="number-asc"
      onOpenSheet={vi.fn()}
      onQueryChange={vi.fn()}
      onViewModeChange={vi.fn()}
      onDisciplineChange={vi.fn()}
      onSortToggle={vi.fn()}
      {...extra}
    />,
  );
}

describe("SheetsListView 페이지네이션 (S2.5)", () => {
  it("페이지당 50행만 렌더하고 범위/페이지 라벨을 표시한다", () => {
    renderList(makeSheets(68));
    expect(screen.getAllByTestId("sheet-row")).toHaveLength(SHEETS_PAGE_SIZE);
    expect(screen.getByText("총 68개 중 1–50")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("이전 버튼은 1페이지에서 비활성", () => {
    renderList(makeSheets(68));
    expect(screen.getByLabelText("이전 페이지")).toBeDisabled();
    expect(screen.getByLabelText("다음 페이지")).toBeEnabled();
  });

  it("다음 페이지로 이동하면 나머지 행과 경계가 갱신된다", async () => {
    const user = userEvent.setup();
    renderList(makeSheets(68));
    await user.click(screen.getByLabelText("다음 페이지"));
    expect(screen.getAllByTestId("sheet-row")).toHaveLength(18);
    expect(screen.getByText("총 68개 중 51–68")).toBeInTheDocument();
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByLabelText("다음 페이지")).toBeDisabled();
    expect(screen.getByLabelText("이전 페이지")).toBeEnabled();
  });

  it("한 페이지 이내면 단일 페이지로 표시", () => {
    renderList(makeSheets(10));
    expect(screen.getAllByTestId("sheet-row")).toHaveLength(10);
    expect(screen.getByText("총 10개 중 1–10")).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
  });

  it("필터(disciplineFilter) 변경 시 1페이지로 리셋", async () => {
    const user = userEvent.setup();
    const { rerender } = renderList(makeSheets(68));
    await user.click(screen.getByLabelText("다음 페이지"));
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    // 부모가 필터를 바꾼 것을 시뮬레이션(같은 sheets, 다른 disciplineFilter prop)
    rerender(
      <SheetsListView
        emptyMessage="없음"
        query=""
        sheets={makeSheets(68)}
        viewMode="list"
        disciplines={["전체", "E"]}
        disciplineFilter="E"
        sortKey="number-asc"
        onOpenSheet={vi.fn()}
        onQueryChange={vi.fn()}
        onViewModeChange={vi.fn()}
        onDisciplineChange={vi.fn()}
        onSortToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });
});
