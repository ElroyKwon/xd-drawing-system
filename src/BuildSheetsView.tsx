import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardList,
  Download,
  File,
  Filter,
  FolderPlus,
  Grid2X2,
  Home,
  Image,
  List,
  Map,
  Maximize2,
  MessageSquare,
  MoreVertical,
  Move,
  MousePointer2,
  Pencil,
  Plus,
  Ruler,
  Search,
  Settings,
  Square,
  Type,
  Upload,
  Users,
  X
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { filterSheets, initialSheets, selectedBuildProject, type Sheet } from "./buildSheetsData";

type BuildSheetsViewProps = {
  onBackToProjects: () => void;
  project?: {
    id: string;
    name: string;
  };
};

type ViewMode = "list" | "grid";

const primaryNav = [
  { label: "홈", icon: Home },
  { label: "시트", icon: ClipboardList },
  { label: "파일", icon: File },
  { label: "이슈", icon: CheckCircle2 },
  { label: "양식", icon: ClipboardList },
  { label: "사진", icon: Camera }
] as const;

const secondaryNav = [
  { label: "구성원", icon: Users },
  { label: "브리지", icon: ArrowLeft },
  { label: "설정", icon: Settings }
] as const;

type PrimarySection = (typeof primaryNav)[number]["label"];
type SecondarySection = (typeof secondaryNav)[number]["label"];
type BuildSection = PrimarySection | SecondarySection;

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
            <ClipboardList size={19} />
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
          <FilesView />
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

type SheetsListViewProps = {
  countLabel: string;
  emptyMessage: string;
  query: string;
  sheets: Sheet[];
  viewMode: ViewMode;
  onOpenSheet: (sheet: Sheet) => void;
  onQueryChange: (value: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
};

function SheetsListView({
  countLabel,
  emptyMessage,
  query,
  sheets,
  viewMode,
  onOpenSheet,
  onQueryChange,
  onViewModeChange
}: SheetsListViewProps) {
  return (
    <section className="sheets-page" aria-label="Build 시트 목록">
      <div className="sheets-title-row">
        <h1>시트</h1>
      </div>

      <div className="sheets-toolbar">
        <button className="secondary-action sheets-export" type="button">
          <Download size={16} aria-hidden="true" />
          <span>내보내기</span>
        </button>
        <label className="search-field sheets-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="시트 검색"
            name="sheet-search"
            placeholder="시트 검색 및 필터"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
        <button className="icon-button" type="button" aria-label="필터">
          <Filter size={18} />
        </button>
        <div className="view-toggle" aria-label="보기 전환">
          <button type="button" aria-label="격자 보기" aria-pressed={viewMode === "grid"} onClick={() => onViewModeChange("grid")}>
            <Grid2X2 size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="목록 보기" aria-pressed={viewMode === "list"} onClick={() => onViewModeChange("list")}>
            <List size={19} aria-hidden="true" />
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <p className="view-note">격자 보기는 다음 slice에서 확장됩니다. 현재는 목록으로 시트 메타데이터를 검토합니다.</p>
      ) : null}

      <div className="table-scroll sheets-table-scroll">
        <table className="project-table sheets-table">
          <thead>
            <tr>
              <th scope="col" aria-label="선택">
                <input type="checkbox" name="all-sheets" aria-label="모든 시트 선택" />
              </th>
              <th scope="col">번호</th>
              <th scope="col" aria-label="버전" />
              <th scope="col">버전 세트</th>
              <th scope="col">공종</th>
              <th scope="col">태그</th>
              <th scope="col">최종 수정자</th>
              <th scope="col" aria-label="행 메뉴" />
            </tr>
          </thead>
          <tbody>
            {sheets.map((sheet) => (
              <SheetRow key={sheet.id} sheet={sheet} onOpenSheet={onOpenSheet} />
            ))}
            {sheets.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">{emptyMessage}</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="pagination sheets-pagination" aria-label="시트 페이지네이션">
        <span>{countLabel}</span>
        <div className="pager-buttons">
          <button type="button" aria-label="이전 페이지">
            &lsaquo;
          </button>
          <span>1 중 1</span>
          <button type="button" aria-label="다음 페이지">
            &rsaquo;
          </button>
        </div>
      </div>
    </section>
  );
}

