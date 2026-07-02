import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listDrawings, listFolders, listIssues, type Drawing, type Folder, type Issue } from "../api/drawings";
import { taskSummary, type TaskSummary } from "../api/tasks";
import { formSummary, type FormSummary } from "../api/forms";
import { computeHomeStats, computeProjectProgress, formatBytes, type IssueStatusDay } from "./homeStats";

type HomeTab = "개요" | "종합";

const STATUS_COLOR: Record<string, string> = {
  열림: "#e8590c",
  진행중: "#1971c2",
  답변됨: "#2f9e44",
  닫힘: "#868e96"
};

export default function BuildHomeView({
  projectName,
  onOpenSheets,
  onOpenIssues,
  onOpenFiles,
  onOpenTasks
}: {
  projectName: string;
  onOpenSheets?: () => void;
  onOpenIssues?: () => void;
  onOpenFiles?: () => void;
  onOpenTasks?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<HomeTab>("개요");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tasks, setTasks] = useState<TaskSummary | null>(null);
  const [formsSummary, setFormsSummary] = useState<FormSummary | null>(null);

  // 홈 진입 시 실데이터 집계 로드(시트/파일/폴더/이슈/작업/양식). 정적 하드코딩 대체.
  useEffect(() => {
    let alive = true;
    Promise.all([
      listDrawings(projectName).catch(() => [] as Drawing[]),
      listIssues({ projectName }).catch(() => [] as Issue[]),
      listFolders(projectName).catch(() => [] as Folder[]),
      taskSummary(projectName).catch(() => null),
      formSummary(projectName).catch(() => null)
    ]).then(([d, i, f, t, fm]) => {
      if (!alive) return;
      setDrawings(d);
      setIssues(i);
      setFolders(f);
      setTasks(t);
      setFormsSummary(fm);
    });
    return () => {
      alive = false;
    };
  }, [projectName]);

  const stats = useMemo(() => computeHomeStats(drawings, issues, folders), [drawings, issues, folders]);

  return (
    <section className="build-page build-home-page" aria-labelledby="build-home-title">
      <div className="build-page-heading">
        <div>
          <h1 id="build-home-title">개혁 님, 환영합니다.</h1>
          <p>오늘 진행 중인 프로젝트를 확인합니다 · {projectName}</p>
        </div>
      </div>

      <div className="home-illustration" aria-hidden="true" />

      <div className="home-tabs" role="tablist" aria-label="Build 홈 보기">
        <button type="button" role="tab" aria-selected={activeTab === "개요"} onClick={() => setActiveTab("개요")}>
          개요
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "종합"} onClick={() => setActiveTab("종합")}>
          종합
        </button>
      </div>

      {activeTab === "개요" ? (
        <HomeOverview stats={stats} tasks={tasks} forms={formsSummary} onOpenSheets={onOpenSheets} onOpenIssues={onOpenIssues} onOpenFiles={onOpenFiles} onOpenTasks={onOpenTasks} />
      ) : (
        <HomeAnalytics issuesByDate={stats.issuesByDate} forms={formsSummary} />
      )}
    </section>
  );
}

