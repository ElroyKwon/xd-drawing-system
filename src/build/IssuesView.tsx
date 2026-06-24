import { Plus, Search, X } from "lucide-react";
import { useState, type FormEvent } from "react";

export default function IssuesView() {
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
