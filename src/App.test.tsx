import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

function renderApp() {
  return {
    user: userEvent.setup(),
    ...render(<App />)
  };
}

function projectRows() {
  return screen.getAllByTestId("project-row");
}

describe("initial setup project list and create modal", () => {
  it("renders the ACC project list structure with required columns and mock rows", () => {
    renderApp();

    expect(screen.getByRole("tab", { name: "프로젝트", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "프로젝트 만들기" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("이름 또는 번호로 프로젝트 검색...")).toBeInTheDocument();

    ["유형", "이름", "번호", "기본 액세스", "허브", "작성 날짜"].forEach((column) => {
      expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
    });

    expect(screen.getByText("Study_Project")).toBeInTheDocument();
    expect(screen.getByText("Construction : Sample Project - Seaport Civic Center")).toBeInTheDocument();
    expect(screen.getByText("2개 중 1-2개 표시 중")).toBeInTheDocument();
  });

  it("filters projects by name or number and restores the full list when cleared", async () => {
    const { user } = renderApp();
    const search = screen.getByPlaceholderText("이름 또는 번호로 프로젝트 검색...");

    await user.type(search, "Seaport");
    expect(projectRows()).toHaveLength(1);
    expect(screen.getByText("Construction : Sample Project - Seaport Civic Center")).toBeInTheDocument();
    expect(screen.queryByText("Study_Project")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "A-001");
    expect(projectRows()).toHaveLength(1);
    expect(screen.getByText("Study_Project")).toBeInTheDocument();

    await user.clear(search);
    expect(projectRows()).toHaveLength(2);
  });

  it("opens a centered project creation modal with ACC fields", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "프로젝트 만들기" }));

    const dialog = screen.getByRole("dialog", { name: "프로젝트 작성" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    [
      "프로젝트 이름",
      "프로젝트 번호",
      "프로젝트 유형",
      "템플릿",
      "주소",
      "시간대",
      "시작일",
      "종료일",
      "프로젝트 값",
      "통화"
    ].forEach((label) => {
      expect(within(dialog).getByLabelText(label, { exact: false })).toBeInTheDocument();
    });
  });

  it("blocks empty submit with required-name validation and keeps the list unchanged", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "프로젝트 만들기" }));
    await user.click(screen.getByRole("button", { name: "프로젝트 작성" }));

    expect(screen.getByText("프로젝트 이름을 입력하세요.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "프로젝트 작성" })).toBeInTheDocument();
    expect(projectRows()).toHaveLength(2);
  });

  it("adds exactly one local mock project on valid submit and makes it searchable", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "프로젝트 만들기" }));
    await user.type(screen.getByLabelText("프로젝트 이름", { exact: false }), "XD Pilot Project");
    await user.type(screen.getByLabelText("프로젝트 번호", { exact: false }), "XD-900");
    await user.click(screen.getByRole("button", { name: "프로젝트 작성" }));

    expect(screen.queryByRole("dialog", { name: "프로젝트 작성" })).not.toBeInTheDocument();
    expect(projectRows()).toHaveLength(3);
    expect(screen.getByText("XD Pilot Project")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("이름 또는 번호로 프로젝트 검색..."), "XD-900");
    expect(projectRows()).toHaveLength(1);
    expect(screen.getByText("XD Pilot Project")).toBeInTheDocument();
  });

  it("closes by cancel or close without mutating the project list", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "프로젝트 만들기" }));
    await user.type(screen.getByLabelText("프로젝트 이름", { exact: false }), "Canceled Project");
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByText("Canceled Project")).not.toBeInTheDocument();
    expect(projectRows()).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "프로젝트 만들기" }));
    await user.type(screen.getByLabelText("프로젝트 이름", { exact: false }), "Closed Project");
    await user.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByText("Closed Project")).not.toBeInTheDocument();
    expect(projectRows()).toHaveLength(2);
  });
});
