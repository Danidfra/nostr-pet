/**
 * `/room/3d-lab`: the procedural 3D Blobbi, on trial beside the 2D drawing.
 *
 * A dev build's route only (gated in the router like `/room`), isolated from
 * the home and the room: nothing here is published, stored or remembered.
 * Three fixed identities (three addresses, so three seeds the way core
 * derives them) and the signed-in Blobbi when it is a V3 one, each shown as
 * the kit's 2D drawing and as the 3D model from the same genome, front, side
 * and back; a stage that turns, idles, walks, sleeps and can stand the SNO
 * figurine beside the model; and the real room with the Blobbi drawn either
 * way, walking to the same spots.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BlobbiRenderer, type BlobbiFacing } from '@blobbi-kit/renderer';
import type { BlobbiGenome, BlobbiMotion } from '@blobbi-kit/renderer/procedural';
import type { BlobbiCompanion } from '@blobbi-kit/core';

import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { DEFAULT_ROOM, type RoomId } from '@/features/home/rooms/rooms';
import { RoomShell } from './components/RoomShell';
import { RoomBlobbi } from './components/RoomBlobbi';
import { Blobbi3dStage } from './components/Blobbi3dStage';
import { useRoomNavigation } from './hooks/useRoomNavigation';
import { walkCycleSecondsFor, walkSpeedFor } from './lib/room-pace';
import { roomFurnitureFor } from './lib/room-furniture';
import { roomLayoutFor } from './lib/room-layout';
import { buildBlobbiModel } from './lib/blobbi3d/model';
import { createBlobbiActor } from './lib/blobbi3d/actor';
import { genomeOf, labBlobbi, morphologyOf, stage3dOf, type Blobbi3dStage as Stage3d } from './lib/blobbi3d/identity';
import { prefersReducedMotion, type StageView } from './lib/blobbi3d/stage';

interface LabIdentity {
  id: string;
  label: string;
  blobbi: BlobbiCompanion;
  genome: BlobbiGenome;
  stage: Stage3d;
}

/** Three addresses: three seeds, as core derives them from `(pubkey, d)`. */
const FIXED: { id: string; pubkey: string; petId: string; name: string }[] = [
  { id: 'one', pubkey: 'a'.repeat(64), petId: '0000000001', name: 'Lab One' },
  { id: 'two', pubkey: 'b'.repeat(64), petId: '0000000002', name: 'Lab Two' },
  { id: 'three', pubkey: 'c'.repeat(64), petId: '0000000003', name: 'Lab Three' },
];

const VIEWS: { view: StageView; label: string }[] = [
  { view: 'front', label: 'Front' },
  { view: 'side', label: 'Side' },
  { view: 'back', label: 'Back' },
  { view: 'turn', label: 'Turn' },
];
const MOTIONS: { motion: BlobbiMotion; label: string }[] = [
  { motion: 'still', label: 'Still' },
  { motion: 'idle', label: 'Idle' },
  { motion: 'walking', label: 'Walk' },
];
/** The kit's facing for each compared view (its side view faces screen-right). */
const FACING: Record<'front' | 'side' | 'back', BlobbiFacing> = { front: 'front', side: 'right', back: 'back' };

/** Where the room's walk button sends the Blobbi, round the room (tiles). */
const SPOTS = [{ x: 1.5, z: 6.5 }, { x: 6.5, z: 6.5 }, { x: 6.5, z: 1.5 }, { x: 1.5, z: 1.5 }];

function identityOf(id: string, label: string, blobbi: BlobbiCompanion, stage: Stage3d): LabIdentity | null {
  const genome = genomeOf(toBlobbiVisual(blobbi));
  return genome ? { id, label, blobbi, genome, stage } : null;
}

function Chip({ on, onClick, children, testId }: { on: boolean; onClick: () => void; children: React.ReactNode; testId: string }) {
  return (
    <button type="button" className={on ? 'decor-chip decor-chip--on' : 'decor-chip'} onClick={onClick} aria-pressed={on} data-testid={testId}>
      {children}
    </button>
  );
}

