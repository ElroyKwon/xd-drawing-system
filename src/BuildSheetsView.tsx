import { ArrowLeft, Hammer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { drawingsToSheets, listDrawings, type Drawing, type Issue } from "./api/drawings";
import { filterSheets, selectedBuildProject, sortSheets, type Sheet, type SheetSortKey } from "./buildSheetsData";
import BuildHomeView from "./build/BuildHomeView";
import BuildManagementView from "./build/BuildManagementView";
import GlobalSearch from "./build/GlobalSearch";
import FilesView from "./build/FilesView";
import FormsView from "./build/FormsView";
import IssuesView from "./build/IssuesView";
import PhotosView from "./build/PhotosView";
import SheetsListView, { type ViewMode } from "./build/SheetsListView";
import SheetViewerShell from "./build/SheetViewerShell";
import { primaryNav, secondaryNav, type BuildSection } from "./build/nav";

type BuildSheetsViewProps = {
  onBackToProjects: () => void;
  // J7: 현재 사용자 역할이 뷰어면 false → 콘텐츠 작성/삭제 버튼 비활성(서버 403과 일관). 기본 true(레거시/편집 가능).
  canEdit?: boolean;
  project?: {
    id: string;
    name: string;
  };
};

export default function BuildSheetsView({ project = selectedBuildProject, canEdit = true, onBackToProjects }: BuildSheetsViewProps) {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [activeSection, setActiveSection] = useState<BuildSection>("시트");
  const [selectedSheet, setSelectedSheet] = useState<Sheet | null>(null);
  // S5: 이슈 목록 → 뷰어 핀 딥링크. 점프 대상 이슈(핀 좌표 포함)를 SheetViewerShell로 전달.
  const [focusIssue, setFocusIssue] = useState<Issue | null>(null);
  // S2: 시트 목록을 백엔드 업로드 도면(실데이터)으로 구성. 정적 시드 제거.
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [disciplineFilter, setDisciplineFilter] = useState<string>("전체");
  const [sortKey, setSortKey] = useState<SheetSortKey>("number-asc");
  // S6: 전역 검색 딥링크 — 이슈 탭 preselect / 파일 화면 폴더 선택.
  const [issuesFocusId, setIssuesFocusId] = useState<string | null>(null);
  const [filesFocusFolderId, setFilesFocusFolderId] = useState<string | null>(null);

  // 도면 목록을 조회한다. 섹션 진입마다 1회 로드(전역 검색 딥링크의 시트 매핑용),
  // 시트/이슈 화면에서는 변환 진행 반영을 위해 폴링한다.
  useEffect(() => {
    if (selectedSheet) {
      return;
    }
    let alive = true;
    const load = () => {
      listDrawings(project.name)
        .then((rows) => alive && setDrawings(rows))
        .catch(() => {/* 폴링 실패는 다음 주기 재시도 */});
    };
    load();
    const timer = activeSection === "시트" || activeSection === "이슈" ? setInterval(load, 2500) : null;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
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
    setFocusIssue(null);
    setIssuesFocusId(null);
    setFilesFocusFolderId(null);
  }

  function openSheet(sheet: Sheet) {
    setActiveSection("시트");
    setSelectedSheet(sheet);
    setFocusIssue(null);
  }

  // S5: 이슈 목록에서 핀 있는 이슈를 열면 해당 시트 뷰어로 점프(딥링크).
  function openIssuePin(sheet: Sheet, issue: Issue) {
    setActiveSection("시트");
    setSelectedSheet(sheet);
    setFocusIssue(issue);
  }

  // S6: 전역 검색 결과 딥링크 — 시트=뷰어, 이슈=이슈 탭+선택, 파일/폴더=파일 화면+폴더.
  function searchOpenSheet(sheetId: string) {
    const sheet = projectSheets.find((s) => s.id === sheetId);
    if (sheet) openSheet(sheet);
  }
  function searchOpenIssue(issueId: string) {
    setSelectedSheet(null);
    setFocusIssue(null);
    setFilesFocusFolderId(null);
    setActiveSection("이슈");
    setIssuesFocusId(issueId);
  }
  function searchOpenFolder(folderId: string | null) {
    setSelectedSheet(null);
    setFocusIssue(null);
    setIssuesFocusId(null);
    setActiveSection("파일");
    setFilesFocusFolderId(folderId);
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
            <GlobalSearch
              projectName={project.name}
              onPickSheet={searchOpenSheet}
              onPickIssue={searchOpenIssue}
              onPickFolder={searchOpenFolder}
            />
            <span className="settings-scope-chip">프로젝트 작업</span>
            <div className="build-trial">30일 평가판 - XD Build Essentials</div>
          </div>
        </header>

        {selectedSheet ? (
          <SheetViewerShell
            projectName={project.name}
            selectedSheet={selectedSheet}
            sheets={projectSheets}
            canEdit={canEdit}
            focusIssueId={focusIssue?.issue_id ?? null}
            focusPin={focusIssue?.pin?.coord_space === "world" ? focusIssue.pin.point : null}
            onBack={() => { setSelectedSheet(null); setFocusIssue(null); }}
          />
        ) : activeSection === "홈" ? (
          <BuildHomeView
            projectName={project.name}
            onOpenSheets={() => openSection("시트")}
            onOpenIssues={() => openSection("이슈")}
            onOpenFiles={() => openSection("파일")}
          />
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
          <FilesView onOpenSheet={openSheet} focusFolderId={filesFocusFolderId} canEdit={canEdit} projectName={project.name} />
        ) : activeSection === "이슈" ? (
          <IssuesView projectName={project.name} sheets={projectSheets} onOpenIssuePin={openIssuePin} focusIssueId={issuesFocusId} canEdit={canEdit} />
        ) : activeSection === "양식" ? (
          <FormsView />
        ) : activeSection === "사진" ? (
          <PhotosView />
        ) : (
          <BuildManagementView section={activeSection} projectName={project.name} />
        )}
      </section>
    </main>
  );
}
