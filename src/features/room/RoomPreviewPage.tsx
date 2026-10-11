/**
 * `/room` — the 3D room, as a preview beside the home (dev builds only; see
 * `AppRouter`). Milestones 1 and 2 of bringing Ditto's room to this app: the
 * diorama, its camera and lighting, the registry's rooms painted as paper,
 * Ditto's default furniture, the room switcher, and the player's own Blobbi
 * drawn by the canonical renderer, walking the room at its own gait's pace,
 * facing the way it goes, looking at the pointer when its face is visible.
 * Decorating (milestone 3) is Ditto's: the decorate button, the editing
 * camera, drag and drop on the grid, the catalog tray, wallpaper and
 * flooring, save and cancel. What is saved is kept on this device, per
 * player, Blobbi and room (milestone 5, `room-store.ts`): never published.
 *
 * Care (milestone 4): each room's items in a strip along the dock (the
 * registry's activities: food and drink in the kitchen, soap and medicine in
 * the care room, toys in the living room), starters and owned items with
 * their counts; selected, then used with the Use button or dragged onto the
 * Blobbi or the floor; the bed, the fridge, the tub and the toy box answer a
 * tap. Every use goes through the home's own write paths (`useRoomCare`);
 * choosing, dragging, walking and the room itself publish nothing.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useProjectedBlobbiState } from '@blobbi-kit/react';
import type { BlobbiCompanion, NostrEvent } from '@blobbi-kit/core';

import { useHomeBlobbi } from '@/hooks/useHomeBlobbi';
import { toBlobbiVisual } from '@/lib/blobbi-visual';
import { baselineExpression } from '@/features/home/scene/reactions';
import { useGazePolicy } from '@/features/home/scene/useGazePolicy';
import { useHoverCapable } from '@/features/home/scene/SceneSettings';
import { DEFAULT_ROOM, resolveRoom, type RoomId } from '@/features/home/rooms/rooms';
import { RoomShell, type RoomEditorBinding } from './components/RoomShell';
import { RoomBlobbi } from './components/RoomBlobbi';
import { RoomDecoratorOverlay, RoomDecoratorToolbar } from './components/RoomDecorator';
import { useRoomNavigation } from './hooks/useRoomNavigation';
import { useRoomDecorator } from './hooks/useRoomDecorator';
import { useRoomActorModel } from './hooks/useRoomActorModel';
import { useRoomCare } from './hooks/useRoomCare';
import { useRoomLife } from './hooks/useRoomLife';
import { useSound, soundForPoke } from '@/features/sound';
import { useReducedMotion } from '@/features/home/scene/SceneSettings';
import { POKE_PATIENCE, pokeReaction, type PokeGesture } from '@/features/home/personality';
import type { EyeOffset } from '@/features/home/scene/gaze';
import type { BlobbiExpression } from '@blobbi-kit/renderer';
import { usePresence } from '@/features/teleport/react/usePresence';
import { journeyFrame } from '@/features/teleport/timeline';
import { TeleportDevPanel } from './components/TeleportDevPanel';
import { useRoomItemDrag } from './hooks/useRoomItemDrag';
import { RoomBottomBar, RoomCareCards } from './components/RoomCarePanel';
import { RoomHeader } from './components/RoomHeader';
import { RoomStatusHud } from './components/RoomStatusHud';
import { RoomBlobbiOverlay, RoomDragGhost, RoomFloorItem } from './components/RoomCareParts';
import { useReactionPolicy } from '@/features/home/scene/useReactionPolicy';
import { roomById, type RoomActivity } from '@/features/home/rooms/rooms';
import { resolveFurniture, type FurnitureInteraction } from './lib/furniture-3d';
import { MAIN_BLOBBI } from './lib/room-geometry';
import type { FurniturePlacement } from './lib/room-furniture';
import { planDrop, planUse, shelfEntries, shelfKey, type CareShelf, type DropPlace, type RoomCareEntry } from './lib/room-care';
import { RoomAppearanceControl } from './components/RoomAppearanceControl';
import { useBlobbiAppearance } from './lib/blobbi-appearance';
import { useRoomSession } from './lib/room-session';
import { roomStoreKey, type LoadStatus, type SaveStatus } from './lib/room-store';
import { walkSpeedFor } from './lib/room-pace';
import { travelGaze } from './lib/room-gaze';

/** The journey preview's controls: a development build with the dev tools only, never production. */
const DEV_TELEPORT = import.meta.env.DEV && import.meta.env.VITE_BLOBBI_DEV_TOOLS === 'true';
/** Concentrating on a journey: eyes shut tight, brows down, mouth set, cheeks flushed with the effort (the renderer's own parts). */
const CONCENTRATE: BlobbiExpression = { eyes: 'closed', mouth: 'flat', brows: 'lowered', blush: 'strong' };
/** How long the relieved, happy face lasts after an arrival. */
const RELIEF_MS = 1_800;
/** How long its eyes stay on something the player touched. */
const ATTENTION_MS = 1_600;
/** When a 3D Blobbi's landing hop comes after a room change: as the room finishes folding in. */
const ROOM_LANDING_MS = 700;
/** How long the carousel pulses when a piece of furniture points at it (one turn of Ditto's guide pulse). */
const PULSE_MS = 2_600;

