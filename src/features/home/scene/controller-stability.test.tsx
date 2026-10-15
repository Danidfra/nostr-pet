/**
 * The scene controller is the same object while only the Blobbi's eyes move
 * (M15 care refinement): whoever is told of it through the settings' seam
 * (a dev surface) is told when something else changes, never once per
 * pointer frame; and its presentation is always the live one.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { parseModernBlobbiEvent } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import { SceneSettingsProvider } from './SceneSettings';
import { useBlobbiPresentation } from './useBlobbiPresentation';
import type { BlobbiSceneController } from './useBlobbiPresentation';

describe('the scene controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stays the same object while the eyes follow a hovering pointer; its presentation is live; the seam is not told per frame', () => {
    const blobbi = parseModernBlobbiEvent(blobbiEvent('0000000042', { name: 'Brook', stage: 'baby', state: 'active' }))!;
    const actor = document.createElement('div');
    actor.getBoundingClientRect = () => ({ left: 100, top: 100, width: 100, height: 100, right: 200, bottom: 200, x: 100, y: 100, toJSON: () => ({}) });
    const scene = document.createElement('section');
    scene.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) });
    const told: (BlobbiSceneController | null)[] = [];
    const onController = (c: BlobbiSceneController | null) => told.push(c);
    const wrapper = ({ children }: { children: ReactNode }) => <SceneSettingsProvider value={{ onController, reducedMotion: true }}>{children}</SceneSettingsProvider>;
    const sceneRef = { current: scene };
    const actorRef = { current: actor };
    const { result } = renderHook(() => useBlobbiPresentation({ blobbi, stats: undefined, sceneRef, actorRef }), { wrapper });
    const first = result.current;
    const toldAtStart = told.length;
    const eyes: unknown[] = [];
    for (let i = 0; i < 6; i++) {
      act(() => first.scenePointerHandlers.onPointerMove({ pointerType: 'mouse', clientX: 110 + i * 15, clientY: 140 } as never));
      act(() => { vi.advanceTimersByTime(20); });
      eyes.push(result.current.presentation.eyeOffset);
    }
    // The eyes moved, the controller did not
    expect(new Set(eyes.map((e) => JSON.stringify(e))).size).toBeGreaterThan(2);
    expect(result.current).toBe(first);
    expect(first.presentation.eyeOffset).toEqual(eyes[eyes.length - 1]);
    expect(told.length).toBe(toldAtStart);
  });
});
