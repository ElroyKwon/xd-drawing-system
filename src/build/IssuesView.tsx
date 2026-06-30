import { MapPin, Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Sheet } from "../buildSheetsData";
import {
  createIssue,
  deleteIssue as apiDeleteIssue,
  listIssues,
  updateIssue,
  ISSUE_STATUS_TRANSITIONS,
  type Issue,
  type IssueStatus
} from "../api/drawings";
import { useModalDismiss } from "../hooks/useModalDismiss";
import { issueCategories, issueTypes } from "./viewer/viewerData";

const STATUS_DOT: Record<string, string> = {
  열림: "#e8590c",
  진행중: "#1971c2",
  답변됨: "#2f9e44",
  닫힘: "#868e96",
  삭제됨: "#adb5bd"
};

export default function IssuesView({
  projectName = "Study_Project",
  sheets = [],
  onOpenIssuePin,
  focusIssueId = null
}: {
  projectName?: string;
  sheets?: Sheet[];
  onOpenIssuePin?: (sheet: Sheet, issue: Issue) => void;
  focusIssueId?: string | null;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [query, setQuery] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listIssues(showDeleted ? { status: "삭제됨", projectName } : { projectName })
      .then(setIssues)
      .catch((e) => setError(e instanceof Error ? e.message : "이슈 조회 실패"));
  }, [showDeleted, projectName]);

  useEffect(() => {
    load();
  }, [load]);

  // S6: 전역 검색 딥링크 — 대상 이슈가 목록에 있으면 선택(없으면 무시).
  useEffect(() => {
    if (focusIssueId && issues.some((i) => i.issue_id === focusIssueId)) {
      setSelectedId(focusIssueId);
    }
  }, [focusIssueId, issues]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return issues;
    return issues.filter((i) => i.title.toLowerCase().includes(normalized));
  }, [issues, query]);

  const selected = issues.find((i) => i.issue_id === selectedId) ?? null;
  const selectedSheet = selected?.sheet_id ? sheets.find((s) => s.id === selected.sheet_id) ?? null : null;

  async function handleCreate(input: {
    title: string;
    type: string;
    category: string;
    assignee: string;
    description: string;
  }) {
    try {
      const created = await createIssue({ ...input, projectName });
      setIssues((prev) => [created, ...prev]);
      setSelectedId(created.issue_id);
      setIsCreateOpen(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이슈 작성 실패");
    }
  }

  async function changeStatus(id: string, status: IssueStatus) {
    try {
      const updated = await updateIssue(id, { status });
      // 삭제됨/닫힘 등으로 현재 탭 필터에서 벗어나면 목록에서 제거.
      if (!showDeleted && status === "삭제됨") {
        setIssues((prev) => prev.filter((i) => i.issue_id !== id));
        setSelectedId(null);
      } else {
        setIssues((prev) => prev.map((i) => (i.issue_id === id ? updated : i)));
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태 변경 실패");
    }
  }

  async function remove(id: string) {
    try {
      await apiDeleteIssue(id);
      setIssues((prev) => prev.filter((i) => i.issue_id !== id));
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이슈 삭제 실패");
    }
  }

  const statusOptions = selected
    ? [selected.status, ...(ISSUE_STATUS_TRANSITIONS[selected.status] ?? [])].filter((s) => s !== "삭제됨")
    : [];

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

      {error ? (
        <div className="viewer-op-error" role="alert">{error}</div>
      ) : null}

      <div className="issue-layout">
        <section className="issue-list-panel" aria-label="이슈 목록">
          <div className="sheets-toolbar">
            <button
              className="secondary-action"
              type="button"
              aria-pressed={!showDeleted}
              onClick={() => { setShowDeleted(false); setSelectedId(null); }}
            >
              열린 이슈
            </button>
            <button
              className="secondary-action"
              type="button"
              aria-pressed={showDeleted}
              onClick={() => { setShowDeleted(true); setSelectedId(null); }}
            >
              삭제된 이슈
            </button>
            <label className="search-field sheets-search">
              <Search size={18} aria-hidden="true" />
              <input
                aria-label="이슈 검색"
                name="issue-search"
                placeholder="이슈 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          {visible.length === 0 ? (
            <div className="empty-state" role="status">
              {showDeleted ? "삭제된 이슈가 없습니다." : "열린 이슈가 없습니다. 이슈를 작성하거나 뷰어에서 핀을 추가하세요."}
            </div>
          ) : (
            visible.map((issue) => (
              <article
                key={issue.issue_id}
                className={`issue-row${selectedId === issue.issue_id ? " is-selected" : ""}`}
              >
                <button type="button" className="issue-row-main" onClick={() => setSelectedId(issue.issue_id)}>
                  <span className="issue-status-dot" style={{ background: STATUS_DOT[issue.status] ?? "#868e96" }} aria-hidden="true" />
                  <span>
                    <strong>{issue.title}</strong>
                    <span>
                      {issue.type} · {issue.status}
                      {issue.pin ? " · 핀" : ""}
                    </span>
                  </span>
                </button>
              </article>
            ))
          )}
        </section>

        <aside className="issue-inspector" aria-label="이슈 인스펙터">
          {selected ? (
            <>
              <h2>{selected.title}</h2>
              <dl>
                <div>
                  <dt>유형</dt>
                  <dd>{selected.type}</dd>
                </div>
                <div>
                  <dt>카테고리</dt>
                  <dd>{issueCategories.find((c) => c.id === selected.category)?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt>담당자</dt>
                  <dd>{selected.assignee || "미지정"}</dd>
                </div>
                <div>
                  <dt>위치</dt>
                  <dd>{selected.pin ? (selectedSheet ? `${selectedSheet.number} 핀` : "핀") : "위치 없음"}</dd>
                </div>
              </dl>

              {!showDeleted ? (
                <label className="field select-field">
                  <span>상태</span>
                  <select
                    name="issue-status"
                    aria-label="이슈 상태"
                    value={selected.status}
                    onChange={(e) => {
                      const next = e.target.value as IssueStatus;
                      if (next !== selected.status) changeStatus(selected.issue_id, next);
                    }}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              ) : null}

              {selected.description ? <p className="issue-detail-desc">{selected.description}</p> : null}

              {selected.pin && selectedSheet && onOpenIssuePin ? (
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => onOpenIssuePin(selectedSheet, selected)}
                >
                  <MapPin size={15} aria-hidden="true" /> 뷰어에서 핀 보기
                </button>
              ) : selected.pin && !selectedSheet ? (
                <p className="issue-empty">연결된 시트를 찾을 수 없습니다(목록 로드 대기).</p>
              ) : null}

              {!showDeleted ? (
                <button type="button" className="ghost-action issue-delete" onClick={() => remove(selected.issue_id)}>
                  <Trash2 size={15} aria-hidden="true" /> 이슈 삭제
                </button>
              ) : null}
            </>
          ) : (
            <>
              <h2>이슈 인스펙터</h2>
              <p className="issue-empty">목록에서 이슈를 선택하면 상세가 표시됩니다.</p>
            </>
          )}
        </aside>
      </div>

      {isCreateOpen ? <IssueCreateModal onClose={() => setIsCreateOpen(false)} onCreate={handleCreate} /> : null}
    </section>
  );
}

