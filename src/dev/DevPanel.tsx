import { useState } from 'react';
import type { BlobbiCompanion } from '@blobbi-kit/core';
import { ExpressionSheet } from './ExpressionSheet';
import type { FixtureController } from './fixture-controller';
import { AdoptedSections, InspectorSection, LifecycleSection, PinsSection, StageStateSection, StatsSection, WorldSection } from './sections';
import { FIXTURE_D } from './fixture-world';
import { specFromCompanion, summaryOf, useDevHome, useDevLifecycle, type DevHome } from './dev-home';

const COLLAPSED_KEY = 'blobbi:dev-panel:collapsed';

/** Remembered on this device; on a phone-width screen the panel starts collapsed so the game stays visible. */
function readCollapsed(): boolean {
  try {
    const stored = window.localStorage.getItem(COLLAPSED_KEY);
    if (stored !== null) return stored === '1';
  } catch {
    /* no storage */
  }
  return typeof window !== 'undefined' && window.innerWidth < 640;
}

/**
 * The floating dev panel: the dev controls (`sections.tsx`) over the normal
 * game, for a `?fixture=` link. The Dev Lab (`/dev`) is the same controls
 * in an engineering layout; this stays for direct fixture links and
 * browser tests. An engineering tool over the game, not part of it: its own
 * stylesheet, its own layer, a dev bundle only.
 */
export function DevPanel({ controller, embedded = false }: { controller: FixtureController; embedded?: boolean }) {
  const home = useDevHome(controller);
  // Embedded in another dev surface: always open, in its flow, nothing floating
  const [collapsedAlone, setCollapsed] = useState(readCollapsed);
  const collapsed = embedded ? false : collapsedAlone;
  const toggle = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1');
      } catch {
        /* fine */
      }
      return !c;
    });
  };
  const blobbi = home.current;
  return (
    <aside className={`dev-panel ${collapsed ? 'dev-panel--collapsed' : ''} ${embedded ? 'dev-panel--embedded' : ''}`} data-testid="dev-panel" data-embedded={embedded ? 'true' : 'false'} aria-label="Dev panel">
      <div className="dev-panel__head">
        <span className="dev-panel__title" data-testid="dev-summary">
          DEV · {summaryOf(blobbi, home.status)}
        </span>
        <button type="button" className="dev-panel__danger" onClick={() => controller.reset()} data-testid="dev-reset" title="Back to the world the URL asked for; clears pins and the kit's session stores">
          Reset fixture
        </button>
        {!embedded && (
          <button type="button" onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Open dev panel' : 'Collapse dev panel'} data-testid="dev-toggle">
            {collapsed ? '▴' : '▾'}
          </button>
        )}
      </div>
      {!collapsed &&
        (blobbi && blobbi.d !== FIXTURE_D ? (
          <div className="dev-panel__body">
            <AdoptedSections controller={controller} blobbi={blobbi} />
          </div>
        ) : blobbi ? (
          <DevPanelBody key={blobbi.d} controller={controller} home={{ blobbi, profile: home.profile, pubkey: home.pubkey, updateCompanionEvent: home.updateCompanionEvent, refresh: home.refresh }} />
        ) : (
          <div className="dev-panel__body dev-panel__hint" data-testid="dev-no-blobbi">
            {home.status === 'empty' ? 'This account owns no Blobbi yet: adopt one in the app. It will be its first Blobbi, so its egg is ready to hatch at once.' : `Fixture loading (${home.status})…`}
          </div>
        ))}
    </aside>
  );
}

function DevPanelBody({ controller, home }: { controller: FixtureController; home: DevHome }) {
  const blobbi: BlobbiCompanion = home.blobbi;
  const spec = specFromCompanion(blobbi);
  const lifecycle = useDevLifecycle(home);
  const [sheet, setSheet] = useState(false);
  return (
    <div className="dev-panel__body">
      <details open>
        <summary>Set: stage &amp; state</summary>
        <StageStateSection controller={controller} spec={spec} />
      </details>
      <details open>
        <summary>Set: stats</summary>
        <StatsSection controller={controller} spec={spec} blobbi={blobbi} />
      </details>
      <details open>
        <summary>Lifecycle</summary>
        <LifecycleSection controller={controller} spec={spec} lifecycle={lifecycle} />
      </details>
      <details open>
        <summary>Presentation pins</summary>
        <PinsSection controller={controller} />
        <div className="dev-panel__row">
          <button type="button" aria-pressed={sheet} onClick={() => setSheet((s) => !s)} data-testid="dev-sheet-toggle">
            expression sheet
          </button>
        </div>
        {sheet && <ExpressionSheet blobbi={blobbi} />}
      </details>
      <details>
        <summary>Inspect</summary>
        <InspectorSection blobbi={blobbi} />
      </details>
      <details>
        <summary>World</summary>
        <WorldSection controller={controller} blobbi={blobbi} />
      </details>
    </div>
  );
}
