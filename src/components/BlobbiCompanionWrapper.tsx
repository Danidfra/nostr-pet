import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCurrentCompanion } from '@/hooks/useCurrentCompanion';
import { Blobbi } from '@/types/blobbi';

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

// Helper to determine SVG URL based on Blobbi type and stage
function getBlobbiSvgUrl(blobbi: Blobbi): string {
  if (blobbi.lifeStage === 'baby') {
    return 'https://danidfra.github.io/blobbi-designs/baby-stage/baby/blobbi-baby-base.svg';
  }
  
  if (blobbi.lifeStage === 'adult' && blobbi.evolutionForm) {
    return `https://danidfra.github.io/blobbi-designs/adult-stage/${blobbi.evolutionForm}/${blobbi.evolutionForm}-base.svg`;
  }
  
  // Default fallback
  return 'https://danidfra.github.io/blobbi-designs/baby-stage/baby/blobbi-baby-base.svg';
}

// Helper to customize SVG with colors
function customizeSvg(svgText: string, blobbi: Blobbi): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  
  // Find body gradient
  const bodyGradient = doc.querySelector('#blobbiBodyGradient');
  if (bodyGradient && blobbi.baseColor) {
    const stops = bodyGradient.querySelectorAll('stop');
    
    if (blobbi.secondaryColor) {
      // If both colors are present
      if (stops[0]) stops[0].setAttribute('style', `stop-color:${blobbi.secondaryColor}`);
      if (stops[1]) stops[1].setAttribute('style', `stop-color:${lightenColor(blobbi.secondaryColor, 20)}`);
      if (stops[2]) stops[2].setAttribute('style', `stop-color:${blobbi.baseColor}`);
    } else {
      // If only base color is present
      if (stops[0]) stops[0].setAttribute('style', `stop-color:${lightenColor(blobbi.baseColor, 40)}`);
      if (stops[1]) stops[1].setAttribute('style', `stop-color:${lightenColor(blobbi.baseColor, 20)}`);
      if (stops[2]) stops[2].setAttribute('style', `stop-color:${blobbi.baseColor}`);
    }
  }
  
  // Find eye gradient
  const eyeGradient = doc.querySelector('#blobbiPupilGradient');
  if (eyeGradient && blobbi.eyeColor) {
    const stops = eyeGradient.querySelectorAll('stop');
    if (stops[0]) stops[0].setAttribute('style', `stop-color:${lightenColor(blobbi.eyeColor, 30)}`);
    if (stops[1]) stops[1].setAttribute('style', `stop-color:${blobbi.eyeColor}`);
  }
  
  // Serialize back to string
  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

// Helper to lighten a color
function lightenColor(color: string, percent: number): string {
  // Simple color lightening - this is a basic implementation
  // In production, you might want to use a proper color manipulation library
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

export function BlobbiCompanionWrapper() {
  const location = useLocation();
  const { data: companionData, isLoading } = useCurrentCompanion();
  const [isCompanionLoaded, setIsCompanionLoaded] = useState(false);
  const [currentBlobbiId, setCurrentBlobbiId] = useState<string | null>(null);
  const companionInitialized = useRef(false);

  // Check if we're on a /blobbi route
  const shouldShowCompanion = location.pathname.startsWith('/blobbi');

  useEffect(() => {
    // Early exit conditions
    if (!shouldShowCompanion || isLoading || !companionData?.blobbi) {
      // Hide companion if it exists and we shouldn't show it
      if (window.blobbiCompanion && isCompanionLoaded) {
        window.blobbiCompanion.hide();
      }
      return;
    }

    const blobbi = companionData.blobbi;
    const blobbiId = companionData.blobbiId;

    // Check if we need to update the companion
    if (currentBlobbiId === blobbiId && isCompanionLoaded) {
      // Same companion, just show it
      window.blobbiCompanion?.show();
      return;
    }

    // Load or update companion
    const loadCompanion = async () => {
      try {
        // Check sessionStorage for cached SVG
        const cacheKey = `blobbi-svg-${blobbiId}`;
        let customizedSvg = sessionStorage.getItem(cacheKey);

        if (!customizedSvg) {
          // Fetch and customize SVG
          const svgUrl = getBlobbiSvgUrl(blobbi);
          const response = await fetch(svgUrl);
          const svgText = await response.text();
          
          // Customize the SVG with the Blobbi's colors
          customizedSvg = customizeSvg(svgText, blobbi);
          
          // Cache in sessionStorage
          sessionStorage.setItem(cacheKey, customizedSvg);
        }

        // Initialize companion if not already done
        if (!companionInitialized.current) {
          // Create container for the companion
          const companionContainer = document.createElement('div');
          companionContainer.id = 'blobbi-companion-root';
          document.body.appendChild(companionContainer);

          // Load the companion HTML
          const response = await fetch('/companion/index.html');
          const html = await response.text();
          
          // Extract the body content
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const bodyContent = doc.body.innerHTML;
          
          companionContainer.innerHTML = bodyContent;

          // Load CSS
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = '/companion/style.css';
          document.head.appendChild(link);

          // Load and execute the script
          const script = document.createElement('script');
          script.src = '/companion/script.js';
          await new Promise((resolve) => {
            script.onload = resolve;
            document.body.appendChild(script);
          });

          companionInitialized.current = true;
        }

        // Wait a bit for the companion to initialize
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update the SVG content
        const characterElement = document.getElementById('blobbi-character');
        if (characterElement) {
          characterElement.innerHTML = customizedSvg;
          
          // Add class to SVG for styling
          const svg = characterElement.querySelector('svg');
          if (svg) {
            svg.classList.add('blobbi-svg');
          }
        }

        // Show the companion
        window.blobbiCompanion?.show();
        
        setIsCompanionLoaded(true);
        setCurrentBlobbiId(blobbiId);
      } catch (error) {
        console.error('Failed to load Blobbi Companion:', error);
      }
    };

    loadCompanion();
  }, [shouldShowCompanion, isLoading, companionData, currentBlobbiId, isCompanionLoaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Hide companion when component unmounts
      if (window.blobbiCompanion && isCompanionLoaded) {
        window.blobbiCompanion.hide();
      }
    };
  }, [isCompanionLoaded]);

  // This component doesn't render anything visible
  return null;
}