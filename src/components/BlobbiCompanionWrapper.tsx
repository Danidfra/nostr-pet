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
  openFeed?: () => void;
  toggleMovementMode?: () => void;
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

  // Find and modify the eye gradient if eye color is present
  if (blobbi.eyeColor) {
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
function getCacheKey(blobbi: Blobbi, blobbiId: string): string {
  const stage = blobbi.lifeStage;
  const type = blobbi.evolutionForm || 'baby';
  const baseColor = blobbi.baseColor || 'default';
  const secondaryColor = blobbi.secondaryColor || 'none';
  return `blobbi-svg-${blobbiId}-${stage}-${type}-${baseColor}-${secondaryColor}`;
}

export function BlobbiCompanionWrapper() {
  const location = useLocation();
  const { data: companionData, isLoading } = useCurrentCompanion();
  const [isCompanionLoaded, setIsCompanionLoaded] = useState(false);
  const [currentBlobbiId, setCurrentBlobbiId] = useState<string | null>(null);
  const [isLoadingSvg, setIsLoadingSvg] = useState(false);
  const companionInitialized = useRef(false);
  const eyeAnimator = useRef<BlobbiEyeAnimator | null>(null);
  const updateInProgress = useRef(false);

  // Check if we're on a /blobbi route
  const shouldShowCompanion = location.pathname.startsWith('/blobbi');

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
      return;
    }

    const blobbi = companionData.blobbi;
    const blobbiId = companionData.blobbiId;

    // Check if we need to update the companion
    if (currentBlobbiId === blobbiId && isCompanionLoaded && !updateInProgress.current) {
      // Same companion, just show it
      window.blobbiCompanion?.show();
      return;
    }

    // Load or update companion
    const loadCompanion = async () => {
      try {
        // Generate cache key with more specificity
        const cacheKey = getCacheKey(blobbi, blobbiId);
        
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
        const cachedSvg = sessionStorage.getItem(cacheKey);
        
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
        
        // Fetch the SVG
        const svgUrl = getBlobbiSvgUrl(blobbi);
        const response = await fetch(svgUrl);
        const svgText = await response.text();
        
        // Customize the SVG with the Blobbi's colors
        const customizedSvg = customizeSvg(svgText, blobbi);
        
        // Update sessionStorage with new SVG
        sessionStorage.setItem(cacheKey, customizedSvg);
        
        // Update the DOM with the new SVG (even if we had a cached version)
        updateSvgInDom(customizedSvg);
        
        // Update state
        setIsLoadingSvg(false);
        setIsCompanionLoaded(true);
        setCurrentBlobbiId(blobbiId);
        updateInProgress.current = false;
        
        // Show the companion if it wasn't already shown
        window.blobbiCompanion?.show();
        
      } catch (error) {
        console.error('Failed to load Blobbi Companion:', error);
        setIsLoadingSvg(false);
        updateInProgress.current = false;
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
      
      // Cleanup eye animator
      if (eyeAnimator.current) {
        eyeAnimator.current.destroy();
        eyeAnimator.current = null;
      }
    };
  }, [isCompanionLoaded]);

  // This component doesn't render anything visible
  return null;
}
