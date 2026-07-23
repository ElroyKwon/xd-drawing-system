import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FilesView from "./FilesView";

// S3: 폴더 트리/파일 목록은 백엔드 실데이터. listFolders/listDrawings 등을 목킹한다.
vi.mock("../api/drawings", async (importActual) => {
  const actual = await importActual<typeof import("../api/drawings")>();
  const folders = [
    { folder_id: "P::bids", project_name: "Study_Project", name: "Bids", parent_id: null, share_status: "프로젝트 공유", permissions: [], updated_at: "2026-06-25T00:00:00", updated_by: "시스템" },
    { folder_id: "P::drawings", project_name: "Study_Project", name: "Drawings", parent_id: null, share_status: "비공개", permissions: [], updated_at: "2026-06-25T00:00:00", updated_by: "시스템" },
    { folder_id: "P::supported", project_name: "Study_Project", name: "Supported files", parent_id: null, share_status: "프로젝트 공유", permissions: [], updated_at: "2026-06-25T00:00:00", updated_by: "시스템" },
    { folder_id: "P::pdfs", project_name: "Study_Project", name: "PDFs", parent_id: "P::supported", share_status: "프로젝트 공유", permissions: [], updated_at: "2026-06-25T00:00:00", updated_by: "시스템" },
  ];
  const drawing = {
    file_id: "d1", filename: "plan.dwg", file_format: "dwg", file_size: 2048,
    upload_date: "2026-06-25T00:00:00", project_name: "Study_Project", version: "2",
    version_set_id: "d0", version_no: 2, is_latest: true, folder_id: null, uploaded_by: "홍길동",
    share_status: "프로젝트 공유",
    conversion_status: "completed",
    sheets: [{ sheet_id: "s1", sheet_name: "Layout1", sheet_index: 0, source: "paperspace" }],
  };
  return {
    ...actual,
    listFolders: vi.fn().mockResolvedValue(folders),
    listDrawings: vi.fn().mockResolvedValue([drawing]),
    createFolder: vi.fn().mockResolvedValue(folders[0]),
    updateFolder: vi.fn().mockResolvedValue(folders[0]),
    deleteFolder: vi.fn().mockResolvedValue(undefined),
    deleteDrawing: vi.fn().mockResolvedValue(undefined),
    addDrawingVersion: vi.fn().mockResolvedValue(drawing),
    listDrawingVersions: vi.fn().mockResolvedValue([
      drawing,
      { ...drawing, file_id: "d0", version_no: 1, is_latest: false },
    ]),
    getDrawing: vi.fn().mockResolvedValue(drawing),
  };
});

import * as api from "../api/drawings";

