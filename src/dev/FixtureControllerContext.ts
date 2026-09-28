import { createContext, useContext } from 'react';
import type { FixtureController } from './fixture-controller';

/**
 * The one fixture controller of a dev session, for the dev surfaces (the
 * floating panel, the Dev Lab) that sit under `DevFixture`. Dev bundle only;
 * production never mounts the provider.
 */
export const FixtureControllerContext = createContext<FixtureController | null>(null);

export function useFixtureController(): FixtureController {
  const controller = useContext(FixtureControllerContext);
  if (!controller) throw new Error('useFixtureController: no DevFixture above this component');
  return controller;
}
