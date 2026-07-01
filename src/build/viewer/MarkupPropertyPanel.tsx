import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Markup } from "../../api/drawings";

const COLORS = ["#d8232a", "#e8590c", "#1971c2", "#2f9e44", "#f59f00"];

export default function MarkupPropertyPanel({
  markup,
  onClose,
  onChange,
  onDelete,
  canEdit = true
}: {
  markup: Markup;
  onClose: () => void;
  onChange: (patch: { text?: string; style?: Markup["style"] }) => void;
  onDelete: () => void;
  // J7: 뷰어는 텍스트·색상 편집·삭제 불가(속성 조회만).
  canEdit?: boolean;
}) {
  const [text, setText] = useState(markup.text ?? "");

  // 선택 마크업이 바뀌면 편집 상태를 동기화한다.
  useEffect(() => {
    setText(markup.text ?? "");
  }, [markup.markup_id, markup.text]);

  const color = markup.style?.color || "#d8232a";

  return (
    <aside className="viewer-aside" aria-label={`${markup.kind} 마크업 속성`}>
      <header className="viewer-aside-head">
        <div>
          <span className="viewer-aside-kicker">마크업 속성</span>
          <strong>{markup.kind}</strong>
        </div>
        <button type="button" className="icon-button" aria-label="속성 패널 닫기" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="viewer-prop-edit">
        {markup.kind === "텍스트" && (
          <label className="field">
            <span>내용</span>
            <input
              type="text"
              aria-label="마크업 텍스트"
              value={text}
              readOnly={!canEdit}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => canEdit && text !== markup.text && onChange({ text })}
            />
          </label>
        )}

        <div className="field">
          <span>색상</span>
          <div className="color-swatches" role="group" aria-label="마크업 색상">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch${c === color ? " is-active" : ""}`}
                style={{ background: c }}
                aria-label={`색상 ${c}`}
                aria-pressed={c === color}
                disabled={!canEdit}
                onClick={() => onChange({ style: { ...markup.style, color: c } })}
              />
            ))}
          </div>
        </div>

        <dl className="viewer-prop-list">
          <div className="viewer-prop-row">
            <dt>종류</dt>
            <dd>{markup.kind}</dd>
          </div>
          <div className="viewer-prop-row">
            <dt>좌표계</dt>
            <dd>{markup.coord_space === "world" ? "도면 좌표(world)" : "이미지 좌표(정규화)"}</dd>
          </div>
          <div className="viewer-prop-row">
            <dt>정점 수</dt>
            <dd>{markup.geometry.length}</dd>
          </div>
        </dl>
      </div>

      <footer className="viewer-aside-meta">
        <span>작성자 {markup.author}</span>
        <span>{markup.created_at.slice(0, 10)}</span>
      </footer>

      {canEdit ? (
        <div className="viewer-aside-actions">
          <button type="button" className="danger-action" onClick={onDelete}>
            <Trash2 size={15} aria-hidden="true" />
            마크업 삭제
          </button>
        </div>
      ) : null}
    </aside>
  );
}
