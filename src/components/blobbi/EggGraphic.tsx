import React from 'react';
import { cn } from '@/lib/utils';

interface EggGraphicProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
  animated?: boolean;
  cracking?: boolean;
  warmth?: number; // 0-100, affects the glow
}

export const EggGraphic: React.FC<EggGraphicProps> = ({
  size = 'medium',
  className,
  animated = false,
  cracking = false,
  warmth = 50,
}) => {
  const sizeClasses = {
    small: 'w-16 h-20',
    medium: 'w-32 h-40',
    large: 'w-48 h-60',
  };

  const baseSize = {
    small: 64,
    medium: 128,
    large: 192,
  };

  const currentSize = baseSize[size];
  const eggWidth = currentSize;
  const eggHeight = currentSize * 1.25;

  // Calculate warmth-based colors
  const getWarmthColor = (warmth: number) => {
    if (warmth < 30) return '#E0F2FE'; // Cool blue
    if (warmth < 50) return '#F0F9FF'; // Light blue
    if (warmth < 70) return '#FFFBEB'; // Warm cream
    if (warmth < 85) return '#FEF3C7'; // Golden
    return '#FED7AA'; // Warm orange
  };

  const getGlowColor = (warmth: number) => {
    if (warmth < 30) return 'rgba(59, 130, 246, 0.3)'; // Blue glow
    if (warmth < 50) return 'rgba(147, 197, 253, 0.3)'; // Light blue glow
    if (warmth < 70) return 'rgba(251, 191, 36, 0.3)'; // Yellow glow
    if (warmth < 85) return 'rgba(245, 158, 11, 0.4)'; // Orange glow
    return 'rgba(239, 68, 68, 0.4)'; // Red glow (too hot)
  };

  const eggColor = getWarmthColor(warmth);
  const glowColor = getGlowColor(warmth);

  return (
    <div 
      className={cn(
        'relative flex items-center justify-center',
        sizeClasses[size],
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
          animated && warmth > 60 && 'animate-egg-warmth',
          cracking && 'animate-egg-crack'
        )}
        style={{
          width: eggWidth,
          height: eggHeight,
          background: `linear-gradient(135deg, ${eggColor} 0%, #FFFFFF  50%, ${eggColor} 100%)`,
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

        {/* Subtle speckles */}
        <div
          className="absolute"
          style={{
            top: '30%',
            right: '30%',
            width: '4px',
            height: '4px',
            background: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '50%',
          }}
        />
        <div
          className="absolute"
          style={{
            top: '60%',
            left: '20%',
            width: '3px',
            height: '3px',
            background: 'rgba(0, 0, 0, 0.08)',
            borderRadius: '50%',
          }}
        />
        <div
          className="absolute"
          style={{
            top: '45%',
            right: '20%',
            width: '2px',
            height: '2px',
            background: 'rgba(0, 0, 0, 0.06)',
            borderRadius: '50%',
          }}
        />

        {/* Cracking lines when cracking is true */}
        {cracking && (
          <>
            <div
              className="absolute"
              style={{
                top: '40%',
                left: '45%',
                width: '2px',
                height: '20%',
                background: 'rgba(0, 0, 0, 0.3)',
                transform: 'rotate(15deg)',
                borderRadius: '1px',
              }}
            />
            <div
              className="absolute"
              style={{
                top: '35%',
                left: '55%',
                width: '1px',
                height: '15%',
                background: 'rgba(0, 0, 0, 0.2)',
                transform: 'rotate(-10deg)',
                borderRadius: '1px',
              }}
            />
            <div
              className="absolute"
              style={{
                top: '50%',
                left: '40%',
                width: '1px',
                height: '12%',
                background: 'rgba(0, 0, 0, 0.25)',
                transform: 'rotate(25deg)',
                borderRadius: '1px',
              }}
            />
          </>
        )}

        {/* Temperature indicator dots */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-1 h-1 rounded-full transition-all duration-300',
                warmth > (i + 1) * 25 ? 'opacity-60' : 'opacity-20'
              )}
              style={{
                background: warmth > (i + 1) * 25 ? getGlowColor(warmth) : 'rgba(0, 0, 0, 0.2)',
              }}
            />
          ))}
        </div>
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