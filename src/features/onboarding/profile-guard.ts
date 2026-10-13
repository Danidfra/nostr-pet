/**
 * A small, local check of the words a player makes public (M14.2): the
 * profile's name and line about them. Deterministic, on this device, and
 * nothing typed ever leaves it for a moderation service.
 *
 * LIMITED ON PURPOSE. The list is short and English: the obvious slurs and
 * the few swear words nobody types by accident, matched as WHOLE words (so
 * "assist", "Hancock", "Scunthorpe" and "class" are never caught) and as the
 * whole text with its separators squeezed out ("f.u.c.k", "f u c k"), with
 * the usual letter-for-number spellings read as letters. Words that are
 * also ordinary names or words in other languages are left out, because a
 * child told their own name is "not very friendly" is worse than a rude
 * word slipping through: the profile is the player's, and the relays, not
 * this app, are where it lives. What this does not cover is said in the
 * final report rather than papered over.
 */

const LOOKALIKES: Readonly<Record<string, string>> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'l', '+': 't' };

/** The words, already in the normalized spelling below (lowercase letters only). */
const BLOCKED: ReadonlySet<string> = new Set([
  'fuck',
  'fucker',
  'fucking',
  'fucked',
  'motherfucker',
  'shit',
  'shitty',
  'bullshit',
  'bitch',
  'bitches',
  'asshole',
  'arsehole',
  'cunt',
  'pussy',
  'whore',
  'slut',
  'wanker',
  'twat',
  'nigger',
  'nigga',
  'niggers',
  'faggot',
  'faggots',
  'retard',
  'retarded',
  'kike',
  'spic',
  'nazi',
  'nazis',
  'rapist',
  'pedo',
  'pedophile',
  'paedophile',
  'killyourself',
  'kys',
]);

/** Lowercase, lookalike digits and symbols read as letters, accents dropped. */
export function normalizePublicText(text: string): string {
  const lower = text.normalize('NFKD').toLowerCase();
  let out = '';
  for (const ch of lower) {
    const mapped = LOOKALIKES[ch];
    if (mapped) out += mapped;
    else if (/\p{M}/u.test(ch)) continue;
    else out += ch;
  }
  return out;
}

/** The whole words of a normalized text (letters only; anything else separates). */
function wordsOf(normalized: string): string[] {
  return normalized.split(/[^\p{L}]+/u).filter(Boolean);
}

export type PublicTextCheck = { ok: true } | { ok: false; reason: string };

/** What the player is told: friendly, no quotation of the word, and the way out. */
export const UNFRIENDLY_LINE = 'Let’s pick different words. Everyone can read a profile, so keep it friendly.';

/**
 * Whether a public text passes. A failure names no word back and shames
 * nobody: it asks for different words, and the field stays the player's to
 * change.
 */
export function checkPublicText(text: string): PublicTextCheck {
  const normalized = normalizePublicText(text);
  const words = wordsOf(normalized);
  if (words.some((w) => BLOCKED.has(w))) return { ok: false, reason: UNFRIENDLY_LINE };
  // Letters squeezed together: "f.u.c.k", "f u c k"; only the whole text, so nothing inside a longer word is read
  const squeezed = words.join('');
  if (squeezed !== words[0] && BLOCKED.has(squeezed)) return { ok: false, reason: UNFRIENDLY_LINE };
  return { ok: true };
}
