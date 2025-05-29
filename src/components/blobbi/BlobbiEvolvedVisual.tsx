import { cn } from '@/lib/utils';
import { Blobbi, BlobbiMood } from '@/types/blobbi';
import { getBlobbiMood } from '@/lib/blobbi';
import { useEffect, useState, useRef } from 'react';

interface BlobbiEvolvedVisualProps {
  blobbi: Blobbi;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  onClick?: () => void;
}

export function BlobbiEvolvedVisual({ blobbi, size = 'medium', className, onClick }: BlobbiEvolvedVisualProps) {
  const mood = getBlobbiMood(blobbi.stats, blobbi.state);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Create unique IDs for patterns to avoid conflicts
  const patternIdPrefix = `blobbi-${blobbi.id}-`;
  
  // Mouse tracking state
  const [pupilOffset, setPupilOffset] = useState({
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 }
  });
  
  // Check if device has mouse (not touch-only)
  const hasMouseSupport = typeof window !== 'undefined' && 
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  
  useEffect(() => {
    if (!hasMouseSupport || blobbi.state === 'sleeping') return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      
      const rect = svgRef.current.getBoundingClientRect();
      const svgCenterX = rect.left + rect.width / 2;
      const svgCenterY = rect.top + rect.height / 2;
      
      // Calculate angle from SVG center to mouse
      const angle = Math.atan2(e.clientY - svgCenterY, e.clientX - svgCenterX);
      
      // Calculate distance (capped for natural movement)
      const distance = Math.min(
        Math.sqrt(Math.pow(e.clientX - svgCenterX, 2) + Math.pow(e.clientY - svgCenterY, 2)),
        300
      ) / 300;
      
      // Maximum pupil movement (in SVG units)
      const maxOffset = 5;
      
      // Calculate offsets
      const offsetX = Math.cos(angle) * distance * maxOffset;
      const offsetY = Math.sin(angle) * distance * maxOffset;
      
      setPupilOffset({
        left: { x: offsetX, y: offsetY },
        right: { x: offsetX, y: offsetY }
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [hasMouseSupport, blobbi.state]);
  
  const sizeClasses = {
    small: 'w-24 h-24',
    medium: 'w-48 h-48',
    large: 'w-64 h-64',
  };
  
  // Animation classes based on state
  const animationClass = blobbi.state === 'sleeping' 
    ? 'animate-pulse' 
    : mood === 'happy' 
    ? 'animate-bounce' 
    : '';
  
  const renderBlobbi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Base blob shape */}
      <ellipse cx="100" cy="110" rx="60" ry="70" fill={blobbi.customization.color || "#e0e7ff"} />
      
      {/* Soft shading */}
      <ellipse cx="100" cy="110" rx="60" ry="70" fill="url(#blobbiGradient)" opacity="0.3" />
      
      {/* Eyes with mouse tracking */}
      {blobbi.state === 'sleeping' ? (
        <>
          <line x1="70" y1="100" x2="90" y2="100" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
          <line x1="110" y1="100" x2="130" y2="100" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <g 
            style={{
              transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="80" cy="100" r="8" fill="#1e293b" />
            <circle cx="82" cy="98" r="3" fill="white" />
          </g>
          <g 
            style={{
              transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="120" cy="100" r="8" fill="#1e293b" />
            <circle cx="122" cy="98" r="3" fill="white" />
          </g>
        </>
      )}
      
      {/* Mouth based on mood */}
      {mood === 'happy' && <path d="M 80 120 Q 100 135 120 120" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />}
      {mood === 'sad' && <path d="M 80 130 Q 100 115 120 130" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />}
      {(mood === 'neutral' || mood === 'sleepy') && <path d="M 90 120 Q 100 125 110 120" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />}
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('hat') && (
        <g>
          <rect x="70" y="50" width="60" height="10" fill="#f59e0b" rx="2" />
          <rect x="80" y="30" width="40" height="30" fill="#f59e0b" rx="5" />
        </g>
      )}
      
      {blobbi.customization.accessories.includes('glasses') && (
        <g>
          <circle cx="80" cy="100" r="12" fill="none" stroke="#1e293b" strokeWidth="2" />
          <circle cx="120" cy="100" r="12" fill="none" stroke="#1e293b" strokeWidth="2" />
          <line x1="92" y1="100" x2="108" y2="100" stroke="#1e293b" strokeWidth="2" />
        </g>
      )}
      
      <defs>
        <radialGradient id="blobbiGradient">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#c7d2fe" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderPengui = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Body - rounder, more egg-shaped */}
      <ellipse cx="100" cy="115" rx="55" ry="65" fill={blobbi.customization.color || "#374151"} />
      <ellipse cx="100" cy="115" rx="55" ry="65" fill="url(#penguiBodyGradient)" opacity="0.3" />
      
      {/* White belly - larger and rounder */}
      <ellipse cx="100" cy="120" rx="40" ry="45" fill="#f9fafb" />
      <ellipse cx="100" cy="120" rx="40" ry="45" fill="url(#penguiBellyGradient)" opacity="0.5" />
      
      {/* Pattern overlay if customized */}
      {blobbi.customization.pattern && (
        <ellipse cx="100" cy="115" rx="55" ry="65" fill={`url(#${patternIdPrefix}${blobbi.customization.pattern})`} opacity="0.3" />
      )}
      
      {/* Wings - slightly reduced for better proportion */}
      <ellipse cx="55" cy="115" rx="12" ry="22" fill={blobbi.customization.color || "#374151"} transform="rotate(-15 55 115)" />
      <ellipse cx="145" cy="115" rx="12" ry="22" fill={blobbi.customization.color || "#374151"} transform="rotate(15 145 115)" />
      
      {/* Eyes with mouse tracking */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 75 85 Q 85 88 95 85" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 105 85 Q 115 88 125 85" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Eye whites */}
          <ellipse cx="85" cy="85" rx="12" ry="14" fill="#ffffff" />
          <ellipse cx="115" cy="85" rx="12" ry="14" fill="#ffffff" />
          {/* Pupils with tracking */}
          <g 
            style={{
              transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="85" cy="87" r="8" fill="#1e293b" />
            <circle cx="88" cy="84" r="3" fill="white" />
          </g>
          <g 
            style={{
              transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="115" cy="87" r="8" fill="#1e293b" />
            <circle cx="118" cy="84" r="3" fill="white" />
          </g>
        </>
      )}
      
      {/* Beak - rounder and friendlier */}
      <ellipse cx="100" cy="105" rx="8" ry="6" fill="#fb923c" />
      <ellipse cx="100" cy="103" rx="6" ry="4" fill="#fed7aa" opacity="0.6" />
      
      {/* Rosy cheeks */}
      <ellipse cx="60" cy="95" rx="10" ry="8" fill="#fbbf24" opacity="0.3" />
      <ellipse cx="140" cy="95" rx="10" ry="8" fill="#fbbf24" opacity="0.3" />
      
      {/* Feet - more rounded */}
      <ellipse cx="85" cy="175" rx="15" ry="8" fill="#fb923c" />
      <ellipse cx="115" cy="175" rx="15" ry="8" fill="#fb923c" />
      <ellipse cx="85" cy="173" rx="12" ry="5" fill="#fed7aa" opacity="0.5" />
      <ellipse cx="115" cy="173" rx="12" ry="5" fill="#fed7aa" opacity="0.5" />
      
      {/* Mouth based on mood - positioned under beak */}
      {mood === 'happy' && <path d="M 92 110 Q 100 115 108 110" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {mood === 'sad' && <path d="M 92 115 Q 100 110 108 115" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />}
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('scarf') && (
        <g>
          <path d="M 55 125 Q 100 130 145 125 L 145 140 Q 100 145 55 140 Z" fill="#ef4444" />
          <path d="M 125 135 L 130 165 Q 125 170 120 165 L 115 140" fill="#ef4444" />
          <rect x="120" y="160" width="10" height="5" fill="#dc2626" />
        </g>
      )}
      
      {blobbi.customization.accessories.includes('hat') && (
        <g>
          <ellipse cx="100" cy="45" rx="40" ry="30" fill="#60a5fa" />
          <rect x="60" y="40" width="80" height="25" fill="#3b82f6" rx="3" />
          <circle cx="100" cy="30" r="10" fill="#ffffff" />
          <circle cx="100" cy="30" r="7" fill="#dbeafe" />
        </g>
      )}
      
      <defs>
        <radialGradient id="penguiBodyGradient">
          <stop offset="0%" stopColor={blobbi.customization.color || "#6b7280"} stopOpacity="0.8" />
          <stop offset="100%" stopColor={blobbi.customization.color || "#1f2937"} stopOpacity="0.4" />
        </radialGradient>
        <radialGradient id="penguiBellyGradient">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f3f4f6" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderOwli = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Round body */}
      <circle cx="100" cy="110" r="60" fill={blobbi.customization.color || "#a8a29e"} />
      <circle cx="100" cy="110" r="60" fill="url(#owliGradient)" opacity="0.3" />
      
      {/* Triangle ears */}
      <path d="M 60 70 L 70 50 L 80 70 Z" fill={blobbi.customization.color || "#a8a29e"} />
      <path d="M 120 70 L 130 50 L 140 70 Z" fill={blobbi.customization.color || "#a8a29e"} />
      
      {/* Pattern overlay if customized */}
      {blobbi.customization.pattern && (
        <circle cx="100" cy="110" r="60" fill={`url(#${patternIdPrefix}${blobbi.customization.pattern})`} opacity="0.3" />
      )}
      
      {/* Large circular eyes with mouse tracking */}
      {blobbi.state === 'sleeping' ? (
        <>
          <line x1="60" y1="100" x2="100" y2="100" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
          <line x1="100" y1="100" x2="140" y2="100" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Eye whites */}
          <circle cx="80" cy="100" r="20" fill="#f5f5f4" />
          <circle cx="120" cy="100" r="20" fill="#f5f5f4" />
          {/* Pupils with tracking */}
          <g 
            style={{
              transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="80" cy="100" r="12" fill="#1e293b" />
            <circle cx="83" cy="97" r="4" fill="white" />
          </g>
          <g 
            style={{
              transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="120" cy="100" r="12" fill="#1e293b" />
            <circle cx="123" cy="97" r="4" fill="white" />
          </g>
        </>
      )}
      
      {/* Small beak */}
      <path d="M 100 110 L 95 120 L 100 125 L 105 120 Z" fill="#f59e0b" />
      
      {/* Minimal wings */}
      <ellipse cx="50" cy="110" rx="15" ry="30" fill={blobbi.customization.color || "#78716c"} transform="rotate(-20 50 110)" opacity="0.8" />
      <ellipse cx="150" cy="110" rx="15" ry="30" fill={blobbi.customization.color || "#78716c"} transform="rotate(20 150 110)" opacity="0.8" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('bow') && (
        <g>
          <path d="M 85 140 L 100 135 L 115 140 L 115 150 L 100 145 L 85 150 Z" fill="#dc2626" />
          <rect x="95" y="135" width="10" height="15" fill="#991b1b" />
        </g>
      )}
      
      <defs>
        <radialGradient id="owliGradient">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor={blobbi.customization.color || "#78716c"} stopOpacity="0.4" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderCatti = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Oval upright body */}
      <ellipse cx="100" cy="120" rx="45" ry="60" fill={blobbi.customization.color || "#f97316"} />
      <ellipse cx="100" cy="120" rx="45" ry="60" fill="url(#cattiGradient)" opacity="0.3" />
      
      {/* Triangle ears */}
      <path d="M 70 70 L 60 50 L 80 60 Z" fill={blobbi.customization.color || "#f97316"} />
      <path d="M 130 70 L 140 50 L 120 60 Z" fill={blobbi.customization.color || "#f97316"} />
      <path d="M 70 60 L 65 52 L 75 57 Z" fill={blobbi.customization.color || "#fb923c"} opacity="0.8" />
      <path d="M 130 60 L 135 52 L 125 57 Z" fill={blobbi.customization.color || "#fb923c"} opacity="0.8" />
      
      {/* Pattern overlay if customized */}
      {blobbi.customization.pattern && (
        <ellipse cx="100" cy="120" rx="45" ry="60" fill={`url(#${patternIdPrefix}${blobbi.customization.pattern})`} opacity="0.3" />
      )}
      
      {/* Eyes with mouse tracking - enhanced with bigger white area */}
      {blobbi.state === 'sleeping' ? (
        <>
          <line x1="75" y1="100" x2="95" y2="100" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
          <line x1="105" y1="100" x2="125" y2="100" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Left eye */}
          <ellipse cx="85" cy="100" rx="12" ry="16" fill="#f9fafb" />
          <g 
            style={{
              transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <ellipse cx="85" cy="100" rx="8" ry="12" fill="#1e293b" />
            <ellipse cx="87" cy="98" rx="3" ry="4" fill="white" />
          </g>
          {/* Right eye */}
          <ellipse cx="115" cy="100" rx="12" ry="16" fill="#f9fafb" />
          <g 
            style={{
              transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <ellipse cx="115" cy="100" rx="8" ry="12" fill="#1e293b" />
            <ellipse cx="117" cy="98" rx="3" ry="4" fill="white" />
          </g>
        </>
      )}
      
      {/* Cat nose and mouth */}
      <path d="M 95 115 L 100 120 L 105 115 Z" fill="#1e293b" />
      {mood === 'happy' && (
        <>
          <path d="M 100 120 Q 90 125 85 120" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 100 120 Q 110 125 115 120" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
      {mood === 'sad' && (
        <>
          <path d="M 100 120 Q 90 115 85 120" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M 100 120 Q 110 115 115 120" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
        </>
      )}
      
      {/* Curved tail */}
      <path d="M 145 140 Q 160 120 155 100 Q 150 80 160 70" stroke={blobbi.customization.color || "#f97316"} strokeWidth="20" fill="none" strokeLinecap="round" />
      
      {/* Whiskers */}
      <line x1="50" y1="110" x2="70" y2="108" stroke="#1e293b" strokeWidth="1.5" />
      <line x1="50" y1="120" x2="70" y2="118" stroke="#1e293b" strokeWidth="1.5" />
      <line x1="130" y1="108" x2="150" y2="110" stroke="#1e293b" strokeWidth="1.5" />
      <line x1="130" y1="118" x2="150" y2="120" stroke="#1e293b" strokeWidth="1.5" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('collar') && (
        <g>
          <rect x="55" y="145" width="90" height="8" fill="#dc2626" rx="4" />
          <circle cx="100" cy="155" r="6" fill="#fbbf24" />
          <line x1="100" y1="155" x2="100" y2="159" stroke="#1e293b" strokeWidth="1" />
        </g>
      )}
      
      <defs>
        <radialGradient id="cattiGradient">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor={blobbi.customization.color || "#ea580c"} stopOpacity="0.4" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderFroggi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Flattened oval body */}
      <ellipse cx="100" cy="120" rx="70" ry="50" fill={blobbi.customization.color || "#22c55e"} />
      <ellipse cx="100" cy="120" rx="70" ry="50" fill="url(#froggiGradient)" opacity="0.3" />
      
      {/* Big circular pop-out eyes */}
      <circle cx="70" cy="80" r="25" fill={blobbi.customization.color || "#22c55e"} />
      <circle cx="130" cy="80" r="25" fill={blobbi.customization.color || "#22c55e"} />
      
      {/* Pattern overlay if customized */}
      {blobbi.customization.pattern && (
        <ellipse cx="100" cy="120" rx="70" ry="50" fill={`url(#${patternIdPrefix}${blobbi.customization.pattern})`} opacity="0.3" />
      )}
      
      {blobbi.state === 'sleeping' ? (
        <>
          <line x1="55" y1="80" x2="85" y2="80" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
          <line x1="115" y1="80" x2="145" y2="80" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Eye whites */}
          <circle cx="70" cy="80" r="20" fill="#f5f5f4" />
          <circle cx="130" cy="80" r="20" fill="#f5f5f4" />
          {/* Pupils with tracking */}
          <g 
            style={{
              transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="70" cy="80" r="15" fill="#1e293b" />
            <circle cx="73" cy="77" r="5" fill="white" />
          </g>
          <g 
            style={{
              transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="130" cy="80" r="15" fill="#1e293b" />
            <circle cx="133" cy="77" r="5" fill="white" />
          </g>
        </>
      )}
      
      {/* Mouth based on mood */}
      {mood === 'happy' && <path d="M 50 120 Q 100 140 150 120" stroke="#1e293b" strokeWidth="4" fill="none" strokeLinecap="round" />}
      {mood === 'sad' && <path d="M 50 130 Q 100 110 150 130" stroke="#1e293b" strokeWidth="4" fill="none" strokeLinecap="round" />}
      {(mood === 'neutral' || mood === 'sleepy') && <path d="M 60 120 Q 100 125 140 120" stroke="#1e293b" strokeWidth="4" fill="none" strokeLinecap="round" />}
      
      {/* Nostrils */}
      <ellipse cx="90" cy="110" rx="3" ry="5" fill={blobbi.customization.color || "#16a34a"} opacity="0.6" />
      <ellipse cx="110" cy="110" rx="3" ry="5" fill={blobbi.customization.color || "#16a34a"} opacity="0.6" />
      
      {/* Little webbed feet */}
      <ellipse cx="60" cy="160" rx="20" ry="10" fill={blobbi.customization.color || "#22c55e"} />
      <ellipse cx="140" cy="160" rx="20" ry="10" fill={blobbi.customization.color || "#22c55e"} />
      <path d="M 45 160 L 50 155 M 55 160 L 55 155 M 65 160 L 70 155" stroke={blobbi.customization.color || "#16a34a"} strokeWidth="2" opacity="0.6" />
      <path d="M 125 160 L 130 155 M 135 160 L 135 155 M 145 160 L 150 155" stroke={blobbi.customization.color || "#16a34a"} strokeWidth="2" opacity="0.6" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('crown') && (
        <g>
          <path d="M 80 50 L 85 40 L 90 50 L 100 40 L 110 50 L 115 40 L 120 50 L 120 60 L 80 60 Z" fill="#fbbf24" />
          <circle cx="100" cy="45" r="3" fill="#dc2626" />
        </g>
      )}
      
      <defs>
        <radialGradient id="froggiGradient">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor={blobbi.customization.color || "#16a34a"} stopOpacity="0.4" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderPet = () => {
    switch (blobbi.evolutionForm) {
      case 'pengui': return renderPengui();
      case 'owli': return renderOwli();
      case 'catti': return renderCatti();
      case 'froggi': return renderFroggi();
      default: return renderBlobbi();
    }
  };

  // Z's for sleeping
  const renderSleepingZ = () => (
    blobbi.state === 'sleeping' && (
      <text x="150" y="50" fontSize="20" fill="#666" className="animate-pulse">
        Z
      </text>
    )
  );

  // Dirt spots for dirty state
  const isDirty = blobbi.stats.cleanliness < 30;
  const renderDirt = () => (
    isDirty && (
      <>
        <circle cx="60" cy="120" r="6" fill="rgba(139,69,19,0.3)" />
        <circle cx="130" cy="140" r="4" fill="rgba(139,69,19,0.3)" />
        <circle cx="90" cy="150" r="5" fill="rgba(139,69,19,0.3)" />
      </>
    )
  );

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
      <svg ref={svgRef} viewBox="0 0 200 200" className="w-full h-full">
        {renderPet()}
        {renderSleepingZ()}
        {renderDirt()}
        
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