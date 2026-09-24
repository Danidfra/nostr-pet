import { Route, Routes } from 'react-router-dom';
import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';

/** One screen. The HUD lives inside the home; there is no app bar. */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRouter;
