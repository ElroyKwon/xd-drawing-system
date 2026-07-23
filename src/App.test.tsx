import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

// S2: Build 시트 목록은 백엔드 도면(실데이터)으로 구성된다. Study_Project만 시트를 제공하고
// 그 외(새 빈 프로젝트)는 빈 목록으로 응답하도록 listDrawings를 목킹(픽스처는 hoisting 안전상 팩토리 내부).
vi.mock("./api/drawings", async (importActual) => {
  const actual = await importActual<typeof import("./api/drawings")>();
  const mk = (id: string, num: string, title: string, code: string, label: string, idx: number) => ({
    sheet_id: id, sheet_name: num, sheet_index: idx, source: "pdf-page",
    sheet_number: num, sheet_title: title, discipline_code: code, discipline_label: label,
  });
  const study = [
    {
      file_id: "seed", filename: "seed.pdf", file_format: "pdf", file_size: 1,
      upload_date: "2026-06-25T00:00:00", project_name: "Study_Project", version: "1",
      conversion_status: "completed",
      sheets: [
        mk("sheet-a001", "A001", "ARCHITECTURAL- GRAPHIC SYMBOLS& ABBREVIATIONS", "A", "A (건축)", 0),
        mk("sheet-a101", "A101", "OFFICE- FLOOR PLAN- LEVEL1", "A", "A (건축)", 1),
        mk("sheet-a102", "A102", "OFFICE- FLOOR PLAN", "A", "A (건축)", 2),
        mk("sheet-e101", "E101", "OFFICE- POWER PLAN", "E", "E (전기)", 3),
        mk("sheet-m101", "M101", "OFFICE- MECHANICAL PLAN", "M", "M (기계)", 4),
        mk("sheet-p101", "P101", "OFFICE- PLUMBING PLAN", "P", "P (배관)", 5),
      ],
    },
  ];
  return {
    ...actual,
    listDrawings: vi.fn((name?: string) => Promise.resolve(name === "Study_Project" ? study : [])),
  };
});

vi.mock("./api/templates", () => ({
  listTemplates: vi.fn(async () => []),
  createTemplate: vi.fn(async ({ name, source = "blank", source_project = null }) => ({
    template_id: `template-${name}`,
    name,
    access: "일반 액세스",
    source,
    source_project,
    folders: [],
    default_members: [],
    created_by: "member-owner",
    created_at: "2026-06-12T00:00:00",
  })),
  deleteTemplate: vi.fn(async () => undefined),
}));

// S7: 인증/구성원/프로젝트 API. getMe=개혁(관리자), 구성원은 project_name별 시드.
vi.mock("./api/admin", () => {
  const MEMBERS = [
    { id: "member-owner", name: "개혁 이", email: "cruelkh@gmail.com", phone: "+82 10-4112-9638" },
    { id: "member-reviewer", name: "도면 검토자", email: "reviewer@xd.local", phone: "+82 10-2000-1200" },
    { id: "member-field", name: "현장 담당자", email: "field@xd.local", phone: "+82 10-3000-3400" },
    { id: "member-viewer", name: "고객 열람자", email: "viewer@xd.local", phone: "+82 10-4000-5600" },
  ];
  const join = (r: { member_id: string; role: string; status: string; added_at: string; project_name: string }) => ({
    ...MEMBERS.find((m) => m.id === r.member_id), ...r,
  });
  return {
    getMe: vi.fn(async () => ({ member_id: "member-owner", member: MEMBERS[0], roles: { Study_Project: "관리자" } })),
    switchUser: vi.fn(async (id: string) => ({ member_id: id, member: MEMBERS.find((m) => m.id === id) ?? null, roles: {} })),
    listMembers: vi.fn(async () => MEMBERS),
    listProjects: vi.fn(async () => []),     // App은 initialProjects 시드를 유지(목록 2행)
    createProject: vi.fn(async (p: unknown) => p),
    listProjectMembers: vi.fn(async (proj: string) =>
      proj === "Study_Project"
        ? [
            join({ project_name: proj, member_id: "member-owner", role: "관리자", status: "활성", added_at: "2026.06.12." }),
            join({ project_name: proj, member_id: "member-reviewer", role: "편집자", status: "활성", added_at: "2026.06.13." }),
          ]
        : [join({ project_name: proj, member_id: "member-owner", role: "관리자", status: "활성", added_at: "방금 전" })]),
    addProjectMember: vi.fn(async () => ({})),
    patchProjectMember: vi.fn(async () => ({})),
  };
});

