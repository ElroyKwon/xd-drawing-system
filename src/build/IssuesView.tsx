import { MapPin, Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Sheet } from "../buildSheetsData";
import {
  createIssue,
  deleteIssue as apiDeleteIssue,
  listIssues,
  updateIssue,
  getIssue,
  addIssueComment,
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

// 홈 위젯 issueActiveCount와 동일 정의 — '열린 이슈' 뷰 카운트 정합.
const ACTIVE_STATUSES = ["열림", "진행중", "답변됨"];

export default function IssuesView({
  projectName = "Study_Project",
  sheets = [],
  onOpenIssuePin,
  focusIssueId = null,
  canEdit = true
}: {
  projectName?: string;
  sheets?: Sheet[];
  onOpenIssuePin?: (sheet: Sheet, issue: Issue) => void;
  focusIssueId?: string | null;
  // J7: 뷰어는 이슈 작성·상태 변경·삭제 불가(서버 403과 일관). 조회·핀 딥링크는 허용.
  canEdit?: boolean;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  // 부채 정합: 홈 '진행 중' 카운트(active=열림+진행중+답변됨)와 '열린 이슈' 뷰를 일치시킨다.
  // 기존엔 '열린 이슈'가 삭제됨 제외 전부(닫힘 포함)를 보여 홈 active와 어긋났다.
  const [view, setView] = useState<"open" | "closed" | "deleted">("open");
  const showDeleted = view === "deleted";
  const [query, setQuery] = useState("");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  const load = useCallback(() => {
    listIssues(view === "deleted" ? { status: "삭제됨", projectName } : { projectName })
      .then(setIssues)
      .catch((e) => setError(e instanceof Error ? e.message : "이슈 조회 실패"));
  }, [view, projectName]);

  useEffect(() => {
    load();
  }, [load]);

  // S6: 전역 검색 딥링크 — 대상 이슈가 목록에 있으면 선택(없으면 무시).
  useEffect(() => {
    if (focusIssueId && issues.some((i) => i.issue_id === focusIssueId)) {
      setSelectedId(focusIssueId);
    }
  }, [focusIssueId, issues]);

  // B1/B2: 이슈 선택 시 댓글·해결버전 전체를 단건 조회로 하이드레이트(목록 응답엔 없을 수 있음).
  useEffect(() => {
    setCommentText("");
    if (!selectedId) return;
    getIssue(selectedId)
      .then((full) =>
        setIssues((prev) =>
          prev.map((i) =>
            i.issue_id === selectedId
              ? { ...i, comments: full.comments, resolution: full.resolution, sheet_key: full.sheet_key }
              : i,
          ),
        ),
      )
      .catch(() => {});
  }, [selectedId]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    // open 뷰 = active(닫힘 제외, 홈 카운트와 정합), closed 뷰 = 닫힘, deleted 뷰 = 로드분(삭제됨).
    const byView = issues.filter((i) =>
      view === "open" ? ACTIVE_STATUSES.includes(i.status)
        : view === "closed" ? i.status === "닫힘"
          : true
    );
    if (!normalized) return byView;
    return byView.filter((i) => i.title.toLowerCase().includes(normalized));
  }, [issues, view, query]);

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
      // 새 상태가 현재 뷰(open=active / closed=닫힘 / deleted=삭제됨)를 벗어나면 목록에서 제거.
      const staysInView =
        view === "open" ? ACTIVE_STATUSES.includes(status)
          : view === "closed" ? status === "닫힘"
            : status === "삭제됨";
      if (!staysInView) {
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

  // B1: 댓글 작성 — 뷰어 포함 모든 멤버 허용(canEdit 게이트 없음). 협력사/다른 담당자가 대응을 남긴다.
  async function submitComment(id: string) {
    const body = commentText.trim();
    if (!body) return;
    try {
      const updated = await addIssueComment(id, body);
      setIssues((prev) => prev.map((i) => (i.issue_id === id ? updated : i)));
      setCommentText("");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "댓글 작성 실패");
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
          <p>열린 이슈 · 닫힌 이슈 · 삭제된 이슈</p>
        </div>
        <button
          className="primary-action"
          type="button"
          disabled={!canEdit}
          title={canEdit ? undefined : "이슈 작성 권한이 없습니다(뷰어)"}
          onClick={() => setIsCreateOpen(true)}
        >
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
              aria-pressed={view === "open"}
              onClick={() => { setView("open"); setSelectedId(null); }}
            >
              열린 이슈
            </button>
            <button
              className="secondary-action"
              type="button"
              aria-pressed={view === "closed"}
              onClick={() => { setView("closed"); setSelectedId(null); }}
            >
              닫힌 이슈
            </button>
            <button
              className="secondary-action"
              type="button"
              aria-pressed={view === "deleted"}
              onClick={() => { setView("deleted"); setSelectedId(null); }}
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
            <div className="empty-state list-empty-state" role="status">
              <strong>
                {view === "deleted"
                  ? "삭제된 이슈가 없습니다."
                  : view === "closed"
                    ? "닫힌 이슈가 없습니다."
                    : "열린 이슈가 없습니다."}
              </strong>
              <span>
                {view === "deleted"
                  ? "삭제된 이슈가 여기에 표시됩니다."
                  : view === "closed"
                    ? "완료 처리된 이슈가 여기에 표시됩니다."
                    : "‘이슈 작성’을 누르거나 뷰어에서 핀을 추가하세요."}
              </span>
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
                    disabled={!canEdit}
                    title={canEdit ? undefined : "상태 변경 권한이 없습니다(뷰어)"}
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

              {/* B2: 해결 버전 표시(설정은 후속 — 아래 리포트 참고). */}
              {selected.resolution ? (
                <p className="issue-resolution">
                  해결 버전: {selected.resolution.note || "메모 없음"} (v{selected.resolution.version_no})
                </p>
              ) : null}

              {/* B1: 댓글 스레드 + 입력(뷰어 포함 모든 멤버 허용). */}
              <div className="issue-comments">
                <h3>댓글</h3>
                {selected.comments && selected.comments.length > 0 ? (
                  <ul className="issue-comment-list">
                    {selected.comments.map((c) => (
                      <li key={c.comment_id} className="issue-comment">
                        <span className="issue-comment-meta">
                          {c.author_name} · {c.created_at.slice(0, 16).replace("T", " ")}
                        </span>
                        <span className="issue-comment-body">{c.body}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="issue-empty">아직 댓글이 없습니다.</p>
                )}
                <textarea
                  className="issue-comment-input"
                  aria-label="댓글 입력"
                  placeholder="대응 내용을 남기세요"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                />
                <button
                  type="button"
                  className="secondary-action"
                  disabled={!commentText.trim()}
                  onClick={() => submitComment(selected.issue_id)}
                >
                  댓글 남기기
                </button>
              </div>

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

              {!showDeleted && canEdit ? (
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
