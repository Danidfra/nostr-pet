import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { NostrContext } from '@nostrify/react';
import type { NostrSigner } from '@nostrify/nostrify';
import { SceneSettingsProvider, type BlobbiSceneController, type SceneSettings } from '@/features/home/scene';
import { DevFixtureContext } from './DevFixtureContext';
import { FixtureControllerContext } from './FixtureControllerContext';
import { DevPanel } from './DevPanel';
import { createFixtureController, type PresentationPins } from './fixture-controller';
import { fixtureSigner, readFixtureRequest } from './fixture-world';
import { PUBKEY } from '@/test/fixtures';
import './dev-panel.css';

/**
 * The app over a fixture world instead of the relays: a signed-in fixture
 * user, an in-memory pool, the scene settings the dev surfaces pin, the
 * controller they share, and (unless a page provides its own surface) the
 * floating panel. Loaded only by a dev bundle behind the dev-tools flag
 * (`App.tsx`); a production build never contains it. Mounted inside the
 * query cache provider, so the surfaces can invalidate what they rewrite.
 */
export default function DevFixture({ search, floatingPanel = true, children }: { search: string; floatingPanel?: boolean; children: ReactNode }) {
  const controller = useMemo(() => createFixtureController(readFixtureRequest(search) ?? { name: 'baby', state: 'active', low: undefined, expression: null }), [search]);
  // A dev surface over the game (the room's dev tools) may show the panel inside itself; the floating one hides meanwhile
  const [claims, setClaims] = useState(0);
  const claim = useCallback(() => {
    setClaims((n) => n + 1);
    return () => setClaims((n) => n - 1);
  }, []);
  const user = useMemo(
    () => ({ pubkey: PUBKEY, signer: fixtureSigner as unknown as NostrSigner, panel: { node: <DevPanel controller={controller} embedded />, claim } }),
    [controller, claim],
  );
  const [pins, setPins] = useState<PresentationPins>(() => controller.pins());
  useEffect(() => controller.subscribe((change) => change.kind === 'pins' && setPins(change.pins)), [controller]);
  // The home hands its scene controller over through the settings seam; the dev surfaces drive it.
  const onController = useCallback((scene: BlobbiSceneController | null) => controller.setScene(scene), [controller]);
  const settings = useMemo<Partial<SceneSettings>>(
    () => ({ baselineExpression: pins.expression, facing: pins.facing, gaze: pins.gaze, motion: pins.motion, reducedMotion: pins.reducedMotion, onController }),
    [pins, onController],
  );
  return (
    <DevFixtureContext.Provider value={user}>
      <FixtureControllerContext.Provider value={controller}>
        <NostrContext.Provider value={{ nostr: controller.store.pool }}>
          <SceneSettingsProvider value={settings}>
            {children}
            {floatingPanel && claims === 0 && <DevPanel controller={controller} />}
          </SceneSettingsProvider>
        </NostrContext.Provider>
      </FixtureControllerContext.Provider>
    </DevFixtureContext.Provider>
  );
}
