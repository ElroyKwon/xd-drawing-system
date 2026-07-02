import { describe, expect, it } from "vitest";
import { computeHomeStats, computeProjectProgress, formatBytes } from "./homeStats";
import type { Drawing, Folder, Issue } from "../api/drawings";

function drawing(p: Partial<Drawing>): Drawing {
  return {
    file_id: "f", filename: "a.dwg", file_format: "dwg", file_size: 1,
    upload_date: "2026-06-30T10:00:00", project_name: "Study_Project", version: "1",
    conversion_status: "completed", sheets: [], ...p,
  };
}
function issue(p: Partial<Issue>): Issue {
  return {
    issue_id: "i", file_id: null, sheet_id: null, title: "t", type: "설계 검토",
    status: "열림", category: "quality", assignee: "", author: "사용자", description: "",
    project_name: "Study_Project", pin: null,
    created_at: "2026-06-30T10:00:00", updated_at: "2026-06-30T10:00:00", ...p,
  } as Issue;
}
const folder = (id: string): Folder => ({
  folder_id: id, project_name: "Study_Project", name: id, parent_id: null,
  share_status: "private", permissions: [], updated_at: "", updated_by: "",
});

describe("computeHomeStats", () => {
  it("시트/파일/폴더/용량/이슈를 실집계한다", () => {
    const drawings = [
      drawing({ file_id: "f1", version_set_id: "vs1", storage_bytes: 2 * 1024 * 1024,
        sheets: [{ sheet_id: "s1", sheet_name: "S1", sheet_index: 0 }, { sheet_id: "s2", sheet_name: "S2", sheet_index: 1 }] }),
      drawing({ file_id: "f2", version_set_id: "vs1", storage_bytes: 1024 * 1024, // 같은 버전세트 → 파일 1개
        sheets: [{ sheet_id: "s3", sheet_name: "S3", sheet_index: 0 }] }),
      drawing({ file_id: "f3", version_set_id: "vs2", conversion_status: "pending",
        sheets: [{ sheet_id: "s4", sheet_name: "S4", sheet_index: 0 }] }), // 미완 → 시트 제외
    ];
    const issues = [
      issue({ issue_id: "a", status: "열림" }),
      issue({ issue_id: "b", status: "진행중" }),
      issue({ issue_id: "c", status: "닫힘" }),
      issue({ issue_id: "d", status: "삭제됨" }), // 제외
    ];
    const stats = computeHomeStats(drawings, issues, [folder("A"), folder("B")]);
    expect(stats.sheetCount).toBe(3);          // 완료분 2+1 (pending 제외)
    expect(stats.fileCount).toBe(2);           // vs1, vs2 고유 버전세트
    expect(stats.folderCount).toBe(2);
    expect(stats.issueActiveCount).toBe(2);    // 열림+진행중 (닫힘/삭제 제외)
    expect(stats.issueByStatus).toEqual({ 열림: 1, 진행중: 1, 닫힘: 1 });
    expect(stats.storageBytes).toBe(3 * 1024 * 1024);
  });

  it("작성일별 이슈 상태를 날짜 오름차순으로 집계한다", () => {
    const issues = [
      issue({ issue_id: "a", status: "열림", created_at: "2026-06-29T10:00:00" }),
      issue({ issue_id: "b", status: "진행중", created_at: "2026-06-29T12:00:00" }),
      issue({ issue_id: "c", status: "열림", created_at: "2026-06-30T09:00:00" }),
    ];
    const { issuesByDate } = computeHomeStats([], issues, []);
    expect(issuesByDate.map((d) => d.date)).toEqual(["2026-06-29", "2026-06-30"]);
    expect(issuesByDate[0]).toMatchObject({ 열림: 1, 진행중: 1 });
    expect(issuesByDate[1]).toMatchObject({ 열림: 1 });
  });

  it("formatBytes는 MB/GB로 표시한다", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
  });

  it("issueTotalCount/issueClosedCount를 라이브 기준으로 집계한다", () => {
    const issues = [
      issue({ issue_id: "a", status: "열림" }),
      issue({ issue_id: "b", status: "닫힘" }),
      issue({ issue_id: "c", status: "삭제됨" }), // 제외
    ];
    const stats = computeHomeStats([], issues, []);
    expect(stats.issueTotalCount).toBe(2);
    expect(stats.issueClosedCount).toBe(1);
  });
});

describe("computeProjectProgress", () => {
  it("작업·양식·이슈 처리율을 합산해 전체 진행률을 산출한다", () => {
    const p = computeProjectProgress(
      { total: 8, done: 2 },
      { total: 5, done: 1 },
      { total: 3, closed: 0 },
    );
    // 완료 3 / 전체 16 = 19%
    expect(p.doneItems).toBe(3);
    expect(p.totalItems).toBe(16);
    expect(p.percent).toBe(19);
    expect(p.components.map((c) => c.label)).toEqual(["작업", "양식", "이슈"]);
    expect(p.components[0]).toMatchObject({ done: 2, total: 8, percent: 25 });
  });

  it("항목이 없으면 total 0 · 빈 구성", () => {
    const p = computeProjectProgress(null, { total: 0, done: 0 }, { total: 0, closed: 0 });
    expect(p.totalItems).toBe(0);
    expect(p.percent).toBe(0);
    expect(p.components).toEqual([]);
  });
});
