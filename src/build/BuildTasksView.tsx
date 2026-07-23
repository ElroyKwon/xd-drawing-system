import { Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  createTask,
  deleteTask as apiDeleteTask,
  listTasks,
  updateTask,
  TASK_STATUSES,
  TASK_PRIORITIES,
  type Task,
  type TaskStatus,
  type TaskPriority
} from "../api/tasks";
import { useModalDismiss } from "../hooks/useModalDismiss";

const STATUS_DOT: Record<string, string> = {
  "할 일": "#e8590c",
  진행중: "#1971c2",
  완료: "#2f9e44"
};

const PRIORITY_LABEL: Record<string, string> = { 높음: "🔴 높음", 보통: "🟡 보통", 낮음: "⚪ 낮음" };

type StatusFilter = "전체" | TaskStatus;

export default function BuildTasksView({
  projectName = "Study_Project",
  canEdit = true
}: {
  projectName?: string;
  // J7: 뷰어(뷰어 역할)는 작업 작성·상태 변경·삭제 불가(서버 403과 일관).
  canEdit?: boolean;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("전체");
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listTasks(projectName)
      .then(setTasks)
      .catch((e) => setError(e instanceof Error ? e.message : "작업 조회 실패"));
  }, [projectName]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (statusFilter === "전체" || t.status === statusFilter) &&
        (!normalized || t.title.toLowerCase().includes(normalized) || t.assignee.toLowerCase().includes(normalized))
    );
  }, [tasks, statusFilter, query]);

  const selected = tasks.find((t) => t.task_id === selectedId) ?? null;

  async function handleCreate(input: {
    title: string;
    assignee: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string;
    description: string;
  }) {
    try {
      const created = await createTask({ ...input, projectName });
      setTasks((prev) => [created, ...prev]);
      setSelectedId(created.task_id);
      setIsCreateOpen(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "작업 작성 실패");
    }
  }

  async function changeStatus(id: string, status: TaskStatus) {
    try {
      const updated = await updateTask(id, { status });
      setTasks((prev) => prev.map((t) => (t.task_id === id ? updated : t)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태 변경 실패");
    }
  }

  async function remove(id: string) {
    try {
      await apiDeleteTask(id);
      setTasks((prev) => prev.filter((t) => t.task_id !== id));
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "작업 삭제 실패");
    }
  }

  const openCount = tasks.filter((t) => t.status !== "완료").length;

  return (
    <section className="build-page" aria-labelledby="tasks-title">
      <div className="build-page-heading">
        <div>
          <h1 id="tasks-title">작업</h1>
          <p>진행 중 {openCount}개 · 전체 {tasks.length}개</p>
        </div>
        <button
          className="primary-action"
          type="button"
          disabled={!canEdit}
          title={canEdit ? undefined : "작업 작성 권한이 없습니다(뷰어)"}
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus size={16} aria-hidden="true" />
          작업 작성
        </button>
      </div>

      {error ? <div className="viewer-op-error" role="alert">{error}</div> : null}

      <div className="issue-layout">
        <section className="issue-list-panel" aria-label="작업 목록">
          <div className="sheets-toolbar">
            {(["전체", ...TASK_STATUSES] as StatusFilter[]).map((s) => (
              <button
                key={s}
                className="secondary-action"
                type="button"
                aria-pressed={statusFilter === s}
                onClick={() => { setStatusFilter(s); setSelectedId(null); }}
              >
                {s}
              </button>
            ))}
            <label className="search-field sheets-search">
              <Search size={18} aria-hidden="true" />
              <input
                aria-label="작업 검색"
                name="task-search"
                placeholder="작업·담당자 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          {visible.length === 0 ? (
            <div className="empty-state list-empty-state" role="status">
              <strong>{tasks.length === 0 ? "작업이 없습니다." : "조건에 맞는 작업이 없습니다."}</strong>
              <span>
                {tasks.length === 0
                  ? "상단의 ‘작업 작성’에서 새 작업을 추가하세요."
                  : "상태 필터나 검색어를 변경해 보세요."}
              </span>
            </div>
          ) : (
            visible.map((task) => (
              <article
                key={task.task_id}
                className={`issue-row${selectedId === task.task_id ? " is-selected" : ""}`}
              >
                <button type="button" className="issue-row-main" onClick={() => setSelectedId(task.task_id)}>
                  <span className="issue-status-dot" style={{ background: STATUS_DOT[task.status] ?? "#868e96" }} aria-hidden="true" />
                  <span>
                    <strong style={task.status === "완료" ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
                      {task.title}
                    </strong>
                    <span>
                      {task.assignee || "미지정"} · {task.status} · {PRIORITY_LABEL[task.priority] ?? task.priority}
                      {task.due_date ? ` · 기한 ${task.due_date}` : ""}
                    </span>
                  </span>
                </button>
              </article>
            ))
          )}
        </section>

        <aside className="issue-inspector" aria-label="작업 상세">
          {selected ? (
            <>
              <h2>{selected.title}</h2>
              <dl>
                <div>
                  <dt>담당자</dt>
                  <dd>{selected.assignee || "미지정"}</dd>
                </div>
                <div>
                  <dt>우선순위</dt>
                  <dd>{PRIORITY_LABEL[selected.priority] ?? selected.priority}</dd>
                </div>
                <div>
                  <dt>기한</dt>
                  <dd>{selected.due_date || "없음"}</dd>
                </div>
              </dl>

              <label className="field select-field">
                <span>상태</span>
                <select
                  name="task-status"
                  aria-label="작업 상태"
                  value={selected.status}
                  disabled={!canEdit}
                  title={canEdit ? undefined : "상태 변경 권한이 없습니다(뷰어)"}
                  onChange={(e) => {
                    const next = e.target.value as TaskStatus;
                    if (next !== selected.status) changeStatus(selected.task_id, next);
                  }}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              {selected.description ? <p className="issue-detail-desc">{selected.description}</p> : null}

              {canEdit ? (
                <button type="button" className="ghost-action issue-delete" onClick={() => remove(selected.task_id)}>
                  <Trash2 size={15} aria-hidden="true" /> 작업 삭제
                </button>
              ) : null}
            </>
          ) : (
            <>
              <h2>작업 상세</h2>
              <p className="issue-empty">목록에서 작업을 선택하면 상세가 표시됩니다.</p>
            </>
          )}
        </aside>
      </div>

      {isCreateOpen ? <TaskCreateModal onClose={() => setIsCreateOpen(false)} onCreate={handleCreate} /> : null}
    </section>
  );
}

