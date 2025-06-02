import React from 'react';
import { cn } from '@/lib/utils';
import { Blobbi } from '@/types/blobbi';
import { isValidBaseColor, isValidSecondaryColor } from '@/lib/blobbi-egg-validation';
import { SpecialMarkRenderer, SpecialMarkFallback } from '@/components/special-marks/SpecialMarkRenderer';
import { isSpecialMarkSupported } from '@/lib/special-marks-utils';
import { useSpecialMark } from '@/hooks/useSpecialMark';

interface EggGraphicProps {
  blobbi?: Blobbi; // Full blobbi object for visual properties
  size?: 'small' | 'medium' | 'large' | 'tiny';
  className?: string;
  animated?: boolean;
  cracking?: boolean;
  warmth?: number; // 0-100, affects the glow (fallback if no blobbi)
}

// Legacy fallback function for special marks (kept for compatibility)
const renderLegacySpecialMark = (specialMark: string, eggWidth: number, eggHeight: number) => {
  console.warn(`Using legacy special mark rendering for: ${specialMark}. Consider updating to use SpecialMarkRenderer.`);
  
  const markStyle = {
    position: 'absolute' as const,
    pointerEvents: 'none' as const,
  };

  switch (specialMark) {
    case 'dot_center':
      return (
        <div
          style={{
            ...markStyle,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '8px',
            height: '8px',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '50%',
          }}
        />
      );
    default:
      return null;
  }
};

