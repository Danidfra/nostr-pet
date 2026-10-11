/**
 * Development only: how hard the room is working, while you play in it.
 * Twice a second: frames drawn per second (and how many of them were only
 * idle life, drawn at the gentler idle rate), each frame's main-thread cost
 * (average and 95th percentile over the last few seconds), what the GPU was
 * asked to draw (draw calls, triangles), what it holds (geometries, textures,
 * shader programs: a number that keeps climbing as you change rooms is a
 * leak), and the page's JavaScript heap where the browser tells it. A hidden
 * tab draws nothing; the overlay says so rather than showing a stale number.
 */
import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { RoomControl } from './RoomShell';

interface Reading {
  fps: number;
  idleShare: number;
  cpuAvgMs: number;
  cpuP95Ms: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  heapMb: number | null;
  hidden: boolean;
}

export function RoomPerfOverlay({ controlRef }: { controlRef: MutableRefObject<RoomControl | null> }) {
  const [reading, setReading] = useState<Reading | null>(null);
  const last = useRef<{ frames: number; idle: number; at: number } | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      const stats = controlRef.current?.stats();
      if (!stats) return;
      const now = performance.now();
      const prev = last.current;
      last.current = { frames: stats.frames, idle: stats.idleFrames, at: now };
      if (!prev) return;
      const seconds = (now - prev.at) / 1000;
      const frames = stats.frames - prev.frames;
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      setReading({
        fps: frames / seconds,
        idleShare: frames > 0 ? (stats.idleFrames - prev.idle) / frames : 0,
        cpuAvgMs: stats.cpuAvgMs,
        cpuP95Ms: stats.cpuP95Ms,
        calls: stats.calls,
        triangles: stats.triangles,
        geometries: stats.geometries,
        textures: stats.textures,
        programs: stats.programs,
        heapMb: memory ? memory.usedJSHeapSize / 1048576 : null,
        hidden: document.hidden,
      });
    }, 500);
    return () => clearInterval(timer);
  }, [controlRef]);
  if (!reading) return <div className="room-perf" data-testid="room-perf">measuring…</div>;
  return (
    <div className="room-perf" data-testid="room-perf">
      {reading.hidden ? (
        <div>tab hidden: nothing drawn</div>
      ) : (
        <div>
          {reading.fps.toFixed(0)} fps · {(reading.idleShare * 100).toFixed(0)}% idle-only
        </div>
      )}
      <div>
        frame {reading.cpuAvgMs.toFixed(2)} ms · p95 {reading.cpuP95Ms.toFixed(2)} ms
      </div>
      <div>
        {reading.calls} calls · {(reading.triangles / 1000).toFixed(1)}k tris
      </div>
      <div>
        {reading.geometries} geo · {reading.textures} tex · {reading.programs} prog
      </div>
      {reading.heapMb !== null && <div>heap {reading.heapMb.toFixed(0)} MB</div>}
    </div>
  );
}
