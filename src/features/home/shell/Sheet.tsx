import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testId?: string;
  /** Extra classes for the panel. */
  className?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A game sheet: a bottom drawer on phones, a side panel on wider screens
 * (CSS decides). Accessible dialog semantics without a dependency: labelled
 * by its title, modal, focus moved in on open and restored on close, Tab
 * kept inside, Escape and the backdrop close it, the page behind does not
 * scroll. The scene stays visible behind it on purpose: a sheet is a thing
 * held up in front of the home, not a new page.
 */
export function Sheet({ open, onClose, title, children, testId, className = '' }: SheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="sheet-root" data-testid={testId} onKeyDown={onKeyDown}>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden data-testid={testId ? `${testId}-backdrop` : undefined} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`sheet-panel ${className}`}>
        <div className="sheet-handle" aria-hidden />
        <div className="flex items-center justify-between gap-3 px-5 pt-3">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="hud-icon-button" aria-label="Close">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
