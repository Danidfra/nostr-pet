import { cn } from '@/lib/utils';
import { Blobbi, BlobbiMood } from '@/types/blobbi';
import { getBlobbiMood } from '@/lib/blobbi';
import { useEffect, useState, useRef } from 'react';
import { EggGraphic } from './EggGraphic';
import { BlobbiVisualEffects, BlobbiVisualEffectGradients } from './BlobbiVisualEffects';

interface BlobbiVisualProps {
  blobbi: Blobbi;
  size?: 'small' | 'medium' | 'large' | 'tiny';
  className?: string;
  onClick?: () => void;
  forceInlineSvg?: boolean; // New prop to guarantee inline SVG
}

export function BlobbiVisual({ blobbi, size, className, onClick, forceInlineSvg = false }: BlobbiVisualProps) {
  const mood = getBlobbiMood(blobbi.stats, blobbi.state);
  const svgRef = useRef<SVGSVGElement>(null);

  // Create unique IDs for patterns to avoid conflicts
  const patternIdPrefix = `blobbi-${blobbi.id}-`;

  // Mouse tracking state
  const [pupilOffset, setPupilOffset] = useState({
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 }
  });

  // Blinking state
  const [isBlinking, setIsBlinking] = useState(false);
  const blinkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if device has mouse (not touch-only)
  const hasMouseSupport = typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  useEffect(() => {
    if (blobbi.state === 'sleeping' || blobbi.lifeStage === 'egg') return;

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      if (!svgRef.current || !hasMouseSupport) return;

      const rect = svgRef.current.getBoundingClientRect();
      const svgCenterX = rect.left + rect.width / 2;
      const svgCenterY = rect.top + rect.height / 2;

      // Calculate angle from SVG center to mouse
      const angle = Math.atan2(e.clientY - svgCenterY, e.clientX - svgCenterX);

      // Calculate distance (capped for natural movement)
      const distance = Math.min(
        Math.sqrt(Math.pow(e.clientX - svgCenterX, 2) + Math.pow(e.clientY - svgCenterY, 2)),
        200
      ) / 200;

      // Maximum pupil movement (in SVG units)
      const maxOffset = 2.5;

      // Calculate offsets
      const offsetX = Math.cos(angle) * distance * maxOffset;
      const offsetY = Math.sin(angle) * distance * maxOffset;

      setPupilOffset({
        left: { x: offsetX, y: offsetY },
        right: { x: offsetX, y: offsetY }
      });
    };

    // Blinking logic
    const scheduleNextBlink = () => {
      const delay = 3000 + Math.random() * 3000; // 3-6 seconds
      blinkTimeoutRef.current = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleNextBlink();
        }, 150); // Blink duration
      }, delay);
    };

    if (hasMouseSupport) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    scheduleNextBlink();

    return () => {
      if (hasMouseSupport) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current);
      }
    };
  }, [hasMouseSupport, blobbi.state, blobbi.lifeStage]);

  // If it's an egg, show the EggGraphic component
  if (blobbi.lifeStage === 'egg') {
    return (
      <div
        className={cn(
          'relative cursor-pointer transition-transform hover:scale-105',
          className
        )}
        onClick={onClick}
      >
        <EggGraphic
          blobbi={blobbi}
          sizeVariant={size}
          animated={blobbi.state === 'active'}
          cracking={!!(blobbi.incubationProgress && blobbi.incubationProgress > 80)}
          warmth={blobbi.eggTemperature ?? 50}
          forceInlineSvg={forceInlineSvg}
        />
      </div>
    );
  }

  // NORMALIZED: Stage-based internal scale normalization
  // Baby Blobbis need to appear slightly larger in small slots
  const stageScale = {
    tiny: 0.85,    // Baby at 85% for compact UI slots (increased from 70%)
    small: 0.90,   // Baby at 90% for small contexts
    medium: 1.0,   // Baby at 100% baseline
    large: 1.1,    // Baby at 110% for hero displays
  };

  const scale = stageScale[size as keyof typeof stageScale] || stageScale.medium;

  // Eye expressions based on mood
  const eyeExpressions = {
    happy: '◉',
    sad: '◔',
    sleepy: '─',
    hungry: '◎',
    dirty: '◔',
    sick: '✕',
    neutral: '●',
  };

  // Mouth expressions based on mood
  const mouthPaths = {
    happy: 'M 35 60 Q 50 70 65 60', // Smile
    sad: 'M 35 70 Q 50 60 65 70', // Frown
    sleepy: 'M 40 65 L 60 65', // Straight line
    hungry: 'M 40 65 Q 50 70 60 65', // Small frown
    dirty: 'M 40 65 Q 50 62 60 65', // Slight grimace
    sick: 'M 35 65 Q 50 60 65 65', // Wavy line
    neutral: 'M 40 65 Q 50 67 60 65', // Slight smile
  };

  // Animation classes based on state
  const animationClass = blobbi.state === 'sleeping'
    ? 'animate-pulse'
    : mood === 'happy'
    ? 'animate-blobbi-jump'
    : '';

  // Dirt spots for dirty state
  const isDirty = blobbi.stats.hygiene < 30;

  return (
    <div
      className={cn(
        // NORMALIZED: Fill parent container
        'w-full h-full',
        // Center content
        'relative flex items-center justify-center',
        'cursor-pointer transition-all duration-300 hover:scale-105',
        className
      )}
      onClick={onClick}
    >
      {/* Fixed shadow that scales */}
      <svg
        viewBox="0 0 100 20"
        className={cn(
          "absolute bottom-0 left-0 w-full",
          blobbi.state === 'sleeping' ? 'animate-pulse' : mood === 'happy' ? 'animate-blobbi-shadow' : ''
        )}
        style={{ transformOrigin: 'center bottom' }}
      >
        <ellipse
          cx="50"
          cy="10"
          rx="25"
          ry="3"
          fill="currentColor"
          className="text-black/25 dark:text-black/35"
        />
      </svg>

      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        className={cn("w-full h-full", animationClass)}
        preserveAspectRatio="xMidYMid meet"
        style={{ transform: `scale(${scale})` }}
      >

        {/* Main body - cute water droplet shape with enhanced gradients */}
        <path
          d="M 50 15 Q 50 10 50 15 Q 72 25 75 55 Q 75 80 50 88 Q 25 80 25 55 Q 28 25 50 15"
          fill={`url(#${patternIdPrefix}blobbiBodyGradient)`}
          className="transition-colors duration-300"
        />
        {/* Soft inner glow for gentle warmth */}
        <ellipse
          cx="50"
          cy="45"
          rx="15"
          ry="20"
          fill="white"
          opacity="0.2"
        />

        {/* Pattern overlay if customized - REMOVED VISUAL DISPLAY */}
        {/* {blobbi.customization.pattern && (
          <path
            d="M 50 15 Q 50 10 50 15 Q 72 25 75 55 Q 75 80 50 88 Q 25 80 25 55 Q 28 25 50 15"
            fill={`url(#${patternIdPrefix}${blobbi.customization.pattern})`}
            opacity="0.3"
          />
        )} */}

        {/* Visual Effects Layer - Render BEFORE eyes so they appear behind */}
        <BlobbiVisualEffects blobbi={blobbi} patternIdPrefix={patternIdPrefix} />

        {/* Eyes with gentle depth and enhanced tracking - Render AFTER effects so they appear on top */}
        {blobbi.state === 'sleeping' ? (
          <>
            <path d="M 30 45 Q 40 48 45 45" stroke={`url(#${patternIdPrefix}blobbiMouthGradient)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M 55 45 Q 65 48 70 45" stroke={`url(#${patternIdPrefix}blobbiMouthGradient)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            {/* Left eye with enhanced depth */}
            <g id="left-eye">
              <ellipse
                cx="38"
                cy="45"
                rx="8"
                ry={isBlinking ? "1" : "10"}
                fill={`url(#${patternIdPrefix}blobbiEyeGradient)`}
                style={{
                  transition: 'ry 0.1s ease-in-out'
                }}
              />
              {!isBlinking && (
                <g
                  className="pupil-container"
                  style={{
                    transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`,
                    transition: 'transform 0.1s ease-out'
                  }}
                >
                  <circle cx="38" cy="46" r="6" fill={`url(#${patternIdPrefix}blobbiPupilGradient)`} />
                  <circle cx="40" cy="44" r="2" fill="white" />
                  <circle cx="41" cy="45" r="0.8" fill="white" opacity="0.8" />
                </g>
              )}
            </g>
            {/* Right eye with enhanced depth */}
            <g id="right-eye">
              <ellipse
                cx="62"
                cy="45"
                rx="8"
                ry={isBlinking ? "1" : "10"}
                fill={`url(#${patternIdPrefix}blobbiEyeGradient)`}
                style={{
                  transition: 'ry 0.1s ease-in-out'
                }}
              />
              {!isBlinking && (
                <g
                  className="pupil-container"
                  style={{
                    transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`,
                    transition: 'transform 0.1s ease-out'
                  }}
                >
                  <circle cx="62" cy="46" r="6" fill={`url(#${patternIdPrefix}blobbiPupilGradient)`} />
                  <circle cx="64" cy="44" r="2" fill="white" />
                  <circle cx="65" cy="45" r="0.8" fill="white" opacity="0.8" />
                </g>
              )}
            </g>
          </>
        )}

        {/* Mouth with gentle shading and enhanced expressions */}
        {mood === 'happy' && (
          <path d="M 42 62 Q 50 68 58 62" stroke={`url(#${patternIdPrefix}blobbiMouthGradient)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
        {mood === 'sad' && (
          <path d="M 42 68 Q 50 62 58 68" stroke={`url(#${patternIdPrefix}blobbiMouthGradient)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        )}
        {(mood === 'neutral' || mood === 'sleepy') && (
          <circle cx="50" cy="65" r="1.5" fill={`url(#${patternIdPrefix}blobbiPupilGradient)`} />
        )}
        {mood === 'hungry' && (
          <ellipse cx="50" cy="65" rx="4" ry="6" fill={`url(#${patternIdPrefix}blobbiPupilGradient)`} opacity="0.3" />
        )}
        {mood === 'sick' && (
          <path d="M 45 65 Q 50 62 55 65" stroke={`url(#${patternIdPrefix}blobbiMouthGradient)`} strokeWidth="2" fill="none" strokeLinecap="round" />
        )}
        {mood === 'dirty' && (
          <path d="M 45 65 L 55 65" stroke={`url(#${patternIdPrefix}blobbiMouthGradient)`} strokeWidth="2" strokeLinecap="round" />
        )}

        {/* Soft blush for cuteness */}
        {mood === 'happy' && (
          <>
            <ellipse cx="22" cy="55" rx="6" ry="4" fill="rgba(255,182,193,0.5)" />
            <ellipse cx="78" cy="55" rx="6" ry="4" fill="rgba(255,182,193,0.5)" />
          </>
        )}

        {/* Sweat drop for sick */}
        {mood === 'sick' && (
          <path
            d="M 72 30 Q 74 25 72 23 Q 70 25 72 30"
            fill="#87CEEB"
          />
        )}

        {/* Dirt spots */}
        {isDirty && (
          <>
            <circle cx="30" cy="70" r="3" fill="rgba(139,69,19,0.3)" />
            <circle cx="68" cy="75" r="2" fill="rgba(139,69,19,0.3)" />
            <circle cx="50" cy="80" r="2.5" fill="rgba(139,69,19,0.3)" />
          </>
        )}

        {/* Z's for sleeping */}
        {blobbi.state === 'sleeping' && (
          <text x="75" y="25" fontSize="10" fill="#666" className="animate-pulse">
            Z
          </text>
        )}

        {/* Accessories with enhanced styling */}
        {blobbi.customization.accessories.includes('hat') && (
          <g>
            <ellipse cx="50" cy="12" rx="20" ry="8" fill={`url(#${patternIdPrefix}blobbiHatGradient)`} />
            <rect x="35" y="8" width="30" height="15" fill={`url(#${patternIdPrefix}blobbiHatBandGradient)`} rx="2" />
            <circle cx="50" cy="5" r="3" fill={`url(#${patternIdPrefix}blobbiHatPompomGradient)`} />
            <circle cx="50.5" cy="4" r="1" fill="white" opacity="0.6" />
          </g>
        )}

        {blobbi.customization.accessories.includes('glasses') && (
          <g>
            <circle cx="38" cy="45" r="10" fill="none" stroke={`url(#${patternIdPrefix}blobbiPupilGradient)`} strokeWidth="2" />
            <circle cx="62" cy="45" r="10" fill="none" stroke={`url(#${patternIdPrefix}blobbiPupilGradient)`} strokeWidth="2" />
            <line x1="48" y1="45" x2="52" y2="45" stroke={`url(#${patternIdPrefix}blobbiPupilGradient)`} strokeWidth="2" />
          </g>
        )}

        {/* Enhanced gradient and pattern definitions */}
        <defs>
          {/* Visual Effects Gradients */}
          <BlobbiVisualEffectGradients patternIdPrefix={patternIdPrefix} />
          <radialGradient id={`${patternIdPrefix}blobbiBodyGradient`} cx="0.3" cy="0.25">
            <stop offset="0%" stopColor={blobbi.baseColor || blobbi.customization.color || "#8b5cf6"} />
            <stop offset="60%" stopColor={blobbi.baseColor || blobbi.customization.color || "#7c3aed"} />
            <stop offset="100%" stopColor={blobbi.secondaryColor || blobbi.baseColor || "#6d28d9"} />
          </radialGradient>
          <radialGradient id={`${patternIdPrefix}blobbiEyeGradient`} cx="0.3" cy="0.3">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </radialGradient>
          <radialGradient id={`${patternIdPrefix}blobbiPupilGradient`} cx="0.3" cy="0.3">
            <stop offset="0%" stopColor={blobbi.eyeColor || "#374151"} />
            <stop offset="100%" stopColor={blobbi.eyeColor ? `${blobbi.eyeColor}dd` : "#1e293b"} />
          </radialGradient>
          <linearGradient id={`${patternIdPrefix}blobbiMouthGradient`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#374151" />
            <stop offset="50%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#374151" />
          </linearGradient>
          <radialGradient id={`${patternIdPrefix}blobbiHatGradient`} cx="0.3" cy="0.2">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </radialGradient>
          <radialGradient id={`${patternIdPrefix}blobbiHatBandGradient`} cx="0.3" cy="0.2">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
          <radialGradient id={`${patternIdPrefix}blobbiHatPompomGradient`} cx="0.3" cy="0.3">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="100%" stopColor="#fbbf24" />
          </radialGradient>
          <pattern id={`${patternIdPrefix}stripes`} patternUnits="userSpaceOnUse" width="8" height="8">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#000" strokeWidth="1" opacity="0.2" />
          </pattern>
          <pattern id={`${patternIdPrefix}dots`} patternUnits="userSpaceOnUse" width="12" height="12">
            <circle cx="6" cy="6" r="2" fill="#000" opacity="0.2" />
          </pattern>
        </defs>
      </svg>

      {/* Hibernation indicator */}
      {blobbi.state === 'hibernating' && (
        <div className="absolute inset-0 bg-gray-900/50 rounded-full flex items-center justify-center">
          <span className="text-white text-xs font-bold">Hibernating</span>
        </div>
      )}
    </div>
  );
}