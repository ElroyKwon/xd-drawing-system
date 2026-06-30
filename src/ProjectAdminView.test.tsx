import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectAdminView from "./ProjectAdminView";

// S7: 구성원은 백엔드(project_member) 영속. admin API를 stateful in-memory로 목킹.
const MEMBERS = [
  { id: "member-owner", name: "개혁 이", email: "cruelkh@gmail.com", phone: "+82 10-4112-9638" },
  { id: "member-reviewer", name: "도면 검토자", email: "reviewer@xd.local", phone: "+82 10-2000-1200" },
  { id: "member-field", name: "현장 담당자", email: "field@xd.local", phone: "+82 10-3000-3400" },
  { id: "member-viewer", name: "고객 열람자", email: "viewer@xd.local", phone: "+82 10-4000-5600" }
];
let pm: Array<{ project_name: string; member_id: string; role: string; status: string; added_at: string }> = [];

vi.mock("./api/admin", () => ({
  listMembers: vi.fn(async () => MEMBERS),
  listProjectMembers: vi.fn(async () =>
    pm.map((r) => ({ ...MEMBERS.find((m) => m.id === r.member_id), ...r }))),
  addProjectMember: vi.fn(async (proj: string, input: { member_id: string; role: string }) => {
    if (pm.some((r) => r.member_id === input.member_id)) throw new Error("400: 이미 프로젝트 구성원입니다");
    const row = { project_name: proj, member_id: input.member_id, role: input.role, status: "활성", added_at: "방금 전" };
    pm.push(row);
    return row;
  }),
  patchProjectMember: vi.fn(async (_p: string, mid: string, patch: { role?: string }) => {
    const r = pm.find((x) => x.member_id === mid);
    if (r && patch.role) r.role = patch.role;
    return r;
  })
}));

function renderProjectAdmin() {
  return { user: userEvent.setup(), ...render(<ProjectAdminView onBackToProjects={() => undefined} />) };
}

async function loadedRows() {
  return screen.findAllByTestId("project-access-row");
}
function accessRows() {
  return screen.getAllByTestId("project-access-row");
}

beforeEach(() => {
  pm = [
    { project_name: "Study_Project", member_id: "member-owner", role: "관리자", status: "활성", added_at: "2026.06.12." },
    { project_name: "Study_Project", member_id: "member-reviewer", role: "편집자", status: "활성", added_at: "2026.06.13." }
  ];
});

describe("ProjectAdminView", () => {
  it("renders the Project Admin member access shell for Study_Project", async () => {
    renderProjectAdmin();
    expect(screen.getByText("Project Admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "구성원 추가" })).toBeInTheDocument();
    const rows = await loadedRows();
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("개혁 이")).toBeInTheDocument();
    expect(screen.getByText("도면 검토자")).toBeInTheDocument();
    expect(screen.queryByText("현장 담당자")).not.toBeInTheDocument();
  });

  it("opens distinct Project Admin section shells from the left rail", async () => {
    const { user } = renderProjectAdmin();
    const expectedSections = [
      ["회사", "프로젝트 회사 관리"],
      ["브리지", "프로젝트 브리지"],
      ["액티비티", "최근 Project Admin 활동"],
      ["알림", "프로젝트 알림 설정"],
      ["위치", "프로젝트 위치"],
      ["설정", "Project 설정"]
    ] as const;
    for (const [sectionName, sectionText] of expectedSections) {
      await user.click(screen.getByRole("button", { name: sectionName }));
      expect(screen.getByRole("heading", { name: sectionName })).toBeInTheDocument();
      expect(screen.getByText(sectionText)).toBeInTheDocument();
    }
  });

  it("shows the selected member in the right inspector", async () => {
    renderProjectAdmin();
    await loadedRows();
    const inspector = screen.getByRole("complementary", { name: "구성원 상세" });
    expect(within(inspector).getByText("개혁 이")).toBeInTheDocument();
    expect(within(inspector).getByDisplayValue("관리자")).toBeInTheDocument();
  });

  it("filters project access members by name or email and restores all rows when cleared", async () => {
    const { user } = renderProjectAdmin();
    await loadedRows();
    const search = screen.getByPlaceholderText("이름 또는 이메일로 구성원 검색...");
    await user.type(search, "검토");
    expect(accessRows()).toHaveLength(1);
    expect(within(accessRows()[0]).getByText("도면 검토자")).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "cruelkh");
    expect(accessRows()).toHaveLength(1);
    expect(within(accessRows()[0]).getByText("개혁 이")).toBeInTheDocument();
    await user.clear(search);
    expect(accessRows()).toHaveLength(2);
  });

  it("updates the right inspector when a member row is selected", async () => {
    const { user } = renderProjectAdmin();
    await loadedRows();
    await user.click(screen.getByText("도면 검토자"));
    const inspector = screen.getByRole("complementary", { name: "구성원 상세" });
    expect(within(inspector).getByText("reviewer@xd.local")).toBeInTheDocument();
    expect(within(inspector).getByDisplayValue("편집자")).toBeInTheDocument();
  });

  it("opens add-member modal and blocks empty submit", async () => {
    const { user } = renderProjectAdmin();
    await loadedRows();
    await user.click(screen.getByRole("button", { name: "구성원 추가" }));
    expect(screen.getByRole("dialog", { name: "구성원 추가" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByText("구성원을 선택하세요.")).toBeInTheDocument();
    expect(accessRows()).toHaveLength(2);
  });

  it("adds an existing member with a selected project role (백엔드 영속)", async () => {
    const { user } = renderProjectAdmin();
    await loadedRows();
    await user.click(screen.getByRole("button", { name: "구성원 추가" }));
    await user.selectOptions(screen.getByLabelText("구성원"), "member-field");
    await user.selectOptions(screen.getByLabelText("역할"), "뷰어");
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.queryByRole("dialog", { name: "구성원 추가" })).not.toBeInTheDocument();
    await waitFor(() => expect(accessRows()).toHaveLength(3));
    expect(within(accessRows()[2]).getByText("현장 담당자")).toBeInTheDocument();
  });

  it("changes a member role via the inspector (관리자 권한)", async () => {
    const { user } = renderProjectAdmin();
    await loadedRows();
    await user.click(screen.getByText("도면 검토자"));
    const inspector = screen.getByRole("complementary", { name: "구성원 상세" });
    await user.selectOptions(within(inspector).getByLabelText("현재 역할"), "뷰어");
    await waitFor(() =>
      expect(within(screen.getByRole("complementary", { name: "구성원 상세" })).getByDisplayValue("뷰어")).toBeInTheDocument());
  });

  it("disables member management when not an admin (편집자/뷰어)", async () => {
    render(<ProjectAdminView onBackToProjects={() => undefined} canManage={false} />);
    await loadedRows();
    expect(screen.getByRole("button", { name: "구성원 추가" })).toBeDisabled();
    expect(screen.getByLabelText("현재 역할")).toBeDisabled();
  });
});
