// S6: Build 홈 위젯 실데이터 집계(순수 함수 — 테스트 가능). 신규 의존성 0.
import type { Drawing, Folder, Issue } from "../api/drawings";

export type RecentUpload = { fileId: string; filename: string; uploadDate: string };
export type IssueStatusDay = { date: string; 열림: number; 진행중: number; 답변됨: number; 닫힘: number };

export type HomeStats = {
  sheetCount: number;
  fileCount: number;
  folderCount: number;
  issueActiveCount: number;       // 열림+진행중+답변됨
  issueTotalCount: number;        // 삭제됨 제외 전체 라이브 이슈
  issueClosedCount: number;       // 닫힘
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
    issueTotalCount: liveIssues.length,
    issueClosedCount: issueByStatus["닫힘"] ?? 0,
    issueByStatus,
    storageBytes,
    recentUploads,
    issuesByDate,
  };
}

export type ProgressComponent = { label: string; done: number; total: number; percent: number };
export type ProjectProgress = {
  percent: number;       // 전체 진행률(완료 항목 / 전체 항목)
  doneItems: number;
  totalItems: number;
  components: ProgressComponent[];   // 작업·양식·이슈 구성별 내역(total>0 만)
};

function pct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/**
 * 일정 엔티티가 없으므로 진행률을 '작업 항목 처리율'로 산출한다(가짜 일정 배제).
 * 완료 정의: 작업 done · 양식 완료 · 이슈 닫힘. 전체 = 각 항목 총계 합.
 */
export function computeProjectProgress(
  tasks: { total: number; done: number } | null,
  forms: { total: number; done: number } | null,
  issues: { total: number; closed: number },
): ProjectProgress {
  const components: ProgressComponent[] = [];
  if (tasks && tasks.total > 0) components.push({ label: "작업", done: tasks.done, total: tasks.total, percent: pct(tasks.done, tasks.total) });
  if (forms && forms.total > 0) components.push({ label: "양식", done: forms.done, total: forms.total, percent: pct(forms.done, forms.total) });
  if (issues.total > 0) components.push({ label: "이슈", done: issues.closed, total: issues.total, percent: pct(issues.closed, issues.total) });
  const doneItems = components.reduce((n, c) => n + c.done, 0);
  const totalItems = components.reduce((n, c) => n + c.total, 0);
  return { percent: pct(doneItems, totalItems), doneItems, totalItems, components };
}

/** bytes → 사람이 읽는 용량(MB/GB). S2.5 storage_bytes 표시 계승. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}
