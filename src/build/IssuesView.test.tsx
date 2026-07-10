import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IssuesView from "./IssuesView";
import type { Sheet } from "../buildSheetsData";

// S5: 이슈는 백엔드 실데이터. listIssues/createIssue/updateIssue/deleteIssue를 목킹한다.
const pinIssue = {
  issue_id: "i1", file_id: "F", sheet_id: "s1",
  title: "현장 패널 번호와 도면 표기가 다름 — CAD 확인 요청", type: "현장 확인",
  status: "열림", category: "clash", assignee: "도면 검토자", author: "사용자",
  description: "", project_name: "Study_Project",
  pin: { point: [120, 80], coord_space: "world" },
  created_at: "2026-06-29T01:00:00", updated_at: "2026-06-29T01:00:00",
};
const globalIssue = {
  ...pinIssue, issue_id: "i2", sheet_id: null, file_id: null, pin: null,
  title: "구역명/장비 태그 식별 불명확", type: "설계 검토", category: "quality",
  created_at: "2026-06-29T02:00:00",
};
// B1/B2: 단건 조회는 댓글·해결버전을 실어 온다.
const existingComment = {
  comment_id: "c1", author_id: "u2", author_name: "협력사 담당",
  body: "현장 재확인 완료, 도면 반영 예정", created_at: "2026-06-30T02:00:00",
};

vi.mock("../api/drawings", async (importActual) => {
  const actual = await importActual<typeof import("../api/drawings")>();
  return {
    ...actual,
    listIssues: vi.fn((filters: { status?: string } = {}) =>
      Promise.resolve(filters.status === "삭제됨" ? [] : [globalIssue, pinIssue])),
    createIssue: vi.fn((input: { title: string }) =>
      Promise.resolve({ ...globalIssue, issue_id: "new", title: input.title })),
    updateIssue: vi.fn((id: string, patch: { status?: string }) =>
      Promise.resolve({ ...pinIssue, issue_id: id, status: patch.status ?? "열림" })),
    deleteIssue: vi.fn(() => Promise.resolve()),
    getIssue: vi.fn((id: string) =>
      Promise.resolve(id === "i1"
        ? { ...pinIssue, comments: [existingComment], resolution: { file_id: "F", version_no: 2, note: "rev2 반영" } }
        : { ...globalIssue, issue_id: id, comments: [] })),
    addIssueComment: vi.fn((id: string, body: string) =>
      Promise.resolve({
        ...pinIssue, issue_id: id,
        comments: [existingComment, { comment_id: "c2", author_id: "me", author_name: "나", body, created_at: "2026-06-30T03:00:00" }],
      })),
  };
});

import * as api from "../api/drawings";

const sheets: Sheet[] = [
  {
    id: "s1", projectId: "p", number: "E-101", title: "전력 간선 계통도", version: "1",
    versionSet: "-", disciplineCode: "E", disciplineLabel: "E (전기)", tag: "dwg",
    lastUpdatedBy: "업로드", imageUrl: undefined, fileId: "F", source: "paperspace",
    sheetIndex: 0, versionSetId: "F",
  },
];

