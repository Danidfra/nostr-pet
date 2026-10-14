/**
 * A render error inside the room stays inside the room. Without a boundary
 * React unmounts the whole tree on an error thrown while rendering or in a
 * layout/effect commit: the page goes white, with nothing to read and
 * nothing to tap. Here the room (and only the room) is replaced by a card
 * that names the error, keeps the fixture and the URL, and offers to try
 * again or to try again drawn in 2D (the 3D model is the heavier path).
 * The error is also reported the way React reports it (console) and kept
 * for the dev tools' error list, so a phone can show and copy it. Nothing
 * is swallowed: an error that is not a render error (a handler, a frame) is
 * not caught here at all.
 *
 * The way out never leads back in (M14.3.1): "Go to the 2D home" makes the
 * 2D home this device's home and goes there as the room's own switch does,
 * so a device that opens on the room is not sent straight back to it. The
 * Blobbi, the account (guest or not) and the care live above this boundary
 * and are untouched. Retrying is offered twice; a room that keeps failing
 * leaves only the way out, so nothing loops.
 */
/* eslint-disable react-refresh/only-export-components -- the boundary and what it shows share one file; hot reload remounts it whole */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { writeExperience, type FromRoomState } from '@/lib/home-experience';
import { useBlobbiAppearance } from '../lib/blobbi-appearance';
import { pageDiagnostics, recordRuntimeError } from '../lib/runtime-errors';

interface Props {
  children: ReactNode;
}

/** Retries offered before only the way out is left. */
export const MAX_ROOM_RETRIES = 2;

interface State {
  error: Error | null;
  componentStack: string | null;
  attempt: number;
}

export class RoomErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    recordRuntimeError('render', error, `${error.stack ?? ''}${info.componentStack ? `\n\ncomponent stack:${info.componentStack}` : ''}`);
  }

  private retry = () => {
    this.setState((s) => ({ error: null, componentStack: null, attempt: s.attempt + 1 }));
  };

  render() {
    if (this.state.error) {
      return <RoomCrash error={this.state.error} componentStack={this.state.componentStack} onRetry={this.state.attempt < MAX_ROOM_RETRIES ? this.retry : null} />;
    }
    // A new key after a retry mounts the room afresh instead of resuming a broken tree
    return <RoomSlot key={this.state.attempt}>{this.props.children}</RoomSlot>;
  }
}

function RoomSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

interface CrashProps {
  error: Error;
  componentStack: string | null;
  /** Null once the retries are spent. */
  onRetry: (() => void) | null;
}

const BACK_HOME: FromRoomState = { fromRoom: true };

/** What stands in the room's place: the cause, a way back, and the 2D drawing as the lighter retry. */
function RoomCrash({ error, componentStack, onRetry }: CrashProps) {
  const [appearance, setAppearance] = useBlobbiAppearance();
  const navigate = useNavigate();
  const toClassic = () => {
    writeExperience('classic');
    navigate('/', { state: BACK_HOME });
  };
  const details = `${error.name}: ${error.message}\n${error.stack ?? ''}${componentStack ? `\n\ncomponent stack:${componentStack}` : ''}\n\n${pageDiagnostics()}`;
  const selectAll = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.focus();
    el.setSelectionRange(0, el.value.length);
  };
  return (
    <div className="room-crash" role="alert" data-testid="room-crash">
      <h2 className="text-lg font-semibold">The room hit an error</h2>
      <p className="text-sm text-foreground/80">
        {error.message || String(error)}
        <br />
        Your Blobbi and this page are unchanged; the room was taken down so the rest could stay up.
      </p>
      <div className="room-crash__actions">
        <button type="button" className="onboard-btn onboard-btn--primary !w-auto !px-4 !py-2 text-sm" onClick={toClassic} data-testid="room-crash-classic">
          Go to the 2D home
        </button>
        {onRetry && (
          <button type="button" className="onboard-btn onboard-btn--secondary !w-auto !px-4 !py-2 text-sm" onClick={onRetry} data-testid="room-crash-retry">
            Try again
          </button>
        )}
        {onRetry && appearance === '3d' && (
          <button
            type="button"
            className="onboard-btn onboard-btn--secondary !w-auto !px-4 !py-2 text-sm"
            onClick={() => {
              setAppearance('2d');
              onRetry();
            }}
            data-testid="room-crash-2d"
          >
            Try again with Classic
          </button>
        )}
      </div>
      {!onRetry && (
        <p className="text-sm text-foreground/80" data-testid="room-crash-spent">
          The room keeps failing on this device. Your Blobbi is waiting in the 2D home.
        </p>
      )}
      {import.meta.env.DEV && (
        <details className="room-crash__details" open>
          <summary className="text-xs">Details (tap the box to select all, then copy)</summary>
          <textarea className="room-crash__report" readOnly rows={8} value={details} onFocus={(e) => selectAll(e.currentTarget)} data-testid="room-crash-report" />
        </details>
      )}
    </div>
  );
}
