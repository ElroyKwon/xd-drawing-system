import { ChevronRight, CloudSun, Plus } from "lucide-react";
import { useState } from "react";

type HomeTab = "개요" | "종합";

export default function BuildHomeView({ projectName, sheetCount }: { projectName: string; sheetCount: number }) {
  const [activeTab, setActiveTab] = useState<HomeTab>("개요");

  return (
    <section className="build-page build-home-page" aria-labelledby="build-home-title">
      <div className="build-page-heading">
        <div>
          <h1 id="build-home-title">개혁 님, 환영합니다.</h1>
          <p>오늘 진행 중인 프로젝트를 확인합니다 · {projectName}</p>
        </div>
        <button className="primary-action" type="button">
          <Plus size={16} aria-hidden="true" />
          작업 만들기
        </button>
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

      {activeTab === "개요" ? <HomeOverview sheetCount={sheetCount} /> : <HomeAnalytics />}
    </section>
  );
}

function HomeOverview({ sheetCount }: { sheetCount: number }) {
  return (
    <div className="home-overview-grid">
      <div className="home-overview-main">
        <section className="home-card home-progress-card" aria-label="프로젝트 진행률">
          <h2>프로젝트 진행률</h2>
          <div className="home-progress-stats">
            <div>
              <strong>1%</strong>
              <span>완료</span>
            </div>
            <div>
              <strong>1,000일</strong>
              <span>남음</span>
            </div>
            <div>
              <strong>2029년 3월 12일</strong>
              <span>목표 완료일</span>
            </div>
          </div>
          <div className="home-progress-bar" aria-hidden="true">
            <span style={{ width: "1%" }} />
          </div>
          <div className="home-onboarding-note">
            프로젝트 일정을 추가하거나 프로젝트 표준에 대한 도움말을 확인해 시작 상태를 채울 수 있습니다.
          </div>
        </section>

        <div className="home-card-row">
          <section className="home-card" aria-label="빠른 링크">
            <h2>빠른 링크</h2>
            <div className="home-quicklinks">
              <div>
                <strong>{sheetCount}</strong>
                <span>시트</span>
              </div>
              <div>
                <strong>1</strong>
                <span>구성원</span>
              </div>
            </div>
            <div className="home-quicklink-actions">
              <button type="button">시트</button>
              <button type="button">구성원</button>
            </div>
          </section>

          <section className="home-card" aria-label="현장 날씨">
            <h2>현장 날씨</h2>
            <div className="home-weather">
              <CloudSun size={34} aria-hidden="true" />
              <div>
                <strong>대체로 흐림</strong>
                <span>9 ℃ · 습도 65% · 풍속 5 m/s</span>
              </div>
            </div>
            <button className="home-link-button" type="button">더 보기 · Weather</button>
          </section>
        </div>

        <section className="home-card" aria-label="작업 상태">
          <h2>작업 상태</h2>
          <button className="home-status-row" type="button">
            <span>나에게 할당된 작업</span>
            <span className="home-status-value">진행 중인 작업 1개</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <button className="home-status-row" type="button">
            <span>프로젝트에 할당된 이슈</span>
            <span className="home-status-value">진행 중인 이슈 1개</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </section>

        <section className="home-card muted-card" aria-label="브리지">
          <h2>브리지</h2>
          <p>콘텐츠 없음 · 브리지 도구로 이동</p>
        </section>
      </div>

      <aside className="home-card home-recent-card" aria-label="최근 작업">
        <div className="home-recent-head">
          <h2>최근 작업</h2>
          <button className="home-link-button" type="button">모두 보기</button>
        </div>
        <article className="home-recent-item">
          <strong>개혁 이 프로젝트 작성했습니다</strong>
          <span>2026년 6월 19일 · 17:31</span>
        </article>
      </aside>
    </div>
  );
}

const analyticsCards = [
  { id: "issue-avg", title: "이슈를 완료하는 데 걸리는 평균 시간", empty: "표시할 이슈 데이터 없음", chart: "none" },
  { id: "issue-overdue", title: "표시할 기한이 지난 이슈", empty: "표시할 이슈 데이터 없음", chart: "none" },
  { id: "issue-status", title: "작성 날짜별 이슈 상태", empty: "", chart: "bars" },
  { id: "form-avg", title: "양식을 완료하는 데 걸리는 평균 시간", empty: "표시할 양식 데이터가 없습니다.", chart: "none" },
  { id: "form-overdue", title: "표시할 기한이 지난 양식", empty: "표시할 양식 데이터가 없습니다.", chart: "none" },
  { id: "form-daily", title: "매일 완료하는 양식", empty: "", chart: "bars" }
] as const;

const issueStatusLegend = ["진행 중", "완료", "답변됨", "보류", "거부"];

function HomeAnalytics() {
  return (
    <div className="home-analytics-grid">
      {analyticsCards.map((card) => (
        <section className="home-analytics-card" key={card.id} aria-label={card.title}>
          <header className="home-analytics-head">
            <h2>{card.title}</h2>
            <button className="icon-button" type="button" aria-label={`${card.title} 필터`}>
              <span aria-hidden="true">⋯</span>
            </button>
          </header>
          {card.chart === "bars" ? (
            <div className="home-chart">
              <div className="home-chart-axis" aria-hidden="true">
                <span>수</span>
              </div>
              <div className="home-chart-plot" aria-hidden="true">
                {[1, 2, 3, 4, 5, 6].map((tick) => (
                  <span className="home-chart-tick" key={tick}>
                    {tick}월
                  </span>
                ))}
              </div>
              {card.id === "issue-status" ? (
                <ul className="home-chart-legend">
                  {issueStatusLegend.map((label) => (
                    <li key={label}>
                      <span className={`legend-dot legend-${issueStatusLegend.indexOf(label)}`} aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="home-analytics-empty">
              <strong>{card.empty}</strong>
              <span>선택한 기간 및 필터에 대해 표시할 데이터가 없습니다.</span>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
