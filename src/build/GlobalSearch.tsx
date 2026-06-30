import { FileText, FolderClosed, Layers, MessageSquareWarning, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchProject, type SearchResults } from "../api/drawings";

const EMPTY: SearchResults = { query: "", sheets: [], issues: [], files: [], folders: [], truncated: false };

export default function GlobalSearch({
  projectName,
  onPickSheet,
  onPickIssue,
  onPickFolder
}: {
  projectName: string;
  onPickSheet: (sheetId: string) => void;
  onPickIssue: (issueId: string) => void;
  onPickFolder: (folderId: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 디바운스 후 서버측 검색. 입력이 비면 패널을 닫고 결과를 비운다.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    let alive = true;
    const timer = setTimeout(() => {
      searchProject(projectName, q)
        .then((r) => alive && setResults(r))
        .catch(() => alive && setResults(EMPTY))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, projectName]);

  // 바깥 클릭 시 결과 패널 닫기.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const total = results.sheets.length + results.issues.length + results.files.length + results.folders.length;
  const showPanel = open && query.trim().length > 0;

  function pick(fn: () => void) {
    fn();
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="global-search" ref={rootRef}>
      <label className="search-field global-search-field">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          name="global-search"
          role="combobox"
          aria-label="프로젝트 전역 검색"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          placeholder="시트·이슈·파일 검색"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {query ? (
          <button type="button" className="global-search-clear" aria-label="검색 지우기" onClick={() => { setQuery(""); setOpen(false); }}>
            <X size={14} />
          </button>
        ) : null}
      </label>

      {showPanel ? (
        <div id="global-search-results" className="global-search-panel" role="listbox" aria-label="검색 결과">
          {loading ? (
            <p className="global-search-status" role="status">검색 중…</p>
          ) : total === 0 ? (
            <p className="global-search-status" role="status">검색 결과가 없습니다.</p>
          ) : (
            <>
              {results.sheets.length > 0 ? (
                <div className="global-search-group">
                  <h3><Layers size={13} aria-hidden="true" /> 시트</h3>
                  {results.sheets.map((s) => (
                    <button key={s.sheet_id} type="button" role="option" onClick={() => pick(() => onPickSheet(s.sheet_id))}>
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {results.issues.length > 0 ? (
                <div className="global-search-group">
                  <h3><MessageSquareWarning size={13} aria-hidden="true" /> 이슈</h3>
                  {results.issues.map((i) => (
                    <button key={i.issue_id} type="button" role="option" onClick={() => pick(() => onPickIssue(i.issue_id))}>
                      <span>{i.label}</span>
                      <span className="global-search-meta">{i.status}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {results.files.length > 0 ? (
                <div className="global-search-group">
                  <h3><FileText size={13} aria-hidden="true" /> 파일</h3>
                  {results.files.map((f) => (
                    <button key={f.file_id} type="button" role="option" onClick={() => pick(() => onPickFolder(f.folder_id ?? null))}>
                      {f.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {results.folders.length > 0 ? (
                <div className="global-search-group">
                  <h3><FolderClosed size={13} aria-hidden="true" /> 폴더</h3>
                  {results.folders.map((f) => (
                    <button key={f.folder_id} type="button" role="option" onClick={() => pick(() => onPickFolder(f.folder_id))}>
                      {f.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {results.truncated ? (
                <p className="global-search-status">일부 결과만 표시됩니다. 검색어를 구체화하세요.</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
