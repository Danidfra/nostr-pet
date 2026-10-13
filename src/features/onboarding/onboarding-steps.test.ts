import { describe, expect, it } from 'vitest';
import { resolveOnboardingStep, type OnboardingFacts } from './onboarding-steps';

const base: OnboardingFacts = { signedIn: false, choice: null, hasBlobbi: undefined };

describe('the way in', () => {
  it('starts at welcome and follows the chosen door while signed out', () => {
    expect(resolveOnboardingStep(base)).toBe('welcome');
    expect(resolveOnboardingStep({ ...base, choice: 'create' })).toBe('create');
    expect(resolveOnboardingStep({ ...base, choice: 'existing' })).toBe('existing');
  });

  it('an existing player with a Blobbi never sees it', () => {
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: true })).toBe('home');
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: undefined })).toBe('loading');
  });

  it('no profile step: signed in without a Blobbi is the egg, for a new account and a returning one alike', () => {
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: false })).toBe('adopt');
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: false, choice: 'create' })).toBe('adopt');
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: false, choice: 'existing' })).toBe('adopt');
  });
});
