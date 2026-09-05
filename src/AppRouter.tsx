import { Route, Routes } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';

export function AppRouter() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default AppRouter;
