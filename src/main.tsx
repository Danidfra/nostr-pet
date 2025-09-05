import { createRoot } from 'react-dom/client'
import '@fontsource-variable/comfortaa'
import '@fontsource/comic-neue'

import App from './App.tsx'
import './index.css'

// Initialize PWA
import { setupPWA, createPWAToastHandler } from './pwa'

// Set up PWA with toast handlers
// setupPWA({
//   ...createPWAToastHandler(),
//   onRegistered: (registration) => {
//     console.log('PWA Service Worker registered successfully:', registration);
//   },
//   onRegisterError: (error) => {
//     console.error('PWA Service Worker registration failed:', error);
//   },
// });

// if ('serviceWorker' in navigator && import.meta.env.PROD) {
//   navigator.serviceWorker
//     .register('/sw.js')
//     .then((reg) => console.log('[SW] registered:', reg.active?.scriptURL))
//     .catch((err) => console.error('[SW] registration failed:', err));
// }

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}

createRoot(document.getElementById("root")!).render(<App />);