function renderApp({ startAtProjects = true }: { startAtProjects?: boolean } = {}) {
  const result = {
    user: userEvent.setup(),
    ...render(<App />)
  };
  if (startAtProjects) {
    fireEvent.click(screen.getByRole("tab", { name: /^프로젝트$/ }));
  }
  return result;
}

function projectRows() {
  return screen.getAllByTestId("project-row");
}

describe("initial setup project list and create modal", () => {
  it("renders the ACC project list structure with required columns and mock rows", () => {
    renderApp();

    expect(screen.getByRole("tab", { name: "프로젝트", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "프로젝트 만들기" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("이름 또는 번호로 프로젝트 검색...")).toHaveAttribute("name", "project-search");

    ["유형", "이름", "번호", "기본 액세스", "허브", "작성 날짜"].forEach((column) => {
      expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Study_Project 프로젝트 열기" })).toBeInTheDocument();
    expect(screen.getByText("Construction : Sample Project - Seaport Civic Center")).toBeInTheDocument();
    expect(screen.getByText("2개 중 1-2개 표시 중")).toBeInTheDocument();
  });

  it("renders Hub views in the ERP sidebar without a separate My Home menu", () => {
    renderApp();

    const sidebar = screen.getByRole("complementary", { name: "Hub Admin 사이드바" });
    expect(within(sidebar).queryByRole("tab", { name: "My Home" })).not.toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "Drawing System 대시보드로 이동" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("tab", { name: "프로젝트", selected: true })).toBeInTheDocument();
    expect(within(sidebar).getByRole("tab", { name: "프로젝트 템플릿" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("tab", { name: "메타그래프" })).toBeInTheDocument();
    expect(within(sidebar).queryByRole("tab", { name: "허브 설정" })).not.toBeInTheDocument();
  });

  it("opens the user switcher as an anchored dropdown and closes it after selection", async () => {
    const { user } = renderApp();
    const trigger = screen.getByRole("button", { name: "사용자 메뉴" });

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu", { name: "담당자 선택" });
    expect(within(menu).getAllByRole("menuitemradio")).toHaveLength(4);
    expect(within(menu).getByRole("menuitemradio", { name: /개혁 이/ })).toHaveAttribute("aria-checked", "true");

    await user.click(within(menu).getByRole("menuitemradio", { name: /현장 담당자/ }));

    await waitFor(() => expect(trigger).toHaveTextContent("현장 담당자"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu", { name: "담당자 선택" })).not.toBeInTheDocument();
  });

  it("opens the Hub-level project template screen with sample templates and a seeded hub template row", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("tab", { name: "프로젝트 템플릿" }));

    expect(screen.getByRole("tab", { name: "프로젝트 템플릿", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "샘플 템플릿" })).toBeInTheDocument();
    expect(screen.getByText("General Contractor")).toBeInTheDocument();
    expect(screen.getByText("Owner Operator")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "허브 템플릿" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "프로젝트 템플릿 작성" })).toBeInTheDocument();
    const hubTemplateTable = screen.getByRole("table", { name: "허브 템플릿 목록" });
    expect(hubTemplateTable).toHaveClass("hub-template-table");
    ["이름", "액세스", "작성 날짜"].forEach((column) => {
      expect(within(hubTemplateTable).getByRole("columnheader", { name: column })).toBeInTheDocument();
    });
    expect(screen.getByTestId("template-row")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "표준 프로젝트 템플릿 템플릿 열기" })).toBeInTheDocument();
  });

  it("opens the project creation modal prefilled with the chosen sample template", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("tab", { name: "프로젝트 템플릿" }));
    await user.click(screen.getAllByRole("button", { name: "사용하여 생성" })[0]);

    const dialog = screen.getByRole("dialog", { name: "프로젝트 작성" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText("템플릿", { exact: false })).toHaveValue("General Contractor");
  });

  it("runs the two-step template creation flow and lists the new hub template", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("tab", { name: "프로젝트 템플릿" }));
    await user.click(screen.getByRole("button", { name: "프로젝트 템플릿 작성" }));

    const typeDialog = screen.getByRole("dialog", { name: "템플릿 작성" });
    expect(within(typeDialog).getByText("빈 템플릿 작성")).toBeInTheDocument();
    await user.click(within(typeDialog).getByRole("button", { name: "다음" }));

    const nameDialog = screen.getByRole("dialog", { name: "템플릿 작성" });
    await user.type(within(nameDialog).getByLabelText("템플릿 이름"), "test1");
    await user.click(within(nameDialog).getByRole("button", { name: "템플릿 작성" }));

    expect(screen.queryByRole("dialog", { name: "템플릿 작성" })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("template-row")).toHaveLength(2);
    expect(screen.getByText("test1")).toBeInTheDocument();
  });

  it("filters projects by name or number and restores the full list when cleared", async () => {
    const { user } = renderApp();
    const search = screen.getByPlaceholderText("이름 또는 번호로 프로젝트 검색...");

    await user.type(search, "Seaport");
    expect(projectRows()).toHaveLength(1);
    expect(screen.getByText("Construction : Sample Project - Seaport Civic Center")).toBeInTheDocument();
    expect(screen.queryByText("Study_Project")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "Study");
    expect(projectRows()).toHaveLength(1);
    expect(screen.getByText("Study_Project")).toBeInTheDocument();

    await user.clear(search);
    expect(projectRows()).toHaveLength(2);
  });

  it("opens My Home by default and returns there when the product brand is clicked", async () => {
    const { user } = renderApp({ startAtProjects: false });

    expect(screen.getByRole("heading", { name: "My Home" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "My Home" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "나에게 할당됨" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "내 프로젝트" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "책갈피" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "최근에 본 항목" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /^프로젝트$/ }));
    expect(screen.getByRole("button", { name: "프로젝트 만들기" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Drawing System 대시보드로 이동" }));
    expect(screen.getByRole("heading", { name: "My Home" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "A001 열기" }));

    expect(screen.getByText("Project Admin")).toBeInTheDocument();
    expect(screen.getByText("Study_Project")).toBeInTheDocument();
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
    expect(within(dialog).getByRole("option", { name: "템플릿 없음 (결정 보류)" })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "General Contractor" })).toBeInTheDocument();
  });

  it("blocks empty submit with required-name validation and keeps the list unchanged", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "프로젝트 만들기" }));
    await user.click(screen.getByRole("button", { name: "프로젝트 작성" }));

    expect(screen.getByText("프로젝트 이름을 입력하세요.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "프로젝트 작성" })).toBeInTheDocument();
    expect(projectRows()).toHaveLength(2);
  });

  it("adds exactly one local mock project, opens its own Project Admin, and makes it searchable", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "프로젝트 만들기" }));
    await user.type(screen.getByLabelText("프로젝트 이름", { exact: false }), "XD Pilot Project");
    await user.type(screen.getByLabelText("프로젝트 번호", { exact: false }), "XD-900");
    await user.click(screen.getByRole("button", { name: "프로젝트 작성" }));

    expect(screen.queryByRole("dialog", { name: "프로젝트 작성" })).not.toBeInTheDocument();
    expect(screen.getByText("Project Admin")).toBeInTheDocument();
    expect(screen.getByText("XD Pilot Project")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "구성원" })).toBeInTheDocument();
    expect(await screen.findAllByTestId("project-access-row")).toHaveLength(1);   // 신규 프로젝트: 생성자=관리자 1행
    expect(screen.getAllByText("개혁 이").length).toBeGreaterThan(0);
    expect(screen.queryByText("도면 검토자")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "프로젝트 목록" }));

    await user.type(screen.getByPlaceholderText("이름 또는 번호로 프로젝트 검색..."), "XD-900");
    expect(projectRows()).toHaveLength(1);
    expect(screen.getByRole("button", { name: "XD Pilot Project 프로젝트 열기" })).toBeInTheDocument();
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

  it("opens Project Admin member access for Study_Project from the project list", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Study_Project 프로젝트 열기" }));

    expect(screen.getByText("Project Admin")).toBeInTheDocument();
    expect(screen.getByText("Project 레벨")).toBeInTheDocument();
    expect(screen.getByText("Study_Project")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "구성원" })).toBeInTheDocument();
    expect((await screen.findAllByText("개혁 이")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Hub Admin")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "프로젝트" })).not.toBeInTheDocument();
  });

  it("opens Build sheets for Study_Project from the project list", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "Study_Project Build 열기" }));

    expect(screen.getByText("Build")).toBeInTheDocument();
    expect(screen.getByText("Project 작업 레벨")).toBeInTheDocument();
    expect(screen.getByText("Study_Project")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "시트" })).toBeInTheDocument();
    expect(await screen.findByText("A001")).toBeInTheDocument();
    expect(screen.getByText("총 6개 중 1–6")).toBeInTheDocument();
    expect(screen.queryByText("Hub Admin")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "프로젝트" })).not.toBeInTheDocument();
  });

  it("opens Build for a newly created project as an independent empty project space", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("button", { name: "프로젝트 만들기" }));
    await user.type(screen.getByLabelText("프로젝트 이름", { exact: false }), "Empty Build Project");
    await user.type(screen.getByLabelText("프로젝트 번호", { exact: false }), "EB-001");
    await user.click(screen.getByRole("button", { name: "프로젝트 작성" }));
    await user.click(screen.getByRole("button", { name: "프로젝트 목록" }));

    await user.click(screen.getByRole("button", { name: "Empty Build Project Build 열기" }));

    expect(screen.getByText("Build")).toBeInTheDocument();
    expect(screen.getByText("Empty Build Project")).toBeInTheDocument();
    expect(screen.getByText("아직 등록된 시트가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("A001")).not.toBeInTheDocument();
  });
});

