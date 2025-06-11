import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface BlobbiCompanionAPI {
  show: () => void;
  hide: () => void;
  setPosition: (x: number, y: number) => void;
  loadCustomSVG: (url: string) => void;
  destroy: () => void;
}

declare global {
  interface Window {
    blobbiCompanion?: BlobbiCompanionAPI;
  }
}

export function BlobbiCompanion() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadCompanion = async () => {
    if (isLoaded) {
      // Toggle visibility if already loaded
      if (window.blobbiCompanion) {
        if (isVisible) {
          window.blobbiCompanion.hide();
          setIsVisible(false);
        } else {
          window.blobbiCompanion.show();
          setIsVisible(true);
        }
      }
      return;
    }

    try {
      // Create container for the companion
      const companionContainer = document.createElement('div');
      companionContainer.id = 'blobbi-companion-root';
      document.body.appendChild(companionContainer);

      // Load the companion HTML
      const response = await fetch('/src/main/companion/index.html');
      const html = await response.text();
      
      // Extract the body content
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const bodyContent = doc.body.innerHTML;
      
      companionContainer.innerHTML = bodyContent;

      // Load CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/src/main/companion/style.css';
      document.head.appendChild(link);

      // Load and execute the script
      const script = document.createElement('script');
      script.src = '/src/main/companion/script.js';
      script.onload = () => {
        setIsLoaded(true);
        setIsVisible(true);
      };
      document.body.appendChild(script);
    } catch (error) {
      console.error('Failed to load Blobbi Companion:', error);
    }
  };

  useEffect(() => {
    // Cleanup function
    return () => {
      // Call destroy method if companion exists
      if (window.blobbiCompanion && typeof window.blobbiCompanion.destroy === 'function') {
        window.blobbiCompanion.destroy();
      }
      
      const companionRoot = document.getElementById('blobbi-companion-root');
      if (companionRoot) {
        companionRoot.remove();
      }
    };
  }, []);

  return (
    <div ref={containerRef}>
      <Button
        onClick={loadCompanion}
        variant="outline"
        className="gap-2"
      >
        <span className="text-lg">🔥</span>
        {isLoaded ? (isVisible ? 'Hide' : 'Show') : 'Enable'} Blobbi Companion
      </Button>
    </div>
  );
}