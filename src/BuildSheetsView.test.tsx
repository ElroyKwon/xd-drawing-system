import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BuildSheetsView from "./BuildSheetsView";

// S2: 시트 목록은 백엔드 업로드 도면(실데이터)으로 구성된다. listDrawings를 목킹해 고정 시트 세트를
// 제공하고 나머지(drawingsToSheets 등)는 실제 구현을 쓴다. 픽스처는 hoisting 안전을 위해 팩토리 내부에 둔다.
vi.mock("./api/drawings", async (importActual) => {
  const actual = await importActual<typeof import("./api/drawings")>();
  const mk = (id: string, num: string, title: string, code: string, label: string) => ({
    sheet_id: id, sheet_name: num, sheet_index: 0, source: "pdf-page",
    sheet_number: num, sheet_title: title, discipline_code: code, discipline_label: label,
  });
  const fixture = [
    {
      file_id: "seed", filename: "seed.pdf", file_format: "pdf", file_size: 1,
      upload_date: "2026-06-25T00:00:00", project_name: "Study_Project", version: "1",
      conversion_status: "completed",
      sheets: [
        mk("sheet-a001", "A001", "ARCHITECTURAL- GRAPHIC SYMBOLS& ABBREVIATIONS", "A", "A (건축)"),
        mk("sheet-a101", "A101", "OFFICE- FLOOR PLAN- LEVEL1", "A", "A (건축)"),
        mk("sheet-a102", "A102", "OFFICE- FLOOR PLAN- LEVEL 2,3&4", "A", "A (건축)"),
        mk("sheet-e101", "E101", "OFFICE- POWER PLAN- LEVEL1", "E", "E (전기)"),
        mk("sheet-m101", "M101", "OFFICE- MECHANICAL PLAN- LEVEL1", "M", "M (기계)"),
        mk("sheet-p101", "P101", "OFFICE- PLUMBING PLAN- LEVEL1", "P", "P (배관)"),
      ],
    },
  ];
  return {
    ...actual,
    listDrawings: vi.fn().mockResolvedValue(fixture),
    // S4: 뷰어가 마운트 시 마크업/측정/버전을 조회한다. 단위 테스트는 빈 상태로 결정론화(실 네트워크 회피).
    listMarkups: vi.fn().mockResolvedValue([]),
    listMeasurements: vi.fn().mockResolvedValue([]),
    listDrawingVersions: vi.fn().mockResolvedValue([]),
  };
});

function renderBuildSheets() {
  return {
    user: userEvent.setup(),
    ...render(<BuildSheetsView onBackToProjects={() => undefined} />),
  };
}

function sheetRows() {
  return screen.getAllByTestId("sheet-row");
}

// 시트가 비동기로 로드되므로 행이 나타날 때까지 기다린다.
async function loadedRows() {
  return screen.findAllByTestId("sheet-row");
}

