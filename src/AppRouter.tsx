import { BrowserRouter, Route, Routes } from "react-router-dom";

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
import EggDemo from "./pages/EggDemo";
import VisualEffectsDemo from "./pages/VisualEffectsDemo";

import { BlobbiCompanionWrapper } from "./components/BlobbiCompanionWrapper";

export function AppRouter() {
  return (
    <BrowserRouter>
      <BlobbiCompanionWrapper />
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
        <Route path="/egg-demo" element={<EggDemo />} />
        <Route path="/visual-effects-demo" element={<VisualEffectsDemo />} />

        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;