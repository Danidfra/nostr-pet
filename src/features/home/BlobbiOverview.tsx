import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectedBlobbiState } from '@blobbi-kit/react';
import { getStatStatus, getVisibleStats, type BlobbiCompanion, type BlobbonautProfile } from '@blobbi-kit/core';
import { MapPin } from 'lucide-react';

import { availableCareActions, useCareActions, type CareAction, type CareResult } from '@/features/care';
import type { NostrEvent } from '@blobbi-kit/core';
import { useLifecycle, useLifecycleCeremony, type CeremonyKind } from '@/features/lifecycle';
import { useSound } from '@/features/sound';
import { BLOBBI_ISLAND_URL } from '@/config/ecosystem';
import type { StatItem } from './BlobbiStatusPanel';
import { CareError, CareFeedback } from './CareFeedback';
import { describeMood } from './mood';
import {
  BedArt,
  BlobbiActor,
  DoorArt,
  HomeScene,
  NeedBubbles,
  SceneBackdrop,
  SceneObjectView,
  SpeechBubble,
  sceneObject,
  useBlobbiPresentation,
  useReducedMotion,
  type Speech,
} from './scene';
import { ActionBar, BlobbiSheet, GameShell, HudTop, MenuSheet } from './shell';

interface BlobbiOverviewProps {
  blobbi: BlobbiCompanion;
  companions: readonly BlobbiCompanion[];
  profile: BlobbonautProfile | null | undefined;
  pubkey: string | undefined;
  onSelect: (d: string) => void;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
}

/** Dev-only lifecycle shortcuts: never in a production build, and off unless the flag is set. */
const DEV_LIFECYCLE_TOOLS = import.meta.env.DEV && import.meta.env.VITE_BLOBBI_DEV_TOOLS === 'true';

/** What the Blobbi says when a care action lands. Microcopy only. */
const CARE_LINES: Record<CareAction, string[]> = {
  feed: ['Yum!', 'Nom nom.', 'That hit the spot.'],
  play: ['Whee!', 'Again, again!', 'Best day.'],
  clean: ['So fresh.', 'Squeaky!', 'Bubbles!'],
  rest: ['Zzz…', 'Good night.'],
};
const WAKE_LINES = ['Morning!', 'I dreamt of snacks.', 'Stretch…'];
const REVEAL_LINES: Record<CeremonyKind, string> = { hatch: 'Hello, world!', evolve: 'I feel… bigger.' };

/**
 * The home of one Blobbi. The whole screen is the room; the HUD is two thin
 * strips (the Blobbi's chip and the menu on top, the care dock below) and
 * two sheets. Every value is read from shared parsed state; nothing here
 * computes decay, thresholds, levels or effects. Movement, gaze, facing and
 * reactions are local presentation state and never publish.
 */
export function BlobbiOverview(props: BlobbiOverviewProps) {
  // The scene is per Blobbi: switching Blobbis starts the newcomer at home
  // with no movement, pending walk, gaze, reaction, ceremony or speech left
  // over from the previous one.
  return <BlobbiHome key={props.blobbi.d} {...props} />;
}

