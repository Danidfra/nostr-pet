import { createContext, useContext } from 'react';
import type { RelayDiagnostics } from '@/lib/relay-diagnostics';

/** The relay diagnostics store (`relay-diagnostics.ts`), provided by `NostrProvider` in development builds only; null otherwise. */
export const RelayDiagnosticsContext = createContext<RelayDiagnostics | null>(null);

export function useRelayDiagnostics(): RelayDiagnostics | null {
  return useContext(RelayDiagnosticsContext);
}