export const EggGraphic: React.FC<EggGraphicProps> = ({
  blobbi,
  size = 'medium',
  className,
  animated = false,
  cracking = false,
  warmth = 50,
}) => {
  // Use blobbi size if available, otherwise use prop
  const eggSize = blobbi?.size || size;
  
  // Initialize special mark hook for dynamic rendering
  const specialMarkHook = useSpecialMark(blobbi?.specialMark || null, {
    animated,
    autoAnimate: true,
    performanceMode: false, // Can be made configurable
  });
  
  const sizeClasses = {
    tiny: 'w-12 h-15',
    small: 'w-16 h-20',
    medium: 'w-32 h-40',
    large: 'w-48 h-60',
  };

  const baseSize = {
    tiny: 48,
    small: 64,
    medium: 128,
    large: 192,
  };

  const currentSize = baseSize[eggSize as keyof typeof baseSize];
  const eggWidth = currentSize;
  const eggHeight = currentSize * 1.25;

  // Get actual warmth from blobbi or use prop
  const actualWarmth = blobbi?.eggTemperature ?? warmth;

  // Get base color from blobbi or use warmth-based fallback
  const getBaseColor = () => {
    if (blobbi?.baseColor && isValidBaseColor(blobbi.baseColor)) {
      return blobbi.baseColor;
    }
    // Fallback to specification-compliant colors based on warmth
    if (actualWarmth < 30) return '#f2f2f2'; // Cool light tone (common)
    if (actualWarmth < 50) return '#e6e6ff'; // Light blue (common)
    if (actualWarmth < 70) return '#ffffcc'; // Warm cream (uncommon)
    if (actualWarmth < 85) return '#ccffcc'; // Light green (uncommon)
    return '#99ccff'; // Warm blue (uncommon)
  };

  const getGlowColor = (warmth: number) => {
    if (warmth < 30) return 'rgba(59, 130, 246, 0.3)'; // Blue glow
    if (warmth < 50) return 'rgba(147, 197, 253, 0.3)'; // Light blue glow
    if (warmth < 70) return 'rgba(251, 191, 36, 0.3)'; // Yellow glow
    if (warmth < 85) return 'rgba(245, 158, 11, 0.4)'; // Orange glow
    return 'rgba(239, 68, 68, 0.4)'; // Red glow (too hot)
  };

  const baseColor = getBaseColor();
  const secondaryColor = blobbi?.secondaryColor && isValidSecondaryColor(blobbi.secondaryColor) 
    ? blobbi.secondaryColor 
    : undefined;
  const glowColor = getGlowColor(actualWarmth);

  // Create gradient based on base and secondary colors
  const createEggGradient = () => {
    if (secondaryColor) {
      return `linear-gradient(135deg, ${baseColor} 0%, ${secondaryColor} 50%, ${baseColor} 100%)`;
    }
    return `linear-gradient(135deg, ${baseColor} 0%, #FFFFFF 50%, ${baseColor} 100%)`;
  };

  // Create pattern overlay based on blobbi.pattern
  const createPatternOverlay = () => {
    if (!blobbi?.pattern) return null;

    const patternStyle = {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
      opacity: 0.3,
      pointerEvents: 'none' as const,
    };

    switch (blobbi.pattern) {
      case 'gradient':
        return (
          <div
            style={{
              ...patternStyle,
              background: `linear-gradient(45deg, transparent 30%, ${secondaryColor || 'rgba(255,255,255,0.5)'} 70%)`,
            }}
          />
        );
      case 'stripes':
        return (
          <div
            style={{
              ...patternStyle,
              background: `repeating-linear-gradient(45deg, transparent, transparent 8px, ${secondaryColor || 'rgba(0,0,0,0.1)'} 8px, ${secondaryColor || 'rgba(0,0,0,0.1)'} 16px)`,
            }}
          />
        );
      case 'dots':
        return (
          <div
            style={{
              ...patternStyle,
              background: `radial-gradient(circle at 25% 25%, ${secondaryColor || 'rgba(0,0,0,0.1)'} 2px, transparent 2px), radial-gradient(circle at 75% 75%, ${secondaryColor || 'rgba(0,0,0,0.1)'} 2px, transparent 2px)`,
              backgroundSize: '20px 20px',
            }}
          />
        );
      case 'swirl':
        return (
          <div
            style={{
              ...patternStyle,
              background: `conic-gradient(from 0deg, transparent, ${secondaryColor || 'rgba(255,255,255,0.3)'}, transparent)`,
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className={cn(
        'relative flex items-center justify-center',
        sizeClasses[eggSize as keyof typeof sizeClasses],
        className
      )}
    >
      {/* Glow effect based on warmth */}
      <div
        className={cn(
          'absolute inset-0 rounded-full blur-xl transition-all duration-1000',
          animated && 'animate-pulse'
        )}
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          transform: 'scale(1.2)',
        }}
      />

      {/* Main egg shape */}
      <div
        className={cn(
          'relative transition-all duration-500',
          animated && !cracking && 'animate-egg-sway',
          animated && actualWarmth > 60 && 'animate-egg-warmth',
          cracking && 'animate-egg-crack'
        )}
        style={{
          width: eggWidth,
          height: eggHeight,
          background: createEggGradient(),
          borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
          boxShadow: `
            inset -10px -10px 20px rgba(0, 0, 0, 0.1),
            inset 10px 10px 20px rgba(255, 255, 255, 0.8),
            0 10px 30px rgba(0, 0, 0, 0.2)
          `,
          filter: cracking ? 'brightness(1.1)' : 'brightness(1)',
        }}
      >
        {/* Highlight on the egg */}
        <div
          className="absolute"
          style={{
            top: '20%',
            left: '25%',
            width: '30%',
            height: '25%',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, transparent 100%)',
            borderRadius: '50%',
            filter: 'blur(2px)',
          }}
        />

        {/* Pattern overlay */}
        {createPatternOverlay()}

        {/* Special marks based on blobbi.specialMark */}
        {blobbi?.specialMark && (
          isSpecialMarkSupported(blobbi.specialMark) ? (
            <SpecialMarkRenderer
              specialMark={blobbi.specialMark}
              eggWidth={eggWidth}
              eggHeight={eggHeight}
              animated={specialMarkHook.isAnimated}
              opacity={specialMarkHook.opacity}
              className={specialMarkHook.getAnimationClass()}
            />
          ) : specialMarkHook.useFallback ? (
            <SpecialMarkFallback
              specialMark={blobbi.specialMark}
              eggWidth={eggWidth}
              eggHeight={eggHeight}
            />
          ) : (
            renderLegacySpecialMark(blobbi.specialMark, eggWidth, eggHeight)
          )
        )}

        {/* Crack pattern based on docs/aprovado.svg when cracking is true */}
        {cracking && (
          <svg
            className="absolute inset-0 pointer-events-none"
            viewBox="0 0 120 125"
            style={{
              width: '100%',
              height: '100%',
            }}
          >
            {/* Main horizontal crack (adapted from aprovado.svg) */}
            <path
              d="M10 62 
                 L20 60 
                 L30 64 
                 L40 59 
                 L50 65 
                 L60 58 
                 L70 66 
                 L80 57 
                 L90 67 
                 L100 59 
                 L110 65"
              stroke="rgba(0, 0, 0, 0.6)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />

            {/* Secondary cracks (adapted from aprovado.svg) */}
            <path d="M30 64 L28 70" stroke="rgba(0, 0, 0, 0.4)" strokeWidth="1" strokeLinecap="round" />
            <path d="M50 65 L53 71" stroke="rgba(0, 0, 0, 0.4)" strokeWidth="1" strokeLinecap="round" />
            <path d="M60 58 L57 52" stroke="rgba(0, 0, 0, 0.4)" strokeWidth="1" strokeLinecap="round" />
            <path d="M80 57 L82 50" stroke="rgba(0, 0, 0, 0.4)" strokeWidth="1" strokeLinecap="round" />
            <path d="M90 67 L95 72" stroke="rgba(0, 0, 0, 0.4)" strokeWidth="1" strokeLinecap="round" />
            <path d="M100 59 L97 53" stroke="rgba(0, 0, 0, 0.4)" strokeWidth="1" strokeLinecap="round" />
            <path d="M110 65 L113 69" stroke="rgba(0, 0, 0, 0.4)" strokeWidth="1" strokeLinecap="round" />
            
            {/* Additional micro-cracks for detail */}
            <path d="M40 59 L38 55" stroke="rgba(0, 0, 0, 0.25)" strokeWidth="0.8" strokeLinecap="round" />
            <path d="M70 66 L73 70" stroke="rgba(0, 0, 0, 0.25)" strokeWidth="0.8" strokeLinecap="round" />
            <path d="M20 60 L18 56" stroke="rgba(0, 0, 0, 0.2)" strokeWidth="0.6" strokeLinecap="round" />
            
            {/* Crack highlights for depth (following the main crack pattern) */}
            <path
              d="M10 63 
                 L20 61 
                 L30 65 
                 L40 60 
                 L50 66 
                 L60 59 
                 L70 67 
                 L80 58 
                 L90 68 
                 L100 60 
                 L110 66"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="0.8"
              fill="none"
              strokeLinecap="round"
            />
            
            {/* Secondary crack highlights */}
            <path d="M30 65 L28 71" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.4" strokeLinecap="round" />
            <path d="M60 59 L57 53" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="0.4" strokeLinecap="round" />
          </svg>
        )}



        {/* Title display for special eggs */}
        {blobbi?.title && (
          <div
            className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-center px-2 py-1 bg-black/20 rounded-full backdrop-blur-sm"
            style={{
              color: baseColor,
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
              fontSize: eggSize === 'tiny' ? '8px' : eggSize === 'small' ? '10px' : '12px',
            }}
          >
            {blobbi.title}
          </div>
        )}
      </div>

      {/* Floating particles for magical effect */}
      {animated && (
        <>
          <div
            className="absolute animate-ping"
            style={{
              top: '10%',
              left: '20%',
              width: '4px',
              height: '4px',
              background: 'rgba(251, 191, 36, 0.6)',
              borderRadius: '50%',
              animationDelay: '0s',
              animationDuration: '2s',
            }}
          />
          <div
            className="absolute animate-ping"
            style={{
              top: '20%',
              right: '15%',
              width: '3px',
              height: '3px',
              background: 'rgba(147, 197, 253, 0.6)',
              borderRadius: '50%',
              animationDelay: '0.5s',
              animationDuration: '2.5s',
            }}
          />
          <div
            className="absolute animate-ping"
            style={{
              bottom: '15%',
              left: '15%',
              width: '2px',
              height: '2px',
              background: 'rgba(167, 243, 208, 0.6)',
              borderRadius: '50%',
              animationDelay: '1s',
              animationDuration: '3s',
            }}
          />
        </>
      )}
    </div>
  );
};