async function openViewer(user: ReturnType<typeof userEvent.setup>) {
  const open = await screen.findByRole("button", { name: "A001 열기" });
  await user.click(open);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BuildSheetsView", () => {
  it("renders the Build shell and sheets table for Study_Project", async () => {
    renderBuildSheets();

    expect(screen.getByText("Build")).toBeInTheDocument();
    expect(screen.getByText("Project 작업 레벨")).toBeInTheDocument();
    expect(screen.getByText("Study_Project")).toBeInTheDocument();
    expect(screen.getByText("프로젝트 작업")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "시트" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: "시트" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("시트 검색 및 필터")).toBeInTheDocument();

    ["번호", "버전 세트", "공종", "태그", "최종 수정자"].forEach((column) => {
      expect(screen.getByRole("columnheader", { name: column })).toBeInTheDocument();
    });

    expect(await loadedRows()).toHaveLength(6);
    expect(screen.getByText("A001")).toBeInTheDocument();
    expect(screen.getByText("P101")).toBeInTheDocument();
    expect(screen.getByText("총 6개 중 1–6")).toBeInTheDocument();
  });

  it("filters sheets by number, title, discipline, and tag", async () => {
    const { user } = renderBuildSheets();
    await loadedRows();
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

  it("filters by discipline and sorts sheet numbers", async () => {
    const { user } = renderBuildSheets();
    await loadedRows();

    // 공종 필터: 전기(E)만
    await user.selectOptions(screen.getByLabelText("공종 필터"), "E");
    expect(sheetRows()).toHaveLength(1);
    expect(within(sheetRows()[0]).getByText("E101")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("공종 필터"), "전체");
    expect(sheetRows()).toHaveLength(6);

    // 정렬 토글: 내림차순이면 첫 행이 P101
    await user.click(screen.getByRole("button", { name: /번호 정렬/ }));
    expect(within(sheetRows()[0]).getByText("P101")).toBeInTheDocument();
  });

  it("updates the selected view toggle while keeping the list usable", async () => {
    const { user } = renderBuildSheets();
    await loadedRows();

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
    expect(screen.getByText("최근 활동")).toBeInTheDocument();

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
    await openViewer(user);

    expect(screen.getByRole("heading", { name: "A001" })).toBeInTheDocument();
    expect(screen.getByText("ARCHITECTURAL- GRAPHIC SYMBOLS& ABBREVIATIONS")).toBeInTheDocument();
    expect(screen.getByText("정적 시트 렌더")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "마크업", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "이슈" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "시트 비교" })).toBeInTheDocument();
    expect(screen.getByText("필름스트립")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "시트 목록" }));

    expect(screen.getByRole("heading", { name: "시트" })).toBeInTheDocument();
    expect(await loadedRows()).toHaveLength(6);
  });

  it("names sheet selection checkboxes for browser form-field checks", async () => {
    renderBuildSheets();
    await loadedRows();

    expect(screen.getByRole("textbox", { name: "시트 검색" })).toHaveAttribute("name", "sheet-search");
    expect(screen.getByRole("checkbox", { name: "모든 시트 선택" })).toHaveAttribute("name", "all-sheets");
    expect(screen.getByRole("checkbox", { name: "A001 선택" })).toHaveAttribute("name", "sheet-a001");
  });

  it("switches the Build home overview and analytics tabs", async () => {
    const { user } = renderBuildSheets();

    await user.click(screen.getByRole("button", { name: "홈" }));
    expect(screen.getByRole("tab", { name: "개요", selected: true })).toBeInTheDocument();
    expect(screen.getByText("저장 용량")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "종합" }));
    expect(screen.getByRole("tab", { name: "종합", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "작성 날짜별 이슈 상태" })).toBeInTheDocument();
    expect(screen.queryByText("저장 용량")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "개요" }));
    expect(screen.getByRole("tab", { name: "개요", selected: true })).toBeInTheDocument();
    expect(screen.getByText("저장 용량")).toBeInTheDocument();
  });

  it("renders the analytics cards on the Build home 종합 tab (이슈 차트 + 양식 빈 상태)", async () => {
    const { user } = renderBuildSheets();

    await user.click(screen.getByRole("button", { name: "홈" }));
    await user.click(screen.getByRole("tab", { name: "종합" }));

    [
      "작성 날짜별 이슈 상태",
      "양식을 완료하는 데 걸리는 평균 시간",
      "표시할 기한이 지난 양식",
      "매일 완료하는 양식",
    ].forEach((title) => {
      expect(screen.getByRole("region", { name: title })).toBeInTheDocument();
    });
  });

  it("toggles the sheet row export/share menu popover", async () => {
    const { user } = renderBuildSheets();
    await loadedRows();

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

  it("toggles the active markup tool in the viewer tool rail", async () => {
    const { user } = renderBuildSheets();
    await openViewer(user);

    const rail = screen.getByRole("complementary", { name: "마크업 도구" });
    expect(within(rail).getByRole("button", { name: "선택" })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(rail).getByRole("button", { name: "텍스트" }));
    expect(within(rail).getByRole("button", { name: "텍스트" })).toHaveAttribute("aria-pressed", "true");
    expect(within(rail).getByRole("button", { name: "선택" })).toHaveAttribute("aria-pressed", "false");
  });

  it("starts with an empty markup list (real data, no demo seed)", async () => {
    const { user } = renderBuildSheets();
    await openViewer(user);

    // 정적 demoMarkups 제거 — 마크업은 백엔드 영속이며 빈 시트는 빈 목록을 보인다.
    expect(await screen.findByText(/아직 마크업이 없습니다/)).toBeInTheDocument();
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

  it("opens the measure panel; a PDF sheet shows the DXF-only measurement notice", async () => {
    const { user } = renderBuildSheets();
    await openViewer(user);

    await user.click(screen.getByRole("button", { name: "측정" }));
    const measure = screen.getByRole("complementary", { name: "측정 교정" });
    // PDF 시트(pdf-page)는 벡터 비가용 → 측정 비활성 안내(무성 오작동 금지, E7).
    expect(within(measure).getByText(/DXF 벡터 시트 전용|벡터로 전환/)).toBeInTheDocument();
  });

  it("opens the version compare modal with a version picker", async () => {
    const { user } = renderBuildSheets();
    await openViewer(user);

    await user.click(screen.getByRole("button", { name: "시트 비교" }));
    const dialog = screen.getByRole("dialog", { name: "시트 비교" });
    // 같은 version_set의 다른 버전을 고른다(없으면 비교 비활성).
    expect(within(dialog).getByLabelText("비교 버전 선택")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "비교" })).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog", { name: "시트 비교" })).not.toBeInTheDocument();
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
