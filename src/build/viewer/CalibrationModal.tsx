import { X } from "lucide-react";
import { useRef } from "react";
import { useModalDismiss } from "../../hooks/useModalDismiss";

export default function CalibrationModal({
  onClose,
  onConfirm
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDismiss(onClose, dialogRef);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="calibration-modal"
        role="dialog"
        aria-modal="true"
        aria-label="교정을 만드시겠습니까?"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2>교정을 만드시겠습니까?</h2>
          <button type="button" className="modal-close" aria-label="닫기" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="modal-body">
          <p className="modal-desc">
            현재 시트의 축척을 교정합니다. 마커에 표시할 이름을 입력한 뒤 확인을 누르세요. (외관 affordance — 실제 교정 계산은 수행하지 않습니다.)
          </p>

          <label className="field">
            <span>마커 텍스트</span>
            <input type="text" name="calibration-marker" aria-label="마커 텍스트" placeholder="예: 1/2&quot;=1'-0&quot;" />
          </label>
        </div>

        <footer className="modal-footer">
          <button type="button" className="ghost-action" onClick={onClose}>
            취소
          </button>
          <button type="button" className="primary-action" onClick={onConfirm}>
            확인
          </button>
        </footer>
      </div>
    </div>
  );
}
