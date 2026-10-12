/**
 * Sign-in helpers that keep a waiting screen honest: a signer that never
 * answers (an extension popup left open, a bunker offline) ends in a message
 * and a way to try again, never in a spinner forever. The promise itself is
 * not cancelled (a late answer is still a login, which is what the player
 * wanted); the screen simply stops waiting for it.
 */
export class SignInTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignInTimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SignInTimeoutError(message)), ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

/** What a rejected sign-in says, in the player's words: a signer's refusal is a choice, not an error. */
export function signInMessage(error: unknown): string {
  if (error instanceof SignInTimeoutError) return error.message;
  const text = error instanceof Error ? error.message : String(error ?? '');
  if (/reject|denied|cancel|declin|user closed/i.test(text)) return 'Sign-in was cancelled. Try again whenever you are ready.';
  return text || 'Sign-in failed. Try again.';
}