function SheetRow({ sheet, onOpenSheet }: { sheet: Sheet; onOpenSheet: (sheet: Sheet) => void }) {
  return (
    <tr data-testid="sheet-row">
      <td>
        <input type="checkbox" name={sheet.id} aria-label={`${sheet.number} 선택`} />
      </td>
      <td>
        <div className="sheet-number-cell">
          <span className={`sheet-thumb discipline-${sheet.disciplineCode.toLowerCase()}`} aria-hidden="true">
            <span />
          </span>
          <div>
            <button className="sheet-open-button" type="button" aria-label={`${sheet.number} 열기`} onClick={() => onOpenSheet(sheet)}>
              {sheet.number}
            </button>
            <small>{sheet.title}</small>
          </div>
        </div>
      </td>
      <td>
        <span className="version-chip">{sheet.version}</span>
      </td>
      <td>{sheet.versionSet}</td>
      <td>
        <span className={`discipline-chip discipline-${sheet.disciplineCode.toLowerCase()}`}>{sheet.disciplineLabel}</span>
      </td>
      <td>
        <span className="tag-link">{sheet.tag}</span>
      </td>
      <td>
        <span className="updater-avatar">FP</span>
        <span>{sheet.lastUpdatedBy}</span>
      </td>
      <td>
        <button className="table-icon" type="button" aria-label={`${sheet.number} 메뉴`}>
          <MoreVertical size={18} />
        </button>
      </td>
    </tr>
  );
}

function BuildHomeView({ projectName, sheetCount }: { projectName: string; sheetCount: number }) {
  return (
    <section className="build-page build-home-page" aria-labelledby="build-home-title">
      <div className="build-page-heading">
        <div>
          <h1 id="build-home-title">Build 홈</h1>
          <p>{projectName}</p>
        </div>
        <button className="primary-action" type="button">
          <Plus size={16} aria-hidden="true" />
          작업 만들기
        </button>
      </div>

      <div className="build-dashboard-grid">
        <section className="build-metric-card" aria-label="프로젝트 진행률">
          <h2>프로젝트 진행률</h2>
          <strong>68%</strong>
          <span>{sheetCount}개 시트 기준</span>
        </section>
        <section className="build-metric-card" aria-label="빠른 링크">
          <h2>빠른 링크</h2>
          <button type="button" aria-label="시트 빠른 링크">시트</button>
          <button type="button" aria-label="이슈 빠른 링크">이슈</button>
          <button type="button" aria-label="파일 빠른 링크">파일</button>
        </section>
        <section className="build-metric-card" aria-label="최근 작업">
          <h2>최근 작업</h2>
          <p>A001 시트 검토</p>
          <p>Project Admin 구성원 확인</p>
        </section>
        <section className="build-metric-card muted-card" aria-label="Bridge">
          <h2>Bridge</h2>
          <p>공유된 항목 없음</p>
        </section>
      </div>
    </section>
  );
}

function FilesView() {
  return (
    <section className="build-page" aria-labelledby="files-title">
      <div className="build-page-heading">
        <div>
          <h1 id="files-title">파일</h1>
          <p>프로젝트 파일</p>
        </div>
        <div className="build-action-group">
          <button className="secondary-action" type="button">
            <FolderPlus size={16} aria-hidden="true" />
            폴더 추가
          </button>
          <button className="primary-action" type="button">
            <Upload size={16} aria-hidden="true" />
            파일 업로드
          </button>
        </div>
      </div>
      <div className="files-layout">
        <aside className="folder-tree" aria-label="폴더">
          <strong>파일 루트</strong>
          <button type="button" aria-current="page">도면</button>
          <button type="button">현장 사진</button>
          <button type="button">회의록</button>
        </aside>
        <div className="files-table-panel">
          <div className="sheets-toolbar">
            <label className="search-field sheets-search">
              <Search size={18} aria-hidden="true" />
              <input aria-label="파일 검색" name="file-search" placeholder="파일 검색" />
            </label>
            <button className="icon-button" type="button" aria-label="필터">
              <Filter size={18} />
            </button>
          </div>
          <table className="project-table files-table">
            <thead>
              <tr>
                <th scope="col">이름</th>
                <th scope="col">버전</th>
                <th scope="col">수정자</th>
                <th scope="col">수정일</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sample Drawing Package.pdf</td>
                <td>v1</td>
                <td>Forma Sample</td>
                <td>오늘</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function IssuesView() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <section className="build-page" aria-labelledby="issues-title">
      <div className="build-page-heading">
        <div>
          <h1 id="issues-title">이슈</h1>
          <p>열린 이슈와 삭제된 이슈</p>
        </div>
        <button className="primary-action" type="button" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} aria-hidden="true" />
          이슈 작성
        </button>
      </div>
      <div className="issue-layout">
        <section className="issue-list-panel" aria-label="이슈 목록">
          <div className="sheets-toolbar">
            <button className="secondary-action" type="button">열린 이슈</button>
            <button className="secondary-action" type="button">삭제된 이슈</button>
            <label className="search-field sheets-search">
              <Search size={18} aria-hidden="true" />
              <input aria-label="이슈 검색" name="issue-search" placeholder="이슈 검색" />
            </label>
          </div>
          <article className="issue-row">
            <strong>문 출입 방향 확인</strong>
            <span>설계 검토 · A101 · 미해결</span>
          </article>
        </section>
        <aside className="issue-inspector" aria-label="이슈 인스펙터">
          <h2>이슈 인스펙터</h2>
          <dl>
            <div>
              <dt>유형</dt>
              <dd>설계 검토</dd>
            </div>
            <div>
              <dt>위치</dt>
              <dd>A101 핀</dd>
            </div>
          </dl>
        </aside>
      </div>
      {isCreateOpen ? <IssueCreateModal onClose={() => setIsCreateOpen(false)} /> : null}
    </section>
  );
}

