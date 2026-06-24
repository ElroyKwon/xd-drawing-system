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
    expect(screen.getByRole("tab", { name: "My Home", selected: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "프로젝트 만들기" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("이름 또는 번호로 프로젝트 검색...")).toHaveAttribute("name", "project-search");

    ["유형", "이름", "번호", "기본 액세스", "허브", "작성 날짜"].forEach((column) => {
      expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Study_Project 프로젝트 열기" })).toBeInTheDocument();
    expect(screen.getByText("Construction : Sample Project - Seaport Civic Center")).toBeInTheDocument();
    expect(screen.getByText("2개 중 1-2개 표시 중")).toBeInTheDocument();
  });

  it("renders only the three ACC hub tabs without a Hub settings tab", () => {
    renderApp();

    expect(screen.getByRole("tab", { name: "My Home" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "프로젝트" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "프로젝트 템플릿" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "허브 설정" })).not.toBeInTheDocument();
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

  it("shows My Home with the four ACC dashboard widgets and an actionable recent item", async () => {
    const { user } = renderApp();

    await user.click(screen.getByRole("tab", { name: "My Home" }));

    expect(screen.getByRole("tab", { name: "My Home", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "나에게 할당됨" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "내 프로젝트" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "책갈피" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "최근에 본 항목" })).toBeInTheDocument();

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
    expect(screen.getAllByTestId("project-access-row")).toHaveLength(1);
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
    expect(screen.getAllByText("개혁 이").length).toBeGreaterThan(0);
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
    expect(screen.getByText("A001")).toBeInTheDocument();
    expect(screen.getByText("6 중 1-6 표시")).toBeInTheDocument();
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
