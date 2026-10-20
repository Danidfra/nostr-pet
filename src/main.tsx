import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// A World Travel hand-off in the address is taken out of it before anything else runs (features/presence)
import './features/presence/handoff-capture';
import '@fontsource-variable/comfortaa';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
