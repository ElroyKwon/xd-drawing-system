import { Trash2, X } from "lucide-react";
import { ISSUE_STATUS_TRANSITIONS, type Issue, type IssueStatus } from "../../api/drawings";

/**
 * S5: 선택된 이슈(핀 또는 목록)의 상세 + 상태 변경(ACC식 전이) + 삭제.
 * 상태 드롭다운은 현재 상태에서 허용된 전이만 노출한다(백엔드가 권위 검증).
 */
export default function IssueDetailPanel({
  issue,
  onChangeStatus,
  onDelete,
  onClose,
  canEdit = true
}: {
  issue: Issue;
  onChangeStatus: (status: IssueStatus) => void;
  onDelete: () => void;
  onClose: () => void;
  // J7: 뷰어는 상태 변경·삭제 불가(조회만).
  canEdit?: boolean;
}) {
  const options = [issue.status, ...(ISSUE_STATUS_TRANSITIONS[issue.status] ?? [])].filter(
    (s) => s !== "삭제됨"
  );

  return (
    <aside className="viewer-aside issue-detail-panel" aria-label="이슈 상세">
      <header className="viewer-aside-head">
        <h2>이슈 상세</h2>
        <button type="button" className="modal-close" aria-label="닫기" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="issue-detail-body">
        <strong className="issue-detail-title">{issue.title}</strong>
        <dl>
          <div>
            <dt>유형</dt>
            <dd>{issue.type}</dd>
          </div>
          <div>
            <dt>담당자</dt>
            <dd>{issue.assignee || "미지정"}</dd>
          </div>
          <div>
            <dt>위치</dt>
            <dd>{issue.pin ? `핀(${issue.pin.coord_space})` : "위치 없음"}</dd>
          </div>
          <div>
            <dt>작성자</dt>
            <dd>{issue.author}</dd>
          </div>
        </dl>
        <label className="field select-field">
          <span>상태</span>
          <select
            name="issue-status"
            aria-label="이슈 상태"
            value={issue.status}
            disabled={!canEdit}
            title={canEdit ? undefined : "상태 변경 권한이 없습니다(뷰어)"}
            onChange={(e) => {
              const next = e.target.value as IssueStatus;
              if (next !== issue.status) onChangeStatus(next);
            }}
          >
            {options.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        {issue.description ? <p className="issue-detail-desc">{issue.description}</p> : null}
        {canEdit ? (
          <button type="button" className="ghost-action issue-delete" onClick={onDelete}>
            <Trash2 size={15} aria-hidden="true" /> 이슈 삭제
          </button>
        ) : null}
      </div>
    </aside>
  );
}
