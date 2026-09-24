import { useEffect, useState } from 'react';

export const WIDE_SCREEN_QUERY = '(min-width: 900px)';

function matches(query: string): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false;
  } catch {
    return false;
  }
}

/** Whether the frame is wide enough for the desktop rail beside the room (the same breakpoint the CSS uses). */
export function useWideScreen(): boolean {
  const [wide, setWide] = useState(() => matches(WIDE_SCREEN_QUERY));
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(WIDE_SCREEN_QUERY);
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, []);
  return wide;
}
