import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProjectedBlobbiState } from '@blobbi-kit/react';
import { getStatStatus, getVisibleStats, type BlobbiCompanion, type BlobbonautProfile } from '@blobbi-kit/core';
import { MapPin, Paintbrush } from 'lucide-react';

import { availableCareActions, useCareActions, type CareAction, type CareResult } from '@/features/care';
import type { NostrEvent } from '@blobbi-kit/core';
import { useLifecycle, useLifecycleCeremony, type CeremonyKind } from '@/features/lifecycle';
import { InventorySheet, ItemGlyph, useHomeInventory, useUseItem, useWornEquipment, type HomeInventoryItem, type ItemAction, type ItemUseResult } from '@/features/inventory';
import { useSound, type SoundId } from '@/features/sound';
import { BLOBBI_ISLAND_URL } from '@/config/ecosystem';
import type { StatItem } from './BlobbiStatusPanel';
import { CareError, CareFeedback } from './CareFeedback';
import type { FeedbackResult } from './care-feedback-text';
import { describeMood } from './mood';
import {
  BlobbiActor,
  DoorArt,
  HomeScene,
  NeedBubbles,
  SceneObjectView,
  SpeechBubble,
  offeredItemObject,
  sceneObject,
  useBlobbiPresentation,
  useReducedMotion,
  isAtPoint,
  itemObjectAt,
  floorPointFromScene,
  MIN_USE_MS,
  type FloorPoint,
  type Speech,
} from './scene';
import { ANNOYED_LINES, glanceToward, roomGreeting } from './personality';
import { ActionBar, BlobbiSheet, GameShell, HomeRail, HudTop, MenuSheet, hotbarKey, useWideScreen } from './shell';
import { FurnitureCatalogSheet, FurnitureLayer, RoomArrows, RoomBackdrop, RoomEditorBar, RoomIndicator, toyApproach, useFurnitureDrag, usePlacedToys, useRoomEditor, type ToyInRoom, approachSpot, entrySpot, localLayoutStore, readRoomPlacements, roomById, roomShowsItem, sleepSpotFor, surfaceBackground, useRoom, useRoomLayout, furnitureById, type FurnitureDefinition, type Placement, type RoomId } from './rooms';

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
/** What the Blobbi says after using an item. */
const ITEM_LINES: Record<ItemAction, string[]> = {
  feed: ['Yum!', 'Nom nom.', 'Delicious!'],
  play: ['Whee!', 'Again, again!', 'Best toy.'],
  clean: ['So fresh.', 'Squeaky!', 'Bubbles!'],
  medicine: ['All better.', 'Feeling good.'],
  boost: ['Zoom!', 'So much energy!'],
};

/** The sound for a care or item action; the same table for the dock and the room. */
function soundFor(action: CareAction | ItemAction): SoundId {
  switch (action) {
    case 'feed':
    case 'medicine':
    case 'boost':
      return 'eat';
    case 'clean':
      return 'clean';
    case 'play':
      return 'celebrate';
    case 'rest':
      return 'rest';
  }
}

/** What a placed piece of furniture is for, if anything. */
function furnitureUse(placement: Placement): string | undefined {
  return furnitureById(placement.id)?.use?.kind;
}

/** An item set down in the room, and where its use stands. */
interface ItemOffer {
  entry: HomeInventoryItem;
  phase: 'walking' | 'using' | 'failed';
  key: number;
  /** Where it lies and where the Blobbi stands to use it; the usual offer spot when absent. */
  spot?: { position: FloorPoint; approach: FloorPoint };
  /** A toy that stays in the room after use (its placement key). */
  toyKey?: string;
  /** When the use began, for the minimum visible duration. */
  usingSince?: number;
}

