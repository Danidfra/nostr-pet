/**
 * The dev fixture controller, without React: a spec becomes a modern kind
 * 31124 the kit parses back to the same spec; presets take their numbers
 * from the kit's thresholds and mission definitions; a rewrite keeps the
 * creature (its seed) and changes only its state; nothing ever leaves the
 * in-memory store.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrContext } from '@nostrify/react';
import { createElement, type ReactNode } from 'react';
import { CRITICAL_THRESHOLDS, KIND_BLOBBI_STATE, getStatStatus, getTagValue, parseModernBlobbiEvent, type BlobbiStage, type BlobbiStats } from '@blobbi-kit/core';
import { EVOLVE_STAT_THRESHOLD, HATCH_MISSIONS, useEvolveTasks, useHatchTasks } from '@blobbi-kit/react';
import { PUBKEY } from '@/test/fixtures';
import { FIXTURE_PRESETS, HEALTHY_VALUE, NO_PINS, createFixtureController, criticalValue, statsForPreset } from './fixture-controller';
import { FIXTURE_D, STAT_NAMES, buildFixtureBlobbi, missionsComplete, missionsForSpec, readFixtureRequest, specFromCompanion, specFromOptions, type FixtureSpec } from './fixture-world';

const request = (search = '?fixture=baby') => readFixtureRequest(search)!;
const parsed = (spec: FixtureSpec) => parseModernBlobbiEvent(buildFixtureBlobbi(spec))!;

describe('the fixture request', () => {
  it('reads the fixture, its state, a low stat and a pinned face from the URL; an unknown name falls back to the baby', () => {
    expect(readFixtureRequest('')).toBeNull();
    expect(readFixtureRequest('?fixture=egg')).toEqual({ name: 'egg', state: 'active', low: undefined, expression: null });
    expect(readFixtureRequest('?fixture=adult-v2&state=sleeping&low=energy&expression=sad')).toEqual({ name: 'adult-v2', state: 'sleeping', low: 'energy', expression: 'sad' });
    expect(readFixtureRequest('?fixture=dragon&low=luck&expression=smug')).toEqual({ name: 'baby', state: 'active', low: undefined, expression: null });
  });
});

describe('a spec and its event', () => {
  it('round-trips through the kit parser: stage, generation, state, stats, streak, xp, progression and mission counts', () => {
    const spec: FixtureSpec = {
      ...specFromOptions({ name: 'adult-v2' }),
      state: 'sleeping',
      stats: { hunger: 11, happiness: 22, hygiene: 33, energy: 44, health: 55 },
      careStreak: 9,
      experience: 1234,
      progressionState: 'none',
    };
    const companion = parsed(spec);
    expect(companion.d).toBe(FIXTURE_D);
    expect(specFromCompanion(companion)).toEqual(spec);
    const evolving: FixtureSpec = { ...specFromOptions({ name: 'baby' }), progressionState: 'evolving', missions: { interactions: 5, themes: 2, colorMoments: 1, editProfile: true } };
    expect(specFromCompanion(parsed(evolving))).toEqual(evolving);
    const incubating: FixtureSpec = { ...specFromOptions({ name: 'egg' }), progressionState: 'incubating', missions: { interactions: 3, themes: 1, colorMoments: 0, editProfile: false } };
    expect(specFromCompanion(parsed(incubating))).toEqual(incubating);
  });

  it('is the same creature every time: the seed and the visual traits never change between rebuilds, only the id, the date and the state', () => {
    const a = buildFixtureBlobbi(specFromOptions({ name: 'baby' }));
    const b = buildFixtureBlobbi({ ...specFromOptions({ name: 'adult' }), stats: { hunger: 5, happiness: 5, hygiene: 5, energy: 5, health: 5 } });
    for (const tag of ['seed', 'base_color', 'secondary_color', 'eye_color', 'pattern', 'special_mark', 'size', 'd']) expect(getTagValue(b.tags, tag), tag).toBe(getTagValue(a.tags, tag));
    expect(b.id).not.toBe(a.id);
    expect(b.created_at).toBeGreaterThan(a.created_at);
    expect(parseModernBlobbiEvent(a)!.adultType).toBeUndefined();
    // Core derives the adult form from the seed, so the adult is the form this seed always gives.
    const adult = parseModernBlobbiEvent(b)!;
    expect(adult.adultType).toBeDefined();
    expect(adult.adultType).toBe(parseModernBlobbiEvent(buildFixtureBlobbi(specFromOptions({ name: 'adult-v2' })))!.adultType);
  });

  it('dates the stats now, so what was set is what is shown; an egg is never asleep; the missions are the kit\'s own list', () => {
    const now = Math.floor(Date.now() / 1000);
    const egg = buildFixtureBlobbi({ ...specFromOptions({ name: 'egg' }), state: 'sleeping', progressionState: 'incubating' });
    expect(Number(getTagValue(egg.tags, 'last_decay_at'))).toBeGreaterThanOrEqual(now);
    expect(getTagValue(egg.tags, 'state')).toBe('active');
    expect(getTagValue(egg.tags, 'progression_state')).toBe('incubating');
    expect(getTagValue(egg.tags, 'progression_started_at')).toBeDefined();
    const missions = missionsForSpec({ ...specFromOptions({ name: 'egg' }), progressionState: 'incubating' })!;
    expect(missions.map((m) => m.id)).toEqual(HATCH_MISSIONS.map((m) => m.id));
    expect(missionsForSpec(specFromOptions({ name: 'baby' }))).toBeUndefined();
  });
});

describe('presets from the model', () => {
  it('a critical value is under the kit\'s critical threshold for that stage and stat, and healthy is above every warning and the evolve threshold', () => {
    for (const stage of ['egg', 'baby', 'adult'] as BlobbiStage[]) {
      for (const stat of STAT_NAMES) {
        const threshold = (CRITICAL_THRESHOLDS[stage] as Partial<Record<keyof BlobbiStats, number>>)[stat];
        if (threshold === undefined) expect(criticalValue(stage, stat)).toBe(HEALTHY_VALUE);
        else expect(getStatStatus(stage, stat, criticalValue(stage, stat))).toBe('critical');
        expect(getStatStatus(stage, stat, HEALTHY_VALUE)).toBe('normal');
      }
    }
    expect(HEALTHY_VALUE).toBeGreaterThanOrEqual(EVOLVE_STAT_THRESHOLD);
    expect(statsForPreset('baby', 'hungry').hunger).toBe(criticalValue('baby', 'hunger'));
    expect(statsForPreset('baby', 'hungry').energy).toBe(HEALTHY_VALUE);
    expect(statsForPreset('baby', 'tired').energy).toBe(criticalValue('baby', 'energy'));
    expect(statsForPreset('adult', 'dirty').hygiene).toBe(criticalValue('adult', 'hygiene'));
    for (const stat of STAT_NAMES) expect(getStatStatus('adult', stat, statsForPreset('adult', 'critical')[stat])).toBe('critical');
  });

  it('every whole-Blobbi preset builds a modern event, and the ready ones are ready by the kit\'s own mission rule', () => {
    const base = specFromOptions({ name: 'baby' });
    for (const preset of FIXTURE_PRESETS) {
      const spec = preset.apply(base);
      expect(parseModernBlobbiEvent(buildFixtureBlobbi(spec)), preset.id).toBeDefined();
    }
    const ready = (id: string) => missionsComplete(FIXTURE_PRESETS.find((p) => p.id === id)!.apply(base));
    expect(ready('hatch-ready')).toBe(true);
    expect(ready('evolution-ready')).toBe(true);
    expect(ready('cracking-egg')).toBe(false);
    expect(ready('incubating-egg')).toBe(false);
    expect(ready('fresh-egg')).toBe(false);
  });
});

describe('the controller', () => {
  it('rewrites the world in place: a patch over the current spec, the same creature, a fresh event, and the listeners hear it', () => {
    const c = createFixtureController(request('?fixture=egg'));
    const heard: string[] = [];
    c.subscribe((change) => heard.push(change.kind));
    const seed = getTagValue(c.store.companion()!.event.tags, 'seed');
    const event = c.setSpec({ stats: { ...c.spec().stats, health: 12 } });
    expect(c.store.companion()!.stats.health).toBe(12);
    expect(c.store.companion()!.event.id).toBe(event.id);
    expect(getTagValue(event.tags, 'seed')).toBe(seed);
    c.setSpec((s) => ({ ...s, state: 'sleeping' })); // an egg: ignored by the builder
    expect(c.store.companion()!.state).toBe('active');
    c.applyPreset('sleeping-baby');
    expect(c.store.companion()!.stage).toBe('baby');
    expect(c.store.companion()!.state).toBe('sleeping');
    expect(c.applyPreset('no-such-preset')).toBeUndefined();
    expect(heard).toEqual(['blobbi', 'blobbi', 'blobbi']);
    // The world is still one Blobbi, one profile, one kind 0, three definitions, one inventory.
    expect(c.store.events().filter((e) => e.kind === KIND_BLOBBI_STATE)).toHaveLength(1);
    expect(c.store.events()).toHaveLength(7);
  });

  it('pins are scene settings, not world state; reset forgets pins, rewrites and the fixture\'s device storage, and nothing else on the device', () => {
    const c = createFixtureController(request('?fixture=baby&expression=sad'));
    expect(c.pins()).toEqual({ ...NO_PINS, expression: 'sad' });
    const before = c.store.companion()!.event.id;
    c.setPins({ facing: 'left', reducedMotion: true });
    expect(c.pins()).toEqual({ expression: 'sad', facing: 'left', reducedMotion: true });
    expect(c.store.companion()!.event.id).toBe(before);
    c.clearPins();
    expect(c.pins()).toEqual(NO_PINS);
    c.applyPreset('critical-adult');
    window.localStorage.setItem(`blobbi:selected:${PUBKEY}`, FIXTURE_D);
    window.localStorage.setItem('blobbi:home-appearance:v1', 'night');
    window.localStorage.setItem(`something:${'b'.repeat(64)}`, 'a real player');
    const heard: string[] = [];
    c.subscribe((change) => heard.push(change.kind));
    c.reset();
    expect(c.store.companion()!.stage).toBe('baby');
    expect(c.store.companion()!.stats.hunger).toBe(70);
    expect(c.pins()).toEqual({ ...NO_PINS, expression: 'sad' });
    expect(heard).toEqual(['pins', 'reset']);
    expect(window.localStorage.getItem(`blobbi:selected:${PUBKEY}`)).toBeNull();
    expect(window.localStorage.getItem('blobbi:home-appearance:v1')).toBe('night');
    expect(window.localStorage.getItem(`something:${'b'.repeat(64)}`)).toBe('a real player');
  });

  it('never opens a socket or fetches: the store is the whole transport, and a publish lands in it', async () => {
    const socket = vi.fn();
    vi.stubGlobal('WebSocket', socket);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const c = createFixtureController(request('?fixture=baby'));
      const companion = c.store.companion()!;
      await c.store.pool.event({ ...companion.event, id: 'n'.repeat(64), created_at: companion.event.created_at + 1, tags: companion.event.tags.map((t) => (t[0] === 'state' ? ['state', 'sleeping'] : t)) });
      expect(c.store.published()).toHaveLength(1);
      expect(c.store.companion()!.state).toBe('sleeping');
      expect(await c.store.pool.query([{ kinds: [KIND_BLOBBI_STATE], authors: [PUBKEY], '#d': [FIXTURE_D] }])).toHaveLength(1);
      expect(socket).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('the kit reads the fixture the way it reads a relay', () => {
  const wrap = (c: ReturnType<typeof createFixtureController>) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, createElement(NostrContext.Provider, { value: { nostr: c.store.pool } }, children));
  };

  it('a hatch-ready fixture is ready by the kit\'s hatch tasks; a cracking one is not; an evolution-ready one is ready by the evolve tasks', async () => {
    const c = createFixtureController(request('?fixture=egg'));
    c.applyPreset('hatch-ready');
    const hatch = renderHook(() => useHatchTasks(c.store.companion()!, PUBKEY), { wrapper: wrap(c) });
    await waitFor(() => expect(hatch.result.current.isLoading).toBe(false));
    expect(hatch.result.current.allCompleted).toBe(true);
    expect(hatch.result.current.tasks.map((t) => `${t.id}:${t.current}/${t.required}`)).toEqual(['create_theme:1/1', 'color_moment:1/1', 'interactions:7/7']);

    c.applyPreset('cracking-egg');
    const cracking = renderHook(() => useHatchTasks(c.store.companion()!, PUBKEY), { wrapper: wrap(c) });
    await waitFor(() => expect(cracking.result.current.isLoading).toBe(false));
    expect(cracking.result.current.allCompleted).toBe(false);
    expect(cracking.result.current.tasks.filter((t) => t.completed)).toHaveLength(2);

    c.applyPreset('evolution-ready');
    const evolve = renderHook(() => useEvolveTasks(c.store.companion()!, PUBKEY), { wrapper: wrap(c) });
    await waitFor(() => expect(evolve.result.current.isLoading).toBe(false));
    expect(evolve.result.current.allCompleted).toBe(true);
  });
});