function IssueCreateModal({
  onClose,
  onCreate
}: {
  onClose: () => void;
  onCreate: (input: { title: string; type: string; category: string; assignee: string; description: string }) => void;
}) {
  const dialogRef = useRef<HTMLFormElement>(null);
  useModalDismiss(onClose, dialogRef);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>("설계 검토");
  const [category, setCategory] = useState<string>(issueCategories[0]?.id ?? "");
  const [assignee, setAssignee] = useState("도면 검토자");
  const [description, setDescription] = useState("");
  const [error, setError] = useState(false);

  function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError(true);
      return;
    }
    onCreate({ title: title.trim(), type, category, assignee, description: description.trim() });
  }

  return (
    <div className="modal-backdrop">
      <form ref={dialogRef} tabIndex={-1} className="project-modal member-modal" role="dialog" aria-modal="true" aria-labelledby="issue-create-title" onSubmit={submitIssue}>
        <header className="modal-header">
          <h2 id="issue-create-title">이슈 작성</h2>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="modal-body">
          <label className="field">
            <span>제목 <b aria-hidden="true">*</b></span>
            <input
              name="issue-title"
              aria-label="제목"
              value={title}
              autoFocus
              aria-invalid={error}
              onChange={(e) => {
                setTitle(e.target.value);
                if (e.target.value.trim()) setError(false);
              }}
            />
            {error ? <span className="field-error">제목을 입력하세요.</span> : null}
          </label>
          <label className="field select-field">
            <span>유형</span>
            <select name="issue-type" value={type} onChange={(e) => setType(e.target.value)}>
              {issueTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field select-field">
            <span>카테고리</span>
            <select name="issue-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {issueCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>담당자</span>
            <input name="issue-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
          </label>
          <label className="field">
            <span>설명</span>
            <input name="issue-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="예: 현장 확인 후 CAD 수정 요청" />
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
