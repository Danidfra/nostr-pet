/**
 * The profile form of the kind 0 write: checked and prefilled here; how it
 * is merged into the account's metadata, and when it may be written at all,
 * is `metadata-write.ts`. Nothing secret is ever part of a profile.
 */
import type { NostrMetadata } from '@nostrify/nostrify';
import { t } from '@/i18n';

export const PROFILE_NAME_MAX = 50;
export const PROFILE_ABOUT_MAX = 300;

export interface ProfileFormInput {
  name: string;
  about: string;
  picture: string;
}

export type ProfileCheck = { ok: true; value: ProfileFormInput } | { ok: false; reason: string };

/**
 * Trim and bound the form; a picture must be an http(s) URL or empty. The
 * profile editor wants a name; the save ceremony's steps (M14.2) may give a
 * picture or a line without one (`allowEmptyName`), and then the name is
 * simply not set.
 */
export function checkProfileForm(input: ProfileFormInput, { allowEmptyName = false }: { allowEmptyName?: boolean } = {}): ProfileCheck {
  const name = input.name.trim().replace(/\s+/g, ' ');
  const about = input.about.trim();
  const picture = input.picture.trim();
  if (name.length === 0 && !allowEmptyName) return { ok: false, reason: t('wayIn.profile.nameMissing') };
  if (name.length > PROFILE_NAME_MAX) return { ok: false, reason: t('wayIn.profile.nameTooLong', { max: PROFILE_NAME_MAX }) };
  if (about.length > PROFILE_ABOUT_MAX) return { ok: false, reason: t('wayIn.profile.bioTooLong', { max: PROFILE_ABOUT_MAX }) };
  if (picture) {
    try {
      const url = new URL(picture);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: t('wayIn.profile.pictureUrl') };
    } catch {
      return { ok: false, reason: t('wayIn.profile.pictureUrl') };
    }
  }
  return { ok: true, value: { name, about, picture } };
}

/** The form prefilled from what the player already has. */
export function profileFormFrom(existing: NostrMetadata | undefined): ProfileFormInput {
  return { name: existing?.name ?? existing?.display_name ?? '', about: existing?.about ?? '', picture: existing?.picture ?? '' };
}
