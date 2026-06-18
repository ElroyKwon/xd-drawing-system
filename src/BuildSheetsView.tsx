import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardList,
  Download,
  File,
  Filter,
  Grid2X2,
  Home,
  List,
  MoreVertical,
  Search,
  Settings,
  Users
} from "lucide-react";
import { useMemo, useState } from "react";
import { filterSheets, initialSheets, selectedBuildProject, type Sheet } from "./buildSheetsData";

type BuildSheetsViewProps = {
  onBackToProjects: () => void;
};

type ViewMode = "list" | "grid";

const primaryNav = [
  { label: "홈", icon: Home },
  { label: "시트", icon: ClipboardList },
  { label: "파일", icon: File },
  { label: "이슈", icon: CheckCircle2 },
  { label: "양식", icon: ClipboardList },
  { label: "사진", icon: Camera }
];

const secondaryNav = [
  { label: "구성원", icon: Users },
  { label: "브리지", icon: ArrowLeft },
  { label: "설정", icon: Settings }
];

export default function BuildSheetsView({ onBackToProjects }: BuildSheetsViewProps) {
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const sheets = useMemo(() => {
    return filterSheets(selectedBuildProject.id, initialSheets, query);
  }, [query]);

  const countLabel = sheets.length === 0 ? `${initialSheets.length} 중 0 표시` : `${initialSheets.length} 중 1-${sheets.length} 표시`;

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
            <button key={label} type="button" aria-label={label} aria-current={label === "시트" ? "page" : undefined}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <nav className="build-nav build-nav-bottom" aria-label="Build 관리 메뉴">
          {secondaryNav.map(({ label, icon: Icon }) => (
            <button key={label} type="button" aria-label={label}>
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
            <strong>{selectedBuildProject.name}</strong>
          </div>
          <div className="build-trial">30일 평가판 - XD Build Essentials</div>
        </header>

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
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button className="icon-button" type="button" aria-label="필터">
              <Filter size={18} />
            </button>
            <div className="view-toggle" aria-label="보기 전환">
              <button type="button" aria-label="격자 보기" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}>
                <Grid2X2 size={18} aria-hidden="true" />
              </button>
              <button type="button" aria-label="목록 보기" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")}>
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
                  <SheetRow key={sheet.id} sheet={sheet} />
                ))}
                {sheets.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">검색 결과가 없습니다.</div>
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
      </section>
    </main>
  );
}

function SheetRow({ sheet }: { sheet: Sheet }) {
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
            <strong>{sheet.number}</strong>
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
