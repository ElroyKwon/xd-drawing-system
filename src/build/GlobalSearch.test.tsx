import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GlobalSearch from "./GlobalSearch";

const results = {
  query: "EE",
  sheets: [{ file_id: "F1", sheet_id: "s1", number: "EE-01-006", title: "단선결선도", label: "EE-01-006 · 단선결선도" }],
  issues: [{ issue_id: "i1", file_id: "F1", sheet_id: "s1", title: "EE 분전반 확인", status: "열림", label: "EE 분전반 확인" }],
  files: [{ file_id: "F1", folder_id: "fld1", filename: "EE-01-006.pdf", label: "EE-01-006.pdf" }],
  folders: [],
  truncated: false,
};

vi.mock("../api/drawings", async (importActual) => {
  const actual = await importActual<typeof import("../api/drawings")>();
  return { ...actual, searchProject: vi.fn(() => Promise.resolve(results)) };
});

import * as api from "../api/drawings";

beforeEach(() => vi.clearAllMocks());

function setup() {
  const onPickSheet = vi.fn();
  const onPickIssue = vi.fn();
  const onPickFolder = vi.fn();
  return {
    onPickSheet, onPickIssue, onPickFolder,
    user: userEvent.setup(),
    ...render(<GlobalSearch projectName="Study_Project" onPickSheet={onPickSheet} onPickIssue={onPickIssue} onPickFolder={onPickFolder} />),
  };
}

describe("GlobalSearch", () => {
  it("입력 시 타입별 결과를 표시한다", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("프로젝트 전역 검색"), "EE");
    expect(await screen.findByText("EE-01-006 · 단선결선도")).toBeInTheDocument();
    expect(screen.getByText("EE 분전반 확인")).toBeInTheDocument();
    expect(screen.getByText("EE-01-006.pdf")).toBeInTheDocument();
    expect(api.searchProject).toHaveBeenCalledWith("Study_Project", "EE");
  });

  it("시트 결과 클릭 시 onPickSheet 딥링크 콜백", async () => {
    const { user, onPickSheet } = setup();
    await user.type(screen.getByLabelText("프로젝트 전역 검색"), "EE");
    await user.click(await screen.findByText("EE-01-006 · 단선결선도"));
    expect(onPickSheet).toHaveBeenCalledWith("s1");
  });

  it("이슈 결과 클릭 시 onPickIssue 딥링크 콜백", async () => {
    const { user, onPickIssue } = setup();
    await user.type(screen.getByLabelText("프로젝트 전역 검색"), "EE");
    await user.click(await screen.findByText("EE 분전반 확인"));
    expect(onPickIssue).toHaveBeenCalledWith("i1");
  });

  it("파일 결과 클릭 시 onPickFolder(해당 폴더) 딥링크 콜백", async () => {
    const { user, onPickFolder } = setup();
    await user.type(screen.getByLabelText("프로젝트 전역 검색"), "EE");
    await user.click(await screen.findByText("EE-01-006.pdf"));
    expect(onPickFolder).toHaveBeenCalledWith("fld1");
  });

  it("빈 입력이면 검색하지 않는다", async () => {
    setup();
    await waitFor(() => expect(api.searchProject).not.toHaveBeenCalled());
  });
});
