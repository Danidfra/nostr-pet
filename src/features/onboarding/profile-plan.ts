/**
 * The one kind 0 write of the onboarding, planned as data.
 *
 * The event is the standard NIP-01 metadata: the FRESH existing content is
 * kept (every field the player set elsewhere: nip05, lud16, banner…), and
 * only what the form touched is set. `display_name` follows `name` when the
 * player had none, as Ditto does for a new profile. Nothing secret is ever
 * part of a profile.
 */
import type { NostrMetadata } from '@nostrify/nostrify';

export const PROFILE_NAME_MAX = 50;
export const PROFILE_ABOUT_MAX = 300;

export interface ProfileFormInput {
  name: string;
  about: string;
  picture: string;
}

export type ProfileCheck = { ok: true; value: ProfileFormInput } | { ok: false; reason: string };

/** Trim and bound the form; a picture must be an http(s) URL or empty. */
export function checkProfileForm(input: ProfileFormInput): ProfileCheck {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const about = input.about.trim();
  const picture = input.picture.trim();
  if (name.length === 0) return { ok: false, reason: 'Pick a name, or skip this for now.' };
  if (name.length > PROFILE_NAME_MAX) return { ok: false, reason: `Keep the name under ${PROFILE_NAME_MAX} characters.` };
  if (about.length > PROFILE_ABOUT_MAX) return { ok: false, reason: `Keep the bio under ${PROFILE_ABOUT_MAX} characters.` };
  if (picture) {
    try {
      const url = new URL(picture);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: 'The picture must be a web address.' };
    } catch {
      return { ok: false, reason: 'The picture must be a web address.' };
    }
  }
  return { ok: true, value: { name, about, picture } };
}

/** The kind 0 content: the existing metadata with the form applied. */
export function mergeProfileMetadata(existing: NostrMetadata | undefined, form: ProfileFormInput): NostrMetadata {
  const next: NostrMetadata = { ...(existing ?? {}) };
  next.name = form.name;
  if (!existing?.display_name || existing.display_name === existing.name) next.display_name = form.name;
  if (form.about) next.about = form.about;
  else delete next.about;
  if (form.picture) next.picture = form.picture;
  else if (!existing?.picture) delete next.picture;
  return next;
}

/** The form prefilled from what the player already has. */
export function profileFormFrom(existing: NostrMetadata | undefined): ProfileFormInput {
  return { name: existing?.name ?? existing?.display_name ?? '', about: existing?.about ?? '', picture: existing?.picture ?? '' };
}
