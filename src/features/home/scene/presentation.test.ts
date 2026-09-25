import { describe, expect, it } from 'vitest';
import { composePresentation, type PresentationInputs } from './presentation';

const base: PresentationInputs = {
  mode: 'free',
  position: { x: 0.5, y: 0.5 },
  facing: 'left',
  motion: 'idle',
  gaze: { x: 0.4, y: 0 },
  travelGaze: { x: -0.45, y: 0 },
  reaction: null,
  baseline: 'neutral',
};

describe('composePresentation precedence', () => {
  it('idle: baseline face, gaze target, keeps facing and position', () => {
    expect(composePresentation(base)).toEqual({
      position: { x: 0.5, y: 0.5 },
      facing: 'left',
      motion: 'idle',
      eyeOffset: { x: 0.4, y: 0 },
      expression: 'neutral',
      isSleeping: false,
      gesture: null,
    });
  });

  it('a poke gesture shows where the mode allows one, and never over a walk', () => {
    const gesture = { kind: 'bounce' as const, key: 1 };
    expect(composePresentation({ ...base, gesture }).gesture).toEqual(gesture);
    expect(composePresentation({ ...base, gesture, motion: 'walking' }).gesture).toBeNull();
    expect(composePresentation({ ...base, gesture: { kind: 'stir', key: 2 }, mode: 'sleeping' }).gesture).toEqual({ kind: 'stir', key: 2 });
    expect(composePresentation({ ...base, gesture: { kind: 'wiggle', key: 3 }, mode: 'nested' }).gesture).toEqual({ kind: 'wiggle', key: 3 });
    expect(composePresentation({ ...base, gesture, mode: 'ceremony' }).gesture).toBeNull();
    expect(composePresentation({ ...base, gesture, mode: 'editing' }).gesture).toBeNull();
  });

  it('a temporary reaction beats the baseline', () => {
    expect(composePresentation({ ...base, baseline: 'sad', reaction: 'happy' }).expression).toBe('happy');
    expect(composePresentation({ ...base, baseline: 'sad', reaction: null }).expression).toBe('sad');
  });

  it('sleeping beats everything: still, eyes shut, no gaze, neutral face', () => {
    const p = composePresentation({ ...base, mode: 'sleeping', reaction: 'excited', motion: 'walking' });
    expect(p).toMatchObject({ isSleeping: true, motion: 'still', eyeOffset: undefined, expression: 'neutral', facing: 'left' });
  });

  it('a user walk still shows reactions and the travel gaze', () => {
    const p = composePresentation({ ...base, mode: 'user-walk', motion: 'walking', reaction: 'happy' });
    expect(p).toMatchObject({ motion: 'walking', eyeOffset: { x: -0.45, y: 0 }, expression: 'happy', isSleeping: false });
  });

  it('walking: the eyes follow the road, not the pointer', () => {
    const p = composePresentation({ ...base, motion: 'walking' });
    expect(p.motion).toBe('walking');
    expect(p.eyeOffset).toEqual({ x: -0.45, y: 0 });
  });
});
