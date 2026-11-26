import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// An older build's World Travel hand-off in the address (never read) and its storage are dropped before anything runs
import { dropLegacyHandoff, dropLegacyHandoffStore } from './features/presence/world-travel-departure';
import '@fontsource-variable/comfortaa';
import App from './App';
import { detectLocale, loadLocale } from './i18n';
import './index.css';

dropLegacyHandoff();
dropLegacyHandoffStore();

// The language is chosen once, before the first render (`src/i18n/t.ts`); English needs no fetch
void loadLocale(detectLocale()).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