function IssueCreateModal({ onClose }: { onClose: () => void }) {
  function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onClose();
  }

  return (
    <div className="modal-backdrop">
      <form className="project-modal member-modal" role="dialog" aria-modal="true" aria-labelledby="issue-create-title" onSubmit={submitIssue}>
        <header className="modal-header">
          <h2 id="issue-create-title">이슈 작성</h2>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="modal-body">
          <label className="field">
            <span>제목</span>
            <input name="issue-title" />
          </label>
          <label className="field select-field">
            <span>유형</span>
            <select name="issue-type">
              <option>설계 검토</option>
              <option>현장 확인</option>
            </select>
          </label>
          <label className="field select-field">
            <span>담당자</span>
            <select name="issue-assignee">
              <option>개혁 이</option>
              <option>도면 검토자</option>
            </select>
          </label>
        </div>
        <footer className="modal-footer">
          <button className="secondary-action" type="button" onClick={onClose}>
            취소
          </button>
          <button className="primary-action" type="submit">
            작성
          </button>
        </footer>
      </form>
    </div>
  );
}

function FormsView() {
  return (
    <section className="build-page" aria-labelledby="forms-title">
      <div className="build-page-heading">
        <div>
          <h1 id="forms-title">양식</h1>
          <p>스크린샷 근거 보강 필요</p>
        </div>
        <button className="secondary-action" type="button">
          <ClipboardList size={16} aria-hidden="true" />
          양식 템플릿
        </button>
      </div>
      <div className="empty-module-state">
        <strong>양식 화면 원본 보강 대기</strong>
        <span>ACC 분석 문서에서 캡처 누락 항목으로 분류된 로컬 shell입니다.</span>
      </div>
    </section>
  );
}

