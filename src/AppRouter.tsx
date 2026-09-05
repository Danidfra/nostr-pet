import { Route, Routes } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import NotFound from '@/pages/NotFound';

export function AppRouter() {
  return (
    <>
      <AppHeader />
      <Routes>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default AppRouter;