export default function RoomLabPage() {
  const home = useHomeBlobbi();
  const [stage, setStage] = useState<Stage3d>('adult');
  const [chosen, setChosen] = useState('one');
  const mine = home.status === 'ready' ? home.current : undefined;
  const identities = useMemo(() => {
    const fixed = FIXED.map((f) => identityOf(f.id, f.name, labBlobbi(f.pubkey, f.petId, f.name, stage), stage));
    const ownStage = mine ? stage3dOf(mine.stage) : null;
    const own = mine && ownStage ? identityOf('mine', `${mine.name} (yours)`, mine, ownStage) : null;
    return [...fixed, own].filter((i): i is LabIdentity => i !== null);
  }, [stage, mine]);
  const current = identities.find((i) => i.id === chosen) ?? identities[0];
  const [view, setView] = useState<StageView>('turn');
  const [motion, setMotion] = useState<BlobbiMotion>('idle');
  const [sleeping, setSleeping] = useState(false);
  const [figurine, setFigurine] = useState(false);
  const visual = useMemo(() => toBlobbiVisual(current.blobbi), [current.blobbi]);

  return (
    <div className="game-shell" data-testid="room-lab">
      <div className="game-frame">
        <div className="game-column overflow-y-auto">
          <header className="flex items-center gap-3 p-3">
            <Link to="/room" className="room-hud-button" aria-label="Back to the room" data-testid="lab-back">
              <ArrowLeft />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold">3D Blobbi lab</h1>
              <p className="text-[11px] text-foreground/70">Dev only. The kit's drawing and the procedural model, from one genome.</p>
            </div>
          </header>

          <section className="flex flex-wrap items-center gap-2 px-3 pb-2" aria-label="Identity">
            {identities.map((i) => (
              <Chip key={i.id} on={i.id === current.id} onClick={() => setChosen(i.id)} testId={`lab-identity-${i.id}`}>
                {i.label}
              </Chip>
            ))}
            <span className="mx-1 text-foreground/40">·</span>
            <Chip on={stage === 'adult'} onClick={() => setStage('adult')} testId="lab-life-adult">Adult</Chip>
            <Chip on={stage === 'baby'} onClick={() => setStage('baby')} testId="lab-life-baby">Baby</Chip>
          </section>
          <p className="px-3 pb-2 text-[11px] text-foreground/60" data-testid="lab-seed">
            seed {current.genome.seed.slice(0, 16)}…
          </p>

          <section className="px-3 pb-3" aria-label="Side by side">
            <h2 className="pb-2 text-sm font-bold">Side by side: the kit's 2D drawing over the 3D model</h2>
            <div className="flex flex-wrap gap-3" data-testid="lab-compare">
              {(['front', 'side', 'back'] as const).map((v) => (
                <figure key={v} className="flex flex-col items-center gap-1" data-testid={`lab-compare-${v}`}>
                  <div className="relative rounded-2xl bg-white/40" style={{ width: 160, height: 160 }} data-testid={`lab-2d-${v}`}>
                    <BlobbiRenderer visual={visual} instanceId={`lab-2d-${current.id}-${v}`} size="100%" facing={FACING[v]} motion="still" sleepIndicator="none" transparent style={{ width: '100%', height: '100%' }} />
                  </div>
                  <Blobbi3dStage genome={current.genome} stage={current.stage} view={v} motion="still" size={160} testId={`lab-stage-${v}`} label={`3D ${v}`} />
                  <figcaption className="text-[11px] text-foreground/70">{v}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="px-3 pb-3" aria-label="Motion">
            <h2 className="pb-2 text-sm font-bold">On the stage</h2>
            <div className="flex flex-wrap items-start gap-3">
              <Blobbi3dStage genome={current.genome} stage={current.stage} view={view} motion={motion} sleeping={sleeping} figurine={figurine} walkCycle={walkCycleSecondsFor('v3')} size={300} testId="lab-stage-main" label="3D stage" />
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex flex-wrap gap-1" role="group" aria-label="View">
                  {VIEWS.map((v) => (
                    <Chip key={v.view} on={view === v.view} onClick={() => setView(v.view)} testId={`lab-view-${v.view}`}>{v.label}</Chip>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Motion">
                  {MOTIONS.map((m) => (
                    <Chip key={m.motion} on={motion === m.motion} onClick={() => setMotion(m.motion)} testId={`lab-motion-${m.motion}`}>{m.label}</Chip>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Chip on={sleeping} onClick={() => setSleeping((s) => !s)} testId="lab-sleeping">Asleep</Chip>
                  <Chip on={figurine} onClick={() => setFigurine((f) => !f)} testId="lab-figurine">SNO figurine beside it</Chip>
                </div>
                <p className="max-w-[16rem] text-[11px] text-foreground/60">
                  Breathing, blinking, the walk and the turn come from the kit's own motion functions and the seed; the SNO figurine is the furniture format's flat-faced lattice, for comparison.
                </p>
              </div>
            </div>
          </section>

          <section className="flex min-h-[520px] flex-1 flex-col px-0 pb-3" aria-label="In the room">
            <h2 className="px-3 pb-2 text-sm font-bold">In the room</h2>
            <LabRoom key={`${current.id}:${current.stage}`} identity={current} />
          </section>
        </div>
      </div>
    </div>
  );
}

function LabRoom({ identity }: { identity: LabIdentity }) {
  const { blobbi, genome, stage } = identity;
  const [roomId, setRoomId] = useState<RoomId>(DEFAULT_ROOM);
  const [render, setRender] = useState<'2d' | '3d'>('2d');
  const [spot, setSpot] = useState(0);
  const nav = useRoomNavigation({ blobbi, editing: false });
  const walkSpeed = useMemo(() => walkSpeedFor(stage, 'v3'), [stage]);
  // The 3D stand-in: the same genome's model, driven by the room at the room's walking tempo
  const actor = useMemo(() => createBlobbiActor(buildBlobbiModel(morphologyOf(genome, stage), genome.seed), { walkCycle: walkCycleSecondsFor('v3'), reducedMotion: prefersReducedMotion }), [genome, stage]);
  useEffect(() => () => actor.dispose(), [actor]);

  return (
    <RoomShell
      roomId={roomId}
      onChangeRoom={setRoomId}
      isSleeping={false}
      blobbiStage={blobbi.stage}
      blobbiWalkSpeed={walkSpeed}
      blobbiVisible
      roomLayout={roomLayoutFor(roomId)}
      furniturePlacements={roomFurnitureFor(roomId)}
      {...nav.shellProps}
      blobbiModel={render === '3d' ? actor : null}
      stage={<RoomBlobbi blobbi={blobbi} facing={nav.facing} motion={nav.motion} />}
    >
      <div className="room-dock-bar" data-testid="lab-room-dock" data-render={render} data-motion={nav.motion} data-facing={nav.facing}>
        <Chip on={render === '2d'} onClick={() => setRender('2d')} testId="lab-render-2d">2D drawing</Chip>
        <Chip on={render === '3d'} onClick={() => setRender('3d')} testId="lab-render-3d">3D model</Chip>
        <button
          type="button"
          className="decor-chip"
          data-testid="lab-walk"
          disabled={!nav.canWalk}
          onClick={() => {
            const next = SPOTS[spot % SPOTS.length];
            setSpot((s) => s + 1);
            void nav.walkTo(next.x, next.z);
          }}
        >
          Walk
        </button>
        <span className="min-w-0 flex-1 truncate text-right text-[11px] text-foreground/70">{nav.motion === 'walking' ? `walking, faces ${nav.facing}` : 'standing'}</span>
      </div>
    </RoomShell>
  );
}
