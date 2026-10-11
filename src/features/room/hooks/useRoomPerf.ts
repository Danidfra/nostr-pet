/**
 * Development only: how hard the room is working, measured where it runs
 * (a real phone included), never sent anywhere. The hook, apart from any
 * panel, so a recording started from the dev tools runs on while they are
 * closed and the report is still there when they open again.
 *
 * Measured (this page, now):
 *   - display frames: the browser's own animation frames, sampled here,
 *     whatever is or is not drawn: frames per second, frame-time average,
 *     50th/95th/99th percentiles, spikes (over 50 ms) and the worst;
 *   - room frames: how many frames the 3D room actually drew per second,
 *     and how many of those were idle life only (drawn at the quality's
 *     gentler idle rate on purpose), with each frame's main-thread cost;
 *   - what the GPU was asked to draw and holds (draw calls, triangles,
 *     geometries, textures, shader programs).
 * Reported by the browser (coarse, or estimates): device memory, the JS heap
 * (Chrome only), the GPU's name.
 *
 * A hidden or throttled tab draws few or no frames: the numbers are marked
 * as not representative instead of shown as if they were. "Record 10 s"
 * gathers a short report; where the clipboard is withheld (Safari, or any
 * browser on a plain-HTTP LAN address) the report stays on screen to be
 * selected by hand.
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { RoomControl } from '../components/RoomShell';
import type { QualityLevel, QualityPreference } from '../lib/room-quality';
import { summarizeFrames, throttled } from '../lib/frame-stats';

export interface PerfQuality {
  preference: QualityPreference;
  level: QualityLevel;
  reason: string;
}

export interface UseRoomPerfOptions {
  controlRef: MutableRefObject<RoomControl | null>;
  quality: PerfQuality;
  /** What draws the Blobbi now. */
  mode: string;
  /** Whether anyone is looking: the live numbers re-render twice a second only then (a recording keeps it on). */
  active: boolean;
}

/** How long a recording lasts. */
export const RECORDING_MS = 10_000;
/** How often the live numbers refresh. */
const TICK_MS = 500;

interface RecordWindow {
  intervals: number[];
  roomFrames: number;
  idleFrames: number;
  at: number;
}

export interface RoomPerf {
  display: ReturnType<typeof summarizeFrames>;
  room: { fps: number; idleShare: number };
  stats: ReturnType<RoomControl['stats']>;
  memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } | undefined;
  deviceMemory: number | undefined;
  notRepresentative: boolean;
  recording: boolean;
  /** Whole seconds left of a recording, 0 otherwise. */
  recordingLeft: number;
  report: string | null;
  copied: string | null;
  record: () => void;
  copy: () => void;
  selectAll: () => void;
  reportRef: MutableRefObject<HTMLTextAreaElement | null>;
}

