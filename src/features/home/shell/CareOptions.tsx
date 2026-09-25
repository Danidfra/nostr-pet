import { memo } from 'react';
import { ItemGlyph } from '@/features/inventory';
import { describeOption, type CareOption, type CareVerb } from '../care-model';

const VERB_WORD: Record<CareVerb, string> = { feed: 'Feed', play: 'Play', clean: 'Clean', rest: 'Rest' };

interface CareOptionsProps {
  verb: CareVerb;
  options: readonly CareOption[];
  onChoose: (option: CareOption) => void;
  disabled?: boolean;
}

/**
 * The items for the chosen verb, right above the verb row: the ones the
 * player owns (artwork, name, count; using one spends it) and the starter
 * kit (artwork, name, "free"; using one spends nothing and is never
 * counted as owned). One tap chooses. The strip scrolls sideways when
 * there are many, and is one thumb high. It floats over the bottom of the
 * room (CSS: absolute, anchored to the dock), so opening it never changes
 * the dock's height or moves the scene.
 */
function CareOptionsImpl({ verb, options, onChoose, disabled = false }: CareOptionsProps) {
  return (
    <div className="care-options" role="group" aria-label={`${VERB_WORD[verb]}: choose an item`} data-testid="care-options" data-verb={verb} data-float="true">
      <div className="care-options__strip" role="list">
        {options.map((option) => {
          const label = describeOption(option);
          const item = option.entry.item;
          const starter = option.source === 'starter';
          return (
            <div role="listitem" key={option.key} className="care-option__slot">
              <button
                type="button"
                className={`care-option ${starter ? 'care-option--starter' : ''}`}
                onClick={() => onChoose(option)}
                disabled={disabled}
                aria-label={label}
                title={starter ? (item.definitionSource === 'builtin' ? 'Starter item (built-in details; the definition relay did not answer)' : 'Starter item: free, always here') : undefined}
                data-testid={starter ? `care-option-starter-${item.itemId}` : `care-option-${item.itemId}`}
                data-source={option.source}
                data-definition={item.definitionSource}
              >
                <span className="care-option__art">
                  <ItemGlyph glyph={item.glyph} size="2rem" />
                </span>
                {option.source === 'owned' ? (
                  <span className="care-option__qty" aria-hidden>
                    ×{option.entry.quantity}
                  </span>
                ) : (
                  <span className="care-option__free" aria-hidden>
                    free
                  </span>
                )}
                <span className="care-option__name">{item.name}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const CareOptions = memo(CareOptionsImpl);
