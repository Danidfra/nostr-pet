/**
 * How much the 3D room spends drawing itself: three levels and how one is chosen.
 *
 *   high      the room as designed: pixel ratio up to 1.5, soft shadows from
 *             the key light, every lamp lit, every journey mote, idle life at
 *             30 frames a second
 *   balanced  a little less of everything that costs the GPU per pixel: pixel
 *             ratio up to 1.25, plain-filtered and smaller shadows, two lamps
 *             lit, fewer motes, idle life at 24 frames a second
 *   low       for older and budget phones: pixel ratio 1, no cast shadows
 *             (the soft contact shadow under the Blobbi still grounds it), one
 *             lamp lit, fewer motes still, idle life at 15 frames a second
 *
 * What never changes with quality: the Blobbi itself (its geometry, its face
 * and expressions, its eyes, its animations), the furniture, the room's
 * geometry, any interaction. Quality is only how it is drawn.
 *
 * Choosing (`auto`):
 *   - a first guess from what the browser says about the device
 *     (`initialQuality`): deliberately conservative when it looks
 *     constrained (little memory, few cores, a GPU known to be slow, data
 *     saving, a very high pixel count), high otherwise; never "all phones
 *     are slow";
 *   - then what the room actually measures (`QualityMonitor`): only
 *     sustained slowness while something is moving lowers it, one step at a
 *     time, never more often than `COOLDOWN_MS`, and it never raises itself
 *     (no back-and-forth over a passing hiccup).
 * A choice the player makes (`high`, `balanced`, `low`) is kept as it is on
 * this device (`blobbi:room:quality`) and is never overridden.
 */

export type QualityLevel = 'high' | 'balanced' | 'low';
export type QualityPreference = 'auto' | QualityLevel;

export const QUALITY_LEVELS: readonly QualityLevel[] = ['high', 'balanced', 'low'];
export const QUALITY_STORAGE_KEY = 'blobbi:room:quality';

export interface QualitySettings {
  level: QualityLevel;
  /** The renderer's pixel ratio is the device's, up to this. */
  maxPixelRatio: number;
  /** The key light's shadow: soft, plain, or none (the contact shadows remain). */
  shadows: 'soft' | 'plain' | 'off';
  shadowMapSize: number;
  /** Lamps whose light is drawn at once (their bulbs glow either way). */
  lamps: number;
  /** Share of a journey's motes drawn (1 all). */
  moteDensity: number;
  /** Idle life (breathing, blinking) is drawn this many times a second. */
  idleFps: number;
}

export const QUALITY: Readonly<Record<QualityLevel, QualitySettings>> = {
  high: { level: 'high', maxPixelRatio: 1.5, shadows: 'soft', shadowMapSize: 1024, lamps: 3, moteDensity: 1, idleFps: 30 },
  balanced: { level: 'balanced', maxPixelRatio: 1.25, shadows: 'plain', shadowMapSize: 512, lamps: 2, moteDensity: 0.7, idleFps: 24 },
  low: { level: 'low', maxPixelRatio: 1, shadows: 'off', shadowMapSize: 512, lamps: 1, moteDensity: 0.45, idleFps: 15 },
};

/** One level lower, or the same at the bottom. */
export function lowerQuality(level: QualityLevel): QualityLevel {
  return level === 'high' ? 'balanced' : 'low';
}

export function parseQualityPreference(value: unknown): QualityPreference {
  return value === 'high' || value === 'balanced' || value === 'low' || value === 'auto' ? value : 'auto';
}

/** What the browser tells about the device: all optional, since most browsers tell only some of it. */
export interface DeviceSignals {
  /** `navigator.deviceMemory` (GB, coarse; Chrome-based browsers only). */
  memoryGb?: number;
  /** `navigator.hardwareConcurrency`. */
  cores?: number;
  /** `navigator.connection.saveData`. */
  saveData?: boolean;
  /** Device pixels of the screen (`screen.width × screen.height × devicePixelRatio²`). */
  screenPixels?: number;
  /** The GPU's name, when the browser gives it (`WEBGL_debug_renderer_info`). */
  gpu?: string;
}