/** What the Blobbi says when something is picked out for it. */
const PICK_LINES = ['Ooh!', 'For me?', 'Yes please!'];

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

  // Items: the player's inventories (read-only) and the one write path that
  // uses a consumable on this Blobbi.
  const inventory = useHomeInventory({ pubkey, blobbi });
  const useItem = useUseItem({ pubkey, known: inventory.items, updateCompanionEvent, invalidate: refresh });
  // What the Island dressed it in, drawn here too (read-only).
  const worn = useWornEquipment({ pubkey, blobbi, items: inventory.items });

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

  // The room: device-local UI state per Blobbi. A sleeper is in the bedroom.
  const sleeping = blobbi.state === 'sleeping';
  const rooms = useRoom({ pubkey, blobbiD: blobbi.d, sleeping, locked: ceremony.presentation.exclusive });
  const room = rooms.room;
  // The furniture standing here (device-local layout or the room's defaults);
  // the bed in it decides where a sleeper lies.
  const layout = useRoomLayout({ pubkey, blobbiD: blobbi.d, room });
  // Decorating: a draft of the layout the player moves around; Apply saves it.
  const editor = useRoomEditor({ room, current: layout.placements, save: layout.save });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const editorDraft = editor.draft;
  const anchorOf = useCallback((index: number) => editorDraft[index], [editorDraft]);
  const drag = useFurnitureDrag({ canvasRef, anchorOf, clamp: editor.clampFor, onDrop: editor.move, enabled: editor.editing });
  const [catalogOpen, setCatalogOpen] = useState(false);
  // Toys set down in this room: placement is local, ownership is the inventory read.
  const toys = usePlacedToys({ pubkey, blobbiD: blobbi.d, room: room.id, items: inventory.items });
  const shownPlacements = editor.editing ? editor.draft : layout.placements;
  const sleepSpot = useMemo(() => sleepSpotFor(shownPlacements, room), [shownPlacements, room]);
  const [initialPosition] = useState(() => entrySpot(room, sleeping, layout.placements));
  const wide = useWideScreen();

  const scene = useBlobbiPresentation({ blobbi, stats: projected?.stats, sceneRef, actorRef, isInCeremony: ceremony.presentation.exclusive, initialPosition, isEditing: editor.editing });

  const statItems = useMemo<StatItem[]>(
    () =>
      projected
        ? getVisibleStats(blobbi.stage).map((stat) => ({
            stat,
            value: projected.stats[stat],
            status: getStatStatus(blobbi.stage, stat, projected.stats[stat]),
          }))
        : [],
    [projected, blobbi.stage],
  );
  const actions = useMemo(() => availableCareActions(blobbi), [blobbi]);
  const mood = describeMood(blobbi, projected?.stats);

  // Sheets
  const [blobbiSheetOpen, setBlobbiSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);

  // The item set down in the room, if any (see `offerItem` below).
  const [offer, setOffer] = useState<ItemOffer | null>(null);
  const offerRef = useRef<ItemOffer | null>(null);
  useEffect(() => {
    offerRef.current = offer;
  }, [offer]);
  // The item in the player's hand, picked from the hotbar and not yet given.
  // UI state only: nothing is read or written until it is given.
  const [held, setHeld] = useState<HomeInventoryItem | null>(null);

  // Speech: a short line for the moments that deserve one.
  const [speech, setSpeech] = useState<Speech | null>(null);
  const say = useCallback((text: string) => setSpeech((s) => ({ text, key: (s?.key ?? 0) + 1 })), []);

  // A hop, fresh chips, a face and a word each time a care action lands.
  const [resultKey, setResultKey] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackResult | undefined>(undefined);
  const lastResult = care.lastResult;
  const handledResultRef = useRef<typeof lastResult>(undefined);
  const { reactToCare } = scene;
  const play = sound.play;
  useEffect(() => {
    if (!lastResult || handledResultRef.current === lastResult) return;
    handledResultRef.current = lastResult;
    const r = lastResult as CareResult;
    setResultKey((k) => k + 1);
    setFeedback(r);
    reactToCare(r);
    if (r.action === 'rest') {
      say(r.nextState === 'sleeping' ? CARE_LINES.rest[0] : WAKE_LINES[r.event.created_at % WAKE_LINES.length]);
    } else {
      const lines = CARE_LINES[r.action];
      say(lines[r.event.created_at % lines.length]);
    }
    play(soundFor(r.action));
  }, [lastResult, reactToCare, say, play]);

  // An item was used: the same celebration, the item goes away.
  const lastItemResult = useItem.lastResult;
  const handledItemRef = useRef<typeof lastItemResult>(undefined);
  // The celebration waits for the write AND for the use to have been visible
  // for a moment (`MIN_USE_MS`): a fast relay never makes the moment vanish,
  // a slow one never makes the animation wait for it. The face reacted at
  // the pick already; what settles here is the authoritative result.
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!lastItemResult || handledItemRef.current === lastItemResult) return;
    handledItemRef.current = lastItemResult;
    const r = lastItemResult as ItemUseResult;
    const finish = () => {
      finishTimerRef.current = null;
      setOffer(null);
      if (r.alreadyApplied) return;
      setResultKey((k) => k + 1);
      setFeedback({ action: r.action, name: r.name, statsChanged: r.statsChanged, xpGained: r.xpGained, nextState: 'active', itemName: r.item.name });
      reactToCare({ action: r.action, nextState: 'active' });
      const lines = ITEM_LINES[r.action];
      say(lines[r.event.created_at % lines.length]);
      play(soundFor(r.action));
    };
    const remaining = MIN_USE_MS - (Date.now() - (offerRef.current?.usingSince ?? 0));
    if (remaining > 0) finishTimerRef.current = setTimeout(finish, remaining);
    else finish();
  }, [lastItemResult, reactToCare, say, play]);
  useEffect(
    () => () => {
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    },
    [],
  );

  // A use failed: the item stays in the room with a way to retry or put it away.
  const itemError = useItem.error;
  useEffect(() => {
    if (!itemError) return;
    setOffer((o) => (o ? { ...o, phase: 'failed' } : o));
  }, [itemError]);

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

  const ceremonyStart = ceremony.start;
  const startCeremony = useCallback(
    (kind: CeremonyKind) => {
      if (blobbi.state !== 'active') return;
      if (kind === 'hatch' && lifecycle.view.next !== 'hatch') return;
      if (kind === 'evolve' && lifecycle.view.next !== 'evolve') return;
      setBlobbiSheetOpen(false);
      ceremonyStart(kind);
    },
    [blobbi.state, lifecycle.view.next, ceremonyStart],
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
  const liveBlobbi = useRef(blobbi);
  useEffect(() => {
    liveBlobbi.current = blobbi;
  }, [blobbi]);
  const perform = care.perform;
  const walkTo = scene.walkTo;
  const canWalk = scene.canWalk;
  const placeAt = scene.placeAt;
  const door = sceneObject('door');

  // Coming into a room: the Blobbi is placed at the room's entry (a sleeper
  // in the bed), an item that was being walked to is put away (nothing was
  // written), the door prompt closes. `enterRoom` is the player's move and
  // repositions at once, so a walk started in the same tick (rest → bed)
  // begins from the right spot; the effect covers the room changing on its
  // own (the Blobbi falling asleep or waking up from another device).
  const roomRef = useRef<RoomId>(room.id);
  const go = rooms.go;
  const liveStats = useRef(projected?.stats);
  liveStats.current = projected?.stats;
  const enterRoom = useCallback(
    (id: RoomId) => {
      if (id === roomRef.current) return;
      roomRef.current = id;
      go(id);
      placeAt(roomById(id).entry);
      setDoorPrompt(false);
      setHeld(null);
      setOffer((o) => (o && o.phase !== 'using' ? null : o));
      const line = roomGreeting(id, liveBlobbi.current, liveStats.current);
      if (line) say(line);
    },
    [go, placeAt, say],
  );
  useEffect(() => {
    if (roomRef.current === room.id) return;
    roomRef.current = room.id;
    placeAt(entrySpot(room, liveBlobbi.current.state === 'sleeping', readRoomPlacements(localLayoutStore, pubkey, blobbi.d, room.id)));
    setDoorPrompt(false);
    setHeld(null);
    setOffer((o) => (o && o.phase !== 'using' ? null : o));
  }, [room, placeAt, pubkey, blobbi.d]);

  // A sleeper lies in its bed: if the bed moves (the editor), so does the sleeper.
  const sleepX = sleepSpot.x;
  const sleepY = sleepSpot.y;
  const positionRef = useRef(scene.presentation.position);
  positionRef.current = scene.presentation.position;
  useEffect(() => {
    if (liveBlobbi.current.state !== 'sleeping') return;
    if (isAtPoint(positionRef.current, { x: sleepX, y: sleepY })) return;
    placeAt({ x: sleepX, y: sleepY });
  }, [sleepX, sleepY, placeAt]);

  // Rest is walk-then-sleep: to the bed of the room the bed is in (the
  // bedroom, unless a bed stands right here), and only on arrival, only if
  // still awake, the publish. `target` is read before the room changes so
  // the walk starts from the entry towards the right spot.
  const [walkingFor, setWalkingFor] = useState<CareAction | null>(null);
  const careAt = useCallback(
    (roomId: RoomId, target: FloorPoint, action: CareAction) => {
      setWalkingFor(action);
      setDoorPrompt(false);
      enterRoom(roomId);
      void walkTo(target).then((outcome) => {
        setWalkingFor(null);
        if (outcome !== 'arrived') return;
        if (liveBlobbi.current.state !== 'active') return;
        perform(liveBlobbi.current.d, action);
      });
    },
    [enterRoom, walkTo, perform],
  );
  const restAt = useCallback((roomId: RoomId, target: FloorPoint) => careAt(roomId, target, 'rest'), [careAt]);
  // Tapping furniture the Blobbi can use: the bed is rest, done in place.
  const useFurniture = useCallback(
    (placement: Placement, def: FurnitureDefinition) => {
      const kind = def.use?.kind;
      if (!kind) return;
      if (blobbi.state === 'active' && canWalk) careAt(room.id, approachSpot(placement), kind);
      else if (kind === 'rest' && blobbi.state !== 'hibernating') perform(blobbi.d, 'rest');
    },
    [blobbi.d, blobbi.state, canWalk, careAt, room.id, perform],
  );

  // Offering an item: it is set down in the room, the Blobbi walks to it,
  // and only on arrival does the semantic use (spend + care) start. A tap
  // anywhere else while walking puts the item away: nothing was written.
  const offerKeyRef = useRef(0);
  const startUse = useItem.use;
  const resetUse = useItem.reset;
  const offerItem = useCallback(
    (entry: HomeInventoryItem, where?: { spot: { position: FloorPoint; approach: FloorPoint }; toyKey?: string }) => {
      setItemsOpen(false);
      setDoorPrompt(false);
      setHeld(null);
      resetUse();
      const next: ItemOffer = { entry, phase: canWalk ? 'walking' : 'using', key: ++offerKeyRef.current, spot: where?.spot, toyKey: where?.toyKey };
      setOffer(next);
      // The ref is kept current by an effect after render; an egg uses the
      // item at once, before any render, so it is set here too.
      offerRef.current = next;
      const begin = () => {
        if (offerRef.current?.key !== next.key) return;
        const using: ItemOffer = { ...next, phase: 'using', usingSince: Date.now() };
        offerRef.current = using;
        setOffer((o) => (o && o.key === next.key ? using : o));
        const started = startUse({ entry, blobbiD: liveBlobbi.current.d });
        if (!started) setOffer((o) => (o && o.key === next.key ? { ...o, phase: 'failed' } : o));
      };
      if (!canWalk) {
        begin();
        return;
      }
      const object = where?.spot ?? offeredItemObject(entry.item.name);
      void walkTo(object.approach ?? object.position).then((outcome) => {
        if (offerRef.current?.key !== next.key) return;
        if (outcome !== 'arrived') {
          setOffer(null);
          return;
        }
        begin();
      });
    },
    [canWalk, walkTo, startUse, resetUse],
  );
  const putAway = useCallback(() => {
    resetUse();
    offerRef.current = null;
    setOffer(null);
  }, [resetUse]);

  // A toy lying in the room: playing with it is the same use path, with the
  // Blobbi walking to where the toy is; the toy stays while it is still owned.
  const { celebrate: cheer, lookAt } = scene;
  const playWith = useCallback(
    (toy: ToyInRoom) => {
      cheer(900);
      say(PICK_LINES[toy.entry.quantity % PICK_LINES.length]);
      offerItem(toy.entry, { spot: { position: toy.position, approach: toyApproach(toy.position) }, toyKey: toy.key });
    },
    [cheer, say, offerItem],
  );

  const goToDoor = useCallback(() => {
    setDoorPrompt(false);
    void walkTo(door.approach ?? door.position).then((outcome) => {
      if (outcome === 'arrived') setDoorPrompt(true);
    });
  }, [walkTo, door]);
  const placeToy = toys.place;
  const onFloorTap = useCallback(
    (fraction: { x: number; y: number }) => {
      setDoorPrompt(false);
      if (held && held.item.care?.action === 'play' && held.usability.ok) {
        // A toy is set down where the player tapped; nothing is spent.
        const at = floorPointFromScene(fraction);
        if (placeToy(held, at)) {
          setHeld(null);
          lookAt(glanceToward(scene.presentation.position, at), 1_400);
          return;
        }
      }
      setHeld(null);
      scene.onFloorTap(fraction);
    },
    [scene, held, placeToy, lookAt],
  );

  const pendingAction: CareAction | null = care.pendingAction ?? walkingFor;
  const pokeBlobbi = scene.poke;
  const onPoke = useCallback(() => {
    if (pokeBlobbi() === 'upset') say(ANNOYED_LINES[Date.now() % ANNOYED_LINES.length]);
  }, [pokeBlobbi, say]);
  const inCeremony = ceremony.presentation.exclusive;
  const eggCrack = ceremony.presentation.eggCrack ?? lifecycle.view.eggCrack;
  const editing = editor.editing;
  const interactive = !sleeping && canWalk && !inCeremony && !editing;
  const editorSelected = editor.selected;
  const editorSelect = editor.select;
  const dragConsumedTap = drag.consumedTap;
  const dragPointerDown = drag.onPointerDown;
  const dragging = drag.dragging;
  const onSelectFurniture = useCallback(
    (_: Placement, index: number) => {
      if (!dragConsumedTap()) editorSelect(editorSelected === index ? null : index);
    },
    [dragConsumedTap, editorSelect, editorSelected],
  );
  const onFurniturePointerDown = useCallback((_: Placement, index: number, event: React.PointerEvent<HTMLElement>) => dragPointerDown(index, event), [dragPointerDown]);
  const furnitureState = useCallback((_: Placement, index: number) => (index === editorSelected ? 'selected' : dragging === index ? 'dragging' : undefined), [editorSelected, dragging]);
  const usableItemCount = inventory.items.filter((i) => i.usability.ok && !i.unverified).length;

  // The hotbar: this room's usable consumables, from the same read as the
  // sheet. Holding one is two deliberate taps away from a spend: pick it,
  // then tap the Blobbi (or the tile again) to give it.
  const dressing = room.activities.includes('dress');
  const hotbarItems = useMemo(
    () => (dressing ? inventory.items.filter((i) => i.item.equippable) : inventory.items.filter((i) => i.usability.ok && !i.unverified && i.item.care !== null && roomShowsItem(room, i.item))),
    [inventory.items, room, dressing],
  );
  const heldKey = held ? hotbarKey(held) : null;
  useEffect(() => {
    if (heldKey && !hotbarItems.some((i) => hotbarKey(i) === heldKey)) setHeld(null);
  }, [heldKey, hotbarItems]);
  const usableHeld = held !== null && held.usability.ok && !held.unverified;
  const pickItem = useCallback(
    (entry: HomeInventoryItem) => {
      if (held && hotbarKey(held) === hotbarKey(entry)) {
        if (usableHeld) {
          cheer(900);
          say(PICK_LINES[entry.quantity % PICK_LINES.length]);
          offerItem(entry);
        }
        return;
      }
      setHeld(entry);
      // It sees what you picked up: a glance down at the dock.
      if (entry.usability.ok) lookAt({ x: 0, y: 0.7 }, 1_500);
    },
    [held, usableHeld, offerItem, cheer, say, lookAt],
  );
  const give = useCallback(() => {
    if (!held || !usableHeld) return;
    cheer(900);
    say(PICK_LINES[held.quantity % PICK_LINES.length]);
    offerItem(held);
  }, [held, usableHeld, offerItem, cheer, say]);
  // The verbs route to the room when the room has the thing: rest to the
  // bed, clean to the tub, play to a toy lying here, feed to the food in
  // hand. Without one, the verb is the kit's plain care: the home stays
  // usable with nothing owned and nothing placed.
  const onAction = useCallback(
    (action: CareAction) => {
      const active = blobbi.state === 'active' && canWalk;
      if (action === 'rest' && active) {
        const bedHere = layout.placements.find((p) => furnitureUse(p) === 'rest');
        if (bedHere) restAt(room.id, approachSpot(bedHere));
        else restAt('rest', sleepSpotFor(readRoomPlacements(localLayoutStore, pubkey, blobbi.d, 'rest'), roomById('rest')));
        return;
      }
      if (action === 'clean' && active) {
        const tub = layout.placements.find((p) => furnitureUse(p) === 'clean');
        if (tub) {
          careAt(room.id, approachSpot(tub), 'clean');
          return;
        }
      }
      if (action === 'play' && active && toys.toys.length > 0) {
        playWith(toys.toys[0]);
        return;
      }
      if (action === 'feed' && held?.item.care?.action === 'feed' && held.usability.ok) {
        give();
        return;
      }
      perform(blobbi.d, action);
    },
    [blobbi.d, blobbi.state, perform, canWalk, restAt, careAt, layout.placements, room.id, pubkey, toys.toys, held, give, playWith],
  );
  const openItems = useCallback(() => setItemsOpen(true), []);
  const openBlobbiSheet = useCallback(() => setBlobbiSheetOpen(true), []);
  const railCanMove = rooms.canMove && !inCeremony && offer === null;
  const railRooms = useMemo(() => ({ ...rooms, go: enterRoom, canMove: railCanMove }), [rooms, enterRoom, railCanMove]);
  const wornHeld = held ? worn.wornAddresses.has(held.item.address) : false;
  const hotbarHint = held
    ? !held.usability.ok
      ? held.item.equippable
        ? wornHeld
          ? `${blobbi.name} is wearing the ${held.item.name}. Equipment is changed on the Island.`
          : `Equip the ${held.item.name} on the Island.`
        : held.usability.reason ?? 'Not right now.'
      : held.item.care?.action === 'play'
        ? `Tap ${blobbi.name} to play now, or tap the floor to set the ${held.item.name} down.`
        : `Tap ${blobbi.name} to give the ${held.item.name}.`
    : hotbarItems.length > 0
      ? null
      : sleeping
        ? `${blobbi.name} is asleep.`
        : inventory.status === 'loading'
          ? 'Looking for your items…'
          : usableItemCount > 0
            ? room.emptyHint
            : blobbi.stage === 'egg'
              ? 'An egg can only be kept clean.'
              : 'Items you earn on the Island or grow on the Farm show up here.';
  const wornAddresses = worn.wornAddresses;
  const hotbarProps = useMemo(
    () => ({ items: hotbarItems, wornAddresses, selectedKey: heldKey, onSelect: pickItem, onOpenItems: openItems, itemCount: usableItemCount, hint: hotbarHint }),
    [hotbarItems, wornAddresses, heldKey, pickItem, openItems, usableItemCount, hotbarHint],
  );
  const offerObject = offer ? (offer.spot ? itemObjectAt('offer', offer.entry.item.name, offer.spot.position, offer.spot.approach) : offeredItemObject(offer.entry.item.name)) : null;
  const accessories = blobbi.stage === 'egg' ? undefined : worn.accessoriesFor(scene.presentation.facing);
  const actorEffects = useMemo(() => {
    const ceremonyEffects = ceremony.presentation.effects ?? [];
    return ceremonyEffects.length > 0 ? [...ceremonyEffects, ...worn.effects] : worn.effects;
  }, [ceremony.presentation.effects, worn.effects]);

  const lifecycleNext = lifecycle.view.next;
  const lifecycleReady = useMemo(() => (lifecycleNext === 'hatch' ? { kind: 'hatch' as const, label: 'Hatch!' } : lifecycleNext === 'evolve' ? { kind: 'evolve' as const, label: 'Evolve!' } : null), [lifecycleNext]);

  const ceremonyView = { phase: ceremony.phase, kind: ceremony.kind, error: ceremony.error, dismiss: ceremony.dismiss };

  return (
    <GameShell
      top={<HudTop blobbi={blobbi} mood={mood} onOpenBlobbi={() => setBlobbiSheetOpen(true)} onOpenMenu={() => setMenuOpen(true)} />}
      scene={
        <HomeScene
          ref={sceneRef}
          label={`${blobbi.name}'s ${room.label.toLowerCase()}`}
          room={room.id}
          canvasRef={canvasRef}
          editing={editing}
          onSwipe={
            rooms.canMove && !editing
              ? (direction) => {
                  const next = rooms.neighbour(direction === 'left' ? 'right' : 'left');
                  if (next) enterRoom(next);
                }
              : undefined
          }
          topBar={
            <>
              <RoomIndicator rooms={{ ...rooms, go: enterRoom }} disabled={inCeremony || editing} />
              {!editing && !inCeremony && offer === null && (
                <button type="button" className="room-edit-btn" onClick={editor.begin} aria-label="Decorate this room" title="Decorate" data-testid="room-edit">
                  <Paintbrush className="h-4 w-4" aria-hidden />
                </button>
              )}
            </>
          }
          floorLabel={sleeping ? `${blobbi.name} is asleep` : canWalk ? `Call ${blobbi.name} here` : `${blobbi.name} stays put`}
          onFloorTap={interactive ? onFloorTap : undefined}
          pointerHandlers={scene.scenePointerHandlers}
          objects={
            <>
              <FurnitureLayer
                placements={shownPlacements}
                interactive={interactive}
                onUse={useFurniture}
                editing={editing}
                onSelect={editing ? onSelectFurniture : undefined}
                onPointerDown={editing ? onFurniturePointerDown : undefined}
                onKeyDown={editing ? editor.onKeyDown : undefined}
                stateOf={editing ? furnitureState : undefined}
              />
              {room.fixtures.includes('door') && (
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
              )}
              {toys.toys.map((toy) => {
                const mine = offer?.toyKey === toy.key ? offer : null;
                const def = itemObjectAt('toy', toy.entry.item.name, toy.position, toyApproach(toy.position), `scene-object-toy-${toy.entry.item.itemId}`);
                return (
                  <SceneObjectView key={toy.key} def={def} state={mine ? mine.phase : 'placed'} onTap={mine ? (mine.phase === 'failed' ? putAway : undefined) : interactive && offer === null ? () => playWith(toy) : undefined}>
                    <div className="offer-art offer-art--placed">
                      <ItemGlyph glyph={toy.entry.item.glyph} fill />
                    </div>
                  </SceneObjectView>
                );
              })}
              {offer && offerObject && !offer.toyKey && (
                <SceneObjectView
                  def={offerObject}
                  state={offer.phase}
                  onTap={offer.phase === 'using' ? undefined : putAway}
                  aside={
                    offer.phase === 'failed' && (
                      <div className="offer-prompt" data-testid="offer-prompt">
                        <button type="button" className="lifecycle-pill !animate-none !px-3 !py-1.5 !text-xs" onClick={() => offerItem(offer.entry)} data-testid="offer-retry">
                          Try again
                        </button>
                        <button type="button" className="home-glass rounded-full px-3 py-1.5 text-xs font-semibold" onClick={putAway} data-testid="offer-put-away">
                          Put away
                        </button>
                      </div>
                    )
                  }
                >
                  <div className="offer-art">
                    <ItemGlyph glyph={offer.entry.item.glyph} fill />
                  </div>
                </SceneObjectView>
              )}
            </>
          }
          actor={
            <BlobbiActor
              ref={actorRef}
              blobbi={blobbi}
              presentation={scene.presentation}
              happyKey={resultKey}
              onPoke={inCeremony || editing ? undefined : usableHeld ? give : onPoke}
              tapLabel={usableHeld && held ? `Give ${blobbi.name} the ${held.item.name}` : undefined}
              invite={usableHeld}
              eggCrack={blobbi.stage === 'egg' ? eggCrack : undefined}
              effects={actorEffects}
              accessories={accessories}
            >
              <NeedBubbles items={sleeping || inCeremony ? [] : statItems} />
              <SpeechBubble speech={speech} />
              <CareFeedback result={feedback} resultKey={resultKey} />
            </BlobbiActor>
          }
          foreground={
            <>
              <RoomArrows rooms={{ ...rooms, go: enterRoom }} disabled={inCeremony || offer !== null || editing} />
              <div className="absolute inset-x-4 top-16 flex flex-col items-center gap-2">
              <CareError error={care.error} />
              {itemError && offer?.phase === 'failed' && (
                <p role="alert" className="home-glass rounded-xl px-3 py-2 text-center text-sm text-destructive" data-testid="item-error">
                  {itemError.message}
                </p>
              )}
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
            </>
          }
        >
          <RoomBackdrop room={room} />
        </HomeScene>
      }
      aside={wide ? <HomeRail blobbi={blobbi} mood={`${blobbi.name} ${mood}`} statItems={statItems} profile={profile} rooms={railRooms} onOpenBlobbi={openBlobbiSheet} /> : undefined}
      bottom={
        <ActionBar
          room={room.id}
          floorBackground={surfaceBackground(room.surfaces.floor)}
          override={editing ? <RoomEditorBar editor={editor} roomLabel={room.label} onOpenCatalog={() => setCatalogOpen(true)} /> : undefined}
          actions={actions}
          pendingAction={pendingAction}
          onAction={onAction}
          lifecycleReady={lifecycleReady}
          onLifecycle={startCeremony}
          disabled={inCeremony || offer !== null}
          hotbar={hotbarProps}
        />
      }
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
          <FurnitureCatalogSheet open={catalogOpen} onClose={() => setCatalogOpen(false)} room={room} onAdd={editor.add} />
          <InventorySheet
            open={itemsOpen}
            onClose={() => setItemsOpen(false)}
            inventory={inventory}
            blobbiName={blobbi.name}
            onUse={offerItem}
            openUse={useItem.hasOpenUse(blobbi.d)}
            busy={useItem.isPending || offer !== null}
            worn={worn.wornAddresses}
          />
        </>
      }
    />
  );
}
