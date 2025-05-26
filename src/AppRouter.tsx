import { BrowserRouter, Route, Routes } from "react-router-dom";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Blobbi from "./pages/Blobbi";
import BlobbiProfile from "./pages/BlobbiProfile";
import BlobbiCommunity from "./pages/BlobbiCommunity";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/blobbi" element={<Blobbi />} />
        <Route path="/blobbi/community" element={<BlobbiCommunity />} />
        <Route path="/blobbi/:pubkey" element={<BlobbiProfile />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;