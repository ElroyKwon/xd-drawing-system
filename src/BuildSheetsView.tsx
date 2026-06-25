import { ArrowLeft, Hammer } from "lucide-react";
import { useMemo, useState } from "react";
import { filterSheets, initialSheets, selectedBuildProject, type Sheet } from "./buildSheetsData";
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

  const projectSheets = useMemo(() => {
    return initialSheets.filter((sheet) => sheet.projectId === project.id);
  }, [project.id]);

  const sheets = useMemo(() => {
    return filterSheets(project.id, initialSheets, query);
  }, [project.id, query]);

  function openSection(section: BuildSection) {
    setActiveSection(section);
    setSelectedSheet(null);
  }

  function openSheet(sheet: Sheet) {
    setActiveSection("시트");
    setSelectedSheet(sheet);
  }

  const countLabel = sheets.length === 0 ? `${projectSheets.length} 중 0 표시` : `${projectSheets.length} 중 1-${sheets.length} 표시`;
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
            countLabel={countLabel}
            emptyMessage={emptyMessage}
            query={query}
            sheets={sheets}
            viewMode={viewMode}
            onOpenSheet={openSheet}
            onQueryChange={setQuery}
            onViewModeChange={setViewMode}
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
