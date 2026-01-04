import { useLocation } from 'react-router-dom';

interface SafeLocation {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
  key: string;
}

/**
 * Safe wrapper for useLocation that falls back to window.location
 * when Router context is not available (e.g., in PiP windows, tests, etc.)
 * 
 * This prevents crashes when components using location are rendered
 * outside of a Router context.
 */
export function useSafeLocation(): SafeLocation {
  try {
    // Try to use React Router's useLocation
    return useLocation();
  } catch (error) {
    // Fallback to window.location when router context is not available
    return {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash,
      state: null,
      key: 'default',
    };
  }
}
