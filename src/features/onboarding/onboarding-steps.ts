/**
 * Where a player stands on the way in, as one word the flow switches on.
 *
 *   welcome   nobody signed in, nothing chosen yet
 *   create    making a new account (the key, its backup, sign in)
 *   existing  signing in with an extension, a bunker or a secret key
 *   loading   signed in; whether a Blobbi is owned is still being read
 *   adopt     signed in, no Blobbi: the egg, straight away
 *   home      signed in with a Blobbi: nothing to onboard
 *
 * An existing player with a Blobbi never sees any of this. There is no
 * profile step (M12.3): a name, a picture and a line about you are the
 * player's to set whenever they like, from the menu's Account; nothing is
 * asked, and nothing is published, before the egg. Pure, so the order is
 * pinned by tests and a refresh in the middle lands on the same step.
 */
export type OnboardingStep = 'welcome' | 'create' | 'existing' | 'loading' | 'adopt' | 'home';

export interface OnboardingFacts {
  signedIn: boolean;
  /** The player's choice on the welcome screen, while signed out. */
  choice: 'create' | 'existing' | null;
  /** Signed in: whether a Blobbi is owned (undefined while the collection loads). */
  hasBlobbi?: boolean;
}

export function resolveOnboardingStep(f: OnboardingFacts): OnboardingStep {
  if (!f.signedIn) return f.choice ?? 'welcome';
  if (f.hasBlobbi === undefined) return 'loading';
  return f.hasBlobbi ? 'home' : 'adopt';
}
