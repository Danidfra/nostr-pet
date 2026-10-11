import { memo, useEffect, useState } from 'react';
import { ItemCarousel } from '@/features/care-ui/ItemCarousel';
import type { CareEntry } from '@/features/care-ui/care-entries';
import type { CareVerb } from '../care-model';

const VERB_WORD: Record<CareVerb, string> = { feed: 'Feed', play: 'Play', clean: 'Clean', rest: 'Rest' };

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
  return (
    <div className="care-options" role="group" aria-label={`${VERB_WORD[verb]}: choose an item`} data-testid="care-options" data-verb={verb} data-float="true">
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
