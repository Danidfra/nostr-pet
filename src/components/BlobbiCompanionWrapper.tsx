import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useCurrentCompanion } from '@/hooks/useCurrentCompanion';
import { useBed } from '@/contexts/BedContext';
import { Blobbi } from '@/types/blobbi';
import { resolveBlobbiSvg, preloadBlobbiSvgs } from '@/lib/blobbi-svg-resolver';
import { customizeBabySvgFromBlobbi } from '@/blobbi/baby-blobbi';

interface BlobbiCompanionAPI {
  show: () => void;
  hide: () => void;
  setPosition: (x: number, y: number) => void;
  loadCustomSVG: (url: string) => void;
  destroy: () => void;
  openFeed?: () => void;
  toggleMovementMode?: () => void;
}

// Helper to get SVG content from local assets based on Blobbi type and stage
async function getBlobbiSvgContent(blobbi: Blobbi, isSleeping: boolean = false): Promise<string> {
  // Use local SVG resolver instead of GitHub URLs
  return await resolveBlobbiSvg(blobbi, isSleeping);
}

// Helper to customize SVG with colors
function customizeSvg(svgText: string, blobbi: Blobbi, isSleeping: boolean = false): string {
  // Use baby-specific customization for baby Blobbis
  if (blobbi.lifeStage === 'baby') {
    return customizeBabySvgFromBlobbi(svgText, blobbi, isSleeping);
  }

  // Adult customization logic (kept for backward compatibility)
  let modifiedSvg = svgText;

  // Only apply customizations if we have colors
  if (!blobbi.baseColor && !blobbi.secondaryColor) {
    return modifiedSvg;
  }

  // Find and modify the body gradient
  const bodyGradientRegex = /<radialGradient[^>]*id=["']blobbiBodyGradient["'][^>]*>([\s\S]*?)<\/radialGradient>/;
  const bodyGradientMatch = modifiedSvg.match(bodyGradientRegex);

  if (bodyGradientMatch && blobbi.baseColor) {
    let newGradient = '';

    if (blobbi.secondaryColor) {
      // Both base_color and secondary_color are present
      newGradient = `<radialGradient id="blobbiBodyGradient" cx="0.3" cy="0.25">
        <stop offset="0%" style="stop-color:${blobbi.secondaryColor}"/>
        <stop offset="60%" style="stop-color:${lightenColor(blobbi.secondaryColor, 20)}"/>
        <stop offset="100%" style="stop-color:${blobbi.baseColor}"/>
      </radialGradient>`;
    } else {
      // Only base_color is present
      newGradient = `<radialGradient id="blobbiBodyGradient" cx="0.3" cy="0.25">
        <stop offset="0%" style="stop-color:${lightenColor(blobbi.baseColor, 40)}"/>
        <stop offset="60%" style="stop-color:${lightenColor(blobbi.baseColor, 20)}"/>
        <stop offset="100%" style="stop-color:${blobbi.baseColor}"/>
      </radialGradient>`;
    }

    modifiedSvg = modifiedSvg.replace(bodyGradientMatch[0], newGradient);
  }

  // ✅ FIXED: Skip eye color customization for sleeping SVGs (eyes are closed)
  if (blobbi.eyeColor && !isSleeping) {
    const eyeGradientRegex = /<radialGradient[^>]*id=["']blobbiPupilGradient["'][^>]*>([\s\S]*?)<\/radialGradient>/;
    const eyeGradientMatch = modifiedSvg.match(eyeGradientRegex);

    if (eyeGradientMatch) {
      const newEyeGradient = `<radialGradient id="blobbiPupilGradient" cx="0.3" cy="0.3">
        <stop offset="0%" style="stop-color:${lightenColor(blobbi.eyeColor, 30)}"/>
        <stop offset="100%" style="stop-color:${blobbi.eyeColor}"/>
      </radialGradient>`;

      modifiedSvg = modifiedSvg.replace(eyeGradientMatch[0], newEyeGradient);
    }
  }

  return modifiedSvg;
}

// Eye animation controller class
class BlobbiEyeAnimator {
  private svgElement: SVGElement | null = null;
  private leftEye: SVGElement | null = null;
  private rightEye: SVGElement | null = null;
  private leftPupil: SVGElement | null = null;
  private rightPupil: SVGElement | null = null;
  private leftHighlights: SVGElement[] = [];
  private rightHighlights: SVGElement[] = [];
  private isBlinking = false;
  private blinkInterval: NodeJS.Timeout | null = null;
  private mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private animationFrameId: number | null = null;

  constructor(svgElement: SVGElement) {
    this.svgElement = svgElement;
    this.initializeEyes();
    this.startBlinking();
    this.startMouseTracking();
  }

  private initializeEyes() {
    if (!this.svgElement) return;

    // Find eye elements - try multiple selectors for different SVG structures
    const eyeSelectors = [
      '[id*="eye"]',
      '[class*="eye"]',
      'circle[r="8"], circle[r="10"], circle[r="12"]', // Common eye sizes
      'ellipse[rx="8"], ellipse[rx="10"], ellipse[rx="12"]'
    ];

    const pupilSelectors = [
      '[id*="pupil"]',
      '[class*="pupil"]',
      'circle[r="4"], circle[r="5"], circle[r="6"]', // Common pupil sizes
      'ellipse[rx="4"], ellipse[rx="5"], ellipse[rx="6"]'
    ];

    // Find eyes
    for (const selector of eyeSelectors) {
      const eyes = this.svgElement.querySelectorAll(selector);
      if (eyes.length >= 2) {
        this.leftEye = eyes[0] as SVGElement;
        this.rightEye = eyes[1] as SVGElement;
        break;
      }
    }

    // Find pupils
    for (const selector of pupilSelectors) {
      const pupils = this.svgElement.querySelectorAll(selector);
      if (pupils.length >= 2) {
        this.leftPupil = pupils[0] as SVGElement;
        this.rightPupil = pupils[1] as SVGElement;
        break;
      }
    }

    // If we can't find specific pupils, look for smaller circles/ellipses inside or near eyes
    if (!this.leftPupil && this.leftEye) {
      this.leftPupil = this.findPupilNearEye(this.leftEye);
    }
    if (!this.rightPupil && this.rightEye) {
      this.rightPupil = this.findPupilNearEye(this.rightEye);
    }

    // Find highlights (white circles) near pupils
    this.findHighlights();

    // Add CSS classes for animations
    this.addEyeStyles();
  }

  private findPupilNearEye(eye: SVGElement): SVGElement | null {
    if (!this.svgElement) return null;

    const eyeRect = eye.getBoundingClientRect();
    const eyeCenterX = eyeRect.left + eyeRect.width / 2;
    const eyeCenterY = eyeRect.top + eyeRect.height / 2;

    // Look for smaller circles/ellipses near this eye
    const allCircles = this.svgElement.querySelectorAll('circle, ellipse');

    for (const circle of allCircles) {
      if (circle === eye) continue;

      const circleRect = circle.getBoundingClientRect();
      const circleCenterX = circleRect.left + circleRect.width / 2;
      const circleCenterY = circleRect.top + circleRect.height / 2;

      const distance = Math.sqrt(
        Math.pow(eyeCenterX - circleCenterX, 2) +
        Math.pow(eyeCenterY - circleCenterY, 2)
      );

      // If the circle is close to the eye and smaller, it's likely a pupil
      if (distance < 30 && circleRect.width < eyeRect.width) {
        return circle as SVGElement;
      }
    }

    return null;
  }

  private findHighlights() {
    if (!this.svgElement) return;

    // Find white circles that could be highlights
    const allCircles = this.svgElement.querySelectorAll('circle, ellipse');

    for (const circle of allCircles) {
      const fill = circle.getAttribute('fill');
      const style = circle.getAttribute('style');

      // Check if it's white or light colored
      const isWhite = fill === 'white' || fill === '#ffffff' || fill === '#fff' ||
                     (style && (style.includes('fill:white') || style.includes('fill:#ffffff') || style.includes('fill:#fff')));

      if (!isWhite) continue;

      const circleRect = circle.getBoundingClientRect();

      // Check if it's near the left pupil
      if (this.leftPupil) {
        const leftPupilRect = this.leftPupil.getBoundingClientRect();
        const leftDistance = Math.sqrt(
          Math.pow(circleRect.left + circleRect.width / 2 - (leftPupilRect.left + leftPupilRect.width / 2), 2) +
          Math.pow(circleRect.top + circleRect.height / 2 - (leftPupilRect.top + leftPupilRect.height / 2), 2)
        );

        // If it's close to the left pupil and smaller, it's likely a highlight
        if (leftDistance < 20 && circleRect.width < leftPupilRect.width) {
          this.leftHighlights.push(circle as SVGElement);
          continue;
        }
      }

      // Check if it's near the right pupil
      if (this.rightPupil) {
        const rightPupilRect = this.rightPupil.getBoundingClientRect();
        const rightDistance = Math.sqrt(
          Math.pow(circleRect.left + circleRect.width / 2 - (rightPupilRect.left + rightPupilRect.width / 2), 2) +
          Math.pow(circleRect.top + circleRect.height / 2 - (rightPupilRect.top + rightPupilRect.height / 2), 2)
        );

        // If it's close to the right pupil and smaller, it's likely a highlight
        if (rightDistance < 20 && circleRect.width < rightPupilRect.width) {
          this.rightHighlights.push(circle as SVGElement);
        }
      }
    }
  }

  private addEyeStyles() {
    // Check if styles already exist
    if (document.getElementById('blobbi-eye-styles')) return;

    // Add CSS for smooth animations
    const style = document.createElement('style');
    style.id = 'blobbi-eye-styles';
    style.textContent = `
      .blobbi-eye {
        transform-origin: center;
        transition: transform 0.1s ease-out;
      }

      .blobbi-pupil {
        transform-origin: center;
        transition: transform 0.1s ease-out;
      }

      .blobbi-highlight {
        transform-origin: center;
        transition: transform 0.1s ease-out;
      }

      .blobbi-eye.blinking {
        animation: blobbi-blink 0.15s ease-in-out;
      }

      @keyframes blobbi-blink {
        0% { transform: scaleY(1); }
        50% { transform: scaleY(0.1); }
        100% { transform: scaleY(1); }
      }
    `;
    document.head.appendChild(style);

    // Apply classes to eye elements
    if (this.leftEye) {
      this.leftEye.classList.add('blobbi-eye');
    }
    if (this.rightEye) {
      this.rightEye.classList.add('blobbi-eye');
    }
    if (this.leftPupil) {
      this.leftPupil.classList.add('blobbi-pupil');
    }
    if (this.rightPupil) {
      this.rightPupil.classList.add('blobbi-pupil');
    }

    // Apply classes to highlights
    this.leftHighlights.forEach(highlight => {
      highlight.classList.add('blobbi-highlight');
    });

    this.rightHighlights.forEach(highlight => {
      highlight.classList.add('blobbi-highlight');
    });
  }

  private startBlinking() {
    const blink = () => {
      if (this.isBlinking) return;

      this.isBlinking = true;

      // Add blinking class
      if (this.leftEye) this.leftEye.classList.add('blinking');
      if (this.rightEye) this.rightEye.classList.add('blinking');

      // Remove blinking class after animation
      setTimeout(() => {
        if (this.leftEye) this.leftEye.classList.remove('blinking');
        if (this.rightEye) this.rightEye.classList.remove('blinking');
        this.isBlinking = false;
      }, 150);
    };

    // Blink every 3-6 seconds randomly
    const scheduleNextBlink = () => {
      const delay = 3000 + Math.random() * 3000; // 3-6 seconds
      this.blinkInterval = setTimeout(() => {
        blink();
        scheduleNextBlink();
      }, delay);
    };

    scheduleNextBlink();
  }

  private startMouseTracking() {
    this.mouseMoveHandler = (e: MouseEvent) => {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }

      this.animationFrameId = requestAnimationFrame(() => {
        this.updatePupilPosition(e.clientX, e.clientY);
      });
    };

    document.addEventListener('mousemove', this.mouseMoveHandler);
  }

  private updatePupilPosition(mouseX: number, mouseY: number) {
    if (!this.svgElement) return;

    const svgRect = this.svgElement.getBoundingClientRect();
    const svgCenterX = svgRect.left + svgRect.width / 2;
    const svgCenterY = svgRect.top + svgRect.height / 2;

    // Calculate angle and distance from SVG center to mouse
    const angle = Math.atan2(mouseY - svgCenterY, mouseX - svgCenterX);
    const distance = Math.min(
      Math.sqrt(Math.pow(mouseX - svgCenterX, 2) + Math.pow(mouseY - svgCenterY, 2)),
      200 // Max tracking distance
    ) / 200; // Normalize to 0-1

    // Maximum pupil movement (in pixels relative to SVG size)
    const maxMovement = Math.min(svgRect.width, svgRect.height) * 0.02; // 2% of SVG size

    const offsetX = Math.cos(angle) * distance * maxMovement;
    const offsetY = Math.sin(angle) * distance * maxMovement;

    // Apply movement to pupils
    if (this.leftPupil) {
      this.leftPupil.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }
    if (this.rightPupil) {
      this.rightPupil.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }

    // Apply movement to highlights (they should move with the pupils)
    this.leftHighlights.forEach(highlight => {
      highlight.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });

    this.rightHighlights.forEach(highlight => {
      highlight.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });
  }

  public destroy() {
    // Clean up intervals and event listeners
    if (this.blinkInterval) {
      clearTimeout(this.blinkInterval);
    }

    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
    }

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
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

// Helper to generate cache key with more specificity
function getCacheKey(blobbi: Blobbi, blobbiId: string, isSleeping: boolean = false): string {
  const stage = blobbi.lifeStage;
  const type = blobbi.evolutionForm || 'baby';
  const baseColor = blobbi.baseColor || 'default';
  const secondaryColor = blobbi.secondaryColor || 'none';
  const sleepState = isSleeping ? 'sleeping' : 'awake';
  return `blobbi-svg-${blobbiId}-${stage}-${type}-${baseColor}-${secondaryColor}-${sleepState}`;
}

export function BlobbiCompanionWrapper() {
  const location = useLocation();
  const { data: companionData, isLoading } = useCurrentCompanion();
  const { setCompanionLoaded } = useBed();
  const [isCompanionLoaded, setIsCompanionLoaded] = useState(false);
  const [currentBlobbiId, setCurrentBlobbiId] = useState<string | null>(null);
  const [isLoadingSvg, setIsLoadingSvg] = useState(false);
  const companionInitialized = useRef(false);
  const eyeAnimator = useRef<BlobbiEyeAnimator | null>(null);
  const updateInProgress = useRef(false);
  const positionedForSleep = useRef<string | null>(null); // Track which Blobbi was positioned for sleep

  // Check if we're on dashboard or a /blobbi detail route
  const shouldShowCompanion = location.pathname === '/' || location.pathname.startsWith('/blobbi');

  // ✅ NEW: Helper function to position Blobbi on bed when sleeping
  const positionBlobbiOnBed = useCallback((blobbiId: string, retryCount: number = 0) => {
    // Only position if we haven't already positioned this Blobbi for sleep
    if (positionedForSleep.current === blobbiId) {
      return;
    }

    // Wait a bit for bed to be rendered
    setTimeout(() => {
      const bedElement = document.querySelector('img[src*="bed.png"]') as HTMLElement;
      if (!bedElement || !window.blobbiCompanion) {
        // ✅ ENHANCED: Retry positioning up to 3 times with increasing delays
        if (retryCount < 3) {

          positionBlobbiOnBed(blobbiId, retryCount + 1);
          return;
        }

        return;
      }

      // Get bed position and center Blobbi on it
      const bedRect = bedElement.getBoundingClientRect();
      const bedCenterX = bedRect.left + bedRect.width / 2;

      // Position Blobbi horizontally centered, and vertically slightly above center
      let targetScreenX = bedCenterX + 12;
      let targetScreenY = bedRect.top + bedRect.height * 0.15; // Slightly above center vertically

      // Mobile-specific adjustments (shift 15px left and 10px up)
      if (window.innerWidth < 768) {
        targetScreenX -= 30; // Move 15px to the left
        targetScreenY -= 25; // Move 10px upward
      }

      // Convert screen position to companion's position system (distance from right/bottom)
      const positionX = window.innerWidth - targetScreenX - 60; // 60 is half of Blobbi's width
      const positionY = window.innerHeight - targetScreenY - 60; // 60 is half of Blobbi's height

      // Keep within bounds
      const boundedX = Math.max(0, Math.min(window.innerWidth - 120, positionX));
      const boundedY = Math.max(0, Math.min(window.innerHeight - 120, positionY));

      // Position the companion
      window.blobbiCompanion.setPosition(boundedX, boundedY);

      positionedForSleep.current = blobbiId;
    }, 300 + (retryCount * 200)); // Increase delay with each retry
  }, []);

  // Helper to update SVG in the DOM
  const updateSvgInDom = (svgContent: string) => {
    const characterElement = document.getElementById('blobbi-character');
    if (characterElement) {
      characterElement.innerHTML = svgContent;

      // Add class to SVG for styling
      const svg = characterElement.querySelector('svg');
      if (svg) {
        svg.classList.add('blobbi-svg');

        // Initialize eye animations
        if (eyeAnimator.current) {
          eyeAnimator.current.destroy();
        }

        // Wait a bit for SVG to be fully rendered
        setTimeout(() => {
          eyeAnimator.current = new BlobbiEyeAnimator(svg);
        }, 100);
      }
    }
  };

  // Helper to show loading placeholder
  const showLoadingPlaceholder = () => {
    const characterElement = document.getElementById('blobbi-character');
    if (characterElement) {
      characterElement.innerHTML = `
        <div style="width: 100px; height: 100px; display: flex; align-items: center; justify-content: center;">
          <div style="width: 40px; height: 40px; border: 3px solid #f3f3f3; border-top: 3px solid #7C3AED; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
    }
  };

  useEffect(() => {
    // Early exit conditions
    if (!shouldShowCompanion || isLoading || !companionData?.blobbi) {
      // Hide companion if it exists and we shouldn't show it
      if (window.blobbiCompanion && isCompanionLoaded) {
        window.blobbiCompanion.hide();
      }

      // ✅ NEW: Notify bed context that companion is not available
      if (isCompanionLoaded) {
        setCompanionLoaded(false);
        setIsCompanionLoaded(false);
        positionedForSleep.current = null;
      }

      return;
    }

    const blobbi = companionData.blobbi;
    const blobbiId = companionData.blobbiId;

    // Check if we need to update the companion
    if (currentBlobbiId === blobbiId && isCompanionLoaded && !updateInProgress.current) {
      // Same companion, just show it
      window.blobbiCompanion?.show();

      // ✅ NEW: Check if we need to position for sleep
      if (blobbi.isSleeping && positionedForSleep.current !== blobbiId) {

        positionBlobbiOnBed(blobbiId);
      } else if (!blobbi.isSleeping) {
        // Reset positioning tracking if not sleeping
        positionedForSleep.current = null;
      }

      return;
    }

    // Load or update companion
    const loadCompanion = async () => {
      try {
        // ✅ FIXED: Determine current sleep state and generate appropriate cache keys
        const isSleeping = blobbi.isSleeping || false;
        const currentCacheKey = getCacheKey(blobbi, blobbiId, isSleeping);

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

          // Wait a bit for the companion to initialize
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Step 1: Try to load from sessionStorage first
        const cachedSvg = sessionStorage.getItem(currentCacheKey);

        if (cachedSvg) {
          // Use cached SVG immediately
          updateSvgInDom(cachedSvg);
          window.blobbiCompanion?.show();
          setIsCompanionLoaded(true);
          setCurrentBlobbiId(blobbiId);
        } else {
          // Show loading placeholder while fetching
          setIsLoadingSvg(true);
          showLoadingPlaceholder();
          window.blobbiCompanion?.show();
        }

        // Step 2: Fetch and update in parallel (always do this to ensure latest version)
        updateInProgress.current = true;

        // 🚀 NEW: Get SVG content from local assets
        const svgText = await getBlobbiSvgContent(blobbi, isSleeping);

        // ✅ FIXED: Customize the SVG with the Blobbi's colors, considering sleep state
        const customizedSvg = customizeSvg(svgText, blobbi, isSleeping);

        // Update sessionStorage with new SVG
        sessionStorage.setItem(currentCacheKey, customizedSvg);

        // Update the DOM with the new SVG (even if we had a cached version)
        updateSvgInDom(customizedSvg);

        // 🚀 NEW: Preload both awake and sleeping SVGs using local resolver
        if (blobbi.lifeStage === 'baby' || (blobbi.lifeStage === 'adult' && blobbi.evolutionForm)) {
          try {
            // Use the local SVG resolver to pre-cache assets
            await preloadBlobbiSvgs(blobbi);

          } catch (preloadError) {
            console.warn('Failed to preload local SVGs:', preloadError);
          }
        }

        // Update state
        setIsLoadingSvg(false);
        setIsCompanionLoaded(true);
        setCurrentBlobbiId(blobbiId);
        updateInProgress.current = false;

        // ✅ NEW: Notify bed context that companion is loaded
        setCompanionLoaded(true);

        // Show the companion if it wasn't already shown
        window.blobbiCompanion?.show();

        // ✅ NEW: If Blobbi is sleeping, position it on the bed after a short delay
        if (blobbi.isSleeping) {

          positionBlobbiOnBed(blobbiId);
        } else {
          // Reset positioning tracking if not sleeping
          positionedForSleep.current = null;
        }

      } catch (error) {
        console.error('Failed to load Blobbi Companion:', error);
        setIsLoadingSvg(false);
        updateInProgress.current = false;
      }
    };

    loadCompanion();
  }, [shouldShowCompanion, isLoading, companionData, currentBlobbiId, isCompanionLoaded, setCompanionLoaded, positionBlobbiOnBed]);

  // ✅ FIXED: Handle sleep state changes and update SVG accordingly
  useEffect(() => {
    if (!companionData?.blobbi || !isCompanionLoaded) return;

    const blobbi = companionData.blobbi;
    const blobbiId = companionData.blobbiId;
    const isSleeping = blobbi.isSleeping || false;

    // Handle SVG switching for both baby and adult stages (both now have sleeping variants)
    if (blobbi.lifeStage === 'baby' || (blobbi.lifeStage === 'adult' && blobbi.evolutionForm)) {
      const currentCacheKey = getCacheKey(blobbi, blobbiId, isSleeping);
      const cachedSvg = sessionStorage.getItem(currentCacheKey);

      if (cachedSvg) {
        // Quick switch using cached SVG
        updateSvgInDom(cachedSvg);

        // ✅ NEW: Position Blobbi on bed if now sleeping
        if (isSleeping && positionedForSleep.current !== blobbiId) {

          positionBlobbiOnBed(blobbiId);
        } else if (!isSleeping) {
          // Reset positioning tracking if not sleeping
          positionedForSleep.current = null;
        }
      } else {
        // Fallback: resolve the SVG locally if not cached
        const resolveAndUpdateSvg = async () => {
          try {
            const svgText = await getBlobbiSvgContent(blobbi, isSleeping);
            const customizedSvg = customizeSvg(svgText, blobbi, isSleeping);

            sessionStorage.setItem(currentCacheKey, customizedSvg);
            updateSvgInDom(customizedSvg);

            // 🛏️ Position Blobbi on bed if now sleeping
            if (isSleeping && positionedForSleep.current !== blobbiId) {

              positionBlobbiOnBed(blobbiId);
            } else if (!isSleeping) {
              // Reset positioning tracking if not sleeping
              positionedForSleep.current = null;
            }
          } catch (error) {
            console.error('Failed to resolve local SVG state:', error);
          }
        };

        resolveAndUpdateSvg();
      }
    }
  }, [companionData?.blobbi, companionData?.blobbiId, isCompanionLoaded, positionBlobbiOnBed]);

  // ✅ NEW: Handle positioning when bed becomes available and Blobbi is already sleeping
  useEffect(() => {
    // Only run this effect when companion is loaded and we have companion data
    if (!isCompanionLoaded || !companionData?.blobbi) return;

    const blobbi = companionData.blobbi;
    const blobbiId = companionData.blobbiId;

    // If Blobbi is sleeping but hasn't been positioned yet, try to position it
    if (blobbi.isSleeping && positionedForSleep.current !== blobbiId) {

      // Check if bed is available immediately
      const bedElement = document.querySelector('img[src*="bed.png"]') as HTMLElement;
      if (bedElement && window.blobbiCompanion) {

        positionBlobbiOnBed(blobbiId);
      } else {
        // Wait for bed to become available

        positionBlobbiOnBed(blobbiId);
      }
    }
  }, [isCompanionLoaded, companionData?.blobbi, companionData?.blobbiId, positionBlobbiOnBed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Hide companion when component unmounts
      if (window.blobbiCompanion && isCompanionLoaded) {
        window.blobbiCompanion.hide();
      }

      // ✅ NEW: Notify bed context that companion is unloaded
      setCompanionLoaded(false);

      // Cleanup eye animator
      if (eyeAnimator.current) {
        eyeAnimator.current.destroy();
        eyeAnimator.current = null;
      }

      // Reset positioning tracking
      positionedForSleep.current = null;
    };
  }, [isCompanionLoaded, setCompanionLoaded]);

  // This component doesn't render anything visible
  return null;
}
