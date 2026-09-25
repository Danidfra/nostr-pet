/**
 * Where a player stands on the way in, as one word the flow switches on.
 *
 *   welcome   nobody signed in, nothing chosen yet
 *   create    making a new account (key shown once, backup, sign in)
 *   existing  signing in with an extension, a bunker or a secret key
 *   loading   signed in; the profile read that decides the next step is in flight
 *   profile   signed in, no Blobbi, no name on the kind 0 yet (or a new account)
 *   adopt     signed in, no Blobbi; the existing adoption flow
 *   home      signed in with a Blobbi: nothing to onboard
 *
 * An existing player with a Blobbi never sees any of this. One whose kind 0
 * already has a name goes straight to adoption; the profile step is offered
 * to those without one and can always be skipped. Pure, so the order is
 * pinned by tests and a refresh in the middle lands on the same step.
 */
export type OnboardingStep = 'welcome' | 'create' | 'existing' | 'loading' | 'profile' | 'adopt' | 'home';

export interface OnboardingFacts {
  signedIn: boolean;
  /** The player's choice on the welcome screen, while signed out. */
  choice: 'create' | 'existing' | null;
  /** Signed in: whether a Blobbi is owned (undefined while the collection loads). */
  hasBlobbi?: boolean;
  /** Signed in: what the kind 0 says. */
  profile: 'loading' | 'named' | 'unnamed';
  /** The profile step was completed or skipped this session. */
  profileDone: boolean;
  /** The account was created in this session (its kind 0 cannot exist yet). */
  newAccount: boolean;
}

export function resolveOnboardingStep(f: OnboardingFacts): OnboardingStep {
  if (!f.signedIn) return f.choice ?? 'welcome';
  if (f.hasBlobbi === undefined) return 'loading';
  if (f.hasBlobbi) return 'home';
  if (f.profileDone) return 'adopt';
  if (f.newAccount) return 'profile';
  if (f.profile === 'loading') return 'loading';
  return f.profile === 'named' ? 'adopt' : 'profile';
}
