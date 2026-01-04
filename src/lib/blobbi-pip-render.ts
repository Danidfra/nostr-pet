import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Blobbi } from '@/types/blobbi';
import { BlobbiPiPContent } from '@/components/blobbi/BlobbiPiPContent';

/**
 * Renders Blobbi PiP content into the PiP window
 * Wraps content in MemoryRouter since PiP window is a separate context
 */
export function renderBlobbiPiP(pipWindow: Window, blobbi: Blobbi) {
  const container = pipWindow.document.getElementById('blobbi-pip-container');
  if (!container) return;

  // Create a div for React to render into
  const reactRoot = pipWindow.document.createElement('div');
  reactRoot.id = 'blobbi-pip-react-root';
  reactRoot.style.cssText = 'width: 100%; height: 100%;';
  container.appendChild(reactRoot);

  // Render React component wrapped in MemoryRouter
  // MemoryRouter is used because the PiP window doesn't need URL synchronization
  const root = createRoot(reactRoot);
  root.render(
    createElement(
      MemoryRouter,
      null,
      createElement(BlobbiPiPContent, { blobbi, pipWindow })
    )
  );

  // Cleanup function
  return () => {
    root.unmount();
  };
}
