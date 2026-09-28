import type { ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';

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
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRouter;