describe("template detail (Project Admin template mode)", () => {
  async function openTemplateAdmin(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("tab", { name: "프로젝트 템플릿" }));
    await user.click(screen.getByRole("button", { name: "표준 프로젝트 템플릿 템플릿 열기" }));
  }

  it("opens template detail from a hub template row and returns to the templates tab", async () => {
    const { user } = renderApp();
    await openTemplateAdmin(user);

    expect(screen.getByText("템플릿 관리")).toBeInTheDocument();
    expect(screen.getAllByText("표준 프로젝트 템플릿").length).toBeGreaterThan(0);
    expect(screen.getByText("템플릿 설정")).toBeInTheDocument();
    expect(screen.getByText("프로젝트 설정")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "구성" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "프로젝트 템플릿" }));

    expect(screen.getByRole("tab", { name: "프로젝트 템플릿", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "샘플 템플릿" })).toBeInTheDocument();
    expect(screen.queryByText("템플릿 관리")).not.toBeInTheDocument();
  });

  it("switches between the five template detail sections as distinct screens", async () => {
    const { user } = renderApp();
    await openTemplateAdmin(user);

    expect(screen.getByRole("heading", { name: "구성" })).toBeInTheDocument();
    expect(screen.getByText("템플릿 게시")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "템플릿 구성원" }));
    expect(screen.getByRole("heading", { name: "템플릿 구성원" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "프로젝트 구성원" }));
    expect(screen.getByRole("heading", { name: "프로젝트 구성원" })).toBeInTheDocument();
    expect(screen.getByText("표시할 프로젝트 구성원이 없습니다.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "회사" }));
    expect(screen.getByRole("heading", { name: "회사" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "알림" }));
    expect(screen.getByRole("heading", { name: "프로젝트 알림 설정" })).toBeInTheDocument();
  });

  it("expands 기타 알림 to reveal the 15 notification tools including 자료전송", async () => {
    const { user } = renderApp();
    await openTemplateAdmin(user);
    await user.click(screen.getByRole("button", { name: "알림" }));

    expect(screen.queryAllByTestId("notify-tool-row")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "기타 알림 전개" }));

    expect(screen.getAllByTestId("notify-tool-row")).toHaveLength(15);
    expect(screen.getByText("자료전송")).toBeInTheDocument();
  });

  it("expands 필요한 작업 알림 to 9 tools and a tool to its event rows", async () => {
    const { user } = renderApp();
    await openTemplateAdmin(user);
    await user.click(screen.getByRole("button", { name: "알림" }));

    await user.click(screen.getByRole("button", { name: "필요한 작업 알림 전개" }));
    expect(screen.getAllByTestId("notify-tool-row")).toHaveLength(9);

    await user.click(screen.getByRole("button", { name: "양식 전개" }));
    expect(screen.getByText("Form assigned to you")).toBeInTheDocument();
  });

  it("keeps the general Project Admin path unchanged after adding template mode", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Study_Project 프로젝트 열기" }));

    expect(screen.getByText("Project 레벨")).toBeInTheDocument();
    expect(screen.getByText("프로젝트 관리")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "구성원" })).toBeInTheDocument();
    ["구성원", "회사", "브리지", "액티비티", "알림", "위치", "설정"].forEach((item) => {
      expect(screen.getByRole("button", { name: item })).toBeInTheDocument();
    });
    expect(screen.queryByText("템플릿 관리")).not.toBeInTheDocument();
  });
});

