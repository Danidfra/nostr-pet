/**
 * The last line: an error thrown while rendering anywhere outside the room
 * (the welcome, the sign-in, the classic home) no longer leaves a white page.
 * It shows a small card in the app's own words with Reload, and keeps the
 * message for anyone who copies it. Nothing about the player (no key, no
 * login) is shown or sent; the error is reported to the console, as React
 * would, and nowhere else.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Blobbi] the page hit an error', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="app-crash" role="alert" data-testid="app-crash">
        <div className="welcome-card app-crash__card">
          <img src="/blobbilogo.svg" alt="Blobbi" className="welcome-card__logo" width={120} height={40} />
          <h1 className="welcome-card__title">Oops, something tripped</h1>
          <p className="welcome-card__lead">Your Blobbi is fine: nothing was changed. Reloading the page usually helps.</p>
          <button type="button" className="onboard-btn onboard-btn--primary" onClick={() => window.location.reload()} data-testid="app-crash-reload">
            Reload
          </button>
          <details className="welcome-card__more">
            <summary>Details</summary>
            <p className="break-words font-mono text-xs" data-testid="app-crash-message">
              {error.message || String(error)}
            </p>
          </details>
        </div>
      </div>
    );
  }
}
