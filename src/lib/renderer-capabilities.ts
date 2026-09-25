/**
 * What the installed @blobbi-kit/renderer can do, detected from its exports.
 *
 * Renderer 0.4.0 adds two things the home relies on: the `sleepIndicator`
 * input (so the V1 sleeping drawings drop their baked "Zzz" and the home's
 * own animated one is the only sleep cue) and an expressive V1 baby face.
 * Until that version is installed the home must still be correct against
 * 0.3.0, so the capability is read from the export the same release added
 * (`BLOBBI_SLEEP_INDICATORS`) rather than assumed. This keeps the home
 * compiling against the published renderer without vendoring an unreleased
 * one; delete this file and pass `sleepIndicator="none"` directly once the
 * dependency is `^0.4.0`.
 */
import * as renderer from '@blobbi-kit/renderer';

/** True once the renderer can leave the sleep cue to the host. */
export const RENDERER_OWNS_SLEEP_INDICATOR = !('BLOBBI_SLEEP_INDICATORS' in renderer);

/**
 * Extra renderer props for a Blobbi in the home. With a capable renderer the
 * host draws the one sleep cue and the artwork draws none; with 0.3.0 the
 * artwork keeps its own and the host draws nothing, so there is never two.
 */
export const HOME_RENDERER_PROPS: { sleepIndicator?: 'none' } = RENDERER_OWNS_SLEEP_INDICATOR ? {} : { sleepIndicator: 'none' };
