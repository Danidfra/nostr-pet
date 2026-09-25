import { describe, expect, it } from 'vitest';
import { BLOBBI_SOUNDS } from './sounds';
import { VOICE } from './blobbi-voice';
import { createVoiceEngine } from './voice-engine';
import { soundForCare, soundForPoke, soundForReveal } from './sound-policy';
import { fakeAudioContext } from '@/test/fake-audio';

describe('the voice recipes', () => {
  it('are short, quiet, made of the two building blocks, and every sound in the vocabulary has one', () => {
    for (const id of BLOBBI_SOUNDS) {
      const r = VOICE[id];
      expect(r.durationMs, id).toBeLessThanOrEqual(1_300);
      expect(r.master, id).toBeLessThanOrEqual(0.4);
      expect(r.lowpassHz, id).toBeLessThanOrEqual(2_400);
      expect(r.layers.length, id).toBeGreaterThan(0);
      for (const l of r.layers) {
        expect(['sine', 'triangle']).toContain(l.wave);
        expect(l.offsetMs + l.durationMs, `${id} layer inside the sound`).toBeLessThanOrEqual(r.durationMs);
        expect(l.gain).toBeLessThanOrEqual(0.14);
        for (const hz of l.hz) expect(hz).toBeGreaterThanOrEqual(200);
        for (const hz of l.hz) expect(hz).toBeLessThanOrEqual(1_200);
      }
    }
  });

  it('eat is Ditto’s munch: four chews of open pop, hum and close smack, each softer than the last', () => {
    const eat = VOICE.eat;
    expect(eat.layers).toHaveLength(12);
    expect(eat.durationMs).toBe(1_240);
    const opens = eat.layers.filter((l) => l.wave === 'sine' && l.hz[0] === 520);
    expect(opens.map((l) => l.offsetMs)).toEqual([0, 300, 600, 900]);
    expect(opens.map((l) => Number(l.gain.toFixed(4)))).toEqual([0.13, 0.091, 0.0676, 0.0494]);
    const hums = eat.layers.filter((l) => l.wave === 'triangle');
    expect(hums[0].hz).toEqual([740, 840, 680]);
    expect(eat.lowpassHz).toBe(1_900);
    expect(eat.master).toBe(0.38);
  });
});

describe('the voice engine', () => {
  it('creates the context lazily on the first play and never before, resumes it when suspended, and builds the munch graph', () => {
    let created = 0;
    const ctx = fakeAudioContext('suspended');
    const engine = createVoiceEngine(() => {
      created += 1;
      return ctx as unknown as AudioContext;
    });
    expect(created).toBe(0);
    expect(engine.hasContext()).toBe(false);
    engine.resume(); // nothing to resume yet: creates nothing
    expect(created).toBe(0);
    expect(engine.play(VOICE.poke)).toBe(true);
    expect(created).toBe(1);
    expect(ctx.resumes).toBe(1);
    engine.play(VOICE.eat);
    expect(created).toBe(1);
    // The munch: 12 oscillators, each with its gain; one lowpass, one delay, dry, wet, master.
    const oscs = ctx.nodes.filter((n) => n.kind === 'osc');
    expect(oscs.length).toBe(2 + 12);
    const eatOscs = oscs.slice(2);
    expect(eatOscs.map((o) => o.type).filter((t) => t === 'triangle')).toHaveLength(4);
    const first = eatOscs[0];
    expect(first.started).toBe(10);
    expect(first.stopped).toBeCloseTo(10.072, 5);
    expect(first.frequency!.events[0]).toEqual(['set', 520, 10]);
    expect(first.frequency!.events[1][0]).toBe('exp');
    expect(first.frequency!.events[1][1]).toBe(370);
    // Every oscillator feeds a gain, every gain the lowpass; the lowpass feeds dry and delay; master feeds the destination.
    const filter = ctx.nodes.find((n) => n.kind === 'filter' && n.frequency!.events[0][1] === 1_900)!;
    for (const o of eatOscs) {
      expect(o.connections).toHaveLength(1);
      expect(o.connections[0].kind).toBe('gain');
      expect(o.connections[0].connections[0]).toBe(filter);
    }
    expect(filter.connections.map((n) => n.kind).sort()).toEqual(['delay', 'gain']);
    const master = ctx.nodes.filter((n) => n.kind === 'gain' && n.connections.includes(ctx.destination)).at(-1)!;
    expect(master.gain!.events[0]).toEqual(['set', 0.38, 10]);
    // The last oscillator to stop cleans the graph up.
    const last = eatOscs.reduce((a, b) => ((b.stopped ?? 0) >= (a.stopped ?? 0) ? b : a));
    expect(typeof last.onended).toBe('function');
    last.onended!();
    expect(filter.disconnected).toBe(true);
  });

  it('never throws: no Web Audio means no sound, a broken node means no sound', () => {
    expect(createVoiceEngine(() => null).play(VOICE.happy)).toBe(false);
    expect(
      createVoiceEngine(() => {
        throw new Error('no audio here');
      }).play(VOICE.happy),
    ).toBe(false);
    const broken = fakeAudioContext();
    broken.createOscillator = () => {
      throw new Error('boom');
    };
    expect(createVoiceEngine(() => broken as unknown as AudioContext).play(VOICE.happy)).toBe(false);
  });
});

describe('the sound policy', () => {
  it('maps gameplay moments to the vocabulary and nothing else', () => {
    expect(soundForCare('feed', 'active')).toBe('eat');
    expect(soundForCare('clean', 'active')).toBe('clean');
    expect(soundForCare('play', 'active')).toBe('excited');
    expect(soundForCare('boost', 'active')).toBe('excited');
    expect(soundForCare('medicine', 'active')).toBe('happy');
    expect(soundForCare('rest', 'sleeping')).toBe('sleepy');
    expect(soundForCare('rest', 'active')).toBe('happy');
    expect(soundForPoke('glad')).toBe('poke');
    expect(soundForPoke('egg')).toBe('poke');
    expect(soundForPoke('asleep')).toBe('sleepy');
    expect(soundForPoke('sleepy')).toBe('sleepy');
    expect(soundForPoke('grumpy')).toBe('upset');
    expect(soundForPoke('annoyed')).toBe('upset');
    expect(soundForReveal('hatch')).toBe('hatch');
    expect(soundForReveal('evolve')).toBe('evolve');
  });
});
