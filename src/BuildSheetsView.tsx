import { ArrowLeft, Hammer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { drawingsToSheets, listDrawings, type Drawing } from "./api/drawings";
import { filterSheets, selectedBuildProject, sortSheets, type Sheet, type SheetSortKey } from "./buildSheetsData";
import BuildHomeView from "./build/BuildHomeView";
import BuildManagementView from "./build/BuildManagementView";
import FilesView from "./build/FilesView";
import FormsView from "./build/FormsView";
import IssuesView from "./build/IssuesView";
import PhotosView from "./build/PhotosView";
import SheetsListView, { type ViewMode } from "./build/SheetsListView";
import SheetViewerShell from "./build/SheetViewerShell";
import { primaryNav, secondaryNav, type BuildSection } from "./build/nav";

type BuildSheetsViewProps = {
  onBackToProjects: () => void;
  project?: {
    id: string;
    name: string;
  };
};

export default function BuildSheetsView({ project = selectedBuildProject, onBackToProjects }: BuildSheetsViewProps) {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeSection, setActiveSection] = useState<BuildSection>("시트");
  const [selectedSheet, setSelectedSheet] = useState<Sheet | null>(null);
  // S2: 시트 목록을 백엔드 업로드 도면(실데이터)으로 구성. 정적 시드 제거.
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [disciplineFilter, setDisciplineFilter] = useState<string>("전체");
  const [sortKey, setSortKey] = useState<SheetSortKey>("number-asc");

  // 시트 섹션에서 도면 목록을 조회·폴링(변환 완료분 반영).
  useEffect(() => {
    if (activeSection !== "시트" || selectedSheet) {
      return;
    }
    let alive = true;
    const load = () => {
      listDrawings(project.name)
        .then((rows) => alive && setDrawings(rows))
        .catch(() => {/* 폴링 실패는 다음 주기 재시도 */});
    };
    load();
    const timer = setInterval(load, 2500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [activeSection, selectedSheet, project.name]);

  const projectSheets = useMemo(() => drawingsToSheets(drawings, project.id), [drawings, project.id]);

  const disciplines = useMemo(() => {
    return ["전체", ...Array.from(new Set(projectSheets.map((s) => s.disciplineCode))).sort()];
  }, [projectSheets]);

  // 폴링으로 데이터가 바뀌어 선택한 공종이 사라지면 필터를 전체로 되돌린다(무효 select/0행 방지).
  useEffect(() => {
    if (disciplineFilter !== "전체" && !disciplines.includes(disciplineFilter)) {
      setDisciplineFilter("전체");
    }
  }, [disciplines, disciplineFilter]);

  const sheets = useMemo(() => {
    let result = filterSheets(project.id, projectSheets, query);
    if (disciplineFilter !== "전체") {
      result = result.filter((s) => s.disciplineCode === disciplineFilter);
    }
    return sortSheets(result, sortKey);
  }, [project.id, projectSheets, query, disciplineFilter, sortKey]);

  function openSection(section: BuildSection) {
    setActiveSection(section);
    setSelectedSheet(null);
  }

  function openSheet(sheet: Sheet) {
    setActiveSection("시트");
    setSelectedSheet(sheet);
  }

  const emptyMessage = projectSheets.length === 0 ? "아직 등록된 시트가 없습니다." : "검색 결과가 없습니다.";

  return (
    <main className="build-shell">
      <aside className="build-rail" aria-label="Build 메뉴">
        <div className="build-module">
          <span className="module-mark" aria-hidden="true">
            <Hammer size={19} />
          </span>
          <span>Build</span>
        </div>

        <nav className="build-nav" aria-label="Build 주요 메뉴">
          {primaryNav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              aria-current={(selectedSheet && label === "시트") || activeSection === label ? "page" : undefined}
              onClick={() => openSection(label)}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <nav className="build-nav build-nav-bottom" aria-label="Build 관리 메뉴">
          {secondaryNav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              aria-current={!selectedSheet && activeSection === label ? "page" : undefined}
              onClick={() => openSection(label)}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="build-workspace">
        <header className="build-topbar">
          <div className="build-context">
            <button className="ghost-action" type="button" onClick={onBackToProjects}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span>프로젝트 목록</span>
            </button>
            <div className="project-context-stack">
              <span className="level-kicker">Project 작업 레벨</span>
              <strong>{project.name}</strong>
            </div>
          </div>
          <div className="build-topbar-actions">
            <span className="settings-scope-chip">프로젝트 작업</span>
            <div className="build-trial">30일 평가판 - XD Build Essentials</div>
          </div>
        </header>

        {selectedSheet ? (
          <SheetViewerShell
            projectName={project.name}
            selectedSheet={selectedSheet}
            sheets={projectSheets}
            onBack={() => setSelectedSheet(null)}
          />
        ) : activeSection === "홈" ? (
          <BuildHomeView projectName={project.name} sheetCount={projectSheets.length} />
        ) : activeSection === "시트" ? (
          <SheetsListView
            emptyMessage={emptyMessage}
            query={query}
            sheets={sheets}
            viewMode={viewMode}
            disciplines={disciplines}
            disciplineFilter={disciplineFilter}
            sortKey={sortKey}
            onOpenSheet={openSheet}
            onQueryChange={setQuery}
            onViewModeChange={setViewMode}
            onDisciplineChange={setDisciplineFilter}
            onSortToggle={() => setSortKey((k) => (k === "number-asc" ? "number-desc" : "number-asc"))}
          />
        ) : activeSection === "파일" ? (
          <FilesView onOpenSheet={openSheet} />
        ) : activeSection === "이슈" ? (
          <IssuesView />
        ) : activeSection === "양식" ? (
          <FormsView />
        ) : activeSection === "사진" ? (
          <PhotosView />
        ) : (
          <BuildManagementView section={activeSection} />
        )}
      </section>
    </main>
  );
}
