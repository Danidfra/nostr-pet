import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';

/**
 * The 3D room preview (`/room`), while it is being built: a dev build's
 * route only, loaded on demand (three.js comes with it), so the production
 * bundle and the home are untouched until the room replaces the home.
 */
const RoomPreview = import.meta.env.DEV ? lazy(() => import('@/features/room/RoomPreviewPage')) : null;

/**
 * One screen. The HUD lives inside the home; there is no app bar. `/dev` is
 * the Dev Lab when a dev build hands one in; in every other build it is not
 * found, like any other path.
 */
export function AppRouter({ devLab = null }: { devLab?: ReactNode }) {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dev" element={devLab ?? <NotFound />} />
      {RoomPreview && (
        <Route
          path="/room"
          element={
            <Suspense fallback={null}>
              <RoomPreview />
            </Suspense>
          }
        />
      )}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRouter;
