import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';
import { ROOM_PATH } from '@/lib/home-experience';
import { RoomLoading } from '@/features/room/RoomLoading';
import { GuestLayers } from '@/features/guest/GuestLayers';
import { CompanionLayer } from '@/features/companion/CompanionLayer';
import { WorldsAccessWatch } from '@/features/worlds/WorldsAccessWatch';

/**
 * The 3D room (`/room`, beta): in every build, loaded only when visited
 * (three.js comes with it, in its own chunk), so the classic home's bundle
 * is untouched. The classic home stays the default; the player opens the
 * room from the menu, and may choose to open on it (`home-experience.ts`).
 */
const RoomPage = lazy(() => import('@/features/room/RoomPreviewPage'));
/** The 3D Blobbi lab (`/room/3d-lab`): a dev build's only, loaded on demand. */
const RoomLab = import.meta.env.DEV ? lazy(() => import('@/features/room/RoomLabPage')) : null;

/**
 * One screen. The HUD lives inside the home; there is no app bar. `/dev` is
 * the Dev Lab when a dev build hands one in; in every other build it is not
 * found, like any other path.
 */
export function AppRouter({ devLab = null }: { devLab?: ReactNode }) {
  return (
    <>
      {/* The guest's save, sign-in and conflict layers, above whichever home is shown (M14.1) */}
      <GuestLayers />
      {/* The Worlds door watched across both homes, so a save that opens it is seen whole (src/features/worlds) */}
      <WorldsAccessWatch />
      {/* The companion shared with the other Blobbi games: a word when it could not be, a question when unclear */}
      <CompanionLayer />
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dev" element={devLab ?? <NotFound />} />
      <Route
        path={ROOM_PATH}
        element={
          <Suspense fallback={<RoomLoading />}>
            <RoomPage />
          </Suspense>
        }
      />
      {RoomLab && (
        <Route
          path="/room/3d-lab"
          element={
            <Suspense fallback={null}>
              <RoomLab />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default AppRouter;
