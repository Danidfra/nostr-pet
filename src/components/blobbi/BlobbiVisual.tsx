import { cn } from '@/lib/utils';
import { Blobbi, BlobbiMood } from '@/types/blobbi';
import { getBlobbiMood } from '@/lib/blobbi';

interface BlobbiVisualProps {
  blobbi: Blobbi;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  onClick?: () => void;
}

export function BlobbiVisual({ blobbi, size = 'medium', className, onClick }: BlobbiVisualProps) {
  const mood = getBlobbiMood(blobbi.stats, blobbi.state);
  
  // Create unique IDs for patterns to avoid conflicts
  const patternIdPrefix = `blobbi-${blobbi.id}-`;
  
  const sizeClasses = {
    small: 'w-24 h-24',
    medium: 'w-48 h-48',
    large: 'w-64 h-64',
  };
  
  const lifeStageScale = {
    baby: 0.7,
    child: 0.85,
    teen: 0.95,
    adult: 1,
  };
  
  const scale = lifeStageScale[blobbi.lifeStage];
  
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
    ? 'animate-bounce' 
    : '';
  
  // Dirt spots for dirty state
  const isDirty = blobbi.stats.cleanliness < 30;
  
  return (
    <div 
      className={cn(
        'relative cursor-pointer transition-transform hover:scale-105',
        sizeClasses[size],
        animationClass,
        className
      )}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        style={{ transform: `scale(${scale})` }}
      >
        {/* Shadow */}
        <ellipse
          cx="50"
          cy="95"
          rx="25"
          ry="3"
          fill="rgba(0,0,0,0.2)"
          className={blobbi.state === 'sleeping' ? 'animate-pulse' : ''}
        />
        
        {/* Main body - teardrop/oval shape */}
        <path
          d="M 50 10 Q 75 25 75 50 Q 75 80 50 90 Q 25 80 25 50 Q 25 25 50 10"
          fill={blobbi.customization.color}
          stroke="rgba(0,0,0,0.1)"
          strokeWidth="2"
          className="transition-colors duration-300"
        />
        
        {/* Pattern overlay if customized */}
        {blobbi.customization.pattern && (
          <path
            d="M 50 10 Q 75 25 75 50 Q 75 80 50 90 Q 25 80 25 50 Q 25 25 50 10"
            fill={`url(#${patternIdPrefix}${blobbi.customization.pattern})`}
            opacity="0.3"
          />
        )}
        
        {/* Eyes */}
        <text x="35" y="45" fontSize="12" textAnchor="middle" fill="#000">
          {blobbi.state === 'sleeping' ? '─' : eyeExpressions[mood]}
        </text>
        <text x="65" y="45" fontSize="12" textAnchor="middle" fill="#000">
          {blobbi.state === 'sleeping' ? '─' : eyeExpressions[mood]}
        </text>
        
        {/* Mouth */}
        <path
          d={mouthPaths[mood]}
          fill="none"
          stroke="#000"
          strokeWidth="2"
          strokeLinecap="round"
        />
        
        {/* Blush for happy mood */}
        {mood === 'happy' && (
          <>
            <circle cx="25" cy="50" r="5" fill="rgba(255,182,193,0.5)" />
            <circle cx="75" cy="50" r="5" fill="rgba(255,182,193,0.5)" />
          </>
        )}
        
        {/* Sweat drop for sick */}
        {mood === 'sick' && (
          <path
            d="M 70 35 Q 72 30 70 28 Q 68 30 70 35"
            fill="#87CEEB"
          />
        )}
        
        {/* Dirt spots */}
        {isDirty && (
          <>
            <circle cx="30" cy="60" r="3" fill="rgba(139,69,19,0.3)" />
            <circle cx="65" cy="70" r="2" fill="rgba(139,69,19,0.3)" />
            <circle cx="45" cy="75" r="2.5" fill="rgba(139,69,19,0.3)" />
          </>
        )}
        
        {/* Z's for sleeping */}
        {blobbi.state === 'sleeping' && (
          <text x="75" y="25" fontSize="10" fill="#666" className="animate-pulse">
            Z
          </text>
        )}
        
        {/* Accessories */}
        {blobbi.customization.accessories.includes('hat') && (
          <path
            d="M 30 15 L 70 15 L 65 5 L 35 5 Z"
            fill="#FF6B6B"
            stroke="#000"
            strokeWidth="1"
          />
        )}
        
        {blobbi.customization.accessories.includes('glasses') && (
          <g>
            <circle cx="35" cy="40" r="8" fill="none" stroke="#000" strokeWidth="2" />
            <circle cx="65" cy="40" r="8" fill="none" stroke="#000" strokeWidth="2" />
            <line x1="43" y1="40" x2="57" y2="40" stroke="#000" strokeWidth="2" />
          </g>
        )}
        
        {/* Pattern definitions */}
        <defs>
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