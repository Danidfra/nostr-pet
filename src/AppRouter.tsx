import { Route, Routes, useLocation } from "react-router-dom";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import BlobbiDashboard from "./pages/BlobbiDashboard";
import BlobbiDetail from "./pages/BlobbiDetail";
import BlobbiCommunity from "./pages/BlobbiCommunity";
import BlobbiEvolution from "./pages/BlobbiEvolution";
import { BlobbiAdoptionPage } from "./pages/BlobbiAdoptionPage";
import { BubblePopGame } from "./pages/games/BubblePopGame";
import { NumberGuessGame } from "./pages/games/NumberGuessGame";
import { TicTacToeGame } from "./pages/games/TicTacToeGame";
import EggDemo from "./pages/EggDemo";
import PiPDemo from "./pages/PiPDemo";

// DEV-ONLY: Import debug pages (will not be included in production build)
import BlobbiStatusDebug from "./pages/dev/BlobbiStatusDebug";
import BlobbiEditor from "./pages/dev/BlobbiEditor";

import { BlobbiCompanionWrapper } from "./components/BlobbiCompanionWrapper";
import { BlobbiFloatingActionMenu } from "./components/BlobbiFloatingActionMenu";
import { DraggableBed } from "./components/DraggableBed";
import { GlobalHeader } from "./components/GlobalHeader";
import { useBed } from "./contexts/BedContext";
import { useEffect } from "react";
import { useIsMobile } from "./hooks/useIsMobile";

function AppContent() {
  const location = useLocation();
  const { shouldRenderBed, hideBed } = useBed();
  const isMobile = useIsMobile()

  // Show header on all pages except homepage
  const showHeader = location.pathname !== '/';
  const isBlobbiDashboard = location.pathname === '/blobbi';

  // Set CSS variables for header and footer heights
  useEffect(() => {
    const root = document.documentElement;

    // Header height: 112px desktop, 80px mobile
    const headerHeight = showHeader
      ? (isMobile ? '80px' : '112px')
      : '0px';
    root.style.setProperty('--app-header-h', headerHeight);

    // Footer height: 88px on /blobbi dashboard, 0px elsewhere
    root.style.setProperty('--app-footer-h', isBlobbiDashboard ? '88px' : '0px');
  }, [showHeader, isBlobbiDashboard, isMobile]);

  // Disable body scroll on /blobbi dashboard
  useEffect(() => {
    if (!isBlobbiDashboard) return;

    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [isBlobbiDashboard]);

  return (
    <>
      <BlobbiCompanionWrapper />
      <BlobbiFloatingActionMenu />
      <DraggableBed isVisible={shouldRenderBed} onClose={hideBed} />

      {showHeader && <GlobalHeader />}

      <div style={{ paddingTop: 'var(--app-header-h)' }}>
        <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/blobbi" element={<BlobbiDashboard />} />
        <Route path="/blobbi/:blobbiId" element={<BlobbiDetail />} />
        <Route path="/blobbi/adopt" element={<BlobbiAdoptionPage />} />
        <Route path="/blobbi/evolution" element={<BlobbiEvolution />} />
        <Route path="/blobbi/community" element={<BlobbiCommunity />} />
        <Route path="/games/bubble-pop" element={<BubblePopGame />} />
        <Route path="/games/number-guess" element={<NumberGuessGame />} />
        <Route path="/games/tic-tac-toe" element={<TicTacToeGame />} />
        <Route path="/egg-demo" element={<EggDemo />} />
        <Route path="/pip-demo" element={<PiPDemo />} />

        {/* DEV-ONLY ROUTES */}
        {process.env.NODE_ENV === 'development' && (
          <>
            <Route path="/dev/blobbi-status" element={<BlobbiStatusDebug />} />
            <Route path="/dev/blobbi-editor" element={<BlobbiEditor />} />
          </>
        )}

        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </div>
    </>
  );
}

export function AppRouter() {
  // BrowserRouter is now in App.tsx, so we just return AppContent directly
  return <AppContent />;
}
export default AppRouter;