import { useMemo, useState } from 'react';
import { BlobbiRenderer, createBlobbiV3Identity, type BlobbiFacing, type BlobbiVisual } from '@blobbi-kit/renderer';

/** One column of the sheet: a stage seen from a side, in a state. */
const COLUMNS: readonly { label: string; stage: 'egg' | 'baby' | 'adult'; facing?: BlobbiFacing; eggCrack?: 'heavy'; motion?: 'walking' | 'idle' }[] = [
  { label: 'egg', stage: 'egg' },
  { label: 'cracking', stage: 'egg', eggCrack: 'heavy' },
  { label: 'baby', stage: 'baby' },
  { label: 'baby →', stage: 'baby', facing: 'right' },
  { label: 'adult', stage: 'adult' },
  { label: 'adult →', stage: 'adult', facing: 'right' },
  { label: 'adult ←', stage: 'adult', facing: 'left' },
  { label: 'adult back', stage: 'adult', facing: 'back' },
];

/**
 * A V3 population, through the renderer alone: consecutive seeds, each drawn
 * as its egg, its baby and its adult from every side. For judging what tests
 * cannot (is this one species, is a baby the young of its adult, is an egg a
 * hint of what is inside) and for looking at the renderer inside this app's
 * own page, theme and box sizes. Isolated previews: no world, no fixture,
 * no event. Every identity is what the kit's creation rule gives the seed,
 * so this is also what an adoption with that seed would be born as.
 */
export function V3Sheet({ cell = 76 }: { cell?: number }) {
  const [base, setBase] = useState('lab');
  const [count, setCount] = useState(6);
  const [moving, setMoving] = useState(false);
  const rows = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const seed = `${base}-${i + 1}`;
        return { seed, v3: createBlobbiV3Identity(seed) };
      }),
    [base, count],
  );
  return (
    <div data-testid="dev-v3-sheet">
      <div className="dev-panel__row">
        <span className="dev-panel__label">base seed</span>
        <input value={base} spellCheck={false} onChange={(e) => setBase(e.target.value)} data-testid="dev-v3-seed" />
        <span className="dev-panel__label">rows</span>
        {[6, 12, 24].map((n) => (
          <button type="button" key={n} aria-pressed={count === n} onClick={() => setCount(n)} data-testid={`dev-v3-count-${n}`}>
            {n}
          </button>
        ))}
        <button type="button" aria-pressed={moving} onClick={() => setMoving((m) => !m)} data-testid="dev-v3-moving">
          {moving ? 'moving' : 'still'}
        </button>
      </div>
      {/* Wider than the controls column: it scrolls sideways rather than losing its last columns. */}
      <div className="dev-sheet" style={{ gridTemplateColumns: `5rem repeat(${COLUMNS.length}, ${cell}px)`, overflowX: 'auto' }}>
        <span />
        {COLUMNS.map((column) => (
          <span key={column.label} className="dev-sheet__head">
            {column.label}
          </span>
        ))}
        {rows.map(({ seed, v3 }) => (
          <Row key={seed} seed={seed}>
            {COLUMNS.map((column) => {
              const visual: BlobbiVisual = { stage: column.stage, visualGeneration: 'v3', v3 };
              return (
                <span key={column.label} className="dev-sheet__cell" style={{ width: cell, height: cell }} data-testid={`dev-v3-cell-${seed}-${column.label.replace(/\W+/g, '-')}`}>
                  <BlobbiRenderer
                    visual={visual}
                    instanceId={`v3sheet-${seed}-${column.label}`}
                    size="100%"
                    facing={column.facing ?? 'front'}
                    eggCrack={column.eggCrack ?? 'none'}
                    motion={moving ? (column.facing === 'right' || column.facing === 'left' ? 'walking' : 'idle') : 'still'}
                    transparent
                    style={{ width: '100%', height: '100%' }}
                  />
                </span>
              );
            })}
          </Row>
        ))}
      </div>
    </div>
  );
}

function Row({ seed, children }: { seed: string; children: React.ReactNode }) {
  return (
    <>
      <span className="dev-sheet__head">{seed}</span>
      {children}
    </>
  );
}
