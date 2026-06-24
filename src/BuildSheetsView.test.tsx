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
    expect(screen.getByText("Project 작업 레벨")).toBeInTheDocument();
    expect(screen.getByText("Study_Project")).toBeInTheDocument();
    expect(screen.getByText("프로젝트 작업")).toBeInTheDocument();
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

  it("opens Build home, files, forms, photos, and management section shells", async () => {
    const { user } = renderBuildSheets();

    await user.click(screen.getByRole("button", { name: "홈" }));
    expect(screen.getByRole("button", { name: "홈" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "개혁 님, 환영합니다." })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "개요", selected: true })).toBeInTheDocument();
    expect(screen.getByText("프로젝트 진행률")).toBeInTheDocument();
    expect(screen.getByText("빠른 링크")).toBeInTheDocument();
    expect(screen.getByText("최근 작업")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "파일" }));
    expect(screen.getByRole("heading", { name: "파일" })).toBeInTheDocument();
    expect(screen.getByText("Welcome to Files")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "파일 업로드" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "양식" }));
    expect(screen.getByRole("heading", { name: "양식" })).toBeInTheDocument();
    expect(screen.getByText("스크린샷 근거 보강 필요")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "사진" }));
    expect(screen.getByRole("heading", { name: "사진" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "앨범", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "갤러리" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "맵" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "미디어 추가" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "구성원" }));
    expect(screen.getByRole("heading", { name: "Build 구성원" })).toBeInTheDocument();
    expect(screen.getByText("프로젝트 작업 구성원")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "브리지" }));
    expect(screen.getByRole("heading", { name: "Build 브리지" })).toBeInTheDocument();
    expect(screen.getByText("전송된 항목 없음")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "설정" }));
    expect(screen.getByRole("heading", { name: "Build 설정" })).toBeInTheDocument();
    expect(screen.getByText("프로젝트 작업 설정")).toBeInTheDocument();
  });

  it("opens issues and shows the create issue modal affordance", async () => {
    const { user } = renderBuildSheets();

    await user.click(screen.getByRole("button", { name: "이슈" }));

    expect(screen.getByRole("heading", { name: "이슈" })).toBeInTheDocument();
    expect(screen.getByText("삭제된 이슈")).toBeInTheDocument();
    expect(screen.getByText("이슈 인스펙터")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "이슈 작성" }));

    expect(screen.getByRole("dialog", { name: "이슈 작성" })).toBeInTheDocument();
    expect(screen.getByLabelText("제목")).toBeInTheDocument();
    expect(screen.getByLabelText("유형")).toBeInTheDocument();
    expect(screen.getByLabelText("담당자")).toBeInTheDocument();
  });

  it("opens a local viewer shell from a selected sheet row", async () => {
    const { user } = renderBuildSheets();

    await user.click(screen.getByRole("button", { name: "A001 열기" }));

    expect(screen.getByRole("heading", { name: "A001" })).toBeInTheDocument();
    expect(screen.getByText("ARCHITECTURAL- GRAPHIC SYMBOLS& ABBREVIATIONS")).toBeInTheDocument();
    expect(screen.getByText("정적 시트 렌더")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "마크업", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "이슈" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "시트 비교" })).toBeInTheDocument();
    expect(screen.getByText("필름스트립")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "시트 목록" }));

    expect(screen.getByRole("heading", { name: "시트" })).toBeInTheDocument();
    expect(sheetRows()).toHaveLength(6);
  });

  it("names sheet selection checkboxes for browser form-field checks", () => {
    renderBuildSheets();

    expect(screen.getByRole("textbox", { name: "시트 검색" })).toHaveAttribute("name", "sheet-search");
    expect(screen.getByRole("checkbox", { name: "모든 시트 선택" })).toHaveAttribute("name", "all-sheets");
    expect(screen.getByRole("checkbox", { name: "A001 선택" })).toHaveAttribute("name", "sheet-a001");
  });

  it("switches the Build home overview and analytics tabs", async () => {
    const { user } = renderBuildSheets();

    await user.click(screen.getByRole("button", { name: "홈" }));
    expect(screen.getByRole("tab", { name: "개요", selected: true })).toBeInTheDocument();
    expect(screen.getByText("현장 날씨")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "종합" }));
    expect(screen.getByRole("tab", { name: "종합", selected: true })).toBeInTheDocument();
    expect(screen.getByText("이슈를 완료하는 데 걸리는 평균 시간")).toBeInTheDocument();
    expect(screen.queryByText("현장 날씨")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "개요" }));
    expect(screen.getByRole("tab", { name: "개요", selected: true })).toBeInTheDocument();
    expect(screen.getByText("현장 날씨")).toBeInTheDocument();
  });

  it("renders the six analytics cards on the Build home 종합 tab", async () => {
    const { user } = renderBuildSheets();

    await user.click(screen.getByRole("button", { name: "홈" }));
    await user.click(screen.getByRole("tab", { name: "종합" }));

    [
      "이슈를 완료하는 데 걸리는 평균 시간",
      "표시할 기한이 지난 이슈",
      "작성 날짜별 이슈 상태",
      "양식을 완료하는 데 걸리는 평균 시간",
      "표시할 기한이 지난 양식",
      "매일 완료하는 양식"
    ].forEach((title) => {
      expect(screen.getByRole("region", { name: title })).toBeInTheDocument();
    });
  });

  it("toggles the sheet row export/share menu popover", async () => {
    const { user } = renderBuildSheets();

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "A001 메뉴" }));
    const menu = screen.getByRole("menu", { name: "A001 작업" });
    expect(within(menu).getByRole("menuitem", { name: "내보내기" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "공유" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "A001 메뉴" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens and closes the file upload modal affordance", async () => {
    const { user } = renderBuildSheets();

    await user.click(screen.getByRole("button", { name: "파일" }));
    expect(screen.queryByRole("dialog", { name: "파일 업로드" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "파일 업로드" }));
    const dialog = screen.getByRole("dialog", { name: "파일 업로드" });
    expect(within(dialog).getByText("여기로 파일을 끌어 놓거나 파일을 선택하십시오.")).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: "컴퓨터에서" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "파일 업로드" })).not.toBeInTheDocument();
  });
});