function renderIssues(onOpenIssuePin = vi.fn()) {
  return {
    user: userEvent.setup(),
    onOpenIssuePin,
    ...render(<IssuesView projectName="Study_Project" sheets={sheets} onOpenIssuePin={onOpenIssuePin} />),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("IssuesView (S5 이슈 영속)", () => {
  it("renders real issues from the backend (no hardcoded row)", async () => {
    renderIssues();
    expect(await screen.findByText("구역명/장비 태그 식별 불명확")).toBeInTheDocument();
    expect(screen.getByText(/현장 패널 번호와 도면 표기가 다름/)).toBeInTheDocument();
    // 정적 시드 행 제거 확인
    expect(screen.queryByText("문 출입 방향 확인")).not.toBeInTheDocument();
    expect(api.listIssues).toHaveBeenCalledWith({ projectName: "Study_Project" });
  });

  it("creates an issue through the modal (real POST)", async () => {
    const { user } = renderIssues();
    await screen.findByText("구역명/장비 태그 식별 불명확");
    await user.click(screen.getByRole("button", { name: "이슈 작성" }));
    await user.type(screen.getByLabelText("제목"), "설비 위치 변경 확인 후 도면 수정 요청");
    await user.click(screen.getByRole("button", { name: "작성" }));
    expect(api.createIssue).toHaveBeenCalledWith(
      expect.objectContaining({ title: "설비 위치 변경 확인 후 도면 수정 요청", projectName: "Study_Project" }),
    );
    // 목록 + 인스펙터 양쪽에 노출(생성 직후 선택됨).
    expect((await screen.findAllByText("설비 위치 변경 확인 후 도면 수정 요청")).length).toBeGreaterThan(0);
  });

  it("changes issue status (persisted via updateIssue)", async () => {
    const { user } = renderIssues();
    await user.click(await screen.findByText(/현장 패널 번호와 도면 표기가 다름/));
    const statusSelect = await screen.findByLabelText("이슈 상태");
    await user.selectOptions(statusSelect, "진행중");
    expect(api.updateIssue).toHaveBeenCalledWith("i1", { status: "진행중" });
  });

  it("jumps to the viewer pin for a pinned issue (deep-link)", async () => {
    const { user, onOpenIssuePin } = renderIssues();
    await user.click(await screen.findByText(/현장 패널 번호와 도면 표기가 다름/));
    await user.click(await screen.findByRole("button", { name: "뷰어에서 핀 보기" }));
    expect(onOpenIssuePin).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s1" }),
      expect.objectContaining({ issue_id: "i1" }),
    );
  });

  it("switches to the deleted-issues filter", async () => {
    const { user } = renderIssues();
    await screen.findByText("구역명/장비 태그 식별 불명확");
    await user.click(screen.getByRole("button", { name: "삭제된 이슈" }));
    expect(api.listIssues).toHaveBeenCalledWith({ status: "삭제됨", projectName: "Study_Project" });
    expect(await screen.findByText("삭제된 이슈가 없습니다.")).toBeInTheDocument();
  });

  // B1: 댓글 스레드 — 선택 시 단건 조회로 하이드레이트되어 기존 댓글이 보인다.
  it("hydrates and renders the comment thread for a selected issue", async () => {
    const { user } = renderIssues();
    await user.click(await screen.findByText(/현장 패널 번호와 도면 표기가 다름/));
    expect(api.getIssue).toHaveBeenCalledWith("i1");
    expect(await screen.findByText("현장 재확인 완료, 도면 반영 예정")).toBeInTheDocument();
    // B2: 해결 버전도 함께 표시.
    expect(screen.getByText(/해결 버전:/)).toBeInTheDocument();
  });

  // B1: 뷰어 포함 누구나 댓글 작성 → API 호출 + 새 댓글이 스레드에 노출.
  it("posts a comment and shows it in the thread", async () => {
    const { user } = renderIssues();
    await user.click(await screen.findByText(/현장 패널 번호와 도면 표기가 다름/));
    await screen.findByText("현장 재확인 완료, 도면 반영 예정");
    await user.type(screen.getByLabelText("댓글 입력"), "확인했습니다, 승인합니다");
    await user.click(screen.getByRole("button", { name: "댓글 남기기" }));
    expect(api.addIssueComment).toHaveBeenCalledWith("i1", "확인했습니다, 승인합니다");
    expect(await screen.findByText("확인했습니다, 승인합니다")).toBeInTheDocument();
  });

  // J7: 뷰어(canEdit=false)는 이슈 작성·상태 변경·삭제가 비활성/숨김. 조회·핀 딥링크는 유지.
  describe("뷰어 권한 UI 게이팅 (canEdit=false)", () => {
    it("disables create and gates status/delete for viewers", async () => {
      const user = userEvent.setup();
      render(<IssuesView projectName="Study_Project" sheets={sheets} onOpenIssuePin={vi.fn()} canEdit={false} />);
      await screen.findByText("구역명/장비 태그 식별 불명확");
      expect(screen.getByRole("button", { name: "이슈 작성" })).toBeDisabled();
      // 이슈 선택 시 상태 select는 비활성, 삭제 버튼은 숨김.
      await user.click(screen.getByText(/현장 패널 번호와 도면 표기가 다름/));
      expect(await screen.findByLabelText("이슈 상태")).toBeDisabled();
      expect(screen.queryByRole("button", { name: /이슈 삭제/ })).not.toBeInTheDocument();
    });
  });
});
