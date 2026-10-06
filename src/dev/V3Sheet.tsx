import { useMemo, useState } from 'react';
import { BlobbiRenderer, createBlobbiV3Identity, type BlobbiFacing, type BlobbiV3Identity, type BlobbiVisual } from '@blobbi-kit/renderer';
import { V3_REFERENCE_BLOBBIS } from './v3-reference';
import { sheetSeeds, type SheetSource } from './v3-sheet-seeds';

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

/** A row: a label, and the complete identity the kit draws. */
interface SheetRow {
  label: string;
  v3: BlobbiV3Identity;
}

/**
 * V3 Blobbis through the renderer alone, each drawn as its egg, its baby and
 * its adult from every side. For judging what tests cannot (is this one
 * species, is a baby the young of its adult, is an egg a hint of what is
 * inside) and for looking at the renderer inside this app's own page, theme
 * and box sizes. Isolated previews: no world, no fixture, no event.
 *
 * Two sources. REFERENCE: the twelve Blobbis the kit pins algorithm 1 with,
 * exactly as it states them, so what is seen here is what the kit's own
 * reference drawings show. SEEDS: consecutive real seeds for a label, each
 * drawn as what the kit's creation rule gives it, which is what an adoption
 * with that seed would be born as; or one seed pasted from an event.
 */
export function V3Sheet({ cell = 76 }: { cell?: number }) {
  const [source, setSource] = useState<SheetSource>('reference');
  const [base, setBase] = useState('lab');
  const [count, setCount] = useState(6);
  const [moving, setMoving] = useState(false);
  const rows = useMemo<SheetRow[]>(
    () =>
      source === 'reference'
        ? V3_REFERENCE_BLOBBIS.map(({ name, identity }) => ({ label: name, v3: identity }))
        : sheetSeeds(base, count).map(({ label, seed }) => ({ label, v3: createBlobbiV3Identity(seed) })),
    [source, base, count],
  );
  return (
    <div data-testid="dev-v3-sheet">
      <div className="dev-panel__row">
        {(['reference', 'seeds'] as const).map((s) => (
          <button type="button" key={s} aria-pressed={source === s} onClick={() => setSource(s)} data-testid={`dev-v3-source-${s}`} title={s === 'reference' ? "The kit's twelve reference Blobbis, as it states them" : 'Real seeds for a label, as creation gives them; or a seed pasted from an event'}>
            {s === 'reference' ? "kit's reference Blobbis" : 'seeds'}
          </button>
        ))}
        {source === 'seeds' && (
          <>
            <span className="dev-panel__label">label or seed</span>
            <input value={base} spellCheck={false} onChange={(e) => setBase(e.target.value)} data-testid="dev-v3-seed" />
            <span className="dev-panel__label">rows</span>
            {[6, 12, 24].map((n) => (
              <button type="button" key={n} aria-pressed={count === n} onClick={() => setCount(n)} data-testid={`dev-v3-count-${n}`}>
                {n}
              </button>
            ))}
          </>
        )}
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
        {rows.map(({ label, v3 }) => (
          <Row key={v3.seed} label={label} seed={v3.seed}>
            {COLUMNS.map((column) => {
              const visual: BlobbiVisual = { stage: column.stage, visualGeneration: 'v3', v3 };
              return (
                <span key={column.label} className="dev-sheet__cell" style={{ width: cell, height: cell }} data-testid={`dev-v3-cell-${label}-${column.label.replace(/\W+/g, '-')}`}>
                  <BlobbiRenderer
                    visual={visual}
                    instanceId={`v3sheet-${v3.seed.slice(0, 12)}-${column.label}`}
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

function Row({ label, seed, children }: { label: string; seed: string; children: React.ReactNode }) {
  return (
    <>
      <span className="dev-sheet__head" title={`seed ${seed}`}>
        {label}
      </span>
      {children}
    </>
  );
}
