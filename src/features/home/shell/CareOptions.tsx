import { memo } from 'react';
import { Bath, BedDouble, Cookie, Gamepad2, type LucideIcon } from 'lucide-react';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { ItemGlyph } from '@/features/inventory';
import { describeOption, type CareOption, type CareVerb } from '../care-model';

const PLAIN_ICON: Record<CareVerb, LucideIcon> = { feed: Cookie, play: Gamepad2, clean: Bath, rest: BedDouble };
const VERB_WORD: Record<CareVerb, string> = { feed: 'Feed', play: 'Play', clean: 'Clean', rest: 'Rest' };

interface CareOptionsProps {
  verb: CareVerb;
  options: readonly CareOption[];
  blobbi: Pick<BlobbiCompanion, 'name'>;
  onChoose: (option: CareOption) => void;
  disabled?: boolean;
}

/**
 * The options for the chosen verb, right above the verb row: the items the
 * player owns that do it (from the verified inventory read, with artwork
 * and count) and the plain way that needs nothing. One tap chooses. The
 * strip scrolls sideways when there are many, and is one thumb high.
 */
function CareOptionsImpl({ verb, options, blobbi, onChoose, disabled = false }: CareOptionsProps) {
  return (
    <div className="care-options" role="group" aria-label={`${VERB_WORD[verb]}: ways to do it`} data-testid="care-options" data-verb={verb}>
      <div className="care-options__strip" role="list">
        {options.map((option) => {
          const label = describeOption(option, blobbi);
          if (option.kind === 'item') {
            return (
              <div role="listitem" key={option.key} className="care-option__slot">
                <button type="button" className="care-option" onClick={() => onChoose(option)} disabled={disabled} aria-label={label} data-testid={`care-option-${option.entry.item.itemId}`} data-kind="item">
                  <span className="care-option__art">
                    <ItemGlyph glyph={option.entry.item.glyph} size="2rem" />
                  </span>
                  <span className="care-option__qty" aria-hidden>
                    ×{option.entry.quantity}
                  </span>
                  <span className="care-option__name">{option.entry.item.name}</span>
                </button>
              </div>
            );
          }
          const Icon = PLAIN_ICON[option.verb];
          return (
            <div role="listitem" key={option.key} className="care-option__slot">
              <button type="button" className="care-option care-option--plain" onClick={() => onChoose(option)} disabled={disabled} aria-label={label} title={option.hint} data-testid={`care-option-plain-${option.verb}`} data-kind="plain">
                <span className="care-option__art">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <span className="care-option__name">{option.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const CareOptions = memo(CareOptionsImpl);