export function useRoomPerf({ controlRef, quality, mode, active }: UseRoomPerfOptions): RoomPerf {
  const intervals = useRef<number[]>([]);
  const [tick, setTick] = useState(0);
  const lastStats = useRef<{ frames: number; idle: number } | null>(null);
  const [recording, setRecording] = useState<{ until: number; window: RecordWindow } | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const reportRef = useRef<HTMLTextAreaElement | null>(null);
  const live = active || recording !== null;

  // The display's own frames, sampled whenever the hook lives (cheap: one number per frame)
  useEffect(() => {
    let last = 0;
    let id = 0;
    const loop = (t: number) => {
      if (last) {
        intervals.current.push(t - last);
        if (intervals.current.length > 240) intervals.current.shift();
      }
      last = t;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
  // The numbers refresh only while someone looks, or a recording runs
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(timer);
  }, [live]);

  const stats = controlRef.current?.stats() ?? null;
  // Room frames per tick, accumulated into the recording too
  const roomRate = useRef({ fps: 0, idleShare: 0 });
  useEffect(() => {
    if (!stats) return;
    const prev = lastStats.current;
    lastStats.current = { frames: stats.frames, idle: stats.idleFrames };
    if (!prev) return;
    const frames = stats.frames - prev.frames;
    roomRate.current = { fps: (frames * 1000) / TICK_MS, idleShare: frames > 0 ? (stats.idleFrames - prev.idle) / frames : 0 };
    if (recording) {
      recording.window.roomFrames += frames;
      recording.window.idleFrames += stats.idleFrames - prev.idle;
      recording.window.intervals.push(...intervals.current.slice(-30));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const display = summarizeFrames(intervals.current);
  const notRepresentative = throttled(document.hidden, display.p50Ms);

  const buildReport = useCallback(
    (w: RecordWindow | null) => {
      const s = controlRef.current?.stats() ?? null;
      const frames = summarizeFrames(w ? w.intervals : intervals.current);
      const seconds = w ? (performance.now() - w.at) / 1000 : 0;
      const lines = [
        `Blobbi room performance (${new Date().toISOString()})`,
        `device: ${navigator.userAgent}`,
        `screen: ${screen.width}x${screen.height} @${window.devicePixelRatio}x, viewport ${innerWidth}x${innerHeight}`,
        `cores: ${navigator.hardwareConcurrency ?? '?'}, device memory: ${deviceMemory ?? '?'} GB (browser-reported, coarse)`,
        `gpu: ${controlRef.current?.gpu?.() ?? 'not reported'}`,
        `mode: ${mode}, quality: ${quality.level} (${quality.preference === 'auto' ? `auto, ${quality.reason}` : 'chosen'})`,
        s ? `renderer: pixel ratio ${s.pixelRatio}, canvas ${s.canvas[0]}x${s.canvas[1]}, ${s.calls} draw calls, ${s.triangles} triangles, ${s.geometries} geometries, ${s.textures} textures, ${s.programs} programs` : 'renderer: none (the simple room)',
        `display frames (measured${w ? `, ${seconds.toFixed(1)} s` : ', last ~4 s'}): ${frames.fps.toFixed(1)} fps, avg ${frames.avgMs.toFixed(1)} ms, p50 ${frames.p50Ms.toFixed(1)} / p95 ${frames.p95Ms.toFixed(1)} / p99 ${frames.p99Ms.toFixed(1)} ms, ${frames.spikes} spikes > 50 ms, worst ${frames.worstMs.toFixed(0)} ms`,
        w ? `room frames (measured): ${(w.roomFrames / Math.max(seconds, 0.001)).toFixed(1)} per second, ${w.roomFrames ? Math.round((100 * w.idleFrames) / w.roomFrames) : 0}% idle-only` : '',
        s ? `room frame main-thread cost (measured): avg ${s.cpuAvgMs.toFixed(2)} ms, p95 ${s.cpuP95Ms.toFixed(2)} ms` : '',
        memory ? `JS heap (Chrome-reported): ${(memory.usedJSHeapSize / 1048576).toFixed(0)} of ${(memory.jsHeapSizeLimit / 1048576).toFixed(0)} MB` : 'JS heap: not reported by this browser',
        throttled(document.hidden, frames.p50Ms) ? 'NOTE: the tab was hidden or throttled; these numbers are not representative.' : '',
      ].filter(Boolean);
      return lines.join('\n');
    },
    [controlRef, deviceMemory, memory, mode, quality],
  );

  // A recording ends by itself, whether or not anything shows it
  useEffect(() => {
    if (!recording) return;
    const timer = setTimeout(() => {
      setReport(buildReport(recording.window));
      setRecording(null);
    }, Math.max(0, recording.until - performance.now()));
    return () => clearTimeout(timer);
  }, [recording, buildReport]);

  const record = useCallback(() => {
    setReport(null);
    setCopied(null);
    setRecording({ until: performance.now() + RECORDING_MS, window: { intervals: [], roomFrames: 0, idleFrames: 0, at: performance.now() } });
  }, []);

  const copy = useCallback(async () => {
    const text = report ?? buildReport(null);
    setReport(text);
    try {
      if (!navigator.clipboard) throw new Error('no clipboard here');
      await navigator.clipboard.writeText(text);
      setCopied('copied');
    } catch {
      setCopied('clipboard unavailable: select the text below and copy it');
    }
  }, [report, buildReport]);

  // iOS Safari ignores select() on a read-only box; a range works
  const selectAll = useCallback(() => {
    const el = reportRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, el.value.length);
  }, []);

  return {
    display,
    room: roomRate.current,
    stats,
    memory,
    deviceMemory,
    notRepresentative,
    recording: recording !== null,
    recordingLeft: recording ? Math.max(0, Math.ceil((recording.until - performance.now()) / 1000)) : 0,
    report,
    copied,
    record,
    copy: () => void copy(),
    selectAll,
    reportRef,
  };
}
