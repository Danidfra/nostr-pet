/**
 * Development only: the room's animations by hand, to judge them without
 * playing for them. Each room transition (and the room's construction on
 * its own), to any room; the teleport has its own panel beside this one.
 * Feeding and petting play their presentation only (nothing is eaten,
 * nothing is written). Every face by name. A speed, a replay, a cancel, and
 * a scrubber that holds any moment of a scene, drawn at once, even in a
 * background tab. 2D or 3D and the adult or baby fixtures are a click away.
 * Never in a production build (the room renders it behind the dev tools
 * flag).
 */
import { useState } from 'react';

import { ROOM_ORDER, roomById, type RoomId } from '@/features/home/rooms/rooms';
import type { ExpressionName } from '@/features/expression/faces';
import { EXPRESSIONS } from '@/features/expression/faces';
import type { BlobbiAppearance } from '../lib/blobbi-appearance';
import type { RoomTransitions } from '../hooks/useRoomTransitions';
import type { TransitionKind } from '../lib/room-transitions';

const SCENES: { id: string; label: string; kind: TransitionKind; intro?: 'build' | 'quick' }[] = [
  { id: 'construct', label: 'Room construction', kind: 'fade', intro: 'build' },
  { id: 'quick', label: 'Fast transition', kind: 'quick' },
  { id: 'big-jump', label: 'Big Jump', kind: 'big-jump' },
  { id: 'outside', label: 'Outside the Room', kind: 'outside' },
  { id: 'floor-gag', label: 'Invisible Floor', kind: 'floor-gag' },
  { id: 'behind-wall', label: 'Behind the Wall', kind: 'behind-wall' },
];

interface AnimationPlaygroundProps {
  transitions: RoomTransitions;
  /** The room on screen, to pick the next one along. */
  roomId: RoomId;
  appearance: BlobbiAppearance;
  onAppearance: (appearance: BlobbiAppearance) => void;
  onFace: (name: ExpressionName | null) => void;
  /** Ask for a room, as the header does (the scene forced beforehand plays). */
  onRoom: (room: RoomId) => void;
  /** Play the eating animation and the petting reaction, presentation only. */
  onFeed?: () => void;
  onPet?: () => void;
}

export function AnimationPlayground({ transitions, roomId, appearance, onAppearance, onFace, onRoom, onFeed, onPet }: AnimationPlaygroundProps) {
  const [open, setOpen] = useState(false);
  const [scene, setScene] = useState(SCENES[2]);
  const nextRoom = ROOM_ORDER[(ROOM_ORDER.indexOf(roomId) + 1) % ROOM_ORDER.length];
  const [target, setTarget] = useState<RoomId | null>(null);
  const to = target && target !== roomId ? target : nextRoom;
  const [held, setHeld] = useState<number | null>(null);

  if (!open) {
    return (
      <button type="button" className="teleport-dev teleport-dev--closed playground-dev--closed" onClick={() => setOpen(true)} data-testid="playground-open">
        ✦ Animations
      </button>
    );
  }
  const play = (s = scene) => {
    setHeld(null);
    setScene(s);
    transitions.cancel();
    transitions.forceNext(s.kind, { intro: s.intro });
    onRoom(to);
  };
  // Hold a moment: the scene starts held on its first scrub, and moves with the scrubber after
  const hold = (t: number) => {
    setHeld(t);
    if (held !== null && transitions.seek(t)) return;
    transitions.cancel();
    transitions.forceNext(scene.kind, { intro: scene.intro, holdAt: t });
    onRoom(to);
  };
  return (
    <div className="teleport-dev playground-dev" data-testid="playground" data-state={transitions.kind ?? 'idle'}>
      <div className="flex items-center gap-2">
        <strong className="flex-1">Animations · {transitions.kind ?? 'idle'}</strong>
        <button type="button" onClick={() => { transitions.cancel(); setOpen(false); }} aria-label="Close the animation playground">✕</button>
      </div>
      <div className="flex flex-wrap gap-1">
        {SCENES.map((s) => (
          <button key={s.id} type="button" onClick={() => { setScene(s); if (held === null) play(s); else { setHeld(null); transitions.cancel(); } }} data-active={scene.id === s.id} data-testid={`playground-scene-${s.id}`}>
            {s.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2">
        to
        <select value={to} onChange={(e) => setTarget(e.target.value as RoomId)} data-testid="playground-room">
          {ROOM_ORDER.filter((r) => r !== roomId).map((r) => (
            <option key={r} value={r}>{roomById(r).label}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={() => play()} data-testid="playground-replay">Replay</button>
        <button type="button" onClick={() => { setHeld(null); transitions.cancel(); }} data-testid="playground-cancel">Cancel</button>
        {held !== null && <button type="button" onClick={() => { setHeld(null); transitions.cancel(); }} data-testid="playground-release">Release</button>}
        {onFeed && <button type="button" onClick={onFeed} data-testid="playground-feed">Feeding</button>}
        {onPet && <button type="button" onClick={onPet} data-testid="playground-pet">Petting</button>}
      </div>
      <label className="flex items-center gap-2">
        speed
        <input type="range" min={0.1} max={2} step={0.1} value={transitions.speed} onChange={(e) => transitions.setSpeed(Number(e.target.value))} data-testid="playground-speed" />
        <span>{transitions.speed.toFixed(1)}×</span>
      </label>
      <input
        type="range"
        min={0}
        max={Math.max(1, transitions.durationMs || 3000)}
        step={10}
        value={held ?? 0}
        onChange={(e) => hold(Number(e.target.value))}
        aria-label="Scene time"
        data-testid="playground-scrub"
      />
      <div className="text-[11px] opacity-80">{held !== null ? `${scene.label} held at ${held} ms` : 'scrub to hold a moment'}</div>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(EXPRESSIONS) as ExpressionName[]).map((name) => (
          <button key={name} type="button" onClick={() => onFace(name)} data-testid={`playground-face-${name}`}>{name}</button>
        ))}
        <button type="button" onClick={() => onFace(null)} data-testid="playground-face-clear">own face</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onAppearance(appearance === '3d' ? '2d' : '3d')} data-testid="playground-appearance">{appearance === '3d' ? 'Show 2D' : 'Show 3D'}</button>
        <a href="?fixture=adult-v3">adult</a>
        <a href="?fixture=baby-v3">baby</a>
      </div>
    </div>
  );
}
