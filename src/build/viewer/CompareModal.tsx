import { X } from "lucide-react";
import { useRef } from "react";
import type { Sheet } from "../../buildSheetsData";
import { useModalDismiss } from "../../hooks/useModalDismiss";

export default function CompareModal({
  currentSheet,
  sheets,
  sheetB,
  onSelectB,
  onClose,
  onCompare
}: {
  currentSheet: Sheet;
  sheets: Sheet[];
  sheetB: Sheet | null;
  onSelectB: (sheet: Sheet | null) => void;
  onClose: () => void;
  onCompare: () => void;
}) {
  const otherSheets = sheets.filter((sheet) => sheet.id !== currentSheet.id);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDismiss(onClose, dialogRef);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="compare-modal"
        role="dialog"
        aria-modal="true"
        aria-label="시트 비교"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>시트 비교</h2>
          <button type="button" className="modal-close" aria-label="닫기" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="compare-slots">
          <div className="compare-slot">
            <span className="compare-slot-kicker">시트 A</span>
            <strong>{currentSheet.number}</strong>
            <label className="field">
              <span>버전 비교</span>
              <select aria-label="시트 A 버전 비교" defaultValue={currentSheet.versionSet}>
                <option>{currentSheet.versionSet}</option>
                <option>이전 버전</option>
              </select>
            </label>
          </div>

          <div className="compare-slot">
            <span className="compare-slot-kicker">시트 B</span>
            <label className="field">
              <span>시트 선택</span>
              <select
                aria-label="시트 B 선택"
                value={sheetB?.id ?? ""}
                onChange={(event) => {
                  const next = otherSheets.find((sheet) => sheet.id === event.target.value) ?? null;
                  onSelectB(next);
                }}
              >
                <option value="">시트 선택</option>
                {otherSheets.map((sheet) => (
                  <option key={sheet.id} value={sheet.id}>
                    {sheet.number}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>버전 비교</span>
              <select aria-label="시트 B 버전 비교" defaultValue={sheetB?.versionSet ?? ""} disabled={!sheetB}>
                {sheetB ? <option>{sheetB.versionSet}</option> : <option value="">-</option>}
              </select>
            </label>
          </div>
        </div>

        <footer className="modal-footer">
          <button type="button" className="ghost-action" onClick={onClose}>
            취소
          </button>
          <button type="button" className="primary-action" disabled={!sheetB} onClick={onCompare}>
            비교
          </button>
        </footer>
      </div>
    </div>
  );
}
