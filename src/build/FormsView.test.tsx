import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FormsView from "./FormsView";

// S9.1: 양식은 백엔드 실데이터. list/create/update/delete를 목킹한다.
const inProgress = {
  form_id: "f1", title: "수배전반 인수 점검표", form_type: "검사", status: "진행중",
  assignee: "전기 감리", due_date: "2026-07-12", completion: 50, project_name: "Study_Project",
  items: [
    { label: "외관 손상 여부", checked: true },
    { label: "절연저항 측정", checked: true },
    { label: "결선 상태 확인", checked: false },
    { label: "명판 사양 일치", checked: false },
  ],
  created_at: "2026-06-29T02:00:00", updated_at: "2026-06-29T02:00:00",
};
const done = {
  ...inProgress, form_id: "f2", title: "접지 시스템 시공 점검표", form_type: "점검",
  status: "완료", completion: 100, items: [{ label: "접지극", checked: true }],
  created_at: "2026-06-29T01:00:00",
};

vi.mock("../api/forms", async (importActual) => {
  const actual = await importActual<typeof import("../api/forms")>();
  return {
    ...actual,
    listForms: vi.fn(() => Promise.resolve([inProgress, done])),
    createForm: vi.fn((input: { title: string }) =>
      Promise.resolve({ ...inProgress, form_id: "new", title: input.title, status: "미시작", completion: 0, items: [] })),
    updateForm: vi.fn((id: string, patch: { items?: unknown[]; status?: string }) =>
      Promise.resolve({ ...inProgress, form_id: id, ...patch, completion: 75 })),
    deleteForm: vi.fn(() => Promise.resolve()),
  };
});

import * as api from "../api/forms";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FormsView (S9.1 양식)", () => {
  it("renders real forms with completion", async () => {
    render(<FormsView projectName="Study_Project" />);
    expect(await screen.findByText("수배전반 인수 점검표")).toBeInTheDocument();
    expect(screen.getByText("접지 시스템 시공 점검표")).toBeInTheDocument();
    expect(api.listForms).toHaveBeenCalledWith("Study_Project");
  });

  it("shows checklist items for the selected form", async () => {
    const user = userEvent.setup();
    render(<FormsView projectName="Study_Project" />);
    await user.click(await screen.findByText("수배전반 인수 점검표"));
    expect(await screen.findByText("외관 손상 여부")).toBeInTheDocument();
    expect(screen.getByText("결선 상태 확인")).toBeInTheDocument();
  });

  it("toggles a checklist item (persisted via updateForm)", async () => {
    const user = userEvent.setup();
    render(<FormsView projectName="Study_Project" />);
    await user.click(await screen.findByText("수배전반 인수 점검표"));
    const checkboxes = await screen.findAllByRole("checkbox");
    await user.click(checkboxes[2]); // "결선 상태 확인" (unchecked → toggle)
    expect(api.updateForm).toHaveBeenCalledWith("f1", expect.objectContaining({ items: expect.any(Array) }));
  });

  it("creates a form through the modal", async () => {
    const user = userEvent.setup();
    render(<FormsView projectName="Study_Project" />);
    await screen.findByText("수배전반 인수 점검표");
    await user.click(screen.getByRole("button", { name: "양식 작성" }));
    await user.type(screen.getByLabelText("제목"), "전기실 소방 점검표");
    await user.click(screen.getByRole("button", { name: "작성" }));
    expect(api.createForm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "전기실 소방 점검표", projectName: "Study_Project" }),
    );
  });

  it("gates create/checklist/status for viewers (canEdit=false)", async () => {
    const user = userEvent.setup();
    render(<FormsView projectName="Study_Project" canEdit={false} />);
    await screen.findByText("수배전반 인수 점검표");
    expect(screen.getByRole("button", { name: "양식 작성" })).toBeDisabled();
    await user.click(screen.getByText("수배전반 인수 점검표"));
    expect(await screen.findByLabelText("양식 상태")).toBeDisabled();
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeDisabled();
  });
});
