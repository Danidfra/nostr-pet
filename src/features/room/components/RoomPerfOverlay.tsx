/**
 * Development only: the performance numbers on screen (`useRoomPerf`
 * measures them). Two views: the full panel, inside the dev tools'
 * Performance view (live numbers, Record 10 s, Copy report, Select all for
 * a phone whose clipboard is withheld, the report itself), and a small
 * indicator that stays in a corner while the tools are closed (frames per
 * second, a recording's countdown) and never covers the room's controls.
 */
import type { RoomPerf } from '../hooks/useRoomPerf';

interface PanelProps {
  perf: RoomPerf;
  quality: { preference: string; level: string; reason: string };
  /** What draws the Blobbi now. */
  mode: string;
}

export function RoomPerfPanel({ perf, quality, mode }: PanelProps) {
  const { display, room, stats, memory, deviceMemory, notRepresentative } = perf;
  return (
    <div className="devtools__perf" data-testid="room-perf" data-representative={notRepresentative ? 'false' : 'true'}>
      {notRepresentative ? (
        <div className="devtools__warn">tab hidden or throttled: not representative</div>
      ) : (
        <div>
          {display.fps.toFixed(0)} fps · avg {display.avgMs.toFixed(1)} · p95 {display.p95Ms.toFixed(1)} · p99 {display.p99Ms.toFixed(1)} ms · {display.spikes} spikes
        </div>
      )}
      <div>
        room {room.fps.toFixed(0)}/s ({Math.round(room.idleShare * 100)}% idle) · cost {stats ? `${stats.cpuAvgMs.toFixed(2)}/${stats.cpuP95Ms.toFixed(2)}` : '–'} ms
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
      <div className="devtools__row">
        <button type="button" disabled={perf.recording} onClick={perf.record} data-testid="room-perf-record">
          {perf.recording ? `recording… ${perf.recordingLeft} s` : 'Record 10 s'}
        </button>
        <button type="button" onClick={perf.copy} data-testid="room-perf-copy">
          Copy report
        </button>
        {perf.report && (
          <button type="button" onClick={perf.selectAll} data-testid="room-perf-select">
            Select all
          </button>
        )}
      </div>
      {perf.copied && <div data-testid="room-perf-copied">{perf.copied}</div>}
      {perf.report && <textarea ref={perf.reportRef} className="devtools__report" readOnly value={perf.report} rows={8} data-testid="room-perf-report" onFocus={perf.selectAll} />}
    </div>
  );
}

/** The corner indicator: small, out of the way of every control, tappable to open the tools. */
export function RoomPerfPill({ perf, onOpen }: { perf: RoomPerf; onOpen: () => void }) {
  const text = perf.recording ? `rec ${perf.recordingLeft} s` : perf.notRepresentative ? '– fps' : `${perf.display.fps.toFixed(0)} fps`;
  return (
    <button type="button" className="devtools__fps" onClick={onOpen} data-testid="room-perf-pill" data-recording={perf.recording ? 'true' : 'false'} aria-label={`Performance: ${text}. Open the dev tools`}>
      {text}
    </button>
  );
}
