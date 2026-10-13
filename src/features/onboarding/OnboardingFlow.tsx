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
  /** The signed-in pubkey (or the guest's reserved one), or undefined while signed out. */
  pubkey: string | undefined;
  /** Whether a Blobbi is owned; undefined while the collection loads. Ignored while signed out. */
  hasBlobbi: boolean | undefined;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
  /** Something to show while the next step is decided. */
  loading: React.ReactNode;
  /**
   * Meet your Blobbi (M14): begin as a guest, with an egg on this device and
   * no account. Returns false when no guest can begin here (no secure
   * randomness for the reserved key): the flow then offers the key the old
   * way, whose screen says what is missing.
   */
  onPlayAsGuest?: () => boolean;
  /** The egg is a guest's: it is kept on this device, and the copy says so. */
  guest?: boolean;
}

/**
 * The way in: WELCOME → the egg as a guest (M14; the key comes when the player
 * chooses to save) or EXISTING (sign in) → ADOPT (the egg) → home, where the
 * first egg hatches.
 *
 * Everything but the chosen door is read (the guest record, the login store,
 * the collection), so a refresh in the middle lands on the same step: a
 * player without a Blobbi is shown their egg at once, never a screen about
 * having none. An existing player with a Blobbi never sees any of it
 * (`resolveOnboardingStep`).
 */
export function OnboardingFlow({ session, pubkey, hasBlobbi, updateCompanionEvent, refresh, loading, onPlayAsGuest, guest = false }: OnboardingFlowProps) {
  const { choice, choose } = session;
  // The kind 0 name, only to name a brand-new Blobbonaut profile at adoption; it never decides a step or waits
  const author = useAuthor(pubkey && hasBlobbi === false ? pubkey : undefined);
  const step: OnboardingStep = resolveOnboardingStep({ signedIn: !!pubkey, choice, hasBlobbi });
  const meet = () => {
    if (onPlayAsGuest?.()) return;
    choose('create');
  };

  switch (step) {
    case 'welcome':
      return <WelcomeScreen onCreate={meet} onExisting={() => choose('existing')} />;
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
          <AdoptionFlow pubkey={pubkey} suggestedName={author.data?.metadata?.name || author.data?.metadata?.display_name || undefined} updateCompanionEvent={updateCompanionEvent} refresh={refresh} guest={guest} />
        </StagePanel>
      ) : null;
    case 'home':
      return null;
  }
}
