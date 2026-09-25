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
 * The items for the chosen verb, right above the verb row: the starter kit
 * that answers it (artwork and name; using one spends nothing and is never
 * counted as owned). One tap chooses. The strip scrolls sideways when
 * there are many, and is one thumb high. It floats over the bottom of the
 * room (CSS: absolute, anchored to the dock), so opening it never changes
 * the dock's height or moves the scene. Owned items are not repeated here;
 * they live in the Inventory overlay with their quantities.
 */
function CareOptionsImpl({ verb, options, onChoose, disabled = false }: CareOptionsProps) {
  return (
    <div className="care-options" role="group" aria-label={`${VERB_WORD[verb]}: choose an item`} data-testid="care-options" data-verb={verb} data-float="true">
      <div className="care-options__strip" role="list">
        {options.map((option) => {
          const label = describeOption(option);
          const item = option.entry.item;
          return (
            <div role="listitem" key={option.key} className="care-option__slot">
              <button
                type="button"
                className="care-option"
                onClick={() => onChoose(option)}
                disabled={disabled}
                aria-label={label}
                title={item.definitionSource === 'builtin' ? 'Details are built-in; the definition relay did not answer' : undefined}
                data-testid={option.source === 'starter' ? `care-option-starter-${item.itemId}` : `care-option-${item.itemId}`}
                data-source={option.source}
                data-definition={item.definitionSource}
              >
                <span className="care-option__art">
                  <ItemGlyph glyph={item.glyph} size="2rem" />
                </span>
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
