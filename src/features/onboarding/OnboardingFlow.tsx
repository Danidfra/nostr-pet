import { useCallback, useMemo, useState } from 'react';
import type { NostrEvent } from '@blobbi-kit/core';
import { AdoptionFlow } from '@/features/adoption';
import { useAuthor } from '@/hooks/useAuthor';
import { resolveOnboardingStep, type OnboardingStep } from './onboarding-steps';
import { CreateAccountScreen, ExistingAccountScreen, ProfileSetupScreen, WelcomeScreen } from './screens';
import { useProfileSetup } from './useProfileSetup';

interface OnboardingFlowProps {
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
 * The way in: WELCOME → CREATE or EXISTING → (PROFILE) → ADOPT → home.
 *
 * The flow keeps only two facts of its own: which door was chosen and
 * whether the profile step was done or skipped this session. Everything
 * else is read (the login store, the collection, the kind 0), so a refresh
 * in the middle lands on the same step, and an existing player with a
 * Blobbi never sees any of it (`resolveOnboardingStep`).
 */
export function OnboardingFlow({ pubkey, hasBlobbi, updateCompanionEvent, refresh, loading }: OnboardingFlowProps) {
  const [choice, setChoice] = useState<'create' | 'existing' | null>(null);
  const [newAccount, setNewAccount] = useState(false);
  const [profileDone, setProfileDone] = useState(false);
  const author = useAuthor(pubkey && hasBlobbi === false && !newAccount ? pubkey : undefined);
  const profileSetup = useProfileSetup(pubkey);

  const profileState = author.data?.metadata?.name ? 'named' : author.isPending && author.failureCount === 0 && !newAccount ? 'loading' : 'unnamed';
  const step: OnboardingStep = useMemo(
    () => resolveOnboardingStep({ signedIn: !!pubkey, choice, hasBlobbi, profile: profileState, profileDone, newAccount }),
    [pubkey, choice, hasBlobbi, profileState, profileDone, newAccount],
  );

  const { mutateAsync: publishProfile } = profileSetup.publish;
  const { mutateAsync: uploadPicture } = profileSetup.upload;
  const saveProfile = useCallback(
    async (form: Parameters<typeof publishProfile>[0]) => {
      try {
        await publishProfile(form);
      } catch {
        // The mutation's error state is what the screen shows; the player
        // stays on the step. Nothing else may reject unhandled.
        return;
      }
      setProfileDone(true);
    },
    [publishProfile],
  );
  const skipProfile = useCallback(() => setProfileDone(true), []);

  switch (step) {
    case 'welcome':
      return <WelcomeScreen onCreate={() => setChoice('create')} onExisting={() => setChoice('existing')} />;
    case 'create':
      return <CreateAccountScreen onBack={() => setChoice(null)} onCreated={() => setNewAccount(true)} />;
    case 'existing':
      return <ExistingAccountScreen onBack={() => setChoice(null)} />;
    case 'loading':
      return <>{loading}</>;
    case 'profile':
      return <ProfileSetupScreen existing={author.data?.metadata} onSave={saveProfile} onSkip={skipProfile} onUpload={uploadPicture} pending={profileSetup.publish.isPending} error={profileSetup.publish.error} />;
    case 'adopt':
      // Brief when the welcome was seen this session (a door was chosen or a profile step done); full for a returning player landing here.
      return pubkey ? <AdoptionFlow pubkey={pubkey} suggestedName={author.data?.metadata?.name || author.data?.metadata?.display_name || undefined} updateCompanionEvent={updateCompanionEvent} refresh={refresh} brief={choice !== null || newAccount || profileDone} /> : null;
    case 'home':
      return null;
  }
}