function renderFiles() {
  return { user: userEvent.setup(), ...render(<FilesView />) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FilesView (S3 파일/폴더 관리)", () => {
  it("renders the real folder tree from the backend (no static seed)", async () => {
    renderFiles();
    const tree = screen.getByRole("complementary", { name: "폴더" });
    expect(await within(tree).findByRole("button", { name: "Bids" })).toBeInTheDocument();
    expect(within(tree).getByRole("button", { name: "Drawings" })).toBeInTheDocument();
    // 자식 폴더(PDFs)도 트리에 렌더
    expect(within(tree).getByRole("button", { name: "PDFs" })).toBeInTheDocument();
    // 루트 노드
    expect(within(tree).getByRole("button", { name: "프로젝트 파일" })).toBeInTheDocument();
  });

  it("lists files with version and shows the placeholder markup/issue columns", async () => {
    const { container } = renderFiles();
    expect(await screen.findByText("plan.dwg")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "",
      "이름",
      "설명",
      "버전",
      "공유 상태",
      "마크업",
      "이슈",
      "크기",
      "마지막 업데이트",
      "최종 수정자",
      "버전 추가자",
      "",
    ]);
    expect(container.querySelectorAll(".files-table col")).toHaveLength(12);
    // 버전세트 표시 v2
    expect(screen.getByText("v2")).toBeInTheDocument();
    // 크기 포맷
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
    // 버전 추가자(uploaded_by)
    expect(screen.getAllByText("홍길동").length).toBeGreaterThan(0);
  });

  it("creates a new folder in the selected location", async () => {
    const { user } = renderFiles();
    const tree = screen.getByRole("complementary", { name: "폴더" });
    await within(tree).findByRole("button", { name: "Bids" });
    await user.click(screen.getByRole("button", { name: "새 폴더" }));
    await user.type(screen.getByLabelText("새 폴더 이름"), "내폴더");
    await user.click(screen.getByRole("button", { name: "추가" }));
    expect(api.createFolder).toHaveBeenCalledWith(
      expect.objectContaining({ name: "내폴더", projectName: "Study_Project" }),
    );
  });

  it("filters files to the selected folder when navigating the tree", async () => {
    const { user } = renderFiles();
    const tree = screen.getByRole("complementary", { name: "폴더" });
    await user.click(await within(tree).findByRole("button", { name: "Drawings" }));
    // 폴더 선택 시 해당 folder_id로 재조회한다.
    expect(api.listDrawings).toHaveBeenCalledWith(
      "Study_Project",
      expect.objectContaining({ folderId: "P::drawings", latestOnly: true }),
    );
  });

  it("shows a structured folder empty state without a zero-item pagination footer", async () => {
    const { user } = renderFiles();
    const tree = screen.getByRole("complementary", { name: "폴더" });
    await screen.findByText("plan.dwg");
    vi.mocked(api.listDrawings).mockResolvedValueOnce([]);

    await user.click(await within(tree).findByRole("button", { name: "Bids" }));

    const title = await screen.findByText("Bids 폴더가 비어 있습니다");
    const emptyState = title.closest('[role="status"]');
    expect(emptyState).not.toBeNull();
    expect(within(emptyState as HTMLElement).getByText(/파일을 업로드하거나 새 폴더/)).toBeInTheDocument();
    expect(screen.queryByText("0개 항목 표시 중")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("파일 페이지네이션")).not.toBeInTheDocument();
  });

  it("opens the version history modal from the row menu", async () => {
    const { user } = renderFiles();
    await screen.findByText("plan.dwg");
    await user.click(screen.getByRole("button", { name: "plan.dwg 메뉴" }));
    await user.click(screen.getByRole("menuitem", { name: /버전 이력/ }));
    expect(api.listDrawingVersions).toHaveBeenCalledWith("d1");
    const dialog = await screen.findByRole("dialog", { name: /버전 이력/ });
    expect(within(dialog).getByText("v2 (최신)")).toBeInTheDocument();
    expect(within(dialog).getByText("v1")).toBeInTheDocument();
    expect(dialog.querySelectorAll(".version-history-table col")).toHaveLength(6);
  });

  it("shows the file's own share status (not the selected folder's)", async () => {
    // 루트(currentFolder=null) 선택 상태여도 파일 행은 파일 자신의 share_status를 표시해야 한다.
    renderFiles();
    const cell = await screen.findByText("plan.dwg");
    const row = cell.closest("tr")!;
    expect(within(row).getByText("프로젝트 공유")).toBeInTheDocument();
  });

  it("toggles a folder's share status from the row menu", async () => {
    const { user } = renderFiles();
    await screen.findByText("plan.dwg");
    // 테이블 폴더 행(Bids, share=프로젝트 공유)의 메뉴 → 비공개로 전환
    await user.click(screen.getByRole("button", { name: "Bids 메뉴" }));
    await user.click(screen.getByRole("menuitem", { name: /비공개로 전환/ }));
    expect(api.updateFolder).toHaveBeenCalledWith("P::bids", { share_status: "비공개" });
  });

  it("triggers an explicit new-version upload from the row menu", async () => {
    const { user } = renderFiles();
    await screen.findByText("plan.dwg");
    await user.click(screen.getByRole("button", { name: "plan.dwg 메뉴" }));
    // "새 버전 추가" 클릭으로 대상 file_id를 설정한 뒤 파일 선택.
    await user.click(screen.getByRole("menuitem", { name: /새 버전 추가/ }));
    const fileInput = screen.getByLabelText("새 버전 파일 선택") as HTMLInputElement;
    await user.upload(fileInput, new File(["x"], "plan_v2.dwg", { type: "application/octet-stream" }));
    expect(api.addDrawingVersion).toHaveBeenCalledWith("d1", expect.any(File));
  });

  // J7: 뷰어(canEdit=false)는 업로드·폴더 생성·폴더 메뉴·삭제/새버전이 비활성/숨김. 조회는 유지.
  describe("뷰어 권한 UI 게이팅 (canEdit=false)", () => {
    it("disables upload and new-folder controls for viewers", async () => {
      render(<FilesView canEdit={false} />);
      await screen.findByText("plan.dwg");
      expect(screen.getByRole("button", { name: "파일 업로드" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "새 폴더" })).toBeDisabled();
    });

    it("hides the all-mutating folder row menu for viewers", async () => {
      render(<FilesView canEdit={false} />);
      await screen.findByText("plan.dwg");
      // 폴더 메뉴(이름변경·공유·삭제)는 전부 뮤테이션 → 뷰어에게 숨김.
      expect(screen.queryByRole("button", { name: "Bids 메뉴" })).not.toBeInTheDocument();
    });

    it("keeps read-only drawing menu items but hides edit items for viewers", async () => {
      const { user } = { user: userEvent.setup() };
      render(<FilesView canEdit={false} />);
      await screen.findByText("plan.dwg");
      await user.click(screen.getByRole("button", { name: "plan.dwg 메뉴" }));
      // 조회 항목은 유지.
      expect(screen.getByRole("menuitem", { name: /다운로드/ })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: /버전 이력/ })).toBeInTheDocument();
      // 편집 항목은 숨김.
      expect(screen.queryByRole("menuitem", { name: /새 버전 추가/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /삭제/ })).not.toBeInTheDocument();
    });
  });
});
