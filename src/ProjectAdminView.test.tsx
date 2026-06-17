import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ProjectAdminView from "./ProjectAdminView";

function renderProjectAdmin() {
  return {
    user: userEvent.setup(),
    ...render(<ProjectAdminView onBackToProjects={() => undefined} />)
  };
}

function accessRows() {
  return screen.getAllByTestId("project-access-row");
}

describe("ProjectAdminView", () => {
  it("renders the Project Admin member access shell for Study_Project", () => {
    renderProjectAdmin();

    expect(screen.getByText("Project Admin")).toBeInTheDocument();
    expect(screen.getByText("Study_Project")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "구성원" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "구성원" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "구성원 추가" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("이름 또는 이메일로 구성원 검색...")).toBeInTheDocument();

    ["이름", "이메일", "전화", "상태", "역할", "추가된 일시"].forEach((column) => {
      expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
    });

    expect(accessRows()).toHaveLength(2);
    expect(within(accessRows()[0]).getByText("개혁 이")).toBeInTheDocument();
    expect(screen.getByText("도면 검토자")).toBeInTheDocument();
    expect(screen.queryByText("현장 담당자")).not.toBeInTheDocument();
  });

  it("shows the selected member in the right inspector", () => {
    renderProjectAdmin();

    const inspector = screen.getByRole("complementary", { name: "구성원 상세" });
    expect(within(inspector).getByText("개혁 이")).toBeInTheDocument();
    expect(within(inspector).getByText("cruelkh@gmail.com")).toBeInTheDocument();
    expect(within(inspector).getByDisplayValue("관리자")).toBeInTheDocument();
  });

  it("filters project access members by name or email and restores all rows when cleared", async () => {
    const { user } = renderProjectAdmin();
    const search = screen.getByPlaceholderText("이름 또는 이메일로 구성원 검색...");

    await user.type(search, "검토");
    expect(accessRows()).toHaveLength(1);
    expect(within(accessRows()[0]).getByText("도면 검토자")).toBeInTheDocument();
    expect(within(accessRows()[0]).queryByText("개혁 이")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "cruelkh");
    expect(accessRows()).toHaveLength(1);
    expect(within(accessRows()[0]).getByText("개혁 이")).toBeInTheDocument();

    await user.clear(search);
    expect(accessRows()).toHaveLength(2);
  });

  it("updates the right inspector when a member row is selected", async () => {
    const { user } = renderProjectAdmin();

    await user.click(screen.getByText("도면 검토자"));

    const inspector = screen.getByRole("complementary", { name: "구성원 상세" });
    expect(within(inspector).getByText("도면 검토자")).toBeInTheDocument();
    expect(within(inspector).getByText("reviewer@xd.local")).toBeInTheDocument();
    expect(within(inspector).getByDisplayValue("편집자")).toBeInTheDocument();
  });

  it("opens add-member modal and blocks empty submit", async () => {
    const { user } = renderProjectAdmin();

    await user.click(screen.getByRole("button", { name: "구성원 추가" }));
    expect(screen.getByRole("dialog", { name: "구성원 추가" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByText("구성원을 선택하세요.")).toBeInTheDocument();
    expect(accessRows()).toHaveLength(2);
  });

  it("blocks duplicate project-member access", async () => {
    const { user } = renderProjectAdmin();

    await user.click(screen.getByRole("button", { name: "구성원 추가" }));
    await user.selectOptions(screen.getByLabelText("구성원"), "member-owner");
    await user.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.getByText("이미 이 프로젝트에 추가된 구성원입니다.")).toBeInTheDocument();
    expect(accessRows()).toHaveLength(2);
  });

  it("adds an existing mock member with a selected project role", async () => {
    const { user } = renderProjectAdmin();

    await user.click(screen.getByRole("button", { name: "구성원 추가" }));
    await user.selectOptions(screen.getByLabelText("구성원"), "member-field");
    await user.selectOptions(screen.getByLabelText("역할"), "뷰어");
    await user.click(screen.getByRole("button", { name: "추가" }));

    expect(screen.queryByRole("dialog", { name: "구성원 추가" })).not.toBeInTheDocument();
    expect(accessRows()).toHaveLength(3);
    expect(within(accessRows()[2]).getByText("현장 담당자")).toBeInTheDocument();

    await user.click(within(accessRows()[2]).getByText("현장 담당자"));
    const inspector = screen.getByRole("complementary", { name: "구성원 상세" });
    expect(within(inspector).getByText("field@xd.local")).toBeInTheDocument();
    expect(within(inspector).getByDisplayValue("뷰어")).toBeInTheDocument();
  });
});
