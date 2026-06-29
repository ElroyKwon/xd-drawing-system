import { ArrowDownAZ, ArrowUpAZ, Download, Grid2X2, List, MoreVertical, Search, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Sheet, SheetSortKey } from "../buildSheetsData";

export type ViewMode = "list" | "grid";

// S2.5: 수백 행 시트 목록 대비 클라이언트 페이지네이션(페이지당 50).
export const SHEETS_PAGE_SIZE = 50;

type SheetsListViewProps = {
  emptyMessage: string;
  query: string;
  sheets: Sheet[];
  viewMode: ViewMode;
  disciplines: string[];
  disciplineFilter: string;
  sortKey: SheetSortKey;
  onOpenSheet: (sheet: Sheet) => void;
  onQueryChange: (value: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onDisciplineChange: (discipline: string) => void;
  onSortToggle: () => void;
};

export default function SheetsListView({
  emptyMessage,
  query,
  sheets,
  viewMode,
  disciplines,
  disciplineFilter,
  sortKey,
  onOpenSheet,
  onQueryChange,
  onViewModeChange,
  onDisciplineChange,
  onSortToggle
}: SheetsListViewProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // S2.5: 필터/검색/정렬이 바뀌면 1페이지로 리셋(빈 페이지 방지).
  useEffect(() => {
    setPage(1);
  }, [query, disciplineFilter, sortKey]);

  const total = sheets.length;
  const pageCount = Math.max(1, Math.ceil(total / SHEETS_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * SHEETS_PAGE_SIZE;
  const pageSheets = useMemo(
    () => sheets.slice(start, start + SHEETS_PAGE_SIZE),
    [sheets, start]
  );
  const rangeLabel =
    total === 0 ? "0개" : `총 ${total}개 중 ${start + 1}–${Math.min(start + SHEETS_PAGE_SIZE, total)}`;

  function toggleMenu(id: string) {
    setOpenMenuId((current) => (current === id ? null : id));
  }

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
        <select
          className="discipline-filter"
          name="discipline-filter"
          aria-label="공종 필터"
          value={disciplineFilter}
          onChange={(event) => onDisciplineChange(event.target.value)}
        >
          {disciplines.map((d) => (
            <option key={d} value={d}>
              {d === "전체" ? "전체 공종" : d}
            </option>
          ))}
        </select>
        <button
          className="icon-button"
          type="button"
          aria-label={`번호 정렬 (${sortKey === "number-asc" ? "오름차순" : "내림차순"})`}
          onClick={onSortToggle}
        >
          {sortKey === "number-asc" ? <ArrowDownAZ size={18} /> : <ArrowUpAZ size={18} />}
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
            {pageSheets.map((sheet) => (
              <SheetRow
                key={sheet.id}
                sheet={sheet}
                isMenuOpen={openMenuId === sheet.id}
                onOpenSheet={onOpenSheet}
                onToggleMenu={() => toggleMenu(sheet.id)}
              />
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
        <span>{rangeLabel}</span>
        <div className="pager-buttons">
          <button
            type="button"
            aria-label="이전 페이지"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            &lsaquo;
          </button>
          <span>{`${currentPage} / ${pageCount}`}</span>
          <button
            type="button"
            aria-label="다음 페이지"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            &rsaquo;
          </button>
        </div>
      </div>
    </section>
  );
}

function SheetRow({
  sheet,
  isMenuOpen,
  onOpenSheet,
  onToggleMenu
}: {
  sheet: Sheet;
  isMenuOpen: boolean;
  onOpenSheet: (sheet: Sheet) => void;
  onToggleMenu: () => void;
}) {
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
        <div className="row-menu-anchor">
          <button
            className="table-icon"
            type="button"
            aria-label={`${sheet.number} 메뉴`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={onToggleMenu}
          >
            <MoreVertical size={18} />
          </button>
          {isMenuOpen ? (
            <div className="row-menu-popover" role="menu" aria-label={`${sheet.number} 작업`}>
              <button type="button" role="menuitem">
                <Download size={15} aria-hidden="true" />
                내보내기
              </button>
              <button type="button" role="menuitem">
                <Share2 size={15} aria-hidden="true" />
                공유
              </button>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
