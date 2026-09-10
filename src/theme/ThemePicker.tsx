import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, Palette, X } from 'lucide-react';
import { useBlobbiTheme } from './ThemeProvider';
import type { BlobbiHomeTheme } from './themes';

/**
 * A small swatch that previews a theme: sky over ground with the accent as a
 * "Blobbi-sized" dot. No image loads for the preview; the swatch colours are
 * part of the registry so the picker stays instant.
 */
function ThemeSwatch({ theme }: { theme: BlobbiHomeTheme }) {
  const [sky, ground, accent] = theme.swatch;
  return (
    <span
      aria-hidden
      className="relative block h-14 w-full overflow-hidden rounded-xl"
      style={{ background: `linear-gradient(180deg, ${sky} 0%, ${sky} 58%, ${ground} 58%, ${ground} 100%)` }}
    >
      <span className="absolute left-1/2 top-[52%] h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: accent }} />
      <span className="absolute left-1/2 top-[66%] h-1.5 w-6 -translate-x-1/2 rounded-full bg-black/25" />
    </span>
  );
}

/**
 * The theme selector: a button in the header that opens a small panel of
 * theme cards (anchored to the trigger on wide screens, full-width under the
 * header on phones so it never leaves the viewport). Selecting applies the
 * theme immediately, remembers it on this device, and publishes nothing. Roving-tabindex radio group: arrows move,
 * Enter/Space select, Escape closes.
 */
export function ThemePicker() {
  const { theme, themes, setTheme } = useBlobbiTheme();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const index = Math.max(0, themes.findIndex((t) => t.id === theme.id));
    optionRefs.current[index]?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!document.getElementById(panelId)?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, panelId, theme.id, themes]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = themes.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index === last ? 0 : index + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index === 0 ? last : index - 1;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = last;
    if (next !== null) {
      event.preventDefault();
      setTheme(themes[next].id);
      optionRefs.current[next]?.focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card/80 px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Palette className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Theme</span>
        <span className="sr-only sm:hidden">Theme</span>
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose a home theme"
          className="fixed inset-x-3 top-16 z-50 rounded-2xl border border-border bg-card p-3 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-semibold">Home theme</p>
            <button
              type="button"
              onClick={close}
              aria-label="Close theme picker"
              className="rounded-full p-1 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div role="radiogroup" aria-label="Home theme" className="grid grid-cols-2 gap-2">
            {themes.map((option, index) => {
              const selected = option.id === theme.id;
              return (
                <button
                  key={option.id}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTheme(option.id)}
                  onKeyDown={(event) => onOptionKeyDown(event, index)}
                  className={`group flex flex-col gap-1.5 rounded-xl border p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <ThemeSwatch theme={option} />
                  <span className="flex items-center justify-between px-1 pb-0.5">
                    <span className="text-xs font-semibold">{option.name}</span>
                    {selected && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
                  </span>
                  <span className="sr-only">{option.tagline}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">Saved on this device. Your Blobbi looks the same everywhere.</p>
        </div>
      )}
    </div>
  );
}
