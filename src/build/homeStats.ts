// S6: Build 홈 위젯 실데이터 집계(순수 함수 — 테스트 가능). 신규 의존성 0.
import type { Drawing, Folder, Issue } from "../api/drawings";

export type RecentUpload = { fileId: string; filename: string; uploadDate: string };
export type IssueStatusDay = { date: string; 열림: number; 진행중: number; 답변됨: number; 닫힘: number };

export type HomeStats = {
  sheetCount: number;
  fileCount: number;
  folderCount: number;
  issueActiveCount: number;       // 열림+진행중+답변됨
  issueByStatus: Record<string, number>;
  storageBytes: number;
  recentUploads: RecentUpload[];
  issuesByDate: IssueStatusDay[];
};

const ACTIVE_STATUSES = ["열림", "진행중", "답변됨"];
const CHART_STATUSES: Array<keyof Omit<IssueStatusDay, "date">> = ["열림", "진행중", "답변됨", "닫힘"];

/** created_at/upload_date(ISO)에서 날짜 부분만(YYYY-MM-DD). */
function dayOf(iso: string): string {
  return (iso || "").slice(0, 10);
}

export function computeHomeStats(drawings: Drawing[], issues: Issue[], folders: Folder[]): HomeStats {
  const completed = drawings.filter((d) => d.conversion_status === "completed");
  const sheetCount = completed.reduce((n, d) => n + (d.sheets?.length ?? 0), 0);

  // 파일 수 = 고유 버전세트 수(버전 중복 제외).
  const fileKeys = new Set(drawings.map((d) => d.version_set_id || d.file_id));
  const fileCount = fileKeys.size;

  const storageBytes = drawings.reduce((n, d) => n + (d.storage_bytes ?? 0), 0);

  const recentUploads: RecentUpload[] = [...drawings]
    .sort((a, b) => (b.upload_date || "").localeCompare(a.upload_date || ""))
    .slice(0, 5)
    .map((d) => ({ fileId: d.file_id, filename: d.filename, uploadDate: d.upload_date }));

  // 이슈 상태 집계(삭제됨 제외).
  const liveIssues = issues.filter((i) => i.status !== "삭제됨");
  const issueByStatus: Record<string, number> = {};
  for (const i of liveIssues) {
    issueByStatus[i.status] = (issueByStatus[i.status] ?? 0) + 1;
  }
  const issueActiveCount = liveIssues.filter((i) => ACTIVE_STATUSES.includes(i.status)).length;

  // 작성일별 이슈 상태(차트). 날짜별 상태 카운트, 날짜 오름차순.
  const byDate = new Map<string, IssueStatusDay>();
  for (const i of liveIssues) {
    const date = dayOf(i.created_at);
    if (!date) continue;
    let row = byDate.get(date);
    if (!row) {
      row = { date, 열림: 0, 진행중: 0, 답변됨: 0, 닫힘: 0 };
      byDate.set(date, row);
    }
    if ((CHART_STATUSES as string[]).includes(i.status)) {
      row[i.status as keyof Omit<IssueStatusDay, "date">] += 1;
    }
  }
  const issuesByDate = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    sheetCount,
    fileCount,
    folderCount: folders.length,
    issueActiveCount,
    issueByStatus,
    storageBytes,
    recentUploads,
    issuesByDate,
  };
}

/** bytes → 사람이 읽는 용량(MB/GB). S2.5 storage_bytes 표시 계승. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