describe("M5 a11y 부채 정리 (접기 헤더 + 모달 해제 동작)", () => {
  it("renders the sample-template collapse header as a heading wrapping the toggle (no heading nested in a button) and toggles aria-expanded", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("tab", { name: "프로젝트 템플릿" }));

    const heading = screen.getByRole("heading", { name: "샘플 템플릿" });
    const toggle = screen.getByRole("button", { name: "샘플 템플릿" });
    // accordion 패턴: button이 heading 안에 있고, button 안에는 heading이 없어야 한다
    expect(heading).toContainElement(toggle);
    expect(within(toggle).queryByRole("heading")).toBeNull();

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("General Contractor")).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("General Contractor")).not.toBeInTheDocument();
  });

  it("closes a modal on Escape and restores focus to the trigger", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("tab", { name: "프로젝트 템플릿" }));

    const trigger = screen.getByRole("button", { name: "프로젝트 템플릿 작성" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "템플릿 작성" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "템플릿 작성" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("moves focus into the dialog when a modal opens", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("tab", { name: "프로젝트 템플릿" }));
    await user.click(screen.getByRole("button", { name: "프로젝트 템플릿 작성" }));

    const typeDialog = screen.getByRole("dialog", { name: "템플릿 작성" });
    expect(typeDialog).toContainElement(document.activeElement as HTMLElement);
  });
});

describe("지식그래프 네비게이션", () => {
  it("지식그래프 탭이 있고 클릭하면 뷰로 전환된다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ nodes: [], edges: [] }), { status: 200 })
    );
    const { user } = renderApp();

    await user.click(screen.getByRole("tab", { name: "메타그래프" }));

    // 탭 라벨("지식그래프")은 kicker에도 렌더되어 이름이 겹치므로, 뷰 고유 텍스트(범례)로 전환을 확인한다.
    expect(await screen.findByText(/curated 실선/)).toBeInTheDocument();
  });
});
