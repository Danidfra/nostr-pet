/**
 * The presence controller as React state: one controller for the life of
 * the component (a fresh one if React's development double effect disposed
 * the first), its snapshot re-rendered on each change, disposed (every timer
 * cleared) on unmount. The callbacks are read fresh each time, so a
 * parent re-rendering never rebuilds the controller or loses a journey.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPresenceController, type PresenceController, type PresenceSnapshot, type PresenceState } from '../presence';
import type { JourneyCue, JourneyKind } from '../timeline';

export interface UsePresenceOptions {
  initial?: 'present' | 'absent';
  reducedMotion?: () => boolean;
  onCue?: (cue: JourneyCue, kind: JourneyKind) => void;
  onComplete?: (state: 'present' | 'absent') => void;
}

export interface Presence extends PresenceSnapshot {
  leave: () => boolean;
  enter: () => boolean;
  cancel: () => void;
  getState: () => PresenceState;
  /** The controller itself, for a coordinator that drives it from outside React. */
  controller: PresenceController;
}

export function usePresence({ initial = 'present', reducedMotion, onCue, onComplete }: UsePresenceOptions = {}): Presence {
  const latest = useRef({ reducedMotion, onCue, onComplete });
  latest.current = { reducedMotion, onCue, onComplete };
  const [make] = useState(() => () =>
    createPresenceController({
      initial,
      reducedMotion: () => latest.current.reducedMotion?.() ?? false,
      onCue: (cue, kind) => latest.current.onCue?.(cue, kind),
      onComplete: (state) => latest.current.onComplete?.(state),
    }),
  );
  const [controller, setController] = useState<PresenceController>(make);
  const [snapshot, setSnapshot] = useState<PresenceSnapshot>(() => controller.snapshot());
  useEffect(() => {
    // A controller disposed by an earlier cleanup (React's development double effect) is replaced, never reused
    if (controller.isDisposed()) {
      setController(make());
      return;
    }
    setSnapshot(controller.snapshot());
    const unsubscribe = controller.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, [controller, make]);

  const leave = useCallback(() => controller.leave(), [controller]);
  const enter = useCallback(() => controller.enter(), [controller]);
  const cancel = useCallback(() => controller.cancel(), [controller]);
  const getState = useCallback(() => controller.getState(), [controller]);
  return { ...snapshot, leave, enter, cancel, getState, controller };
}