export default function RoomPreviewPage() {
  const home = useHomeBlobbi();
  return (
    <div className="game-shell" data-testid="room-preview">
      <div className="game-frame">
        <div className="game-column">
          {home.status === 'ready' && home.current ? (
            <BlobbiRoom key={`${home.pubkey ?? 'anon'}:${home.current.d}`} blobbi={home.current} pubkey={home.pubkey} updateCompanionEvent={home.updateCompanionEvent} refresh={home.refresh} />
          ) : (
            <RoomMessage status={home.status} />
          )}
        </div>
      </div>
    </div>
  );
}

function RoomMessage({ status }: { status: ReturnType<typeof useHomeBlobbi>['status'] }) {
  const text =
    status === 'signed-out' ? 'Sign in on the home screen to see your Blobbi in its room.'
    : status === 'empty' ? 'Adopt a Blobbi on the home screen first.'
    : status === 'error' ? 'The relays did not answer.'
    : 'Looking for your Blobbi…';
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center" role="status">
      <p className="scene-text text-sm text-foreground/80">{text}</p>
      <Link to="/" className="onboard-btn onboard-btn--secondary !w-auto !px-4 !py-2 text-sm">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Home
      </Link>
    </div>
  );
}

/** What a piece of furniture opens when tapped: the items of its activities (the bed is rest, handled on its own). */
const FURNITURE_SHELVES: Record<Exclude<FurnitureInteraction, 'bed'>, { label: string; activities: readonly RoomActivity[] }> = {
  fridge: { label: 'From the fridge', activities: ['feed', 'boost'] },
  bath: { label: 'At the tub', activities: ['clean', 'medicine'] },
  toys: { label: 'From the toy box', activities: ['play'] },
};

interface BlobbiRoomProps {
  blobbi: BlobbiCompanion;
  pubkey: string | undefined;
  updateCompanionEvent: (event: NostrEvent) => void;
  refresh: () => void;
}

