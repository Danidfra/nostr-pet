/**
 * The words of the world-travel live region (`TravelAnnouncer`): which
 * sentence a travel state says, kept apart from the component so both homes
 * and the tests share one source.
 */
import type { TravelViewKind } from '@blobbi-kit/core';
import { t } from '@/i18n';

/** "Looking for …" is said only when the first look lasts this long (ms): a quick answer says nothing at all. */
export const LOOKING_SAID_AFTER_MS = 800;

export interface TravelAnnouncerProps {
  /** World travel is on Nostr and this Blobbi travels (not an egg, not a sleeper). */
  active: boolean;
  view: TravelViewKind;
  place: string;
  name: string;
  nameOf: (place: string) => string;
  unreachable: boolean;
}

/** The sentence for a state, or null for "nothing to say" (the Blobbi home, never in question). */
export function travelAnnouncement(p: Omit<TravelAnnouncerProps, 'active'>, said: string | null): string | null {
  const relays = p.unreachable ? ` ${t('world.travel.unreachable')}` : '';
  switch (p.view) {
    case 'looking':
      return t('world.travel.looking', { name: p.name });
    case 'coming':
      return t('world.travel.calling', { name: p.name });
    case 'away':
      return `${t('world.travel.isIn', { name: p.name, place: p.nameOf(p.place) })}${relays}`;
    case 'here':
      // Only as the end of something said (a look, a call, an absence): never on a plain load
      return said ? `${t('world.travel.isHere', { name: p.name })}${relays}` : p.unreachable ? `${t('world.travel.shownHome', { name: p.name })}${relays}` : null;
  }
}
