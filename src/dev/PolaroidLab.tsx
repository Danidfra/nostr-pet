import { useEffect, useMemo, useState } from 'react';
import { VISUAL_GENERATION_TAG, parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import type { BlobbiEggCrack, BlobbiVisual } from '@blobbi-kit/renderer';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { portraitOptions } from '@/features/photo/blobbi-portrait';
import { composePolaroid } from '@/features/photo/compose-polaroid';
import { FRAME_LABEL, POLAROID_FRAMES, photoDate, type PolaroidFrame } from '@/features/photo/polaroid-layout';

type Stage = 'egg' | 'baby' | 'adult';
type Generation = 'v1' | 'v2' | 'v3';

/** Every drawing a Polaroid can hold: each stage of each generation that has artwork of its own. */
const SUBJECTS: readonly { stage: Stage; generation: Generation }[] = [
  { stage: 'egg', generation: 'v1' },
  { stage: 'baby', generation: 'v1' },
  { stage: 'adult', generation: 'v1' },
  { stage: 'adult', generation: 'v2' },
  { stage: 'egg', generation: 'v3' },
  { stage: 'baby', generation: 'v3' },
  { stage: 'adult', generation: 'v3' },
];

/** The fixture's own event with the stage and the generation swapped (as `sheet-visuals.ts` does), eggs included. */
function useSubjects(blobbi: BlobbiCompanion): { key: string; label: string; visual: BlobbiVisual }[] {
  return useMemo(() => {
    const fixtureIsV3 = blobbi.visualGeneration === 'v3';
    return SUBJECTS.flatMap(({ stage, generation }) => {
      let tags = blobbi.event.tags.filter((t) => t[0] !== 'stage' && t[0] !== VISUAL_GENERATION_TAG && t[0] !== 'state');
      if (generation !== 'v3' && fixtureIsV3 && blobbi.seed) tags = [...tags.filter((t) => t[0] !== 'seed'), ['seed', blobbi.seed]];
      tags.push(['stage', stage], ['state', 'active']);
      if (generation !== 'v1') tags.push([VISUAL_GENERATION_TAG, generation]);
      const parsed = parseModernBlobbiEvent({ ...blobbi.event, tags });
      return parsed ? [{ key: `${stage}-${generation}`, label: `${stage} ${generation}`, visual: toBlobbiVisual(parsed) }] : [];
    });
  }, [blobbi.event, blobbi.seed, blobbi.visualGeneration]);
}

const CRACKS: readonly BlobbiEggCrack[] = ['none', 'light', 'medium', 'heavy'];

/**
 * A contact sheet of Polaroids: the fixture as every stage of every
 * generation, in the chosen frame, drawn by the very code the Photo sheet
 * uses (`composePolaroid`). Nothing is developed until asked for: each
 * picture is a full-size PNG.
 */
export function PolaroidLab({ blobbi }: { blobbi: BlobbiCompanion }) {
  const subjects = useSubjects(blobbi);
  const [frame, setFrame] = useState<PolaroidFrame>('classic');
  const [sleeping, setSleeping] = useState(false);
  const [crack, setCrack] = useState<BlobbiEggCrack>('none');
  const [caption, setCaption] = useState('A sunny afternoon at home');
  const [withDate, setWithDate] = useState(false);
  const [run, setRun] = useState(0);
  const [pictures, setPictures] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (run === 0) return;
    let cancelled = false;
    const made: string[] = [];
    setFailed(null);
    void (async () => {
      for (const subject of subjects) {
        try {
          const result = await composePolaroid({
            portrait: portraitOptions({ visual: subject.visual, sleeping, eggCrack: crack }),
            frame,
            name: blobbi.name,
            caption,
            date: withDate ? photoDate(new Date()) : null,
          });
          if (cancelled) return;
          const url = URL.createObjectURL(result.blob);
          made.push(url);
          setPictures((p) => ({ ...p, [subject.key]: url }));
        } catch (error) {
          if (!cancelled) setFailed(`${subject.label}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
      for (const url of made) URL.revokeObjectURL(url);
      setPictures({});
    };
    // Developed on demand: the button (and any control, once developed) asks again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, frame, sleeping, crack, caption, withDate, subjects]);

  return (
    <>
      <div className="dev-panel__row">
        {POLAROID_FRAMES.map((f) => (
          <button type="button" key={f} aria-pressed={frame === f} onClick={() => setFrame(f)} data-testid={`dev-polaroid-frame-${f}`}>
            {FRAME_LABEL[f]}
          </button>
        ))}
        <button type="button" onClick={() => setRun((n) => n + 1)} data-testid="dev-polaroid-develop">
          {run === 0 ? 'Develop' : 'Develop again'}
        </button>
      </div>
      <div className="dev-panel__row">
        <label>
          <input type="checkbox" checked={sleeping} onChange={(e) => setSleeping(e.target.checked)} data-testid="dev-polaroid-sleeping" /> sleeping
        </label>
        <label>
          <input type="checkbox" checked={withDate} onChange={(e) => setWithDate(e.target.checked)} data-testid="dev-polaroid-date" /> date
        </label>
        <label>
          egg crack{' '}
          <select value={crack} onChange={(e) => setCrack(e.target.value as BlobbiEggCrack)} data-testid="dev-polaroid-crack">
            {CRACKS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="dev-panel__row">
        <label htmlFor="dev-polaroid-caption">caption</label>
        <input id="dev-polaroid-caption" value={caption} onChange={(e) => setCaption(e.target.value)} data-testid="dev-polaroid-caption" />
      </div>
      {failed && <p className="dev-panel__error">{failed}</p>}
      <div className="dev-polaroids" data-testid="dev-polaroids">
        {subjects.map((s) => (
          <figure key={s.key}>
            {pictures[s.key] ? <img src={pictures[s.key]} alt={`Polaroid: ${s.label}`} data-testid={`dev-polaroid-${s.key}`} /> : null}
            <figcaption>{s.label}</figcaption>
          </figure>
        ))}
      </div>
      <p className="dev-panel__hint">The fixture's own seed as each stage and generation, through the Photo sheet's own composer. Full-size PNGs (1080 × 1350): open one in a new tab to inspect it.</p>
    </>
  );
}
