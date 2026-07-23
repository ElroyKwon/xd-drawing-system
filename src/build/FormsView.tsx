import { Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  createForm,
  deleteForm as apiDeleteForm,
  listForms,
  updateForm,
  FORM_STATUSES,
  FORM_TYPES,
  type BuildForm,
  type FormItem,
  type FormStatus,
  type FormType
} from "../api/forms";
import { useModalDismiss } from "../hooks/useModalDismiss";

const STATUS_DOT: Record<string, string> = {
  미시작: "#e8590c",
  진행중: "#1971c2",
  제출: "#7048e8",
  완료: "#2f9e44"
};

type StatusFilter = "전체" | FormStatus;

export default function FormsView({
  projectName = "Study_Project",
  canEdit = true
}: {
  projectName?: string;
  canEdit?: boolean;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("전체");
  const [query, setQuery] = useState("");
  const [forms, setForms] = useState<BuildForm[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listForms(projectName)
      .then(setForms)
      .catch((e) => setError(e instanceof Error ? e.message : "양식 조회 실패"));
  }, [projectName]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return forms.filter(
      (f) =>
        (statusFilter === "전체" || f.status === statusFilter) &&
        (!normalized || f.title.toLowerCase().includes(normalized) || f.assignee.toLowerCase().includes(normalized))
    );
  }, [forms, statusFilter, query]);

  const selected = forms.find((f) => f.form_id === selectedId) ?? null;

  async function handleCreate(input: {
    title: string;
    form_type: FormType;
    status: FormStatus;
    assignee: string;
    due_date: string;
    items: FormItem[];
  }) {
    try {
      const created = await createForm({ ...input, projectName });
      setForms((prev) => [created, ...prev]);
      setSelectedId(created.form_id);
      setIsCreateOpen(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "양식 작성 실패");
    }
  }

  async function patch(id: string, patchBody: Partial<Pick<BuildForm, "status" | "items">>) {
    try {
      const updated = await updateForm(id, patchBody);
      setForms((prev) => prev.map((f) => (f.form_id === id ? updated : f)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "양식 수정 실패");
    }
  }

  function toggleItem(form: BuildForm, index: number) {
    if (!canEdit) return;
    const items = form.items.map((it, i) => (i === index ? { ...it, checked: !it.checked } : it));
    patch(form.form_id, { items });
  }

  async function remove(id: string) {
    try {
      await apiDeleteForm(id);
      setForms((prev) => prev.filter((f) => f.form_id !== id));
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "양식 삭제 실패");
    }
  }

  const openCount = forms.filter((f) => f.status !== "완료").length;

  return (
    <section className="build-page" aria-labelledby="forms-title">
      <div className="build-page-heading">
        <div>
          <h1 id="forms-title">양식</h1>
          <p>점검·안전·품질·검사 체크리스트 · 진행 중 {openCount}개 / 전체 {forms.length}개</p>
        </div>
        <button
          className="primary-action"
          type="button"
          disabled={!canEdit}
          title={canEdit ? undefined : "양식 작성 권한이 없습니다(뷰어)"}
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus size={16} aria-hidden="true" />
          양식 작성
        </button>
      </div>

      {error ? <div className="viewer-op-error" role="alert">{error}</div> : null}

      <div className="issue-layout">
        <section className="issue-list-panel" aria-label="양식 목록">
          <div className="sheets-toolbar">
            {(["전체", ...FORM_STATUSES] as StatusFilter[]).map((s) => (
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
                aria-label="양식 검색"
                name="form-search"
                placeholder="양식·담당자 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          {visible.length === 0 ? (
            <div className="empty-state list-empty-state" role="status">
              <strong>{forms.length === 0 ? "양식이 없습니다." : "조건에 맞는 양식이 없습니다."}</strong>
              <span>
                {forms.length === 0
                  ? "상단의 ‘양식 작성’에서 새 양식을 추가하세요."
                  : "상태 필터나 검색어를 변경해 보세요."}
              </span>
            </div>
          ) : (
            visible.map((form) => (
              <article
                key={form.form_id}
                className={`issue-row${selectedId === form.form_id ? " is-selected" : ""}`}
              >
                <button type="button" className="issue-row-main" onClick={() => setSelectedId(form.form_id)}>
                  <span className="issue-status-dot" style={{ background: STATUS_DOT[form.status] ?? "#868e96" }} aria-hidden="true" />
                  <span>
                    <strong>{form.title}</strong>
                    <span>
                      {form.form_type} · {form.status} · 완료율 {form.completion}%
                      {form.due_date ? ` · 기한 ${form.due_date}` : ""}
                    </span>
                  </span>
                </button>
              </article>
            ))
          )}
        </section>

        <aside className="issue-inspector" aria-label="양식 상세">
          {selected ? (
            <>
              <h2>{selected.title}</h2>
              <dl>
                <div>
                  <dt>유형</dt>
                  <dd>{selected.form_type}</dd>
                </div>
                <div>
                  <dt>담당자</dt>
                  <dd>{selected.assignee || "미지정"}</dd>
                </div>
                <div>
                  <dt>기한</dt>
                  <dd>{selected.due_date || "없음"}</dd>
                </div>
              </dl>

              <div className="form-progress" aria-label={`완료율 ${selected.completion}%`}>
                <div className="form-progress-bar">
                  <span style={{ width: `${selected.completion}%` }} />
                </div>
                <span className="form-progress-label">{selected.completion}% 완료</span>
              </div>

              <ul className="form-checklist" aria-label="점검 항목">
                {selected.items.length === 0 ? (
                  <li className="issue-empty">점검 항목이 없습니다.</li>
                ) : (
                  selected.items.map((it, i) => (
                    <li key={i}>
                      <label>
                        <input
                          type="checkbox"
                          checked={it.checked}
                          disabled={!canEdit}
                          onChange={() => toggleItem(selected, i)}
                        />
                        <span className={it.checked ? "checked" : undefined}>{it.label}</span>
                      </label>
                    </li>
                  ))
                )}
              </ul>

              <label className="field select-field">
                <span>상태</span>
                <select
                  name="form-status"
                  aria-label="양식 상태"
                  value={selected.status}
                  disabled={!canEdit}
                  title={canEdit ? undefined : "상태 변경 권한이 없습니다(뷰어)"}
                  onChange={(e) => {
                    const next = e.target.value as FormStatus;
                    if (next !== selected.status) patch(selected.form_id, { status: next });
                  }}
                >
                  {FORM_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>

              {canEdit ? (
                <button type="button" className="ghost-action issue-delete" onClick={() => remove(selected.form_id)}>
                  <Trash2 size={15} aria-hidden="true" /> 양식 삭제
                </button>
              ) : null}
            </>
          ) : (
            <>
              <h2>양식 상세</h2>
              <p className="issue-empty">목록에서 양식을 선택하면 점검 항목이 표시됩니다.</p>
            </>
          )}
        </aside>
      </div>

      {isCreateOpen ? <FormCreateModal onClose={() => setIsCreateOpen(false)} onCreate={handleCreate} /> : null}
    </section>
  );
}

function FormCreateModal({
  onClose,
  onCreate
}: {
  onClose: () => void;
  onCreate: (input: {
    title: string;
    form_type: FormType;
    status: FormStatus;
    assignee: string;
    due_date: string;
    items: FormItem[];
  }) => void;
}) {
  const dialogRef = useRef<HTMLFormElement>(null);
  useModalDismiss(onClose, dialogRef);
  const [title, setTitle] = useState("");
  const [formType, setFormType] = useState<FormType>("점검");
  const [status, setStatus] = useState<FormStatus>("미시작");
  const [assignee, setAssignee] = useState("전기 감리");
  const [dueDate, setDueDate] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [error, setError] = useState(false);

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError(true);
      return;
    }
    const items: FormItem[] = itemsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((label) => ({ label, checked: false }));
    onCreate({ title: title.trim(), form_type: formType, status, assignee, due_date: dueDate, items });
  }

  return (
    <div className="modal-backdrop">
      <form ref={dialogRef} tabIndex={-1} className="project-modal member-modal" role="dialog" aria-modal="true" aria-labelledby="form-create-title" onSubmit={submitForm}>
        <header className="modal-header">
          <h2 id="form-create-title">양식 작성</h2>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="modal-body">
          <label className="field">
            <span>제목 <b aria-hidden="true">*</b></span>
            <input
              name="form-title"
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
            <select name="form-type" value={formType} onChange={(e) => setFormType(e.target.value as FormType)}>
              {FORM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="field select-field">
            <span>상태</span>
            <select name="form-status" value={status} onChange={(e) => setStatus(e.target.value as FormStatus)}>
              {FORM_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>담당자</span>
            <input name="form-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
          </label>
          <label className="field">
            <span>기한</span>
            <input type="date" name="form-due" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="field">
            <span>점검 항목 (한 줄에 하나)</span>
            <textarea
              name="form-items"
              rows={4}
              value={itemsText}
              onChange={(e) => setItemsText(e.target.value)}
              placeholder={"외관 손상 여부\n절연저항 측정\n결선 상태 확인"}
            />
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