function PhotosView() {
  return (
    <section className="build-page" aria-labelledby="photos-title">
      <div className="build-page-heading">
        <div>
          <h1 id="photos-title">사진</h1>
          <p>프로젝트 사진</p>
        </div>
        <button className="primary-action" type="button">
          <Upload size={16} aria-hidden="true" />
          미디어 추가
        </button>
      </div>
      <div className="photo-tabs" role="tablist" aria-label="사진 보기">
        <button type="button" role="tab" aria-selected="true">
          앨범
        </button>
        <button type="button" role="tab" aria-selected="false">
          갤러리
        </button>
        <button type="button" role="tab" aria-selected="false">
          맵
        </button>
      </div>
      <div className="photo-layout">
        <aside className="folder-tree" aria-label="사진 앨범">
          <strong>앨범</strong>
          <button type="button" aria-current="page">현장</button>
          <button type="button">검수</button>
          <button type="button">마감</button>
        </aside>
        <div className="photo-empty">
          <Image size={42} aria-hidden="true" />
          <strong>갤러리 비어 있음</strong>
          <span>맵 보기와 앨범 구조만 로컬로 표시합니다.</span>
          <Map size={28} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

function BuildManagementView({ section }: { section: SecondarySection }) {
  const copy: Record<SecondarySection, { title: string; lead: string; rows: string[] }> = {
    구성원: {
      title: "Build 구성원",
      lead: "프로젝트 작업 구성원",
      rows: ["개혁 이 · 관리자", "도면 검토자 · 편집자"]
    },
    브리지: {
      title: "Build 브리지",
      lead: "전송된 항목 없음",
      rows: ["수신 대기", "송신 대기"]
    },
    설정: {
      title: "Build 설정",
      lead: "프로젝트 작업 설정",
      rows: ["시트 번호 규칙", "이슈 유형", "파일 권한"]
    }
  };
  const content = copy[section];

  return (
    <section className="build-page" aria-labelledby={`build-${section}-title`}>
      <div className="build-page-heading">
        <div>
          <h1 id={`build-${section}-title`}>{content.title}</h1>
          <p>{content.lead}</p>
        </div>
      </div>
      <div className="section-list">
        {content.rows.map((row) => (
          <div className="section-list-row" key={row}>
            <span>{row}</span>
            <strong>로컬 shell</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function SheetViewerShell({
  projectName,
  selectedSheet,
  sheets,
  onBack
}: {
  projectName: string;
  selectedSheet: Sheet;
  sheets: Sheet[];
  onBack: () => void;
}) {
  const [activePanel, setActivePanel] = useState<"마크업" | "이슈">("마크업");

  return (
    <section className="viewer-shell" aria-label="2D 시트 뷰어">
      <header className="viewer-header">
        <button className="ghost-action" type="button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          시트 목록
        </button>
        <div>
          <h1>{selectedSheet.number}</h1>
          <p>{selectedSheet.title}</p>
          <span>{projectName}</span>
        </div>
        <button className="secondary-action" type="button">
          <Download size={16} aria-hidden="true" />
          내보내기
        </button>
      </header>

      <div className="viewer-grid">
        <aside className="viewer-panel">
          <div className="viewer-panel-tabs" role="tablist" aria-label="뷰어 패널">
            <button type="button" role="tab" aria-selected={activePanel === "마크업"} onClick={() => setActivePanel("마크업")}>
              마크업
            </button>
            <button type="button" role="tab" aria-selected={activePanel === "이슈"} onClick={() => setActivePanel("이슈")}>
              이슈
            </button>
          </div>
          {activePanel === "마크업" ? (
            <div className="viewer-panel-body">
              <Pencil size={20} aria-hidden="true" />
              <strong>마크업 없음</strong>
              <span>펜, 도형, 화살표, 검색 affordance만 표시합니다.</span>
            </div>
          ) : (
            <div className="viewer-panel-body">
              <MessageSquare size={20} aria-hidden="true" />
              <strong>이슈 없음</strong>
              <span>핀, 상세 필드, 댓글, 활동 로그 affordance만 표시합니다.</span>
            </div>
          )}
        </aside>

        <div className="viewer-stage">
          <div className="static-sheet" aria-label="정적 시트 렌더">
            <span>정적 시트 렌더</span>
            <div className="drawing-title">{selectedSheet.number}</div>
            <div className="drawing-gridline vertical-one" />
            <div className="drawing-gridline vertical-two" />
            <div className="drawing-gridline horizontal-one" />
            <div className="drawing-gridline horizontal-two" />
            <div className="drawing-room room-large" />
            <div className="drawing-room room-small" />
            <div className="drawing-callout">A</div>
          </div>
          <div className="viewer-bottom-controls" aria-label="뷰어 하단 컨트롤">
            <button type="button" aria-label="선택">
              <MousePointer2 size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-label="이동">
              <Move size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-label="맞춤">
              <Maximize2 size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-label="측정">
              <Ruler size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-label="시트 비교">
              <Grid2X2 size={18} aria-hidden="true" />
              <span>시트 비교</span>
            </button>
          </div>
        </div>

        <aside className="viewer-tool-rail" aria-label="뷰어 도구">
          <button type="button" aria-label="텍스트">
            <Type size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="도형">
            <Square size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="펜">
            <Pencil size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="이슈 핀">
            <MessageSquare size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="측정 도구">
            <Ruler size={18} aria-hidden="true" />
          </button>
        </aside>
      </div>

      <footer className="sheet-filmstrip" aria-label="필름스트립">
        <strong>필름스트립</strong>
        <div>
          {sheets.map((sheet) => (
            <button key={sheet.id} type="button" aria-current={sheet.id === selectedSheet.id ? "page" : undefined}>
              {sheet.number}
            </button>
          ))}
        </div>
      </footer>
    </section>
  );
}
