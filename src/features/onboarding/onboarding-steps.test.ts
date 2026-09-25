import { describe, expect, it } from 'vitest';
import { resolveOnboardingStep, type OnboardingFacts } from './onboarding-steps';

const base: OnboardingFacts = { signedIn: false, choice: null, hasBlobbi: undefined, profile: 'loading', profileDone: false, newAccount: false };

describe('the way in', () => {
  it('starts at welcome and follows the chosen door while signed out', () => {
    expect(resolveOnboardingStep(base)).toBe('welcome');
    expect(resolveOnboardingStep({ ...base, choice: 'create' })).toBe('create');
    expect(resolveOnboardingStep({ ...base, choice: 'existing' })).toBe('existing');
  });

  it('an existing player with a Blobbi never sees it', () => {
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: true, profile: 'unnamed' })).toBe('home');
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: undefined })).toBe('loading');
  });

  it('offers the profile step to a new account and to a nameless kind 0, and skips it for a named one', () => {
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: false, newAccount: true })).toBe('profile');
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: false, profile: 'loading' })).toBe('loading');
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: false, profile: 'unnamed' })).toBe('profile');
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: false, profile: 'named' })).toBe('adopt');
  });

  it('after the profile step, done or skipped, comes adoption', () => {
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: false, profile: 'unnamed', profileDone: true })).toBe('adopt');
    expect(resolveOnboardingStep({ ...base, signedIn: true, hasBlobbi: false, newAccount: true, profileDone: true })).toBe('adopt');
  });
});
