import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { NostrContext } from '@nostrify/react';
import type { NostrSigner } from '@nostrify/nostrify';
import { SceneSettingsProvider, type SceneSettings } from '@/features/home/scene';
import { DevFixtureContext } from './DevFixtureContext';
import { DevPanel } from './DevPanel';
import { createFixtureController, type PresentationPins } from './fixture-controller';
import { fixtureSigner, readFixtureRequest } from './fixture-world';
import { PUBKEY } from '@/test/fixtures';
import './dev-panel.css';

/**
 * The app over a fixture world instead of the relays: a signed-in fixture
 * user, an in-memory pool, the scene settings the dev panel pins, and the
 * panel itself. Loaded only by a dev bundle behind the dev-tools flag
 * (`App.tsx`); a production build never contains it. Mounted inside the
 * query cache provider, so the panel can invalidate what it rewrites.
 */
export default function DevFixture({ search, children }: { search: string; children: ReactNode }) {
  const controller = useMemo(() => createFixtureController(readFixtureRequest(search) ?? { name: 'baby', state: 'active', low: undefined, expression: null }), [search]);
  const user = useMemo(() => ({ pubkey: PUBKEY, signer: fixtureSigner as unknown as NostrSigner }), []);
  const [pins, setPins] = useState<PresentationPins>(() => controller.pins());
  useEffect(() => controller.subscribe((change) => change.kind === 'pins' && setPins(change.pins)), [controller]);
  const settings = useMemo<Partial<SceneSettings>>(() => ({ baselineExpression: pins.expression, facing: pins.facing, reducedMotion: pins.reducedMotion }), [pins]);
  return (
    <DevFixtureContext.Provider value={user}>
      <NostrContext.Provider value={{ nostr: controller.store.pool }}>
        <SceneSettingsProvider value={settings}>
          {children}
          <DevPanel controller={controller} />
        </SceneSettingsProvider>
      </NostrContext.Provider>
    </DevFixtureContext.Provider>
  );
}
