/**
 * Development only: how hard the room is working, measured where it runs
 * (a real phone included), never sent anywhere.
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
 * A hidden or throttled tab draws few or no frames: the overlay says the
 * numbers are not representative instead of showing them as if they were.
 * "Record 10 s" gathers a short report (and copies it), for a phone where
 * there is no console to read. Where the clipboard is withheld (Safari, or
 * any browser on a plain-HTTP LAN address, where `navigator.clipboard` does
 * not exist) the report stays on screen in a text box, and "Select all"
 * selects it for the long-press copy.
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { RoomControl } from './RoomShell';
import type { QualityLevel, QualityPreference } from '../lib/room-quality';
import { summarizeFrames, throttled } from '../lib/frame-stats';

interface Props {
  controlRef: MutableRefObject<RoomControl | null>;
  quality: { preference: QualityPreference; level: QualityLevel; reason: string };
  /** What draws the Blobbi now. */
  mode: string;
}

interface Window {
  intervals: number[];
  roomFrames: number;
  idleFrames: number;
  at: number;
}

export function RoomPerfOverlay({ controlRef, quality, mode }: Props) {
  const intervals = useRef<number[]>([]);
  const [tick, setTick] = useState(0);
  const lastStats = useRef<{ frames: number; idle: number } | null>(null);
  const [recording, setRecording] = useState<{ until: number; window: Window } | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const reportRef = useRef<HTMLTextAreaElement | null>(null);

  // The display's own frames, sampled here
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
    const timer = setInterval(() => setTick((n) => n + 1), 500);
    return () => {
      cancelAnimationFrame(id);
      clearInterval(timer);
    };
  }, []);

  const stats = controlRef.current?.stats() ?? null;
  // Room frames per half second, accumulated into the recording too
  const roomRate = useRef({ fps: 0, idleShare: 0 });
  useEffect(() => {
    if (!stats) return;
    const prev = lastStats.current;
    lastStats.current = { frames: stats.frames, idle: stats.idleFrames };
    if (!prev) return;
    const frames = stats.frames - prev.frames;
    roomRate.current = { fps: frames * 2, idleShare: frames > 0 ? (stats.idleFrames - prev.idle) / frames : 0 };
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
    (w: Window | null) => {
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

  // A recording ends by itself
  useEffect(() => {
    if (!recording) return;
    const timer = setTimeout(() => {
      setReport(buildReport(recording.window));
      setRecording(null);
    }, Math.max(0, recording.until - performance.now()));
    return () => clearTimeout(timer);
  }, [recording, buildReport]);

  const copy = useCallback(async (text: string) => {
    try {
      if (!navigator.clipboard) throw new Error('no clipboard here');
      await navigator.clipboard.writeText(text);
      setCopied('copied');
    } catch {
      setCopied('clipboard unavailable: select the text below and copy it');
    }
  }, []);
  // iOS Safari ignores select() on a read-only box; a range works
  const selectAll = useCallback(() => {
    const el = reportRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, el.value.length);
  }, []);

  return (
    <div className="room-perf" data-testid="room-perf" data-representative={notRepresentative ? 'false' : 'true'}>
      {notRepresentative ? (
        <div className="room-perf__warn">tab hidden or throttled: not representative</div>
      ) : (
        <div>
          {display.fps.toFixed(0)} fps · avg {display.avgMs.toFixed(1)} · p95 {display.p95Ms.toFixed(1)} · p99 {display.p99Ms.toFixed(1)} ms · {display.spikes} spikes
        </div>
      )}
      <div>
        room {roomRate.current.fps.toFixed(0)}/s ({Math.round(roomRate.current.idleShare * 100)}% idle) · cost {stats ? `${stats.cpuAvgMs.toFixed(2)}/${stats.cpuP95Ms.toFixed(2)}` : '–'} ms
      </div>
      <div>
        {mode} · {quality.level}
        {quality.preference === 'auto' ? ` (auto, ${quality.reason})` : ''} · dpr {window.devicePixelRatio}
        {stats ? ` → ${stats.pixelRatio}` : ''}
      </div>
      {stats && (
        <div>
          {stats.calls} calls · {(stats.triangles / 1000).toFixed(1)}k tris · {stats.geometries} geo · {stats.textures} tex · {stats.programs} prog
        </div>
      )}
      <div>
        {memory ? `heap ${(memory.usedJSHeapSize / 1048576).toFixed(0)} MB` : 'heap n/a'}
        {deviceMemory !== undefined ? ` · device ~${deviceMemory} GB` : ''}
      </div>
      <div className="room-perf__actions">
        <button type="button" disabled={!!recording} onClick={() => { setReport(null); setCopied(null); setRecording({ until: performance.now() + 10_000, window: { intervals: [], roomFrames: 0, idleFrames: 0, at: performance.now() } }); }} data-testid="room-perf-record">
          {recording ? 'recording…' : 'Record 10 s'}
        </button>
        <button type="button" onClick={() => { const r = report ?? buildReport(null); setReport(r); void copy(r); }} data-testid="room-perf-copy">
          Copy report
        </button>
        {report && (
          <button type="button" onClick={selectAll} data-testid="room-perf-select">
            Select all
          </button>
        )}
      </div>
      {copied && <div data-testid="room-perf-copied">{copied}</div>}
      {report && <textarea ref={reportRef} className="room-perf__report" readOnly value={report} rows={8} data-testid="room-perf-report" onFocus={selectAll} />}
    </div>
  );
}
