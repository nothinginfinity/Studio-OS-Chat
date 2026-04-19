import { createPortal } from "react-dom";

export interface ActionSheetBaseProps {
  /** z-index layer — default 1100 so it sits above the history sheet (1000) */
  zIndex?: number;
  onBackdropClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}

/**
 * Generic bottom-sheet shell.
 * Renders a backdrop + slide-up card via portal into document.body.
 * All domain-specific content goes in `children`.
 *
 * Usage:
 *   <ActionSheetBase onBackdropClick={onClose} ariaLabel="Chat actions">
 *     <div className="action-sheet-handle" />
 *     ...your content...
 *   </ActionSheetBase>
 */
export function ActionSheetBase({
  zIndex = 1100,
  onBackdropClick,
  children,
  ariaLabel = "Action sheet",
}: ActionSheetBaseProps) {
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onBackdropClick();
  }

  return createPortal(
    <div
      className="action-sheet-backdrop"
      style={{ zIndex }}
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="action-sheet">
        {children}
      </div>
    </div>,
    document.body
  );
}
