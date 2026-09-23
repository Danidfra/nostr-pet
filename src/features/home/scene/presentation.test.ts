import { describe, expect, it } from 'vitest';
import { composePresentation, type PresentationInputs } from './presentation';

const base: PresentationInputs = {
  position: { x: 0.5, y: 0.5 },
  facing: 'left',
  motion: 'idle',
  gaze: { x: 0.4, y: 0 },
  travelGaze: { x: -0.45, y: 0 },
  reaction: null,
  baseline: 'neutral',
  isSleeping: false,
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
    });
  });

  it('a temporary reaction beats the baseline', () => {
    expect(composePresentation({ ...base, baseline: 'sad', reaction: 'happy' }).expression).toBe('happy');
    expect(composePresentation({ ...base, baseline: 'sad', reaction: null }).expression).toBe('sad');
  });

  it('sleeping beats everything: still, eyes shut, no gaze, neutral face', () => {
    const p = composePresentation({ ...base, isSleeping: true, reaction: 'excited', motion: 'walking' });
    expect(p).toMatchObject({ isSleeping: true, motion: 'still', eyeOffset: undefined, expression: 'neutral', facing: 'left' });
  });

  it('walking: the eyes follow the road, not the pointer', () => {
    const p = composePresentation({ ...base, motion: 'walking' });
    expect(p.motion).toBe('walking');
    expect(p.eyeOffset).toEqual({ x: -0.45, y: 0 });
  });
});
