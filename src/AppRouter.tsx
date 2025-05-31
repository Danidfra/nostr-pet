import { BrowserRouter, Route, Routes } from "react-router-dom";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Blobbi from "./pages/Blobbi";
import BlobbiProfile from "./pages/BlobbiProfile";
import BlobbiCommunity from "./pages/BlobbiCommunity";
import BlobbiEvolution from "./pages/BlobbiEvolution";
import { BlobbiAdoptionPage } from "./pages/BlobbiAdoptionPage";
import { BubblePopGame } from "./pages/games/BubblePopGame";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/blobbi" element={<Blobbi />} />
        <Route path="/blobbi/adopt" element={<BlobbiAdoptionPage />} />
        <Route path="/blobbi/evolution" element={<BlobbiEvolution />} />
        <Route path="/blobbi/community" element={<BlobbiCommunity />} />
        <Route path="/blobbi/:pubkey" element={<BlobbiProfile />} />
        <Route path="/games/bubble-pop" element={<BubblePopGame />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;