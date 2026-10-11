/** Join class names, skipping the falsy ones. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Floating control surface: readable contrast over any room background, light or dark (Ditto's). */
export const CONTROL_SURFACE = 'bg-background/60 backdrop-blur-sm border border-border/20 shadow-sm';

/** Guide highlight: a ring that pulses gently (not on elements positioned by transform) (Ditto's). */
export const GUIDE_HIGHLIGHT = 'ring-2 ring-primary ring-offset-2 ring-offset-background motion-safe:animate-[guide-pulse_2.6s_ease-in-out_infinite]';
