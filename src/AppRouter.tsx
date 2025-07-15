import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import BlobbiDashboard from "./pages/BlobbiDashboard";
import BlobbiDetail from "./pages/BlobbiDetail";
import BlobbiProfile from "./pages/BlobbiProfile";
import BlobbiCommunity from "./pages/BlobbiCommunity";
import BlobbiEvolution from "./pages/BlobbiEvolution";
import { BlobbiAdoptionPage } from "./pages/BlobbiAdoptionPage";
import { BubblePopGame } from "./pages/games/BubblePopGame";
import { NumberGuessGame } from "./pages/games/NumberGuessGame";
import { TicTacToeGame } from "./pages/games/TicTacToeGame";
import EggDemo from "./pages/EggDemo";
import VisualEffectsDemo from "./pages/VisualEffectsDemo";

import { BlobbiCompanionWrapper } from "./components/BlobbiCompanionWrapper";
import { BlobbiFloatingActionMenu } from "./components/BlobbiFloatingActionMenu";
import { DraggableBed } from "./components/DraggableBed";
import { GlobalHeader } from "./components/GlobalHeader";
import { useBed } from "./contexts/BedContext";

function AppContent() {
  const location = useLocation();
  const { shouldRenderBed, hideBed } = useBed();

  // Show header on all pages except homepage
  const showHeader = location.pathname !== '/';

  return (
    <>
      <BlobbiCompanionWrapper />
      <BlobbiFloatingActionMenu />
      <DraggableBed isVisible={shouldRenderBed} onClose={hideBed} />

      {showHeader && <GlobalHeader />}

      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/blobbi" element={<BlobbiDashboard />} />
        <Route path="/blobbi/:blobbiId" element={<BlobbiDetail />} />
        <Route path="/blobbi/adopt" element={<BlobbiAdoptionPage />} />
        <Route path="/blobbi/evolution" element={<BlobbiEvolution />} />
        <Route path="/blobbi/community" element={<BlobbiCommunity />} />
        <Route path="/blobbi/profile/:pubkey" element={<BlobbiProfile />} />
        <Route path="/games/bubble-pop" element={<BubblePopGame />} />
        <Route path="/games/number-guess" element={<NumberGuessGame />} />
        <Route path="/games/tic-tac-toe" element={<TicTacToeGame />} />
        <Route path="/egg-demo" element={<EggDemo />} />
        <Route path="/visual-effects-demo" element={<VisualEffectsDemo />} />

        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
export default AppRouter;