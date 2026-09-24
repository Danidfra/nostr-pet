import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ISLAND_DAY_MS, ISLAND_EPOCH_MS, ISLAND_TICK_MS, islandDayProgressAt, islandMinuteAt, islandPhaseAt, islandTimeAt, msUntilNextIslandTick } from './island-clock';
import { PHASE_LOOKS, SURFACES, resolvePhase, isAppearance } from './environments';
import { EnvironmentProvider, useEnvironment } from './EnvironmentProvider';
import { APPEARANCE_STORAGE_KEY, applyPhaseToDocument, readStoredAppearance, writeStoredAppearance } from './appearance-storage';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const minuteMs = ISLAND_DAY_MS / 120;

describe('island clock (as the Island computes it)', () => {
  it('is a pure function of the instant: two real hours per island day from the fixed epoch', () => {
    expect(islandDayProgressAt(ISLAND_EPOCH_MS)).toBe(0);
    expect(islandDayProgressAt(ISLAND_EPOCH_MS + ISLAND_DAY_MS / 2)).toBeCloseTo(0.5);
    expect(islandDayProgressAt(ISLAND_EPOCH_MS + ISLAND_DAY_MS)).toBe(0);
    expect(islandMinuteAt(ISLAND_EPOCH_MS + 42.5 * minuteMs)).toBeCloseTo(42.5);
  });

  it('folds instants before the epoch and bad clocks into range', () => {
    expect(islandDayProgressAt(ISLAND_EPOCH_MS - minuteMs)).toBeCloseTo(119 / 120);
    expect(islandDayProgressAt(Number.NaN)).toBe(0);
  });

  it('follows the phase table: dawn 0-10, day 10-75, sunset 75-90, night 90-120', () => {
    const at = (minute: number) => islandPhaseAt(minute / 120);
    expect(at(0).phase).toBe('dawn');
    expect(at(9.99).phase).toBe('dawn');
    expect(at(10).phase).toBe('day');
    expect(at(74.99).phase).toBe('day');
    expect(at(75).phase).toBe('sunset');
    expect(at(90).phase).toBe('night');
    expect(at(119.99).phase).toBe('night');
    expect(at(5).phaseProgress).toBeCloseTo(0.5);
    expect(islandTimeAt(ISLAND_EPOCH_MS + 82.5 * minuteMs)).toMatchObject({ phase: 'sunset', minute: 82.5 });
  });

  it('ticks on absolute boundaries so every client steps together', () => {
    expect(msUntilNextIslandTick(0)).toBe(ISLAND_TICK_MS);
    expect(msUntilNextIslandTick(ISLAND_TICK_MS * 3 + 1_000)).toBe(ISLAND_TICK_MS - 1_000);
    expect(msUntilNextIslandTick(Number.NaN)).toBe(ISLAND_TICK_MS);
  });
});

describe('environment registry', () => {
  it('has a complete look for every phase and only night is dark', () => {
    for (const phase of ['dawn', 'day', 'sunset', 'night'] as const) {
      const look = PHASE_LOOKS[phase];
      expect(look.phase).toBe(phase);
      expect(Object.keys(look.scene)).toHaveLength(15);
      expect(Object.keys(SURFACES[look.mood])).toHaveLength(17);
    }
    expect(PHASE_LOOKS.night.mood).toBe('dark');
    expect(PHASE_LOOKS.day.mood).toBe('light');
  });

  it('an appearance either follows the Island or locks a phase', () => {
    expect(resolvePhase('island', 'sunset')).toBe('sunset');
    expect(resolvePhase('day', 'night')).toBe('day');
    expect(resolvePhase('night', 'dawn')).toBe('night');
    expect(isAppearance('island')).toBe(true);
    expect(isAppearance('forest')).toBe(false);
  });

  it('paints a phase onto the document', () => {
    const root = document.createElement('div');
    applyPhaseToDocument(PHASE_LOOKS.night, root);
    expect(root.style.getPropertyValue('--sky-top')).toBe(PHASE_LOOKS.night.scene.skyTop);
    expect(root.style.getPropertyValue('--background')).toBe(SURFACES.dark.background);
    expect(root.dataset.homePhase).toBe('night');
    expect(root.classList.contains('dark')).toBe(true);
    applyPhaseToDocument(PHASE_LOOKS.day, root);
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.getPropertyValue('--stars')).toBe('0');
  });

  it('the :root defaults in index.css match the day look', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    for (const [name, value] of Object.entries(SURFACES.light)) expect(css).toContain(`--${name}: ${value};`);
    expect(css).toContain(`--sky-top: ${PHASE_LOOKS.day.scene.skyTop};`);
    expect(css).toContain(`--wall: ${PHASE_LOOKS.day.scene.wall};`);
  });
});

describe('appearance persistence', () => {
  it('reads the default when nothing is stored, round-trips a choice, falls back on junk and on a broken storage', () => {
    expect(readStoredAppearance({ getItem: () => null })).toBe('island');
    const store = new Map<string, string>();
    writeStoredAppearance('night', { setItem: (k, v) => store.set(k, v) });
    expect(store.get(APPEARANCE_STORAGE_KEY)).toBe('night');
    expect(readStoredAppearance({ getItem: (k) => store.get(k) ?? null })).toBe('night');
    expect(readStoredAppearance({ getItem: () => 'forest' })).toBe('island');
    expect(
      readStoredAppearance({
        getItem: () => {
          throw new Error('nope');
        },
      }),
    ).toBe('island');
  });
});

function Probe() {
  const env = useEnvironment();
  return (
    <div>
      <span data-testid="phase">{env.phase}</span>
      <span data-testid="island">{env.island.phase}</span>
      <button type="button" onClick={() => env.setAppearance('night')}>
        night
      </button>
    </div>
  );
}

describe('EnvironmentProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('follows the Island clock, ticks on its boundaries, and locks a phase when asked', async () => {
    let now = ISLAND_EPOCH_MS + 9.5 * minuteMs; // dawn, half a minute before day
    render(
      <EnvironmentProvider now={() => now}>
        <Probe />
      </EnvironmentProvider>,
    );
    expect(screen.getByTestId('phase')).toHaveTextContent('dawn');
    expect(document.documentElement.dataset.homePhase).toBe('dawn');
    now += 60_000;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ISLAND_TICK_MS);
    });
    expect(screen.getByTestId('phase')).toHaveTextContent('day');
    expect(screen.getByTestId('island')).toHaveTextContent('day');

    act(() => screen.getByRole('button', { name: 'night' }).click());
    expect(screen.getByTestId('phase')).toHaveTextContent('night');
    expect(screen.getByTestId('island')).toHaveTextContent('day');
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('night');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('works without a provider, as the Island time with a no-op setter', () => {
    render(<Probe />);
    expect(['dawn', 'day', 'sunset', 'night']).toContain(screen.getByTestId('phase').textContent);
    act(() => screen.getByRole('button', { name: 'night' }).click());
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBeNull();
  });
});
