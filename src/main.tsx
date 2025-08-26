import { createRoot } from 'react-dom/client'
import '@fontsource-variable/comfortaa'

import App from './App.tsx'
import './index.css'

// Initialize PWA
import { setupPWA, createPWAToastHandler } from './pwa'

// Set up PWA with toast handlers
setupPWA({
  ...createPWAToastHandler(),
  onRegistered: (registration) => {
    console.log('PWA Service Worker registered successfully:', registration);
  },
  onRegisterError: (error) => {
    console.error('PWA Service Worker registration failed:', error);
  },
});

createRoot(document.getElementById("root")!).render(<App />);