function HomeOverview({
  stats,
  tasks,
  forms,
  onOpenSheets,
  onOpenIssues,
  onOpenFiles,
  onOpenTasks
}: {
  stats: ReturnType<typeof computeHomeStats>;
  tasks: TaskSummary | null;
  forms: FormSummary | null;
  onOpenSheets?: () => void;
  onOpenIssues?: () => void;
  onOpenFiles?: () => void;
  onOpenTasks?: () => void;
}) {
  const progress = computeProjectProgress(
    tasks,
    forms ? { total: forms.total, done: forms.done } : null,
    { total: stats.issueTotalCount, closed: stats.issueClosedCount }
  );
  return (
    <div className="home-overview-grid">
      <div className="home-overview-main">
        <section className="home-card home-progress-card" aria-label="프로젝트 진행률">
          <h2>프로젝트 진행률</h2>
          {progress.totalItems === 0 ? (
            <div className="home-onboarding-note">
              작업·양식·이슈가 없습니다. 작업 항목을 추가하면 진행률이 여기에 집계됩니다.
            </div>
          ) : (
            <div className="home-progress">
              <div className="home-progress-top">
                <strong className="home-progress-percent">{progress.percent}%</strong>
                <span className="home-progress-sub">완료 {progress.doneItems} / 전체 {progress.totalItems} 항목 (작업·양식·이슈 처리 기준)</span>
              </div>
              <div className="home-progress-track" role="img" aria-label={`전체 진행률 ${progress.percent}%`}>
                <span style={{ width: `${progress.percent}%` }} />
              </div>
              <ul className="home-progress-breakdown">
                {progress.components.map((c) => (
                  <li key={c.label}>
                    <span className="home-progress-blabel">{c.label}</span>
                    <span className="home-progress-btrack" aria-hidden="true">
                      <span style={{ width: `${c.percent}%` }} />
                    </span>
                    <span className="home-progress-bvalue">{c.done}/{c.total} · {c.percent}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="home-card-row">
          <section className="home-card" aria-label="빠른 링크">
            <h2>빠른 링크</h2>
            <div className="home-quicklinks">
              <div>
                <strong>{stats.sheetCount}</strong>
                <span>시트</span>
              </div>
              <div>
                <strong>{stats.fileCount}</strong>
                <span>파일</span>
              </div>
              <div>
                <strong>{stats.folderCount}</strong>
                <span>폴더</span>
              </div>
            </div>
            <div className="home-quicklink-actions">
              <button type="button" onClick={onOpenSheets}>시트 보기</button>
              <button type="button" onClick={onOpenFiles}>파일 보기</button>
            </div>
          </section>

          <section className="home-card" aria-label="저장 용량">
            <h2>저장 용량</h2>
            <div className="home-storage">
              <strong>{formatBytes(stats.storageBytes)}</strong>
              <span>업로드 원본 + 파생 산출물</span>
            </div>
          </section>
        </div>

        <section className="home-card" aria-label="작업 상태">
          <h2>작업 상태</h2>
          <button className="home-status-row" type="button" onClick={onOpenTasks}>
            <span>진행 중인 작업</span>
            {tasks && tasks.total > 0 ? (
              <span className="home-status-value">{tasks.open}개 진행 · {tasks.done}개 완료</span>
            ) : (
              <span className="home-status-value muted">작업 없음 · 작업 작성</span>
            )}
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <button className="home-status-row" type="button" onClick={onOpenIssues}>
            <span>진행 중인 프로젝트 이슈</span>
            <span className="home-status-value">{stats.issueActiveCount}개</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </section>

        <section className="home-card muted-card" aria-label="브리지">
          <h2>브리지</h2>
          <p className="home-recent-empty">이 프로젝트에 연결된 브리지가 없습니다. 브리지는 다른 프로젝트·허브와 시트/파일을 공유합니다(교차-허브 연동 예정).</p>
        </section>
      </div>

      <aside className="home-card home-recent-card" aria-label="최근 활동">
        <div className="home-recent-head">
          <h2>최근 활동</h2>
          <button className="home-link-button" type="button" onClick={onOpenFiles}>모두 보기</button>
        </div>
        {stats.recentUploads.length === 0 ? (
          <p className="home-recent-empty">아직 업로드된 도면이 없습니다.</p>
        ) : (
          stats.recentUploads.map((u) => (
            <article className="home-recent-item" key={u.fileId}>
              <strong>{u.filename}</strong>
              <span>{formatDate(u.uploadDate)}</span>
            </article>
          ))
        )}
      </aside>
    </div>
  );
}

function HomeAnalytics({ issuesByDate, forms }: { issuesByDate: IssueStatusDay[]; forms: FormSummary | null }) {
  const formCards: Array<{ id: string; title: string; value: string; hint: string }> = forms && forms.total > 0
    ? [
        { id: "form-total", title: "등록된 양식", value: `${forms.total}건`, hint: `진행 중 ${forms.open} · 완료 ${forms.done}` },
        { id: "form-avg", title: "양식 평균 완료율", value: `${forms.avg_completion}%`, hint: "체크리스트 항목 기준" },
        { id: "form-open", title: "미완료 양식", value: `${forms.open}건`, hint: "미시작 + 진행 중" }
      ]
    : [];
  return (
    <div className="home-analytics-grid">
      <section className="home-analytics-card home-analytics-wide" aria-label="작성 날짜별 이슈 상태">
        <header className="home-analytics-head">
          <h2>작성 날짜별 이슈 상태</h2>
        </header>
        <IssueStatusChart issuesByDate={issuesByDate} />
      </section>

      {formCards.length === 0 ? (
        <section className="home-analytics-card" aria-label="양식 분석">
          <header className="home-analytics-head">
            <h2>양식 분석</h2>
          </header>
          <div className="home-analytics-empty">
            <strong>표시할 양식 데이터가 없습니다.</strong>
            <span>양식을 작성하면 완료율이 여기에 집계됩니다.</span>
          </div>
        </section>
      ) : (
        formCards.map((card) => (
          <section className="home-analytics-card" key={card.id} aria-label={card.title}>
            <header className="home-analytics-head">
              <h2>{card.title}</h2>
            </header>
            <div className="home-analytics-metric">
              <strong>{card.value}</strong>
              <span>{card.hint}</span>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

const CHART_STATUSES: Array<keyof Omit<IssueStatusDay, "date">> = ["열림", "진행중", "답변됨", "닫힘"];

function IssueStatusChart({ issuesByDate }: { issuesByDate: IssueStatusDay[] }) {
  if (issuesByDate.length === 0) {
    return (
      <div className="home-analytics-empty">
        <strong>표시할 이슈 데이터 없음</strong>
        <span>이슈를 작성하면 작성일별 상태가 여기에 집계됩니다.</span>
      </div>
    );
  }
  const totals = issuesByDate.map((d) => CHART_STATUSES.reduce((n, s) => n + d[s], 0));
  const max = Math.max(1, ...totals);
  return (
    <div className="home-chart">
      <div className="home-chart-bars" role="img" aria-label="작성일별 이슈 상태 누적 막대 차트">
        {issuesByDate.map((day, idx) => (
          <div className="home-chart-col" key={day.date} title={`${day.date}: ${totals[idx]}건`}>
            <div className="home-chart-stack">
              {CHART_STATUSES.map((s) =>
                day[s] > 0 ? (
                  <span
                    key={s}
                    className="home-chart-seg"
                    style={{ height: `${(day[s] / max) * 100}%`, background: STATUS_COLOR[s] }}
                  />
                ) : null
              )}
            </div>
            <span className="home-chart-xlabel">{day.date.slice(5)}</span>
          </div>
        ))}
      </div>
      <ul className="home-chart-legend">
        {CHART_STATUSES.map((s) => (
          <li key={s}>
            <span className="legend-dot" style={{ background: STATUS_COLOR[s] }} aria-hidden="true" />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = iso.slice(0, 10);
  const t = iso.slice(11, 16);
  return t ? `${d} · ${t}` : d;
}
