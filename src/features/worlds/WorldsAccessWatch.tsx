import { useContext } from 'react';
import { GuestStoreContext } from '@/features/guest';
import { useWatchWorldsAccess } from './useWorldsAccess';

/** The Worlds door watched once, beside the router (`useWorldsAccess.ts`); nothing without a guest store (a router rendered on its own, a test). */
export function WorldsAccessWatch() {
  const store = useContext(GuestStoreContext);
  return store ? <Watch /> : null;
}

function Watch() {
  useWatchWorldsAccess();
  return null;
}
