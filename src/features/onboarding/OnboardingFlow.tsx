import type { NostrEvent } from '@blobbi-kit/core';
import { AdoptionFlow } from '@/features/adoption';
import { useAuthor } from '@/hooks/useAuthor';
import { resolveOnboardingStep, type OnboardingStep } from './onboarding-steps';
import { ExistingAccountScreen, WelcomeScreen } from './screens';
import { CreateAccountScreen } from './KeyScene';
import { StagePanel } from './WelcomeStage';
import type { OnboardingSession } from './useOnboardingSession';

interface OnboardingFlowProps {
  session: OnboardingSession;
  /** The signed-in pubkey, or undefined while signed out. */
  pubkey: string | undefined;
  /** Whether a Blobbi is owned; undefined while the collection loads. Ignored while signed out. */
  hasBlobbi: boolean | undefined;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
  /** Something to show while the next step is decided. */
  loading: React.ReactNode;
}

/**
 * The way in: WELCOME → CREATE (the key) or EXISTING (sign in) → ADOPT (the
 * egg) → home, where the first egg hatches.
 *
 * Everything but the chosen door is read (the login store, the
 * collection), so a refresh in the middle lands on the same step: a
 * signed-in player without a Blobbi is shown their egg at once, never a
 * screen about having none. An existing player with a Blobbi never sees any
 * of it (`resolveOnboardingStep`).
 */
export function OnboardingFlow({ session, pubkey, hasBlobbi, updateCompanionEvent, refresh, loading }: OnboardingFlowProps) {
  const { choice, choose } = session;
  // The kind 0 name, only to name a brand-new Blobbonaut profile at adoption; it never decides a step or waits
  const author = useAuthor(pubkey && hasBlobbi === false ? pubkey : undefined);
  const step: OnboardingStep = resolveOnboardingStep({ signedIn: !!pubkey, choice, hasBlobbi });

  switch (step) {
    case 'welcome':
      return <WelcomeScreen onCreate={() => choose('create')} onExisting={() => choose('existing')} />;
    case 'create':
      return <CreateAccountScreen onBack={() => choose(null)} />;
    case 'existing':
      return <ExistingAccountScreen onBack={() => choose(null)} />;
    case 'loading':
      return <StagePanel line="Just a moment…">{loading}</StagePanel>;
    case 'adopt':
      // The egg in the same world: the guide who welcomed you points at it
      return pubkey ? (
        <StagePanel line="Look! Your very own egg!">
          <AdoptionFlow pubkey={pubkey} suggestedName={author.data?.metadata?.name || author.data?.metadata?.display_name || undefined} updateCompanionEvent={updateCompanionEvent} refresh={refresh} />
        </StagePanel>
      ) : null;
    case 'home':
      return null;
  }
}