function TaskCreateModal({
  onClose,
  onCreate
}: {
  onClose: () => void;
  onCreate: (input: {
    title: string;
    assignee: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string;
    description: string;
  }) => void;
}) {
  const dialogRef = useRef<HTMLFormElement>(null);
  useModalDismiss(onClose, dialogRef);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("시공 전기팀");
  const [status, setStatus] = useState<TaskStatus>("할 일");
  const [priority, setPriority] = useState<TaskPriority>("보통");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState(false);

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError(true);
      return;
    }
    onCreate({ title: title.trim(), assignee, status, priority, due_date: dueDate, description: description.trim() });
  }

  return (
    <div className="modal-backdrop">
      <form ref={dialogRef} tabIndex={-1} className="project-modal member-modal" role="dialog" aria-modal="true" aria-labelledby="task-create-title" onSubmit={submitTask}>
        <header className="modal-header">
          <h2 id="task-create-title">작업 작성</h2>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="modal-body">
          <label className="field">
            <span>제목 <b aria-hidden="true">*</b></span>
            <input
              name="task-title"
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
          <label className="field">
            <span>담당자</span>
            <input name="task-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
          </label>
          <label className="field select-field">
            <span>우선순위</span>
            <select name="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="field select-field">
            <span>상태</span>
            <select name="task-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>기한</span>
            <input type="date" name="task-due" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="field">
            <span>설명</span>
            <input name="task-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="예: 준공 전 접지저항 측정값 제출" />
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
