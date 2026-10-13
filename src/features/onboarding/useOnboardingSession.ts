import { useMemo, useState } from 'react';

/**
 * The one fact the way in keeps of its own: which door the player chose on
 * this visit. Owned by the page (`Home`), never by the flow: between signing
 * in and the collection's first answer the page shows the flow's loading
 * step, and a flow that kept this itself would be unmounted and start again
 * from nothing (the M12.3 first-egg bug).
 */
export interface OnboardingSession {
  choice: 'create' | 'existing' | null;
  choose: (choice: 'create' | 'existing' | null) => void;
}

export function useOnboardingSession(pubkey: string | undefined): OnboardingSession {
  const [choice, choose] = useState<'create' | 'existing' | null>(null);
  // Signed out from the menu part way in: back to the welcome, never straight into making another key
  const [seen, setSeen] = useState(pubkey);
  if (seen !== pubkey) {
    setSeen(pubkey);
    if (seen && !pubkey) choose(null);
  }
  return useMemo(() => ({ choice, choose }), [choice]);
}