function BlobbiHome({ blobbi, companions, profile, pubkey, onSelect, updateCompanionEvent, refresh }: BlobbiOverviewProps) {
  const projected = useProjectedBlobbiState(blobbi);
  const care = useCareActions({ pubkey, updateCompanionEvent, invalidate: refresh });
  const sound = useSound();

  const sceneRef = useRef<HTMLElement>(null);
  const actorRef = useRef<HTMLDivElement>(null);

  // Lifecycle: the kit's missions and transitions, and the ceremony that
  // dresses a transition. The ceremony performs the semantic write at one
  // point and reveals only when it landed.
  const lifecycle = useLifecycle({ blobbi, profile, pubkey, updateCompanionEvent, invalidate: refresh });
  const reducedMotion = useReducedMotion();
  const { hatch, evolve } = lifecycle;
  const performCeremony = useCallback((kind: CeremonyKind) => (kind === 'hatch' ? hatch() : evolve()), [hatch, evolve]);
  const [reveal, setReveal] = useState<{ kind: CeremonyKind; key: number } | null>(null);
  const ceremony = useLifecycleCeremony({
    perform: performCeremony,
    reducedMotion,
    onReveal: (kind) => setReveal((r) => ({ kind, key: (r?.key ?? 0) + 1 })),
  });

  const scene = useBlobbiPresentation({ blobbi, stats: projected?.stats, sceneRef, actorRef, isInCeremony: ceremony.presentation.exclusive });

  const statItems: StatItem[] = projected
    ? getVisibleStats(blobbi.stage).map((stat) => ({
        stat,
        value: projected.stats[stat],
        status: getStatStatus(blobbi.stage, stat, projected.stats[stat]),
      }))
    : [];
  const actions = useMemo(() => availableCareActions(blobbi), [blobbi]);
  const mood = describeMood(blobbi, projected?.stats);

  // Sheets
  const [blobbiSheetOpen, setBlobbiSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Speech: a short line for the moments that deserve one.
  const [speech, setSpeech] = useState<Speech | null>(null);
  const say = useCallback((text: string) => setSpeech((s) => ({ text, key: (s?.key ?? 0) + 1 })), []);

  // A hop, fresh chips, a face and a word each time a care action lands.
  const [resultKey, setResultKey] = useState(0);
  const lastResult = care.lastResult;
  const handledResultRef = useRef<typeof lastResult>(undefined);
  const { reactToCare } = scene;
  const play = sound.play;
  useEffect(() => {
    if (!lastResult || handledResultRef.current === lastResult) return;
    handledResultRef.current = lastResult;
    setResultKey((k) => k + 1);
    reactToCare(lastResult as CareResult);
    const r = lastResult as CareResult;
    if (r.action === 'rest') {
      say(r.nextState === 'sleeping' ? CARE_LINES.rest[0] : WAKE_LINES[r.event.created_at % WAKE_LINES.length]);
      play('rest');
    } else {
      const lines = CARE_LINES[r.action];
      say(lines[r.event.created_at % lines.length]);
      play(r.action === 'feed' ? 'eat' : 'clean');
    }
  }, [lastResult, reactToCare, say, play]);

  // The reveal of a lifecycle moment: a bigger face, a hop, a word, a sound.
  const { celebrate } = scene;
  const handledRevealRef = useRef(0);
  useEffect(() => {
    if (!reveal || handledRevealRef.current === reveal.key) return;
    handledRevealRef.current = reveal.key;
    celebrate();
    setResultKey((k) => k + 1);
    say(REVEAL_LINES[reveal.kind]);
    play('celebrate');
  }, [reveal, celebrate, say, play]);

  const startCeremony = useCallback(
    (kind: CeremonyKind) => {
      if (blobbi.state !== 'active') return;
      if (kind === 'hatch' && lifecycle.view.next !== 'hatch') return;
      if (kind === 'evolve' && lifecycle.view.next !== 'evolve') return;
      setBlobbiSheetOpen(false);
      ceremony.start(kind);
    },
    [blobbi.state, lifecycle.view.next, ceremony],
  );
  const devForce = DEV_LIFECYCLE_TOOLS
    ? (kind: CeremonyKind) => {
        setBlobbiSheetOpen(false);
        ceremony.start(kind);
      }
    : undefined;

  // The door: walk there, then the way out is offered at the door (a real
  // link, so the new tab opens from the player's own tap).
  const [doorPrompt, setDoorPrompt] = useState(false);

  // Rest is walk-then-sleep (see M1.1): only an arrived walk, only if still
  // awake by then, through a perform that checks a live in-flight flag.
  const [walkingToBed, setWalkingToBed] = useState(false);
  const liveBlobbi = useRef(blobbi);
  useEffect(() => {
    liveBlobbi.current = blobbi;
  }, [blobbi]);
  const perform = care.perform;
  const walkTo = scene.walkTo;
  const canWalk = scene.canWalk;
  const bed = sceneObject('bed');
  const door = sceneObject('door');
  const onAction = useCallback(
    (action: CareAction) => {
      if (action === 'rest' && blobbi.state === 'active' && canWalk) {
        setWalkingToBed(true);
        setDoorPrompt(false);
        void walkTo(bed.approach ?? bed.position).then((outcome) => {
          setWalkingToBed(false);
          if (outcome !== 'arrived') return;
          if (liveBlobbi.current.state !== 'active') return;
          perform(liveBlobbi.current.d, 'rest');
        });
        return;
      }
      perform(blobbi.d, action);
    },
    [blobbi.d, blobbi.state, perform, walkTo, canWalk, bed],
  );

  const goToDoor = useCallback(() => {
    setDoorPrompt(false);
    void walkTo(door.approach ?? door.position).then((outcome) => {
      if (outcome === 'arrived') setDoorPrompt(true);
    });
  }, [walkTo, door]);
  const onFloorTap = useCallback(
    (fraction: { x: number; y: number }) => {
      setDoorPrompt(false);
      scene.onFloorTap(fraction);
    },
    [scene],
  );

  const pendingAction: CareAction | null = care.pendingAction ?? (walkingToBed ? 'rest' : null);
  const sleeping = blobbi.state === 'sleeping';
  const inCeremony = ceremony.presentation.exclusive;
  const eggCrack = ceremony.presentation.eggCrack ?? lifecycle.view.eggCrack;
  const interactive = !sleeping && canWalk && !inCeremony;

  const lifecycleReady =
    lifecycle.view.next === 'hatch' ? { kind: 'hatch' as const, label: 'Hatch!' } : lifecycle.view.next === 'evolve' ? { kind: 'evolve' as const, label: 'Evolve!' } : null;

  const ceremonyView = { phase: ceremony.phase, kind: ceremony.kind, error: ceremony.error, dismiss: ceremony.dismiss };

  return (
    <GameShell
      top={<HudTop blobbi={blobbi} mood={mood} onOpenBlobbi={() => setBlobbiSheetOpen(true)} onOpenMenu={() => setMenuOpen(true)} />}
      scene={
        <HomeScene
          ref={sceneRef}
          label={`${blobbi.name}'s home`}
          floorLabel={sleeping ? `${blobbi.name} is asleep` : canWalk ? `Call ${blobbi.name} here` : `${blobbi.name} stays put`}
          onFloorTap={interactive ? onFloorTap : undefined}
          pointerHandlers={scene.scenePointerHandlers}
          objects={
            <>
              <SceneObjectView
                def={door}
                state={doorPrompt ? 'open' : 'closed'}
                onTap={interactive ? goToDoor : undefined}
                aside={
                  doorPrompt && (
                    <a href={BLOBBI_ISLAND_URL} target="_blank" rel="noopener noreferrer" className="door-prompt lifecycle-pill !animate-none" data-testid="door-prompt" onClick={() => setDoorPrompt(false)}>
                      <MapPin className="h-4 w-4" aria-hidden />
                      Go to the Island
                    </a>
                  )
                }
              >
                <DoorArt open={doorPrompt} />
              </SceneObjectView>
              <SceneObjectView def={bed} state={sleeping ? 'occupied' : 'free'} onTap={interactive ? () => void walkTo(bed.position) : undefined}>
                <BedArt />
              </SceneObjectView>
            </>
          }
          actor={
            <BlobbiActor
              ref={actorRef}
              blobbi={blobbi}
              presentation={scene.presentation}
              happyKey={resultKey}
              onPoke={inCeremony ? undefined : scene.poke}
              eggCrack={blobbi.stage === 'egg' ? eggCrack : undefined}
              effects={ceremony.presentation.effects}
            >
              <NeedBubbles items={sleeping || inCeremony ? [] : statItems} />
              <SpeechBubble speech={speech} />
              <CareFeedback result={care.lastResult} resultKey={resultKey} />
            </BlobbiActor>
          }
          foreground={
            <div className="absolute inset-x-4 top-16 flex flex-col items-center gap-2">
              <CareError error={care.error} />
              {ceremony.phase === 'failed' && (
                <p role="alert" className="home-glass rounded-xl px-3 py-2 text-center text-sm text-destructive" data-testid="ceremony-error">
                  {(lifecycle.error ?? ceremony.error)?.message}{' '}
                  <button
                    type="button"
                    className="ml-1 text-xs font-semibold underline"
                    onClick={() => {
                      lifecycle.clearError();
                      ceremony.dismiss();
                    }}
                  >
                    Dismiss
                  </button>
                </p>
              )}
            </div>
          }
        >
          <SceneBackdrop />
        </HomeScene>
      }
      bottom={<ActionBar actions={actions} pendingAction={pendingAction} onAction={onAction} lifecycleReady={lifecycleReady} onLifecycle={startCeremony} disabled={inCeremony} />}
      overlays={
        <>
          <BlobbiSheet
            open={blobbiSheetOpen}
            onClose={() => setBlobbiSheetOpen(false)}
            blobbi={blobbi}
            mood={mood}
            statItems={statItems}
            profile={profile}
            companions={companions}
            onSelect={(d) => {
              setBlobbiSheetOpen(false);
              onSelect(d);
            }}
            lifecycle={lifecycle}
            ceremony={ceremonyView}
            onCeremony={startCeremony}
            devForce={devForce}
          />
          <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
        </>
      }
    />
  );
}
