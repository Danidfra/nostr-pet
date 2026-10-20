import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// An older build's World Travel hand-off in the address (never read) and its storage are dropped before anything runs
import { dropLegacyHandoff, dropLegacyHandoffStore } from './features/presence/world-travel-departure';
import '@fontsource-variable/comfortaa';
import App from './App';
import './index.css';

dropLegacyHandoff();
dropLegacyHandoffStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