function BlobbiRoom({ blobbi, pubkey, updateCompanionEvent, refresh }: BlobbiRoomProps) {
  const projected = useProjectedBlobbiState(blobbi);
  const isSleeping = blobbi.state === 'sleeping';
  const isEgg = blobbi.stage === 'egg';
  // The room the player chose; a sleeper is in the bedroom whatever was chosen.
  const [chosenRoom, setChosenRoom] = useState<RoomId>(DEFAULT_ROOM);
  const resolvedRoom = resolveRoom(chosenRoom, isSleeping);
  // What each room shows this session: saved decorations, else the defaults.
  // Kept on this device for this player and this Blobbi; written on Save only
  const rooms = useRoomSession({ storageKey: roomStoreKey(pubkey, blobbi.d) });
  const storeNotice = useStoreNotice(rooms.persistence);
  const decorator = useRoomDecorator({ roomId: resolvedRoom, furniture: rooms.furnitureFor(resolvedRoom), layout: rooms.layoutFor(resolvedRoom), onSave: rooms.saveRoom });
  // The room being decorated is pinned, so falling asleep meanwhile doesn't move the view out from under the draft.
  const roomId = decorator.room ?? resolvedRoom;
  const nav = useRoomNavigation({ blobbi, editing: decorator.editing });
  const { facing, motion } = nav;
  const baseline = useMemo(() => baselineExpression(blobbi, projected?.stats), [blobbi, projected?.stats]);
  // A care result's face for a moment (the 2D drawing's; the 3D model hops), then the baseline again
  const reactions = useReactionPolicy();
  const faceNow: BlobbiExpression = reactions.reaction ?? baseline;
  const layout = decorator.layoutDraft ?? rooms.layoutFor(roomId);
  const placements = decorator.draft ?? rooms.furnitureFor(roomId);
  const walkSpeed = useMemo(() => walkSpeedFor(blobbi.stage, blobbi.visualGeneration), [blobbi.stage, blobbi.visualGeneration]);
  // How it is drawn: the kit's 2D (default) or the 3D model, this device's choice; one Blobbi, one walk, either way
  const [appearance, setAppearance] = useBlobbiAppearance();
  const actor3d = useRoomActorModel(blobbi, appearance);

  // The eyes: on the pointer while standing with a face in view (the home's
  // gaze policy over the room's own element), a glance the way it goes while walking.
  const shellRef = useRef<HTMLDivElement | null>(null);
  const actorRef = useRef<HTMLDivElement | null>(null);
  const hoverCapable = useHoverCapable();
  const gaze = useGazePolicy({ actorRef, sceneRef: shellRef, hoverCapable, actorKey: `${facing}:${motion}`, enabled: !isEgg && !isSleeping && facing !== 'back' && !decorator.editing });
  const pointerHandlers = useMemo(() => ({ onPointerMove: gaze.onPointerMove, onPointerLeave: gaze.onPointerLeave, onPointerDown: gaze.onPointerDown }), [gaze.onPointerMove, gaze.onPointerLeave, gaze.onPointerDown]);

  const { draft, layoutDraft, selectedIndex, select, setDraft, setLayoutDraft, move, setInvalid, invalid, save, cancel } = decorator;
  const controlRef = nav.shellProps.controlRef;

  // ─── Its body: one gesture vocabulary (the home's), played by whichever drawing stands in the room ───
  const { play } = useSound();
  const reducedMotion = useReducedMotion();
  const [gestureNow, setGestureNow] = useState<{ kind: PokeGesture; key: number } | null>(null);
  const gestureKey = useRef(0);
  const gesture = useCallback((kind: PokeGesture) => {
    gestureKey.current += 1;
    setGestureNow({ kind, key: gestureKey.current });
    controlRef.current?.gesture(kind);
  }, [controlRef]);
  // A moment's attention: its eyes on something the player just touched
  const [attention, setAttention] = useState<EyeOffset | null>(null);
  useEffect(() => {
    if (!attention) return;
    const timer = setTimeout(() => setAttention(null), ATTENTION_MS);
    return () => clearTimeout(timer);
  }, [attention]);

  // ─── Where it is: here, leaving, away, arriving (a journey is presentation only; nothing is written) ───
  const reduceMotionRef = useRef(reducedMotion);
  reduceMotionRef.current = reducedMotion;
  const [relievedFor, setRelievedFor] = useState<number | null>(null);
  const presence = usePresence({
    reducedMotion: () => reduceMotionRef.current,
    onCue: (cue) => {
      play(cue);
      if (cue === 'tada') {
        // "It worked!": eyes open, a relieved smile, a little hop
        setRelievedFor(presence.controller.snapshot().journey?.startedAt ?? null);
        reactions.react('happy', RELIEF_MS);
        gesture('bounce');
      }
    },
  });
  const journey = presence.journey;
  const present = presence.state === 'present';
  const absent = presence.state === 'absent';
  // Concentrating, eyes shut tight, the whole journey, until an arrival's "ta-da"
  const concentrating = journey !== null && !(journey.kind === 'arrive' && relievedFor === journey.startedAt);
  useEffect(() => {
    controlRef.current?.journey(journey ? { kind: journey.kind, startedAt: journey.startedAt, reduced: journey.reduced } : null);
  }, [controlRef, journey]);
  // The development scrubber's moment, on both drawings at once
  const [journeyPreview, setJourneyPreview] = useState<{ kind: 'depart' | 'arrive'; t: number; reduced: boolean } | null>(null);
  useEffect(() => {
    controlRef.current?.journeyPreview(journeyPreview);
  }, [controlRef, journeyPreview]);
  // A scrubbed moment shows the face that moment asks for
  const previewFace = journeyPreview ? journeyFrame(journeyPreview.kind, journeyPreview.t, journeyPreview.reduced).face : null;

  // ─── Care: one adapter over the home's write paths ───
  const hop = useCallback(() => gesture('bounce'), [gesture]);
  const care = useRoomCare({ blobbi, pubkey, updateCompanionEvent, refresh, nav, react: reactions.react, hop });

  // What the strip shows: the room's own shelf, or what a piece of furniture opened (until the room changes)
  const [furnitureShelf, setFurnitureShelf] = useState<CareShelf | null>(null);
  // A piece of furniture pointed at the carousel: its middle card pulses for a moment (Ditto's guide ring)
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!pulse) return;
    const timer = setTimeout(() => setPulse(false), PULSE_MS);
    return () => clearTimeout(timer);
  }, [pulse]);
  useEffect(() => setFurnitureShelf(null), [roomId]);
  const shelf = useMemo<CareShelf>(() => furnitureShelf ?? { kind: 'room', roomId }, [furnitureShelf, roomId]);
  const hasStrip = furnitureShelf !== null || (roomId !== 'rest' && roomId !== 'closet');
  const entries = useMemo(() => (hasStrip ? shelfEntries(shelf, care.inventory) : []), [hasStrip, shelf, care.inventory]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  // The selection, per shelf, for this visit (React state only; selecting never uses anything)
  const [selections, setSelections] = useState<Record<string, string>>({});
  const currentShelfKey = shelfKey(shelf);
  const chosen = selections[currentShelfKey];
  const selectedKey = chosen && entries.some((e) => e.key === chosen) ? chosen : null;
  const selectItem = useCallback((key: string) => setSelections((s) => (s[currentShelfKey] === key ? s : { ...s, [currentShelfKey]: key })), [currentShelfKey]);

  // Where a point in the room lands: on the Blobbi (as a tap would find it, 2D or 3D alike), the floor, or nowhere
  const placeAt = useCallback((clientX: number, clientY: number): DropPlace => {
    const control = controlRef.current;
    const hit = control?.pickAt(clientX, clientY);
    if (!control || !hit) return { kind: 'nowhere' };
    if (hit.kind === 'actor') return hit.id === MAIN_BLOBBI ? { kind: 'blobbi' } : { kind: 'nowhere' };
    if (hit.kind === 'floor') return { kind: 'floor', x: hit.x, z: hit.z };
    const floor = control.floorAt(clientX, clientY);
    return floor ? { kind: 'floor', ...floor } : { kind: 'nowhere' };
  }, [controlRef]);
  const applyEntry = care.use;
  const drag = useRoomItemDrag({
    onTap: selectItem,
    // Lights the drop ring or the floor under the item, with no render (the shell's data attribute)
    onHover: (_key, point) => {
      const shell = shellRef.current?.querySelector<HTMLElement>('[data-testid="room-shell"]');
      if (!shell) return;
      if (point) shell.dataset.drop = placeAt(point.x, point.y).kind;
      else delete shell.dataset.drop;
    },
    onDrop: (key, clientX, clientY) => {
      const entry = entriesRef.current.find((e) => e.key === key);
      if (!entry) return;
      selectItem(key);
      const plan = planDrop(entry.action, placeAt(clientX, clientY), controlRef.current?.blobbiPosition() ?? null);
      if (plan.kind === 'cancel') return;
      // Set down on the floor: a soft thud (handed over, the eating says it)
      if (plan.kind === 'set-down') play('drop');
      applyEntry(entry, plan, roomId);
    },
  });
  const startDrag = drag.start;
  const onDragStart = useCallback((e: ReactPointerEvent, entry: RoomCareEntry) => {
    // Only into a 3D room, which can tell the Blobbi from the floor; without it, Use is the way
    if (controlRef.current && present) startDrag(e, entry.key);
  }, [controlRef, startDrag, present]);
  const onUse = useCallback((entry: RoomCareEntry) => {
    selectItem(entry.key);
    applyEntry(entry, planUse(entry.action, controlRef.current?.blobbiPosition() ?? null), roomId);
  }, [selectItem, applyEntry, controlRef, roomId]);

  // A drag ends without a drop when the room changes, decorating begins, or the item is gone or no longer usable
  const cancelDrag = drag.cancel;
  useEffect(() => cancelDrag(), [roomId, decorator.editing, cancelDrag]);
  const dragged = drag.session ? entries.find((e) => e.key === drag.session!.key) ?? null : null;
  const draggedGone = drag.session !== null && (!dragged || !dragged.usable || care.busy || (dragged.choice.source === 'owned' && care.inventory.status !== 'ready'));
  useEffect(() => {
    if (draggedGone) cancelDrag();
  }, [draggedGone, cancelDrag]);
  // Picked up: "hup"
  const lifted = drag.session?.lifted ?? false;
  useEffect(() => {
    if (lifted) play('pickup');
  }, [lifted, play]);

  // ─── Its own life, when nothing else is going on (useRoomLife) ───
  const lifeEnabled = !isEgg && !isSleeping && !decorator.editing && !care.busy && drag.session === null && present && journeyPreview === null;
  const life = useRoomLife({
    enabled: lifeEnabled,
    canWalk: nav.canWalk && !reducedMotion,
    position: () => controlRef.current?.blobbiPosition() ?? null,
    walkTo: nav.walkTo,
    gesture,
  });
  const markActivity = life.markActivity;
  // Its eyes: the pointer's when it has one, else what it is attending to, else where its own thoughts wander;
  // a glance the way it goes while walking (the 2D drawing; the 3D model turns its whole body)
  const restingGaze = gaze.eyeOffset ?? attention ?? life.glance ?? undefined;
  const eyeOffset = motion === 'walking' ? travelGaze(facing) : restingGaze;
  const gaze3d = isEgg || isSleeping || motion === 'walking' ? null : restingGaze ?? null;
  useEffect(() => {
    controlRef.current?.gaze(gaze3d);
    // The offset's numbers are what matter, not its identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlRef, gaze3d?.x, gaze3d?.y, actor3d.model]);

  // A tap on the Blobbi: the home's poke personality (glad, then grumpy if overdone; sleepy when tired)
  const pokes = useRef<number[]>([]);
  const stats = projected?.stats;
  const react = reactions.react;
  const onBlobbiTap = useCallback((id: string) => {
    if (id !== MAIN_BLOBBI || !present) return;
    markActivity();
    const now = Date.now();
    pokes.current = [...pokes.current.filter((t) => now - t < POKE_PATIENCE.windowMs), now];
    const reaction = pokeReaction({ stage: blobbi.stage, state: blobbi.state, stats, recentPokes: pokes.current.length });
    if (reaction.mood === 'annoyed') pokes.current = [];
    if (reaction.expression) react(reaction.expression, reaction.durationMs);
    gesture(reaction.gesture);
    const sound = soundForPoke(reaction.mood);
    if (sound) play(sound);
  }, [markActivity, blobbi.stage, blobbi.state, stats, react, gesture, play, present]);

  // Going to another room: a soft swish; the 3D Blobbi gives a little hop as it lands (the drawing hops in by itself)
  const firstRoom = useRef(true);
  const has3d = actor3d.model !== null;
  useEffect(() => {
    if (firstRoom.current) {
      firstRoom.current = false;
      return;
    }
    play('room');
    if (!has3d) return;
    const timer = setTimeout(() => gesture('bounce'), ROOM_LANDING_MS);
    return () => clearTimeout(timer);
    // Only a change of room
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Furniture: the bed rests or wakes; the fridge, the tub and the toy box open their items
  const bed = useMemo(() => {
    const p = placements.find((f) => f.at === 'floor' && resolveFurniture(f.id)?.interaction === 'bed');
    return p ? { x: p.x, z: p.y } : null;
  }, [placements]);
  const rest = care.rest;
  // Any piece tapped: a wooden knock, and the Blobbi looks over at it
  const onPieceTap = useCallback((index: number, lamp: boolean) => {
    markActivity();
    play(lamp ? 'select' : 'knock');
    const p = placements[index];
    const at = controlRef.current?.blobbiPosition();
    if (p && at && p.at === 'floor') {
      // Across the screen is x - z from the camera's corner; nearer the camera is lower
      const across = (p.x - p.y) - (at.x - at.z);
      setAttention({ x: Math.max(-0.8, Math.min(0.8, across * 0.25)), y: p.x + p.y > at.x + at.z ? 0.4 : -0.1 });
    }
  }, [markActivity, play, placements, controlRef]);
  const onInteract = useCallback((interaction: FurnitureInteraction, index: number) => {
    if (interaction === 'bed') {
      const p = placements[index];
      rest(p ? { x: p.x, z: p.y } : null);
      return;
    }
    const opened = FURNITURE_SHELVES[interaction];
    const own = roomById(roomId).activities;
    const same = opened.activities.length === own.length && opened.activities.every((a) => own.includes(a));
    setFurnitureShelf(same ? null : { kind: 'furniture', label: opened.label, activities: opened.activities });
    setPulse(true);
  }, [placements, rest, roomId]);

  const offer = care.offer;
  const offerGlyph = offer?.choice.entry.item.glyph ?? null;
  const floorThings = useMemo(
    () => (offer && offer.place.kind === 'floor' && offer.place.roomId === roomId && offerGlyph
      ? [{ key: `offer-${offer.key}`, x: offer.place.x, z: offer.place.z, node: <RoomFloorItem offer={offer} glyph={offerGlyph} onPutAway={care.putAway} /> }]
      : []),
    [offer, offerGlyph, roomId, care.putAway],
  );
  // Its name, shown over its head on demand (hover, tap, keyboard focus), in 2D and 3D alike
  const nameTag = useMemo(() => ({ text: blobbi.name, color: toBlobbiVisual(blobbi).baseColor }), [blobbi]);
  const handed = offer && offer.place.kind === 'hand' && offer.phase !== 'failed' && offerGlyph ? { glyph: offerGlyph, phase: offer.phase } : null;
  // The carousel's focus moving: the smallest tick
  const focusItem = useCallback((key: string) => {
    selectItem(key);
    play('select');
  }, [selectItem, play]);
  // A use that failed: a short "nuh" as the reason appears
  const failed = offer?.phase === 'failed';
  useEffect(() => {
    if (failed) play('invalid');
  }, [failed, play]);
  // Decorating: a piece set down pops, a new piece too, and Save chimes
  const placeMove = useCallback((index: number, placement: FurniturePlacement) => {
    play('place');
    move(index, placement);
  }, [move, play]);
  const draftCount = draft?.length ?? null;
  const lastDraftCount = useRef(draftCount);
  useEffect(() => {
    if (draftCount !== null && lastDraftCount.current !== null && draftCount > lastDraftCount.current) play('place');
    lastDraftCount.current = draftCount;
  }, [draftCount, play]);
  const saveWithChime = useCallback(() => {
    play('save');
    save();
  }, [save, play]);
  const editor = useMemo((): RoomEditorBinding | undefined => {
    if (!decorator.editing || !draft || !layoutDraft) return undefined;
    return {
      selectedIndex,
      onSelect: select,
      onMove: placeMove,
      onInvalidChange: setInvalid,
      toolbar: selectedIndex !== null ? <RoomDecoratorToolbar draft={draft} onDraftChange={setDraft} selectedIndex={selectedIndex} onSelect={select} /> : undefined,
      overlay: (
        <RoomDecoratorOverlay
          roomId={roomId}
          draft={draft}
          onDraftChange={setDraft}
          layout={layoutDraft}
          onLayoutChange={setLayoutDraft}
          selectedIndex={selectedIndex}
          onSelect={select}
          invalid={invalid}
          controlRef={controlRef}
          onSave={saveWithChime}
          onCancel={cancel}
        />
      ),
    };
  }, [decorator.editing, draft, layoutDraft, selectedIndex, select, placeMove, setInvalid, setDraft, setLayoutDraft, invalid, controlRef, saveWithChime, cancel, roomId]);

  return (
    // Any touch of the player's holds the Blobbi's own life off for a while
    <div ref={shellRef} className="flex flex-1 min-h-0 flex-col" onPointerDownCapture={markActivity} onKeyDownCapture={markActivity}>
      <RoomShell
        roomId={roomId}
        onChangeRoom={setChosenRoom}
        isSleeping={isSleeping}
        blobbiStage={blobbi.stage}
        blobbiWalkSpeed={walkSpeed}
        // Away somewhere else: not in the room at all (no drawing, no shadow, nothing to tap)
        blobbiVisible={!absent}
        roomLayout={layout}
        furniturePlacements={placements}
        pointerHandlers={pointerHandlers}
        {...nav.shellProps}
        onDecorate={decorator.open}
        decorateDisabled={care.busy || !present}
        // Its life is the app's (useRoomLife): it ambles only when nothing else is going on
        blobbiWanders={false}
        onInteract={onInteract}
        onPieceTap={onPieceTap}
        onBlobbiTap={onBlobbiTap}
        floorThings={floorThings}
        blobbiOverlay={<RoomBlobbiOverlay feedback={care.feedback} handed={handed} />}
        blobbiName={nameTag}
        header={<RoomHeader name={blobbi.name} stage={blobbi.stage} />}
        statusHud={!isEgg && <RoomStatusHud stage={blobbi.stage} stats={projected?.stats} onGuide={isSleeping ? undefined : setChosenRoom} />}
        middleSlot={<RoomCareCards offer={offer} onRetry={care.retry} onPutAway={care.putAway} error={care.error} notice={care.notice ?? storeNotice} />}
        blobbiModel={actor3d.model}
        hudEnd={<RoomAppearanceControl appearance={appearance} onChange={setAppearance} unavailable3d={actor3d.unavailable3d} />}
        editor={editor}
        stage={
          <RoomBlobbi
            ref={actorRef}
            blobbi={blobbi}
            facing={facing}
            motion={motion}
            eyeOffset={concentrating ? undefined : eyeOffset}
            expression={previewFace === 'concentrate' || (!journeyPreview && concentrating) ? CONCENTRATE : previewFace === 'relieved' ? 'happy' : faceNow}
            gesture={gestureNow}
            journey={journey}
            absent={absent}
            journeyPreview={journeyPreview}
          />
        }
      >
        <RoomBottomBar
          blobbi={blobbi}
          roomId={roomId}
          carousel={hasStrip ? {
            entries,
            focusedKey: selectedKey,
            onFocus: focusItem,
            onUse,
            onBlocked: (entry) => {
              play('invalid');
              care.notify(entry.reason ?? 'Not right now.');
            },
            onDragStart,
            onClose: furnitureShelf ? () => setFurnitureShelf(null) : undefined,
            highlight: pulse,
          } : null}
          offer={offer}
          busy={care.busy || !present}
          onRest={() => rest(bed)}
          restPending={care.restPending}
        />
      </RoomShell>
      <RoomDragGhost ref={drag.ghostRef} glyph={drag.session?.lifted && dragged ? dragged.glyph : null} />
      {DEV_TELEPORT && <TeleportDevPanel presence={presence} preview={journeyPreview} onPreview={setJourneyPreview} />}
    </div>
  );
}

/** How long a word about the stored rooms stays. */
const STORE_NOTICE_MS = 6_000;

/** One honest line when the stored rooms could not be read whole, or a save could not be kept. */
function useStoreNotice(persistence: { load: LoadStatus | null; save: SaveStatus | null }): string | null {
  const [notice, setNotice] = useState<string | null>(() => loadNotice(persistence.load));
  const save = persistence.save;
  useEffect(() => {
    if (save === 'full') setNotice('This browser is out of room, so your decorating is kept for this visit only.');
    else if (save === 'unavailable') setNotice('This browser would not keep your decorating, so it lasts for this visit only.');
    else if (save === 'newer') setNotice('A newer version of Blobbi saved these rooms here; they were left as they are.');
    else if (save === 'saved') setNotice(null);
  }, [save]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), STORE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);
  return notice;
}

function loadNotice(load: LoadStatus | null): string | null {
  if (load === 'repaired') return 'Some saved furniture is no longer available and was left out.';
  if (load === 'corrupt') return 'Your saved rooms could not be read, so they show their defaults.';
  if (load === 'newer') return 'These rooms were saved by a newer version of Blobbi, so they show their defaults here.';
  return null;
}
