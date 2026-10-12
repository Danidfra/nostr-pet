/**
 * Physical things in the room that are not furniture and not a Blobbi: a
 * dish of food set down for it, a ball to play with. The app describes
 * them (`RoomProp`); the room draws them (the 3D scene as meshes among the
 * furniture, with depth and shadows; the simple room as a drawing anchored
 * to the floor) and, for a ball, moves them (`ball-physics.ts`).
 *
 * A prop is identity and state, never behaviour: what it is, where it was
 * set down, what the dish holds (the item's own glyph, so an apple is an
 * apple and a burger a burger), how much has been eaten, whether it is on
 * its way out. The interaction that put it there (`room-interaction.ts`)
 * owns its lifetime; nothing here is persisted or published.
 */
import type { HomeItem } from '@/features/inventory';

export type RoomPropKind = 'dish' | 'ball';

/** What a dish shows: the item's picture (a vetted https image), its emoji, or a plain shape in its category's colour. */
export interface PropGlyph {
  emoji?: string;
  url?: string;
  category?: string;
}

export interface RoomProp {
  id: string;
  kind: RoomPropKind;
  /** Where it was set down (tiles). A ball rolls on from here; the scene owns its motion after that. */
  x: number;
  z: number;
  /** A dish: what is on it. */
  food?: PropGlyph;
  /** A dish: how many bites are gone, out of how many the food takes. */
  bites?: { taken: number; of: number };
  /** On its way out (eaten up, put away, played out): it shrinks and fades, and the owner removes it after `PROP_LEAVE_MS`. */
  leaving?: boolean;
}

/** How long a leaving prop takes to be gone. */
export const PROP_LEAVE_MS = 480;
/** How long a prop takes to drop in and settle when set down. */
export const PROP_ENTER_MS = 420;

/** The toys the room knows how to play with, by the official item's `d`; anything else is set down and used in place. */
export const TOY_BEHAVIOURS: Readonly<Record<string, 'ball'>> = { 'blobbi:toy:ball': 'ball' };

/** Which prop an item becomes when it is set down: food and drink on a dish, a known toy as itself, anything else nothing physical (its glyph lies on the floor). */
export function propKindFor(item: Pick<HomeItem, 'itemId' | 'care'>): RoomPropKind | null {
  const action = item.care?.action;
  if (action === 'feed' || action === 'boost') return 'dish';
  if (action === 'play') return TOY_BEHAVIOURS[item.itemId] ?? null;
  return null;
}

/** The item's own look for the dish: its vetted image when it has one, else its emoji, else its category's colour. */
export function propGlyphFor(item: Pick<HomeItem, 'glyph' | 'definition'>): PropGlyph {
  const glyph: PropGlyph = {};
  if (item.glyph.type === 'image') glyph.url = item.glyph.url;
  if (item.glyph.type === 'emoji') glyph.emoji = item.glyph.text;
  if (item.glyph.type === 'category') glyph.category = item.glyph.category;
  // An image may fail to load: the definition's emoji is the fallback the drawing keeps
  const content = item.definition?.contentJson as { metadata?: { emoji?: unknown } } | undefined;
  const emoji = content?.metadata?.emoji;
  if (!glyph.emoji && typeof emoji === 'string' && emoji.trim() && emoji.length <= 16) glyph.emoji = emoji.trim();
  return glyph;
}

/** A stable key for a glyph, so a drawing is redone only when what it shows changes. */
export function glyphKey(glyph: PropGlyph | undefined): string {
  return glyph ? `${glyph.url ?? ''}|${glyph.emoji ?? ''}|${glyph.category ?? ''}` : '';
}
