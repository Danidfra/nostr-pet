/**
 * The little world a visitor walks into (M12.2): a warm sky with a soft sun,
 * drifting clouds and a few sparkles over a meadow, the same from the first
 * screen to the egg, so the way in is one place rather than a series of
 * forms. Used while nobody is signed in and while a signed-in player has no
 * Blobbi yet.
 *
 * Two ways to stand in it:
 *   - the welcome (`WelcomeScreen`) fills it: a scene, built around the
 *     viewport, that never scrolls on a phone;
 *   - every later step stands in a `StagePanel`: a small Blobbi guide who
 *     says one line about the step, over a panel that may scroll inside
 *     itself (a key backup has a lot to say), never the page.
 *
 * Light by design: the world is CSS (gradients and a few shapes), no images
 * beyond the logo, no animation library; everything that drifts stops under
 * reduced motion.
 */
import type { ReactNode } from 'react';
import { WelcomeHero } from './WelcomeHero';
import { welcomeCast } from './welcome-cast';

export function WelcomeStage({ children }: { children: ReactNode }) {
  return (
    <div className="welcome" data-testid="welcome-stage">
      <WelcomeWorld />
      <div className="welcome__content">{children}</div>
    </div>
  );
}

/** The sky, the sun, the clouds, the meadow: decoration only, never in the way of a tap or a screen reader. */
function WelcomeWorld() {
  return (
    <div className="welcome__world" aria-hidden>
      <span className="welcome__sun" />
      <span className="welcome__cloud welcome__cloud--a" />
      <span className="welcome__cloud welcome__cloud--b" />
      <span className="welcome__cloud welcome__cloud--c" />
      <span className="welcome__spark welcome__spark--a" />
      <span className="welcome__spark welcome__spark--b" />
      <span className="welcome__spark welcome__spark--c" />
      <span className="welcome__hill welcome__hill--back" />
      <span className="welcome__hill welcome__hill--front" />
    </div>
  );
}

/**
 * A later step of the way in: the Blobbi from the welcome, small, beside it, saying `line`; the step's own card
 * below, scrolling inside itself when it must.
 */
export function StagePanel({ line, children }: { line: string; children: ReactNode }) {
  const [guide] = welcomeCast();
  return (
    <div className="welcome-panel" data-testid="welcome-panel">
      {guide && <WelcomeHero blobbi={guide} variant="guide" line={line} testId="welcome-guide" />}
      <div className="welcome-panel__scroll">
        <div className="welcome-panel__card">{children}</div>
      </div>
    </div>
  );
}
