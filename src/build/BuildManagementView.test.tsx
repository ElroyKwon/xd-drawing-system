import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BuildManagementView from "./BuildManagementView";

const listProjectMembers = vi.fn();

vi.mock("../api/admin", () => ({
  listProjectMembers: (...args: unknown[]) => listProjectMembers(...args)
}));

const members = [
  {
    id: "member-1",
    member_id: "member-1",
    project_name: "Study_Project",
    name: "개혁 이",
    email: "cruelkh@gmail.com",
    phone: "+82 10-4112-9638",
    role: "관리자",
    status: "활성",
    added_at: "2026-06-12T00:00:00"
  },
  {
    id: "member-2",
    member_id: "member-2",
    project_name: "Study_Project",
    name: "도면 검토자",
    email: "reviewer@xd.local",
    phone: "+82 10-2000-1200",
    role: "편집자",
    status: "활성",
    added_at: "2026-06-13T00:00:00"
  }
];

beforeEach(() => {
  vi.clearAllMocks();
  listProjectMembers.mockResolvedValue(members);
});

describe("BuildManagementView", () => {
  it("renders members in a readable table and supports local search", async () => {
    const user = userEvent.setup();
    render(<BuildManagementView section="구성원" />);

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "이름",
      "이메일",
      "역할",
      "상태",
      "추가된 일시"
    ]);
    expect(screen.getByText("개혁 이")).toBeInTheDocument();
    expect(screen.getByText("도면 검토자")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("이름 또는 이메일 검색"), "reviewer");
    expect(screen.queryByText("개혁 이")).not.toBeInTheDocument();
    expect(screen.getByText("도면 검토자")).toBeInTheDocument();
  });

  it("replaces placeholder bridge rows with metrics and a structured empty state", () => {
    render(<BuildManagementView section="브리지" />);

    expect(screen.getByRole("heading", { name: "Build 브리지" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("연결된 프로젝트가 없습니다");
    expect(screen.getByRole("button", { name: "브리지 연결" })).toBeInTheDocument();
    expect(screen.queryByText("로컬 shell")).not.toBeInTheDocument();
  });

  it("renders project settings as labeled controls instead of placeholder rows", () => {
    render(<BuildManagementView section="설정" />);

    expect(screen.getByRole("combobox", { name: "번호 형식" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "기본 유형" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "기본 공유 범위" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "변경사항 저장" })).toBeInTheDocument();
    expect(screen.queryByText("로컬 shell")).not.toBeInTheDocument();
  });
});
