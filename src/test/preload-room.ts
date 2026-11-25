/**
 * Compile and evaluate the 3D room's lazy chunk (three.js and the scene)
 * once, before a suite's first test. Without it, the first test that opens
 * the room pays that cold compilation inside its own waits: about a second
 * alone, several with every core busy running the whole suite, which is how
 * `findBy` timed out on a room still loading. Mocks declared with `vi.mock`
 * apply to this import as to any other.
 */
export const PRELOAD_TIMEOUT_MS = 60_000;

export function preloadRoom(): Promise<unknown> {
  return import('@/features/room/RoomPreviewPage');
}
