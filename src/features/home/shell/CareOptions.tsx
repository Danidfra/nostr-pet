import { memo, useEffect, useState } from 'react';
import { ItemCarousel } from '@/features/care-ui/ItemCarousel';
import { entryGroup, type CareEntry } from '@/features/care-ui/care-entries';
import type { CareVerb } from '../care-model';

/** The verbs' words; `clean` is "Care" (its hygiene items and its medicine together, M15 care refinement). */
const VERB_WORD: Record<CareVerb, string> = { feed: 'Feed', play: 'Play', clean: 'Care', rest: 'Rest' };

interface CareOptionsProps {
  verb: CareVerb;
  /** What the verb offers: its starter items, then the player's owned ones with their counts (`homeCareEntries`). */
  entries: readonly CareEntry[];
  /** The item in the middle (the home's, per verb, for the visit). */
  focusedKey: string | null;
  onFocus: (key: string) => void;
  onChoose: (entry: CareEntry) => void;
  /** Something is under way (a use, a walk to the bed): nothing new starts. */
  disabled?: boolean;
}

/**
 * The items for the chosen verb, right above the verb row, in the same
 * carousel the room's dock uses (`ItemCarousel`, Ditto's): one item in the
 * middle, big, arrows either side, its neighbours as previews; owned items
 * show how many are left; tapping the middle one chooses it, and the home's
 * own care path takes it from there (`offerItem`: the same write, spend
 * and ledger as the Inventory's Use). It floats over the bottom of the room
 * (CSS: absolute, anchored to the dock), so opening it never changes the
 * dock's height or moves the scene.
 */
function CareOptionsImpl({ verb, entries, focusedKey, onFocus, onChoose, disabled = false }: CareOptionsProps) {
  // Why the item in the middle cannot be used now, when the player taps it anyway
  const [blocked, setBlocked] = useState<string | null>(null);
  useEffect(() => setBlocked(null), [verb, focusedKey]);
  // Care: the hygiene items first, then the health ones; a thin divider names the health group while it is in the middle
  const focused = entries.find((e) => e.key === focusedKey) ?? entries[0];
  const grouped = entries.some((e) => entryGroup(e) === 'hygiene') && entries.some((e) => entryGroup(e) === 'health');
  const inHealth = grouped && !!focused && entryGroup(focused) === 'health';
  return (
    <div className="care-options" role="group" aria-label={`${VERB_WORD[verb]}: choose an item`} data-testid="care-options" data-verb={verb} data-float="true">
      {inHealth && (
        <p className="care-options__group scene-text" data-testid="care-group" data-group="health" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5em', margin: '0 0 0.15em', fontSize: '0.7em', fontWeight: 600, letterSpacing: '0.04em', opacity: 0.8 }}>
          <span aria-hidden style={{ height: 1, width: '2.5em', background: 'currentColor', opacity: 0.45 }} />
          Health
          <span aria-hidden style={{ height: 1, width: '2.5em', background: 'currentColor', opacity: 0.45 }} />
        </p>
      )}
      <div className="care-options__carousel">
        <ItemCarousel
          items={entries}
          focusedKey={focusedKey}
          onFocus={onFocus}
          onUse={onChoose}
          onBlocked={(entry) => setBlocked(entry.reason ?? 'Not right now.')}
          disabled={disabled}
          idPrefix="care-item"
        />
      </div>
      {blocked && (
        <p className="care-options__note scene-text" role="status" data-testid="care-item-blocked">
          {blocked}
        </p>
      )}
    </div>
  );
}

export const CareOptions = memo(CareOptionsImpl);
