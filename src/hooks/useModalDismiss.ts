import { RefObject, useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 모달 공통 해제 동작(ESC·포커스 트랩·트리거 복귀)을 한 곳에 모은 훅.
 * - ESC로 닫힘
 * - 열릴 때 dialog 내부 첫 포커서블(없으면 dialog 자체)로 포커스 이동
 * - Tab/Shift+Tab이 dialog 안에서 순환(포커스 트랩)
 * - 닫힐 때 직전에 포커스됐던 트리거로 복귀
 *
 * dialog 엘리먼트에는 fallback 포커스를 위해 tabIndex={-1}을 준다.
 *
 * `open`은 부모 안에서 조건부 렌더되는 inline 모달용 — open이 true가 될 때
 * 포커스 이동/트랩이 걸린다. 별도 컴포넌트로 mount/unmount되는 모달은 기본값(true)로 둔다.
 */
export function useModalDismiss(
  onClose: () => void,
  dialogRef: RefObject<HTMLElement | null>,
  open = true
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusables = () =>
      dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];

    // autoFocus로 dialog 내부에 이미 포커스가 있으면 존중하고, 없을 때만 첫 포커서블로 이동
    if (!dialog?.contains(document.activeElement)) {
      const initial = focusables();
      (initial[0] ?? dialog)?.focus();
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab" && dialog) {
        const items = focusables();
        if (items.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !dialog.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      // 트리거가 닫힘과 함께 언마운트된 경우(탭 전환 등) 분리된 노드에 포커스하면 body로 유실 → 생존 시에만 복귀
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus?.();
      }
    };
  }, [open, dialogRef]);
}