/** GPUs that are known to struggle with a lit, shadowed scene at phone resolutions. */
const SLOW_GPU = /(mali-(4|t6|t7|g31|g51|g52)\d*|adreno \(tm\) (3|4|50)\d\d|adreno (3|4|50)\d\d|powervr (sgx|rogue g6|ge8)|apple a(8|9|10)\b|intel.*hd graphics (2|3|4)\d{3}|swiftshader|llvmpipe|software)/i;
/** GPUs that cope, but not with everything at a high pixel ratio. */
const MODEST_GPU = /(mali-g(57|68|71|72|76)|adreno \(tm\) (5[1-9]\d|6[0-1]\d)|adreno (5[1-9]\d|6[0-1]\d)|apple a(11|12)\b|intel.*(hd|uhd) graphics)/i;

/**
 * The first guess. Each signal can only lower it, and each by its own
 * measure: one constrained signal is "balanced", a clearly weak device
 * "low". Nothing known: high (the monitor still watches).
 */
export function initialQuality(signals: DeviceSignals): QualityLevel {
  let level: QualityLevel = 'high';
  const lower = (to: QualityLevel) => {
    if (QUALITY_LEVELS.indexOf(to) > QUALITY_LEVELS.indexOf(level)) level = to;
  };
  if (signals.saveData) lower('low');
  if (signals.memoryGb !== undefined) {
    if (signals.memoryGb <= 2) lower('low');
    else if (signals.memoryGb <= 4) lower('balanced');
  }
  if (signals.cores !== undefined && signals.cores <= 4) lower('balanced');
  if (signals.cores !== undefined && signals.cores <= 2) lower('low');
  if (signals.gpu) {
    if (SLOW_GPU.test(signals.gpu)) lower('low');
    else if (MODEST_GPU.test(signals.gpu)) lower('balanced');
  }
  // A very dense screen costs per pixel whatever the GPU (the pixel ratio caps help, but not all of it)
  if (signals.screenPixels !== undefined && signals.screenPixels > 9_000_000) lower('balanced');
  return level;
}

/** Read the device's signals, where the browser offers them. */
export function readDeviceSignals(gpu?: string): DeviceSignals {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const screenPixels = typeof screen !== 'undefined' ? screen.width * screen.height * dpr * dpr : undefined;
  return {
    memoryGb: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined,
    cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined,
    saveData: nav.connection?.saveData === true,
    screenPixels,
    gpu,
  };
}

/** A sustained-slowness detector over the room's real frame intervals. */
export interface QualityMonitor {
  /**
   * One drawn frame: how long since the last (ms), and whether anything was moving (idle frames are drawn at
   * a capped rate on purpose and say nothing about the device). Returns true when quality should go down a step.
   */
  frame(intervalMs: number, busy: boolean, now: number): boolean;
  reset(now: number): void;
}

/** Busy frames looked at before deciding, at most this far back. */
export const MONITOR_WINDOW_MS = 4000;
/** At least this many busy frames in the window before anything is decided. */
export const MONITOR_MIN_FRAMES = 60;
/** Slow: half the window's frames longer than this (under ~36 fps)… */
export const SLOW_MEDIAN_MS = 28;
/** …and a quarter of them longer than this (under ~25 fps). */
export const SLOW_P75_MS = 40;
/** After a step down, the room is given this long to settle before another. */
export const COOLDOWN_MS = 15_000;

export function createQualityMonitor(now = 0): QualityMonitor {
  let samples: { at: number; ms: number }[] = [];
  let quietUntil = now + COOLDOWN_MS / 3;
  return {
    frame(intervalMs, busy, at) {
      // A frame after a pause (a hidden tab, an idle stretch) is not a slow frame
      if (!busy || intervalMs > 250) return false;
      samples.push({ at, ms: intervalMs });
      while (samples.length && samples[0].at < at - MONITOR_WINDOW_MS) samples.shift();
      if (at < quietUntil || samples.length < MONITOR_MIN_FRAMES) return false;
      const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length * 0.5)];
      const p75 = sorted[Math.floor(sorted.length * 0.75)];
      if (median > SLOW_MEDIAN_MS && p75 > SLOW_P75_MS) {
        samples = [];
        quietUntil = at + COOLDOWN_MS;
        return true;
      }
      return false;
    },
    reset(at) {
      samples = [];
      quietUntil = at + COOLDOWN_MS / 3;
    },
  };
}
