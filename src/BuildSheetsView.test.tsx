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
    expect(within(dialog).getByText(/파일을 선택하십시오/)).toBeInTheDocument();
    expect(within(dialog).getByRole("tab", { name: "컴퓨터에서" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog", { name: "파일 업로드" })).not.toBeInTheDocument();
  });

  async function openViewer(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "A001 열기" }));
  }

  it("toggles the active markup tool in the viewer tool rail", async () => {
    const { user } = renderBuildSheets();
    await openViewer(user);

    const rail = screen.getByRole("complementary", { name: "마크업 도구" });
    expect(within(rail).getByRole("button", { name: "선택" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(rail).getByRole("button", { name: "텍스트" }));
    expect(within(rail).getByRole("button", { name: "텍스트" })).toHaveAttribute("aria-pressed", "true");
    expect(within(rail).getByRole("button", { name: "선택" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a type-specific property panel when a markup is selected", async () => {
    const { user } = renderBuildSheets();
    await openViewer(user);

    await user.click(screen.getByRole("button", { name: "텍스트 마크업: 치수 확인 요망" }));
    const textProps = screen.getByRole("complementary", { name: "텍스트 마크업 속성" });
    expect(within(textProps).getByText("글꼴")).toBeInTheDocument();
    expect(within(textProps).getByText("작성자 김도면")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "클라우드 마크업: 리비전 클라우드" }));
    const cloudProps = screen.getByRole("complementary", { name: "클라우드 마크업 속성" });
    expect(within(cloudProps).getByText("선 두께")).toBeInTheDocument();
    expect(within(cloudProps).queryByText("글꼴")).not.toBeInTheDocument();
  });

  it("switches the left viewer panel between markup, log, and issue tabs", async () => {
    const { user } = renderBuildSheets();
    await openViewer(user);

    expect(screen.getByRole("tab", { name: "마크업", selected: true })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "마크업 로그" }));
    expect(screen.getByRole("tab", { name: "마크업 로그", selected: true })).toBeInTheDocument();
    expect(screen.getByLabelText("색상 필터")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "이슈" }));
    expect(screen.getByRole("tab", { name: "이슈", selected: true })).toBeInTheDocument();
    expect(screen.getByLabelText("이슈 검색")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clash/ })).toBeInTheDocument();
  });

  it("opens the measure panel and calibration modal affordance", async () => {
    const { user } = renderBuildSheets();
    await openViewer(user);

    await user.click(screen.getByRole("button", { name: "측정" }));
    const measure = screen.getByRole("complementary", { name: "측정 교정" });
    expect(within(measure).getByLabelText("축척 설정")).toBeInTheDocument();
    expect(within(measure).getByRole("button", { name: "다각형 면적" })).toBeInTheDocument();

    await user.click(within(measure).getByRole("button", { name: "교정" }));
    expect(screen.getByRole("dialog", { name: "교정을 만드시겠습니까?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog", { name: "교정을 만드시겠습니까?" })).not.toBeInTheDocument();
  });

  it("compares two sheets: B selection enables compare and opens the result overlay", async () => {
    const { user } = renderBuildSheets();
    await openViewer(user);

    await user.click(screen.getByRole("button", { name: "시트 비교" }));
    const dialog = screen.getByRole("dialog", { name: "시트 비교" });
    expect(within(dialog).getByRole("button", { name: "비교" })).toBeDisabled();

    await user.selectOptions(within(dialog).getByLabelText("시트 B 선택"), "sheet-e101");
    expect(within(dialog).getByRole("button", { name: "비교" })).toBeEnabled();

    await user.click(within(dialog).getByRole("button", { name: "비교" }));
    expect(screen.queryByRole("dialog", { name: "시트 비교" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("비교 결과 A001 대 E101")).toBeInTheDocument();
    expect(screen.getByText("비교한 문서")).toBeInTheDocument();

    // 비교 모드에서는 메인 하단 컨트롤이 숨겨져 zoom 라벨이 중복되지 않는다.
    expect(screen.queryByRole("button", { name: "시트 비교" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "축소" })).toHaveLength(1);
  });

  it("closes the measure panel when a non-measure tool is selected", async () => {
    const { user } = renderBuildSheets();
    await openViewer(user);

    const rail = screen.getByRole("complementary", { name: "마크업 도구" });
    await user.click(within(rail).getByRole("button", { name: "측정" }));
    expect(screen.getByRole("complementary", { name: "측정 교정" })).toBeInTheDocument();

    await user.click(within(rail).getByRole("button", { name: "텍스트" }));
    expect(screen.queryByRole("complementary", { name: "측정 교정" })).not.toBeInTheDocument();
    expect(within(rail).getByRole("button", { name: "측정" })).toHaveAttribute("aria-pressed", "false");
    expect(within(rail).getByRole("button", { name: "텍스트" })).toHaveAttribute("aria-pressed", "true");
  });
});
