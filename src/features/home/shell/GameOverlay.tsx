import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface GameOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testId?: string;
  /** Something beside the title (a portrait, a count). */
  lead?: ReactNode;
  /** A line under the title. */
  subtitle?: ReactNode;
  /** Sticky tabs or filters under the header, above the scrolling body. */
  toolbar?: ReactNode;
  /** Extra classes for the panel. */
  className?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A game screen over the game: the one overlay primitive the inventory, the
 * menu and the Blobbi's details are built on. On a phone it takes the whole
 * viewport (safe areas included) and rises from the bottom; on a wider
 * screen it is a centred panel with a bounded width and height, never a
 * side drawer. Accessible dialog semantics without a dependency: labelled
 * by its title, modal, focus moved to the close control on open and
 * restored on close, Tab kept inside, Escape and the backdrop close it, the
 * page behind does not scroll. The header is fixed and the body scrolls.
 * Reduced motion removes the entrance.
 */
export function GameOverlay({ open, onClose, title, children, testId, lead, subtitle, toolbar, className = '' }: GameOverlayProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    (closeRef.current ?? panelRef.current)?.focus();
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
    <div className="overlay-root" data-testid={testId} data-overlay="true" onKeyDown={onKeyDown}>
      <div className="overlay-backdrop" onClick={onClose} aria-hidden data-testid={testId ? `${testId}-backdrop` : undefined} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`overlay-panel ${className}`}>
        <header className="overlay-head">
          {lead && <div className="overlay-head__lead">{lead}</div>}
          <div className="overlay-head__text">
            <h2 id={titleId} className="overlay-title">
              {title}
            </h2>
            {subtitle && <div className="overlay-subtitle">{subtitle}</div>}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="overlay-close" aria-label="Close" data-testid={testId ? `${testId}-close` : undefined}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>
        {toolbar && <div className="overlay-toolbar">{toolbar}</div>}
        <div className="overlay-body">{children}</div>
      </div>
    </div>
  );
}
