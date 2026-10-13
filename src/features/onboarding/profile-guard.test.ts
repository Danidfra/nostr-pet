import { describe, expect, it } from 'vitest';
import { UNFRIENDLY_LINE, checkPublicText, normalizePublicText } from './profile-guard';

describe('the public-text check (M14.2)', () => {
  it('lets ordinary names and lines through, in any language', () => {
    for (const text of ['Dana', 'Lupa', 'Hancock', 'Scunthorpe', 'Assistant to the regional manager', 'class act', 'Dick', 'Hélène', 'Søren', 'Mäkelä', 'José', 'わたし', 'Shitake was a typo', 'a hell of a day', 'bass player', 'I love my Blobbi!', '']) {
      expect(checkPublicText(text), text).toEqual({ ok: true });
    }
  });

  it('catches the obvious words as whole words, however they are cased or dressed up with lookalikes', () => {
    for (const text of ['fuck', 'FUCK', 'F.u.c.k', 'f u c k', 'fuck you all', 'you are a b1tch', 'sh!t happens', 'n1gger', 'kys', 'kill yourself']) {
      expect(checkPublicText(text), text).toEqual({ ok: false, reason: UNFRIENDLY_LINE });
    }
  });

  it('never names the word back and never shames: one friendly line and the way out', () => {
    const check = checkPublicText('shit');
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.reason).not.toMatch(/shit/i);
      expect(check.reason).toMatch(/friendly/);
      expect(check.reason).not.toContain(';');
    }
  });

  it('reads lookalike digits and symbols as letters and drops accents', () => {
    expect(normalizePublicText('H3LL0 W0rld')).toBe('hello world');
    expect(normalizePublicText('Hélène')).toBe('helene');
    expect(normalizePublicText('$5')).toBe('ss');
  });

  it('a squeezed match needs the WHOLE text, so letters inside a longer word are never caught', () => {
    expect(checkPublicText('as shole')).toEqual({ ok: false, reason: UNFRIENDLY_LINE });
    expect(checkPublicText('Lupa the assistant')).toEqual({ ok: true });
    expect(checkPublicText('passhole beach')).toEqual({ ok: true });
  });
});
