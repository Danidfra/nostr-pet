/**
 * NIP-65 Bootstrap Component
 * Handles automatic NIP-65 relay list discovery on app boot
 * Must be placed inside RelayProvider and NostrLoginProvider
 */

import { useNip65Bootstrap } from '@/hooks/useNip65Bootstrap';

export function Nip65Bootstrap() {
  useNip65Bootstrap();
  return null; // This component doesn't render anything
}
