import { cn } from '@/lib/utils';
import { Blobbi, BlobbiMood } from '@/types/blobbi';
import { getBlobbiMood } from '@/lib/blobbi';
import { useEffect, useState, useRef } from 'react';

interface BlobbiEvolvedVisualProps {
  blobbi: Blobbi;
  size?: 'small' | 'medium' | 'large' | 'tiny';
  className?: string;
  onClick?: () => void;
}

export function BlobbiEvolvedVisual({ blobbi, size = 'medium', className, onClick }: BlobbiEvolvedVisualProps) {
  // Use blobbi size if available, otherwise use prop
  const displaySize = blobbi.size || size;
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
    tiny: 'w-20 h-20',
    small: 'w-24 h-24',
    medium: 'w-48 h-48',
    large: 'w-64 h-64',
  };
  
  // Animation classes based on state
  const animationClass = blobbi.state === 'sleeping' 
    ? 'animate-pulse' 
    : mood === 'happy' 
    ? 'animate-blobbi-jump' 
    : '';
  
  const renderBlobbi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Gentle shadow for subtle depth */}
      <ellipse
        cx="102"
        cy="190"
        rx="50"
        ry="6"
        fill="rgba(0,0,0,0.15)"
      />
      
      {/* Main body - cute water droplet shape with subtle gradient */}
      <path
        d="M 100 30 Q 100 20 100 30 Q 144 50 150 110 Q 150 160 100 176 Q 50 160 50 110 Q 56 50 100 30"
        fill={`url(#${patternIdPrefix}blobbiBodySubtle)`}
        className="transition-colors duration-300"
      />
      
      {/* Soft inner glow for gentle warmth */}
      <ellipse
        cx="100"
        cy="90"
        rx="30"
        ry="40"
        fill="white"
        opacity="0.2"
      />
      
      {/* Eyes with gentle depth */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 70 90 Q 80 93 90 90" stroke={`url(#${patternIdPrefix}blobbiMouthSubtle)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 110 90 Q 120 93 130 90" stroke={`url(#${patternIdPrefix}blobbiMouthSubtle)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <g id="left-eye">
            <ellipse cx="76" cy="90" rx="16" ry="20" fill={`url(#${patternIdPrefix}blobbiEyeSubtle)`} />
            <g 
              style={{
                transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`,
                transition: 'transform 0.1s ease-out'
              }}
            >
              <circle cx="76" cy="92" r="12" fill={`url(#${patternIdPrefix}blobbiPupilSubtle)`} />
              <circle cx="80" cy="88" r="4" fill="white" />
              <circle cx="82" cy="90" r="1.5" fill="white" opacity="0.8" />
            </g>
          </g>
          <g id="right-eye">
            <ellipse cx="124" cy="90" rx="16" ry="20" fill={`url(#${patternIdPrefix}blobbiEyeSubtle)`} />
            <g 
              style={{
                transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`,
                transition: 'transform 0.1s ease-out'
              }}
            >
              <circle cx="124" cy="92" r="12" fill={`url(#${patternIdPrefix}blobbiPupilSubtle)`} />
              <circle cx="128" cy="88" r="4" fill="white" />
              <circle cx="130" cy="90" r="1.5" fill="white" opacity="0.8" />
            </g>
          </g>
        </>
      )}
      
      {/* Happy mouth with gentle shading */}
      {mood === 'happy' && (
        <path 
          d="M 84 124 Q 100 136 116 124" 
          stroke={`url(#${patternIdPrefix}blobbiMouthSubtle)`} 
          strokeWidth="5" 
          fill="none" 
          strokeLinecap="round" 
        />
      )}
      {mood === 'sad' && (
        <path 
          d="M 84 136 Q 100 124 116 136" 
          stroke={`url(#${patternIdPrefix}blobbiMouthSubtle)`} 
          strokeWidth="5" 
          fill="none" 
          strokeLinecap="round" 
        />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <circle cx="100" cy="130" r="2" fill={`url(#${patternIdPrefix}blobbiPupilSubtle)`} />
      )}
      
      {/* Soft blush for cuteness */}
      {mood === 'happy' && (
        <>
          <ellipse cx="44" cy="110" rx="12" ry="8" fill="rgba(255,182,193,0.5)" />
          <ellipse cx="156" cy="110" rx="12" ry="8" fill="rgba(255,182,193,0.5)" />
        </>
      )}
      
      {/* Accessories with enhanced styling */}
      {blobbi.customization.accessories.includes('hat') && (
        <g>
          <ellipse cx="100" cy="45" rx="32" ry="12" fill={`url(#${patternIdPrefix}blobbiHatSubtle)`} />
          <rect x="78" y="38" width="44" height="15" fill={`url(#${patternIdPrefix}blobbiHatBandSubtle)`} rx="2" />
          <circle cx="100" cy="30" r="6" fill={`url(#${patternIdPrefix}blobbiHatPompomSubtle)`} />
          <circle cx="101" cy="29" r="2" fill="white" opacity="0.6" />
        </g>
      )}
      
      {blobbi.customization.accessories.includes('glasses') && (
        <g>
          <circle cx="76" cy="90" r="18" fill="none" stroke={`url(#${patternIdPrefix}blobbiPupilSubtle)`} strokeWidth="3" />
          <circle cx="124" cy="90" r="18" fill="none" stroke={`url(#${patternIdPrefix}blobbiPupilSubtle)`} strokeWidth="3" />
          <line x1="94" y1="90" x2="106" y2="90" stroke={`url(#${patternIdPrefix}blobbiPupilSubtle)`} strokeWidth="3" />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}blobbiBodySubtle`} cx="0.3" cy="0.25">
          <stop offset="0%" stopColor={blobbi.baseColor || blobbi.customization.color || "#8b5cf6"} />
          <stop offset="60%" stopColor={blobbi.customization.color || "#7c3aed"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#6d28d9"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}blobbiEyeSubtle`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}blobbiPupilSubtle`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1e293b" />
        </radialGradient>
        <linearGradient id={`${patternIdPrefix}blobbiMouthSubtle`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="50%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
        <radialGradient id={`${patternIdPrefix}blobbiHatSubtle`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}blobbiHatBandSubtle`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}blobbiHatPompomSubtle`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderPandi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Main body - perfect circle with subtle outline */}
      <circle cx="100" cy="120" r="55" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
      
      {/* Head - perfect circle with subtle outline */}
      <circle cx="100" cy="85" r="45" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="2" />
      
      {/* Black ear patches - perfect circles using Blobbi's colors */}
      <circle cx="75" cy="65" r="18" fill={blobbi.customization.color || "#1f2937"} />
      <circle cx="125" cy="65" r="18" fill={blobbi.customization.color || "#1f2937"} />
      
      {/* Inner ears - smaller circles */}
      <circle cx="75" cy="65" r="12" fill={blobbi.secondaryColor || "#374151"} />
      <circle cx="125" cy="65" r="12" fill={blobbi.secondaryColor || "#374151"} />
      
      {/* Eye patches - perfect circles */}
      <circle cx="85" cy="85" r="20" fill={blobbi.customization.color || "#1f2937"} />
      <circle cx="115" cy="85" r="20" fill={blobbi.customization.color || "#1f2937"} />
      
      {/* Eyes - geometric circles with enhanced depth */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 75 85 Q 85 88 95 85" stroke={`url(#${patternIdPrefix}pandiMouth3D)`} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 105 85 Q 115 88 125 85" stroke={`url(#${patternIdPrefix}pandiMouth3D)`} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="85" cy="85" r="12" fill={`url(#${patternIdPrefix}pandiEyeWhite3D)`} />
          <circle cx="115" cy="85" r="12" fill={`url(#${patternIdPrefix}pandiEyeWhite3D)`} />
          <g 
            style={{
              transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="85" cy="85" r="8" fill={`url(#${patternIdPrefix}pandiPupil3D)`} />
            <circle cx="88" cy="82" r="3" fill="white" />
          </g>
          <g 
            style={{
              transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="115" cy="85" r="8" fill={`url(#${patternIdPrefix}pandiPupil3D)`} />
            <circle cx="118" cy="82" r="3" fill="white" />
          </g>
        </>
      )}
      
      {/* Nose - simple triangle with gradient */}
      <path d="M 100 95 L 95 105 L 105 105 Z" fill={`url(#${patternIdPrefix}pandiNose3D)`} />
      
      {/* Mouth - geometric curves with enhanced styling */}
      {mood === 'happy' && (
        <path d="M 90 110 Q 100 118 110 110" stroke={`url(#${patternIdPrefix}pandiMouth3D)`} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 90 118 Q 100 110 110 118" stroke={`url(#${patternIdPrefix}pandiMouth3D)`} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 95 114 Q 100 116 105 114" stroke={`url(#${patternIdPrefix}pandiMouth3D)`} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      
      {/* Arms - simple circles with gradient */}
      <circle cx="55" cy="120" r="15" fill={`url(#${patternIdPrefix}pandiArm3D)`} />
      <circle cx="145" cy="120" r="15" fill={`url(#${patternIdPrefix}pandiArm3D)`} />
      
      {/* Legs - simple circles with gradient */}
      <circle cx="80" cy="165" r="18" fill={`url(#${patternIdPrefix}pandiLeg3D)`} />
      <circle cx="120" cy="165" r="18" fill={`url(#${patternIdPrefix}pandiLeg3D)`} />
      
      {/* Accessories with enhanced styling */}
      {blobbi.customization.accessories.includes('hat') && (
        <g>
          <rect x="70" y="45" width="60" height="8" fill={`url(#${patternIdPrefix}pandiBambooHat3D)`} rx="4" stroke="#16a34a" strokeWidth="1" />
          <rect x="75" y="25" width="50" height="25" fill={`url(#${patternIdPrefix}pandiBambooHatTop3D)`} rx="3" stroke="#15803d" strokeWidth="1" />
          <rect x="80" y="30" width="40" height="15" fill={`url(#${patternIdPrefix}pandiBambooHat3D)`} rx="2" stroke="#16a34a" strokeWidth="1" />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}pandiEyeWhite3D`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f5f5f4" />
          <stop offset="100%" stopColor="#e7e5e4" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}pandiPupil3D`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1e293b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}pandiNose3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor={blobbi.customization.color || "#1f2937"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#374151"} />
        </radialGradient>
        <linearGradient id={`${patternIdPrefix}pandiMouth3D`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="50%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
        <radialGradient id={`${patternIdPrefix}pandiArm3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor={blobbi.customization.color || "#1f2937"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#374151"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}pandiLeg3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor={blobbi.customization.color || "#1f2937"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#374151"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}pandiBambooHat3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}pandiBambooHatTop3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderOwli = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Round body with enhanced 3D gradient */}
      <circle cx="100" cy="110" r="60" fill={`url(#${patternIdPrefix}owliBody3D)`} />
      
      {/* Triangle ears with depth */}
      <path d="M 60 70 L 70 48 L 82 70 Z" fill={`url(#${patternIdPrefix}owliEar3D)`} />
      <path d="M 118 70 L 130 48 L 140 70 Z" fill={`url(#${patternIdPrefix}owliEar3D)`} />
      <path d="M 65 65 L 70 52 L 77 65 Z" fill={`url(#${patternIdPrefix}owliEarInner)`} />
      <path d="M 123 65 L 130 52 L 135 65 Z" fill={`url(#${patternIdPrefix}owliEarInner)`} />
      
      {/* Large expressive eyes with enhanced depth */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 60 100 Q 70 103 80 100" stroke={`url(#${patternIdPrefix}owliMouth3D)`} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 120 100 Q 130 103 140 100" stroke={`url(#${patternIdPrefix}owliMouth3D)`} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="80" cy="100" r="22" fill={`url(#${patternIdPrefix}owliEyeWhite3D)`} />
          <circle cx="120" cy="100" r="22" fill={`url(#${patternIdPrefix}owliEyeWhite3D)`} />
          <g 
            style={{
              transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="80" cy="100" r="14" fill={`url(#${patternIdPrefix}owliPupil3D)`} />
            <circle cx="84" cy="96" r="5" fill="white" opacity="0.9" />
            <circle cx="86" cy="98" r="2" fill="white" />
          </g>
          <g 
            style={{
              transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="120" cy="100" r="14" fill={`url(#${patternIdPrefix}owliPupil3D)`} />
            <circle cx="124" cy="96" r="5" fill="white" opacity="0.9" />
            <circle cx="126" cy="98" r="2" fill="white" />
          </g>
        </>
      )}
      
      {/* Enhanced beak with 3D shading */}
      <path d="M 100 112 L 94 122 L 100 128 L 106 122 Z" fill={`url(#${patternIdPrefix}owliBeak3D)`} />
      <path d="M 100 114 L 96 120 L 100 124 L 104 120 Z" fill={`url(#${patternIdPrefix}owliBeakHighlight)`} />
      
      {/* Subtle wing details with layered depth */}
      <ellipse cx="48" cy="110" rx="16" ry="32" fill={`url(#${patternIdPrefix}owliWing3D)`} transform="rotate(-20 48 110)" />
      <ellipse cx="152" cy="110" rx="16" ry="32" fill={`url(#${patternIdPrefix}owliWing3D)`} transform="rotate(20 152 110)" />
      <ellipse cx="50" cy="108" rx="12" ry="25" fill={`url(#${patternIdPrefix}owliWingHighlight)`} transform="rotate(-20 50 108)" />
      <ellipse cx="150" cy="108" rx="12" ry="25" fill={`url(#${patternIdPrefix}owliWingHighlight)`} transform="rotate(20 150 108)" />
      
      {/* Soft feather texture details */}
      <circle cx="70" cy="130" r="3" fill="rgba(255,255,255,0.2)" />
      <circle cx="130" cy="125" r="2.5" fill="rgba(255,255,255,0.2)" />
      <circle cx="85" cy="140" r="2" fill="rgba(255,255,255,0.15)" />
      <circle cx="115" cy="135" r="2.5" fill="rgba(255,255,255,0.15)" />
      
      {/* Accessories with enhanced styling */}
      {blobbi.customization.accessories.includes('bow') && (
        <g>
          <path d="M 83 142 L 100 136 L 117 142 L 117 154 L 100 148 L 83 154 Z" fill={`url(#${patternIdPrefix}owliBowTie3D)`} />
          <rect x="94" y="136" width="12" height="18" fill={`url(#${patternIdPrefix}owliBowTieCenter3D)`} rx="2" />
          <ellipse cx="100" cy="145" rx="4" ry="6" fill="rgba(255,255,255,0.3)" />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}owliBody3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#d6d3d1" />
          <stop offset="40%" stopColor={blobbi.customization.color || "#a8a29e"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#78716c"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}owliEar3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor={blobbi.customization.color || "#a8a29e"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#57534e"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}owliEarInner`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}owliEyeWhite3D`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f5f5f4" />
          <stop offset="100%" stopColor="#e7e5e4" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}owliPupil3D`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1e293b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}owliBeak3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}owliBeakHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}owliWing3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor={blobbi.customization.color || "#a8a29e"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#57534e"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}owliWingHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#d6d3d1" />
          <stop offset="100%" stopColor={blobbi.customization.color || "#a8a29e"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}owliBowTie3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="50%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}owliBowTieCenter3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>
        <linearGradient id={`${patternIdPrefix}owliMouth3D`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="50%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
      </defs>
    </svg>
  );

  const renderCatti = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Oval upright body with enhanced 3D gradient */}
      <ellipse cx="100" cy="120" rx="45" ry="60" fill={`url(#${patternIdPrefix}cattiBody3D)`} />
      
      {/* Triangle ears with depth and inner detail */}
      <path d="M 68 72 L 58 48 L 82 62 Z" fill={`url(#${patternIdPrefix}cattiEar3D)`} />
      <path d="M 132 72 L 142 48 L 118 62 Z" fill={`url(#${patternIdPrefix}cattiEar3D)`} />
      <path d="M 70 62 L 64 52 L 76 58 Z" fill={`url(#${patternIdPrefix}cattiEarInner)`} />
      <path d="M 130 62 L 136 52 L 124 58 Z" fill={`url(#${patternIdPrefix}cattiEarInner)`} />
      
      {/* Enhanced expressive eyes with depth */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 75 100 Q 85 103 95 100" stroke={`url(#${patternIdPrefix}cattiMouth3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 105 100 Q 115 103 125 100" stroke={`url(#${patternIdPrefix}cattiMouth3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="85" cy="100" rx="12" ry="16" fill={`url(#${patternIdPrefix}cattiEyeWhite3D)`} />
          <ellipse cx="115" cy="100" rx="12" ry="16" fill={`url(#${patternIdPrefix}cattiEyeWhite3D)`} />
          <g 
            style={{
              transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <ellipse cx="85" cy="100" rx="8" ry="12" fill={`url(#${patternIdPrefix}cattiPupil3D)`} />
            <ellipse cx="87" cy="97" rx="3" ry="4" fill="white" opacity="0.9" />
            <ellipse cx="89" cy="99" rx="1.5" ry="2" fill="white" />
          </g>
          <g 
            style={{
              transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <ellipse cx="115" cy="100" rx="8" ry="12" fill={`url(#${patternIdPrefix}cattiPupil3D)`} />
            <ellipse cx="117" cy="97" rx="3" ry="4" fill="white" opacity="0.9" />
            <ellipse cx="119" cy="99" rx="1.5" ry="2" fill="white" />
          </g>
        </>
      )}
      
      {/* Enhanced cat nose with 3D effect */}
      <path d="M 94 115 L 100 122 L 106 115 Z" fill={`url(#${patternIdPrefix}cattiNose3D)`} />
      <path d="M 96 116 L 100 120 L 104 116 Z" fill={`url(#${patternIdPrefix}cattiNoseHighlight)`} />
      
      {/* Cat mouth with subtle curves */}
      {mood === 'happy' && (
        <>
          <path d="M 100 122 Q 88 128 82 122" stroke={`url(#${patternIdPrefix}cattiMouth3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 100 122 Q 112 128 118 122" stroke={`url(#${patternIdPrefix}cattiMouth3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {mood === 'sad' && (
        <>
          <path d="M 100 122 Q 88 116 82 122" stroke={`url(#${patternIdPrefix}cattiMouth3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 100 122 Q 112 116 118 122" stroke={`url(#${patternIdPrefix}cattiMouth3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <>
          <path d="M 100 122 Q 92 125 88 122" stroke={`url(#${patternIdPrefix}cattiMouth3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M 100 122 Q 108 125 112 122" stroke={`url(#${patternIdPrefix}cattiMouth3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}
      
      {/* Enhanced curved tail with gradient */}
      <path d="M 145 140 Q 165 115 158 95 Q 148 75 165 65" stroke={`url(#${patternIdPrefix}cattiTail3D)`} strokeWidth="22" fill="none" strokeLinecap="round" />
      <path d="M 145 140 Q 163 117 156 97 Q 148 79 163 69" stroke={`url(#${patternIdPrefix}cattiTailHighlight)`} strokeWidth="16" fill="none" strokeLinecap="round" />
      
      {/* Enhanced whiskers with subtle curves */}
      <path d="M 48 108 Q 58 110 72 108" stroke="#1e293b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M 48 118 Q 58 120 72 118" stroke="#1e293b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M 128 108 Q 138 110 152 108" stroke="#1e293b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M 128 118 Q 138 120 152 118" stroke="#1e293b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      
      {/* Soft fur texture details */}
      <ellipse cx="75" cy="135" rx="3" ry="2" fill="rgba(255,255,255,0.2)" />
      <ellipse cx="125" cy="130" rx="2.5" ry="2" fill="rgba(255,255,255,0.2)" />
      <ellipse cx="90" cy="150" rx="2" ry="1.5" fill="rgba(255,255,255,0.15)" />
      
      {/* Accessories with enhanced styling */}
      {blobbi.customization.accessories.includes('collar') && (
        <g>
          <rect x="53" y="145" width="94" height="10" fill={`url(#${patternIdPrefix}cattiCollar3D)`} rx="5" />
          <circle cx="100" cy="157" r="8" fill={`url(#${patternIdPrefix}cattiBell3D)`} />
          <circle cx="100" cy="155" r="6" fill={`url(#${patternIdPrefix}cattiBellHighlight)`} />
          <line x1="100" y1="157" x2="100" y2="162" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}cattiBody3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="40%" stopColor={blobbi.customization.color || "#f97316"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#c2410c"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cattiEar3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor={blobbi.customization.color || "#f97316"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#c2410c"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cattiEarInner`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cattiEyeWhite3D`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f3f4f6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cattiPupil3D`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cattiNose3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#be185d" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cattiNoseHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <linearGradient id={`${patternIdPrefix}cattiMouth3D`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="50%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
        <radialGradient id={`${patternIdPrefix}cattiTail3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="50%" stopColor={blobbi.customization.color || "#f97316"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#c2410c"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cattiTailHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fed7aa" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cattiCollar3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cattiBell3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cattiBellHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fefce8" />
          <stop offset="100%" stopColor="#fde047" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderFroggi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Flattened oval body with enhanced 3D gradient */}
      <ellipse cx="100" cy="120" rx="70" ry="50" fill={`url(#${patternIdPrefix}froggiBody3D)`} />
      
      {/* Big circular pop-out eyes with enhanced depth */}
      <circle cx="70" cy="80" r="27" fill={`url(#${patternIdPrefix}froggiEyeBase3D)`} />
      <circle cx="130" cy="80" r="27" fill={`url(#${patternIdPrefix}froggiEyeBase3D)`} />
      
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 55 80 Q 65 83 75 80" stroke={`url(#${patternIdPrefix}froggiMouth3D)`} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 125 80 Q 135 83 145 80" stroke={`url(#${patternIdPrefix}froggiMouth3D)`} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="70" cy="80" r="22" fill={`url(#${patternIdPrefix}froggiEyeWhite3D)`} />
          <circle cx="130" cy="80" r="22" fill={`url(#${patternIdPrefix}froggiEyeWhite3D)`} />
          <g 
            style={{
              transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="70" cy="80" r="16" fill={`url(#${patternIdPrefix}froggiPupil3D)`} />
            <circle cx="74" cy="76" r="6" fill="white" opacity="0.9" />
            <circle cx="76" cy="78" r="2.5" fill="white" />
          </g>
          <g 
            style={{
              transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`,
              transition: 'transform 0.1s ease-out'
            }}
          >
            <circle cx="130" cy="80" r="16" fill={`url(#${patternIdPrefix}froggiPupil3D)`} />
            <circle cx="134" cy="76" r="6" fill="white" opacity="0.9" />
            <circle cx="136" cy="78" r="2.5" fill="white" />
          </g>
        </>
      )}
      
      {/* Enhanced wide smile with depth */}
      {mood === 'happy' && (
        <>
          <path d="M 45 120 Q 100 145 155 120" stroke={`url(#${patternIdPrefix}froggiMouth3D)`} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M 50 122 Q 100 142 150 122" stroke={`url(#${patternIdPrefix}froggiMouthHighlight)`} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      )}
      {mood === 'sad' && (
        <path d="M 45 135 Q 100 115 155 135" stroke={`url(#${patternIdPrefix}froggiMouth3D)`} strokeWidth="5" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 60 120 Q 100 125 140 120" stroke={`url(#${patternIdPrefix}froggiMouth3D)`} strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      
      {/* Enhanced nostrils with 3D effect */}
      <ellipse cx="90" cy="110" rx="4" ry="6" fill={`url(#${patternIdPrefix}froggiNostril3D)`} />
      <ellipse cx="110" cy="110" rx="4" ry="6" fill={`url(#${patternIdPrefix}froggiNostril3D)`} />
      <ellipse cx="90" cy="108" rx="2" ry="3" fill={`url(#${patternIdPrefix}froggiNostrilHighlight)`} />
      <ellipse cx="110" cy="108" rx="2" ry="3" fill={`url(#${patternIdPrefix}froggiNostrilHighlight)`} />
      
      {/* Enhanced webbed feet with depth */}
      <ellipse cx="60" cy="160" rx="22" ry="12" fill={`url(#${patternIdPrefix}froggiFeet3D)`} />
      <ellipse cx="140" cy="160" rx="22" ry="12" fill={`url(#${patternIdPrefix}froggiFeet3D)`} />
      <ellipse cx="60" cy="158" rx="18" ry="8" fill={`url(#${patternIdPrefix}froggiFeetHighlight)`} />
      <ellipse cx="140" cy="158" rx="18" ry="8" fill={`url(#${patternIdPrefix}froggiFeetHighlight)`} />
      
      {/* Enhanced webbed toes */}
      <path d="M 43 160 Q 47 155 52 160" stroke={`url(#${patternIdPrefix}froggiToe3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 53 160 Q 57 155 62 160" stroke={`url(#${patternIdPrefix}froggiToe3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 63 160 Q 67 155 72 160" stroke={`url(#${patternIdPrefix}froggiToe3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 123 160 Q 127 155 132 160" stroke={`url(#${patternIdPrefix}froggiToe3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 133 160 Q 137 155 142 160" stroke={`url(#${patternIdPrefix}froggiToe3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 143 160 Q 147 155 152 160" stroke={`url(#${patternIdPrefix}froggiToe3D)`} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      
      {/* Soft skin texture details */}
      <ellipse cx="75" cy="135" rx="4" ry="3" fill="rgba(255,255,255,0.2)" />
      <ellipse cx="125" cy="130" rx="3.5" ry="2.5" fill="rgba(255,255,255,0.2)" />
      <ellipse cx="85" cy="145" rx="3" ry="2" fill="rgba(255,255,255,0.15)" />
      <ellipse cx="115" cy="140" rx="3.5" ry="2.5" fill="rgba(255,255,255,0.15)" />
      
      {/* Accessories with enhanced styling */}
      {blobbi.customization.accessories.includes('crown') && (
        <g>
          <path d="M 78 52 L 84 38 L 92 52 L 100 38 L 108 52 L 116 38 L 122 52 L 122 64 L 78 64 Z" fill={`url(#${patternIdPrefix}froggiCrown3D)`} />
          <path d="M 80 54 L 85 42 L 90 54 L 100 42 L 110 54 L 115 42 L 120 54 L 120 62 L 80 62 Z" fill={`url(#${patternIdPrefix}froggiCrownHighlight)`} />
          <circle cx="100" cy="46" r="4" fill={`url(#${patternIdPrefix}froggiGem3D)`} />
          <circle cx="100" cy="44" r="2.5" fill={`url(#${patternIdPrefix}froggiGemHighlight)`} />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}froggiBody3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="40%" stopColor={blobbi.customization.color || "#22c55e"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#15803d"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}froggiEyeBase3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor={blobbi.customization.color || "#16a34a"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}froggiEyeWhite3D`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f5f5f4" />
          <stop offset="100%" stopColor="#e7e5e4" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}froggiPupil3D`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1e293b" />
        </radialGradient>
        <linearGradient id={`${patternIdPrefix}froggiMouth3D`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="50%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
        <linearGradient id={`${patternIdPrefix}froggiMouthHighlight`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </linearGradient>
        <radialGradient id={`${patternIdPrefix}froggiNostril3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor={blobbi.customization.color || "#16a34a"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#14532d"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}froggiNostrilHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor={blobbi.customization.color || "#16a34a"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}froggiFeet3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor={blobbi.customization.color || "#16a34a"} />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}froggiFeetHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#4ade80" />
        </radialGradient>
        <linearGradient id={`${patternIdPrefix}froggiToe3D`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={blobbi.customization.color || "#16a34a"} />
          <stop offset="100%" stopColor={blobbi.secondaryColor || "#14532d"} />
        </linearGradient>
        <radialGradient id={`${patternIdPrefix}froggiCrown3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}froggiCrownHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fefce8" />
          <stop offset="100%" stopColor="#fde047" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}froggiGem3D`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="50%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}froggiGemHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fecaca" />
          <stop offset="100%" stopColor="#f87171" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderCloudi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Main cloud body - multiple overlapping circles */}
      <circle cx="100" cy="120" r="45" fill={`url(#${patternIdPrefix}cloudiBody)`} />
      <circle cx="75" cy="110" r="35" fill={`url(#${patternIdPrefix}cloudiBody)`} />
      <circle cx="125" cy="110" r="35" fill={`url(#${patternIdPrefix}cloudiBody)`} />
      <circle cx="85" cy="95" r="25" fill={`url(#${patternIdPrefix}cloudiBody)`} />
      <circle cx="115" cy="95" r="25" fill={`url(#${patternIdPrefix}cloudiBody)`} />
      <circle cx="100" cy="85" r="30" fill={`url(#${patternIdPrefix}cloudiBody)`} />
      
      {/* Fluffy highlights */}
      <circle cx="90" cy="100" r="20" fill={`url(#${patternIdPrefix}cloudiHighlight)`} opacity="0.6" />
      <circle cx="110" cy="105" r="18" fill={`url(#${patternIdPrefix}cloudiHighlight)`} opacity="0.5" />
      <circle cx="100" cy="90" r="15" fill={`url(#${patternIdPrefix}cloudiHighlight)`} opacity="0.7" />
      
      {/* Cute eyes */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 80 100 Q 88 103 96 100" stroke="#64748b" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 104 100 Q 112 103 120 100" stroke="#64748b" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="88" cy="100" r="8" fill="white" />
          <circle cx="112" cy="100" r="8" fill="white" />
          <g style={{ transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="88" cy="100" r="5" fill="#64748b" />
            <circle cx="90" cy="98" r="2" fill="white" />
          </g>
          <g style={{ transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="112" cy="100" r="5" fill="#64748b" />
            <circle cx="114" cy="98" r="2" fill="white" />
          </g>
        </>
      )}
      
      {/* Happy smile */}
      {mood === 'happy' && (
        <path d="M 92 115 Q 100 122 108 115" stroke="#64748b" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 92 122 Q 100 115 108 122" stroke="#64748b" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 96 118 Q 100 120 104 118" stroke="#64748b" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      
      {/* Floating raindrops */}
      <circle cx="70" cy="140" r="3" fill={`url(#${patternIdPrefix}cloudiRain)`} opacity="0.8" />
      <circle cx="130" cy="145" r="2.5" fill={`url(#${patternIdPrefix}cloudiRain)`} opacity="0.6" />
      <circle cx="85" cy="155" r="2" fill={`url(#${patternIdPrefix}cloudiRain)`} opacity="0.7" />
      <circle cx="115" cy="150" r="2.5" fill={`url(#${patternIdPrefix}cloudiRain)`} opacity="0.5" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('rainbow') && (
        <g>
          <path d="M 60 80 Q 100 60 140 80" stroke="#ef4444" strokeWidth="4" fill="none" opacity="0.8" />
          <path d="M 62 82 Q 100 62 138 82" stroke="#f97316" strokeWidth="4" fill="none" opacity="0.8" />
          <path d="M 64 84 Q 100 64 136 84" stroke="#eab308" strokeWidth="4" fill="none" opacity="0.8" />
          <path d="M 66 86 Q 100 66 134 86" stroke="#22c55e" strokeWidth="4" fill="none" opacity="0.8" />
          <path d="M 68 88 Q 100 68 132 88" stroke="#3b82f6" strokeWidth="4" fill="none" opacity="0.8" />
          <path d="M 70 90 Q 100 70 130 90" stroke="#8b5cf6" strokeWidth="4" fill="none" opacity="0.8" />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}cloudiBody`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cloudiHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cloudiRain`} cx="0.5" cy="0.3">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderCrysti = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">      
      {/* Main crystal body - rounded hexagon shape */}
      <path d="M 100 50 L 140 80 L 140 130 L 100 160 L 60 130 L 60 80 Z" fill={`url(#${patternIdPrefix}crystiBody)`} />
      <path d="M 100 55 L 135 82 L 135 128 L 100 155 L 65 128 L 65 82 Z" fill={`url(#${patternIdPrefix}crystiInner)`} opacity="0.7" />
      
      {/* Crystal segments with rounded edges */}
      <path d="M 100 50 L 125 70 L 100 105 L 75 70 Z" fill={`url(#${patternIdPrefix}crystiFacet1)`} opacity="0.8" />
      <path d="M 75 70 L 100 105 L 60 80 L 60 105 Z" fill={`url(#${patternIdPrefix}crystiFacet2)`} opacity="0.7" />
      <path d="M 125 70 L 140 80 L 140 105 L 100 105 Z" fill={`url(#${patternIdPrefix}crystiFacet3)`} opacity="0.7" />
      <path d="M 60 105 L 100 105 L 75 140 L 60 130 Z" fill={`url(#${patternIdPrefix}crystiFacet4)`} opacity="0.6" />
      <path d="M 100 105 L 140 105 L 125 140 L 100 105 Z" fill={`url(#${patternIdPrefix}crystiFacet5)`} opacity="0.6" />
      <path d="M 75 140 L 100 105 L 125 140 L 100 160 Z" fill={`url(#${patternIdPrefix}crystiFacet6)`} opacity="0.8" />
      
      {/* Sparkly eyes */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 80 95 Q 88 98 96 95" stroke={`url(#${patternIdPrefix}crystiSmile)`} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 104 95 Q 112 98 120 95" stroke={`url(#${patternIdPrefix}crystiSmile)`} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="88" cy="95" r="10" fill={`url(#${patternIdPrefix}crystiEye)`} />
          <circle cx="112" cy="95" r="10" fill={`url(#${patternIdPrefix}crystiEye)`} />
          <g style={{ transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="88" cy="95" r="6" fill="#1e1b4b" />
            <circle cx="90" cy="93" r="3" fill="white" />
          </g>
          <g style={{ transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="112" cy="95" r="6" fill="#1e1b4b" />
            <circle cx="114" cy="93" r="3" fill="white" />
          </g>
        </>
      )}
      
      {/* Crystal smile */}
      {mood === 'happy' && (
        <path d="M 90 115 Q 100 123 110 115" stroke={`url(#${patternIdPrefix}crystiSmile)`} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 90 123 Q 100 115 110 123" stroke={`url(#${patternIdPrefix}crystiSmile)`} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 94 119 Q 100 121 106 119" stroke={`url(#${patternIdPrefix}crystiSmile)`} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      
      {/* Floating sparkles */}
      <circle cx="65" cy="65" r="2" fill={`url(#${patternIdPrefix}crystiSparkle1)`} opacity="0.9" />
      <circle cx="135" cy="70" r="1.5" fill={`url(#${patternIdPrefix}crystiSparkle2)`} opacity="0.8" />
      <circle cx="70" cy="140" r="1" fill={`url(#${patternIdPrefix}crystiSparkle3)`} opacity="0.7" />
      <circle cx="130" cy="135" r="2" fill={`url(#${patternIdPrefix}crystiSparkle1)`} opacity="0.6" />
      <circle cx="50" cy="105" r="1.5" fill={`url(#${patternIdPrefix}crystiSparkle2)`} opacity="0.8" />
      <circle cx="150" cy="110" r="1" fill={`url(#${patternIdPrefix}crystiSparkle3)`} opacity="0.9" />
      <circle cx="100" cy="40" r="1.5" fill={`url(#${patternIdPrefix}crystiSparkle1)`} opacity="0.7" />
      <circle cx="100" cy="170" r="1" fill={`url(#${patternIdPrefix}crystiSparkle2)`} opacity="0.8" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('tiara') && (
        <g>
          <path d="M 70 45 L 75 30 L 85 45 L 90 25 L 100 45 L 110 25 L 115 45 L 125 30 L 130 45" 
                stroke={`url(#${patternIdPrefix}crystiCrown)`} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="90" cy="25" r="3" fill={`url(#${patternIdPrefix}crystiGem)`} />
          <circle cx="100" cy="20" r="4" fill={`url(#${patternIdPrefix}crystiGem)`} />
          <circle cx="110" cy="25" r="3" fill={`url(#${patternIdPrefix}crystiGem)`} />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}crystiShadow`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}crystiBody`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f3e8ff" />
          <stop offset="30%" stopColor="#e9d5ff" />
          <stop offset="70%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}crystiInner`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </radialGradient>
        <linearGradient id={`${patternIdPrefix}crystiFacet1`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id={`${patternIdPrefix}crystiFacet2`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id={`${patternIdPrefix}crystiFacet3`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id={`${patternIdPrefix}crystiFacet4`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id={`${patternIdPrefix}crystiFacet5`} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id={`${patternIdPrefix}crystiFacet6`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <radialGradient id={`${patternIdPrefix}crystiEye`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e9d5ff" />
        </radialGradient>
        <linearGradient id={`${patternIdPrefix}crystiSmile`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <radialGradient id={`${patternIdPrefix}crystiSparkle1`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}crystiSparkle2`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#ec4899" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}crystiSparkle3`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}crystiCrown`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}crystiGem`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderBloomi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Flower petals - overlapping circles */}
      <circle cx="100" cy="70" r="25" fill={`url(#${patternIdPrefix}bloomiPetal1)`} />
      <circle cx="130" cy="90" r="25" fill={`url(#${patternIdPrefix}bloomiPetal2)`} />
      <circle cx="130" cy="130" r="25" fill={`url(#${patternIdPrefix}bloomiPetal3)`} />
      <circle cx="100" cy="150" r="25" fill={`url(#${patternIdPrefix}bloomiPetal4)`} />
      <circle cx="70" cy="130" r="25" fill={`url(#${patternIdPrefix}bloomiPetal5)`} />
      <circle cx="70" cy="90" r="25" fill={`url(#${patternIdPrefix}bloomiPetal6)`} />
      
      {/* Center body - round and cheerful */}
      <circle cx="100" cy="110" r="35" fill={`url(#${patternIdPrefix}bloomiCenter)`} />
      <circle cx="100" cy="110" r="28" fill={`url(#${patternIdPrefix}bloomiCenterHighlight)`} opacity="0.6" />
      
      {/* Happy eyes */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 80 105 Q 88 108 96 105" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 104 105 Q 112 108 120 105" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="88" cy="105" r="8" fill="white" />
          <circle cx="112" cy="105" r="8" fill="white" />
          <g style={{ transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="88" cy="105" r="5" fill="#1f2937" />
            <circle cx="90" cy="103" r="2" fill="white" />
          </g>
          <g style={{ transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="112" cy="105" r="5" fill="#1f2937" />
            <circle cx="114" cy="103" r="2" fill="white" />
          </g>
        </>
      )}
      
      {/* Sweet smile */}
      {mood === 'happy' && (
        <path d="M 90 120 Q 100 128 110 120" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 90 128 Q 100 120 110 128" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 94 124 Q 100 126 106 124" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      
      {/* Rosy cheeks */}
      <circle cx="70" cy="115" r="8" fill={`url(#${patternIdPrefix}bloomiBlush)`} opacity="0.6" />
      <circle cx="130" cy="115" r="8" fill={`url(#${patternIdPrefix}bloomiBlush)`} opacity="0.6" />
      
      {/* Floating pollen particles */}
      <circle cx="60" cy="80" r="2" fill={`url(#${patternIdPrefix}bloomiPollen)`} opacity="0.8" />
      <circle cx="140" cy="85" r="1.5" fill={`url(#${patternIdPrefix}bloomiPollen)`} opacity="0.6" />
      <circle cx="55" cy="140" r="1" fill={`url(#${patternIdPrefix}bloomiPollen)`} opacity="0.7" />
      <circle cx="145" cy="135" r="2" fill={`url(#${patternIdPrefix}bloomiPollen)`} opacity="0.5" />
      <circle cx="75" cy="60" r="1.5" fill={`url(#${patternIdPrefix}bloomiPollen)`} opacity="0.9" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('flower_crown') && (
        <g>
          <circle cx="85" cy="75" r="6" fill={`url(#${patternIdPrefix}bloomiSmallFlower1)`} />
          <circle cx="100" cy="70" r="7" fill={`url(#${patternIdPrefix}bloomiSmallFlower2)`} />
          <circle cx="115" cy="75" r="6" fill={`url(#${patternIdPrefix}bloomiSmallFlower3)`} />
          <circle cx="87" cy="75" r="3" fill={`url(#${patternIdPrefix}bloomiFlowerCenter)`} />
          <circle cx="100" cy="70" r="3" fill={`url(#${patternIdPrefix}bloomiFlowerCenter)`} />
          <circle cx="113" cy="75" r="3" fill={`url(#${patternIdPrefix}bloomiFlowerCenter)`} />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}bloomiPetal1`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiPetal2`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fed7d7" />
          <stop offset="100%" stopColor="#f87171" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiPetal3`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiPetal4`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiPetal5`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#dcfce7" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiPetal6`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#3b82f6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiCenter`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiCenterHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiBlush`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiPollen`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiSmallFlower1`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiSmallFlower2`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiSmallFlower3`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#dcfce7" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}bloomiFlowerCenter`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderStarri = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Main star body - larger 5-pointed star shape */}
      <path d="M 100 25 L 115 75 L 165 75 L 125 110 L 140 160 L 100 130 L 60 160 L 75 110 L 35 75 L 85 75 Z" 
            fill={`url(#${patternIdPrefix}starriBody)`} />
      <path d="M 100 35 L 112 70 L 150 70 L 120 95 L 132 135 L 100 115 L 68 135 L 80 95 L 50 70 L 88 70 Z" 
            fill={`url(#${patternIdPrefix}starriInner)`} opacity="0.8" />
      
      {/* Twinkling eyes */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 80 95 Q 88 98 96 95" stroke={`url(#${patternIdPrefix}starriSmile)`} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M 104 95 Q 112 98 120 95" stroke={`url(#${patternIdPrefix}starriSmile)`} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="88" cy="95" r="10" fill={`url(#${patternIdPrefix}starriEye)`} />
          <circle cx="112" cy="95" r="10" fill={`url(#${patternIdPrefix}starriEye)`} />
          <g style={{ transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="88" cy="95" r="6" fill="#1e1b4b" />
            <circle cx="90" cy="93" r="3" fill="white" />
          </g>
          <g style={{ transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="112" cy="95" r="6" fill="#1e1b4b" />
            <circle cx="114" cy="93" r="3" fill="white" />
          </g>
        </>
      )}
      
      {/* Cosmic smile */}
      {mood === 'happy' && (
        <path d="M 88 115 Q 100 125 112 115" stroke={`url(#${patternIdPrefix}starriSmile)`} strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 88 125 Q 100 115 112 125" stroke={`url(#${patternIdPrefix}starriSmile)`} strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 92 120 Q 100 122 108 120" stroke={`url(#${patternIdPrefix}starriSmile)`} strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      
      {/* Floating stardust */}
      <circle cx="55" cy="60" r="2" fill={`url(#${patternIdPrefix}starriDust1)`} opacity="0.9" />
      <circle cx="145" cy="65" r="1.5" fill={`url(#${patternIdPrefix}starriDust2)`} opacity="0.8" />
      <circle cx="60" cy="140" r="2.5" fill={`url(#${patternIdPrefix}starriDust3)`} opacity="0.7" />
      <circle cx="140" cy="135" r="2" fill={`url(#${patternIdPrefix}starriDust1)`} opacity="0.6" />
      <circle cx="40" cy="100" r="1.5" fill={`url(#${patternIdPrefix}starriDust2)`} opacity="0.8" />
      <circle cx="160" cy="105" r="2" fill={`url(#${patternIdPrefix}starriDust3)`} opacity="0.9" />
      
      {/* Constellation lines */}
      <path d="M 55 60 L 70 45 L 130 50 L 145 65" stroke={`url(#${patternIdPrefix}starriConstellation)`} strokeWidth="1.5" opacity="0.5" />
      <path d="M 40 100 L 60 140 L 140 135 L 160 105" stroke={`url(#${patternIdPrefix}starriConstellation)`} strokeWidth="1.5" opacity="0.5" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('halo') && (
        <g>
          <circle cx="100" cy="100" r="85" stroke={`url(#${patternIdPrefix}starriHalo)`} strokeWidth="2" fill="none" opacity="0.6" />
          <circle cx="100" cy="100" r="90" stroke={`url(#${patternIdPrefix}starriHalo)`} strokeWidth="1" fill="none" opacity="0.4" />
          <circle cx="70" cy="35" r="3" fill={`url(#${patternIdPrefix}starriHaloStar)`} />
          <circle cx="130" cy="40" r="2.5" fill={`url(#${patternIdPrefix}starriHaloStar)`} />
          <circle cx="165" cy="100" r="3" fill={`url(#${patternIdPrefix}starriHaloStar)`} />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}starriShadow`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}starriBody`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="30%" stopColor="#3730a3" />
          <stop offset="70%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}starriInner`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}starriEye`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </radialGradient>
        <linearGradient id={`${patternIdPrefix}starriSmile`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <radialGradient id={`${patternIdPrefix}starriDust1`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}starriDust2`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}starriDust3`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <linearGradient id={`${patternIdPrefix}starriConstellation`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <radialGradient id={`${patternIdPrefix}starriHalo`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#c084fc" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}starriHaloStar`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderFlammi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Main flame body with wider, rounder organic shape */}
      <path d="M 100 160 Q 60 140 50 110 Q 45 80 70 60 Q 80 40 100 25 Q 120 40 130 60 Q 155 80 150 110 Q 140 140 100 160 Z" 
            fill={`url(#${patternIdPrefix}flammiBody)`} />
      <path d="M 100 155 Q 65 138 58 115 Q 55 90 75 70 Q 82 50 100 35 Q 118 50 125 70 Q 145 90 142 115 Q 135 138 100 155 Z" 
            fill={`url(#${patternIdPrefix}flammiInner)`} opacity="0.8" />
      
      {/* Inner flame core */}
      <path d="M 100 145 Q 70 130 65 110 Q 62 95 80 80 Q 85 65 100 55 Q 115 65 120 80 Q 138 95 135 110 Q 130 130 100 145 Z" 
            fill={`url(#${patternIdPrefix}flammiCore)`} opacity="0.9" />
      
      {/* Cute eyes */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 80 100 Q 88 103 96 100" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 104 100 Q 112 103 120 100" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="88" cy="100" r="10" fill="white" />
          <circle cx="112" cy="100" r="10" fill="white" />
          <g style={{ transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="88" cy="100" r="6" fill="#1f2937" />
            <circle cx="90" cy="98" r="3" fill="white" />
          </g>
          <g style={{ transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="112" cy="100" r="6" fill="#1f2937" />
            <circle cx="114" cy="98" r="3" fill="white" />
          </g>
        </>
      )}
      
      {/* Happy smile */}
      {mood === 'happy' && (
        <path d="M 88 115 Q 100 125 112 115" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 88 125 Q 100 115 112 125" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 92 120 Q 100 122 108 120" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      
      {/* Little arms */}
      <ellipse cx="55" cy="110" rx="8" ry="15" fill={`url(#${patternIdPrefix}flammiArm)`} transform="rotate(-30 55 110)" />
      <ellipse cx="145" cy="110" rx="8" ry="15" fill={`url(#${patternIdPrefix}flammiArm)`} transform="rotate(30 145 110)" />
      
      {/* Little legs */}
      <ellipse cx="90" cy="155" rx="10" ry="8" fill={`url(#${patternIdPrefix}flammiLeg)`} />
      <ellipse cx="110" cy="155" rx="10" ry="8" fill={`url(#${patternIdPrefix}flammiLeg)`} />
      
      {/* Floating embers */}
      <circle cx="45" cy="80" r="2" fill={`url(#${patternIdPrefix}flammiEmber)`} opacity="0.8" />
      <circle cx="155" cy="85" r="1.5" fill={`url(#${patternIdPrefix}flammiEmber)`} opacity="0.6" />
      <circle cx="40" cy="130" r="1" fill={`url(#${patternIdPrefix}flammiEmber)`} opacity="0.7" />
      <circle cx="160" cy="125" r="2" fill={`url(#${patternIdPrefix}flammiEmber)`} opacity="0.5" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('flame_crown') && (
        <g>
          <path d="M 85 65 Q 87 55 90 65 Q 92 55 95 65 Q 97 50 100 65 Q 103 50 105 65 Q 107 55 110 65 Q 112 55 115 65" 
                stroke={`url(#${patternIdPrefix}flammiCrown)`} strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="100" cy="50" r="3" fill={`url(#${patternIdPrefix}flammiCrownGem)`} />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}flammiGlow`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}flammiBody`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="30%" stopColor="#f97316" />
          <stop offset="70%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}flammiInner`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}flammiCore`} cx="0.5" cy="0.4">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fde047" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}flammiArm`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}flammiLeg`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}flammiEmber`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#f97316" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}flammiCrown`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}flammiCrownGem`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fde047" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderDroppi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Main water drop body */}
      <path d="M 100 40 Q 100 30 100 40 Q 135 60 140 110 Q 140 150 100 165 Q 60 150 60 110 Q 65 60 100 40" 
            fill={`url(#${patternIdPrefix}droppiBody)`} />
      
      {/* Inner water reflection */}
      <ellipse cx="100" cy="100" rx="35" ry="45" fill={`url(#${patternIdPrefix}droppiInner)`} opacity="0.6" />
      <ellipse cx="90" cy="80" rx="20" ry="25" fill={`url(#${patternIdPrefix}droppiHighlight)`} opacity="0.7" />
      
      {/* Cute eyes */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 77 95 Q 85 98 93 95" stroke="#0891b2" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 107 95 Q 115 98 123 95" stroke="#0891b2" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="85" cy="95" r="12" fill="white" />
          <circle cx="115" cy="95" r="12" fill="white" />
          <g style={{ transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="85" cy="95" r="8" fill="#0891b2" />
            <circle cx="88" cy="92" r="4" fill="white" />
            <circle cx="89" cy="94" r="2" fill="white" />
          </g>
          <g style={{ transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="115" cy="95" r="8" fill="#0891b2" />
            <circle cx="118" cy="92" r="4" fill="white" />
            <circle cx="119" cy="94" r="2" fill="white" />
          </g>
        </>
      )}
      
      {/* Gentle smile */}
      {mood === 'happy' && (
        <path d="M 88 115 Q 100 123 112 115" stroke="#0891b2" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 88 123 Q 100 115 112 123" stroke="#0891b2" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 92 119 Q 100 121 108 119" stroke="#0891b2" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      
      {/* Little arms */}
      <ellipse cx="60" cy="110" rx="10" ry="18" fill={`url(#${patternIdPrefix}droppiArm)`} transform="rotate(-25 60 110)" />
      <ellipse cx="140" cy="110" rx="10" ry="18" fill={`url(#${patternIdPrefix}droppiArm)`} transform="rotate(25 140 110)" />
      
      {/* Little legs */}
      <ellipse cx="85" cy="160" rx="12" ry="10" fill={`url(#${patternIdPrefix}droppiLeg)`} />
      <ellipse cx="115" cy="160" rx="12" ry="10" fill={`url(#${patternIdPrefix}droppiLeg)`} />
      
      {/* Water droplets floating around */}
      <circle cx="55" cy="75" r="3" fill={`url(#${patternIdPrefix}droppiDroplet)`} opacity="0.8" />
      <circle cx="145" cy="80" r="2.5" fill={`url(#${patternIdPrefix}droppiDroplet)`} opacity="0.6" />
      <circle cx="50" cy="135" r="2" fill={`url(#${patternIdPrefix}droppiDroplet)`} opacity="0.7" />
      <circle cx="150" cy="130" r="2.5" fill={`url(#${patternIdPrefix}droppiDroplet)`} opacity="0.5" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('water_crown') && (
        <g>
          <circle cx="100" cy="35" r="20" stroke={`url(#${patternIdPrefix}droppiCrown)`} strokeWidth="3" fill="none" opacity="0.7" />
          <circle cx="100" cy="35" r="15" stroke={`url(#${patternIdPrefix}droppiCrown)`} strokeWidth="2" fill="none" opacity="0.5" />
          <circle cx="85" cy="30" r="2" fill={`url(#${patternIdPrefix}droppiCrownGem)`} />
          <circle cx="100" cy="25" r="3" fill={`url(#${patternIdPrefix}droppiCrownGem)`} />
          <circle cx="115" cy="30" r="2" fill={`url(#${patternIdPrefix}droppiCrownGem)`} />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}droppiRipple`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}droppiBody`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="30%" stopColor="#22d3ee" />
          <stop offset="70%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}droppiInner`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}droppiHighlight`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}droppiArm`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}droppiLeg`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0284c7" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}droppiDroplet`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#06b6d4" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}droppiCrown`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#22d3ee" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}droppiCrownGem`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderBreezy = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Main leaf body - classic leaf shape */}
      <path d="M 100 40 Q 70 60 60 90 Q 55 120 70 140 Q 85 155 100 160 Q 115 155 130 140 Q 145 120 140 90 Q 130 60 100 40" 
            fill={`url(#${patternIdPrefix}breezyBody)`} />
      
      {/* Leaf veins - central vein */}
      <path d="M 100 45 L 100 155" stroke={`url(#${patternIdPrefix}breezyVein)`} strokeWidth="3" opacity="0.6" />
      
      {/* Side veins */}
      <path d="M 100 70 L 80 85" stroke={`url(#${patternIdPrefix}breezyVein)`} strokeWidth="2" opacity="0.5" />
      <path d="M 100 70 L 120 85" stroke={`url(#${patternIdPrefix}breezyVein)`} strokeWidth="2" opacity="0.5" />
      <path d="M 100 100 L 75 115" stroke={`url(#${patternIdPrefix}breezyVein)`} strokeWidth="2" opacity="0.5" />
      <path d="M 100 100 L 125 115" stroke={`url(#${patternIdPrefix}breezyVein)`} strokeWidth="2" opacity="0.5" />
      <path d="M 100 130 L 85 140" stroke={`url(#${patternIdPrefix}breezyVein)`} strokeWidth="2" opacity="0.5" />
      <path d="M 100 130 L 115 140" stroke={`url(#${patternIdPrefix}breezyVein)`} strokeWidth="2" opacity="0.5" />
      
      {/* Inner leaf highlight */}
      <path d="M 100 50 Q 75 65 68 85 Q 65 105 75 120 Q 85 130 100 135 Q 115 130 125 120 Q 135 105 132 85 Q 125 65 100 50" 
            fill={`url(#${patternIdPrefix}breezyInner)`} opacity="0.6" />
      
      {/* Cute eyes */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 77 90 Q 85 93 93 90" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 107 90 Q 115 93 123 90" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="85" cy="90" r="10" fill="white" />
          <circle cx="115" cy="90" r="10" fill="white" />
          <g style={{ transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="85" cy="90" r="6" fill="#1f2937" />
            <circle cx="87" cy="88" r="3" fill="white" />
          </g>
          <g style={{ transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="115" cy="90" r="6" fill="#1f2937" />
            <circle cx="117" cy="88" r="3" fill="white" />
          </g>
        </>
      )}
      
      {/* Cheerful smile */}
      {mood === 'happy' && (
        <path d="M 85 110 Q 100 120 115 110" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 85 120 Q 100 110 115 120" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 89 115 Q 100 117 111 115" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      
      {/* Little arms */}
      <path d="M 65 100 Q 55 95 50 105 Q 55 115 65 110" fill={`url(#${patternIdPrefix}breezyArm)`} />
      <path d="M 135 100 Q 145 95 150 105 Q 145 115 135 110" fill={`url(#${patternIdPrefix}breezyArm)`} />
      
      {/* Little legs */}
      <ellipse cx="90" cy="155" rx="10" ry="8" fill={`url(#${patternIdPrefix}breezyLeg)`} />
      <ellipse cx="110" cy="155" rx="10" ry="8" fill={`url(#${patternIdPrefix}breezyLeg)`} />
      
      {/* Floating leaves */}
      <path d="M 50 70 Q 45 75 50 80 Q 55 75 50 70" fill={`url(#${patternIdPrefix}breezyFloating)`} opacity="0.8" />
      <path d="M 150 75 Q 145 80 150 85 Q 155 80 150 75" fill={`url(#${patternIdPrefix}breezyFloating)`} opacity="0.6" />
      <path d="M 45 130 Q 40 135 45 140 Q 50 135 45 130" fill={`url(#${patternIdPrefix}breezyFloating)`} opacity="0.7" />
      <path d="M 155 125 Q 150 130 155 135 Q 160 130 155 125" fill={`url(#${patternIdPrefix}breezyFloating)`} opacity="0.5" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('flower_crown') && (
        <g>
          <circle cx="85" cy="55" r="5" fill={`url(#${patternIdPrefix}breezyFlower1)`} />
          <circle cx="100" cy="50" r="6" fill={`url(#${patternIdPrefix}breezyFlower2)`} />
          <circle cx="115" cy="55" r="5" fill={`url(#${patternIdPrefix}breezyFlower3)`} />
          <circle cx="85" cy="55" r="2" fill="#fbbf24" />
          <circle cx="100" cy="50" r="2.5" fill="#fbbf24" />
          <circle cx="115" cy="55" r="2" fill="#fbbf24" />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}breezyBody`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="30%" stopColor="#4ade80" />
          <stop offset="70%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}breezyInner`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="100%" stopColor="#86efac" />
        </radialGradient>
        <linearGradient id={`${patternIdPrefix}breezyVein`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#15803d" />
          <stop offset="50%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <radialGradient id={`${patternIdPrefix}breezyArm`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}breezyLeg`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}breezyFloating`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}breezyFlower1`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}breezyFlower2`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}breezyFlower3`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fed7d7" />
          <stop offset="100%" stopColor="#f87171" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderRocky = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Main rocky body - rounded boulder shape */}
      <path d="M 100 50 L 130 70 L 140 110 L 130 150 L 100 165 L 70 150 L 60 110 L 70 70 Z" 
            fill={`url(#${patternIdPrefix}rockyBody)`} />
      <path d="M 100 55 L 125 72 L 135 108 L 125 145 L 100 158 L 75 145 L 65 108 L 75 72 Z" 
            fill={`url(#${patternIdPrefix}rockyInner)`} opacity="0.8" />
      
      {/* Rock texture lines */}
      <path d="M 75 80 L 125 85" stroke="#57534e" strokeWidth="2" opacity="0.5" />
      <path d="M 70 110 L 130 115" stroke="#57534e" strokeWidth="2" opacity="0.5" />
      <path d="M 80 140 L 120 135" stroke="#57534e" strokeWidth="2" opacity="0.5" />
      
      {/* Cute eyes */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 77 95 Q 85 98 93 95" stroke="#1f2937" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M 107 95 Q 115 98 123 95" stroke="#1f2937" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="85" cy="95" r="12" fill="white" />
          <circle cx="115" cy="95" r="12" fill="white" />
          <g style={{ transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="85" cy="95" r="8" fill="#1f2937" />
            <circle cx="88" cy="92" r="4" fill="white" />
          </g>
          <g style={{ transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="115" cy="95" r="8" fill="#1f2937" />
            <circle cx="118" cy="92" r="4" fill="white" />
          </g>
        </>
      )}
      
      {/* Gentle smile */}
      {mood === 'happy' && (
        <path d="M 88 115 Q 100 123 112 115" stroke="#1f2937" strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 88 123 Q 100 115 112 123" stroke="#1f2937" strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 92 119 Q 100 121 108 119" stroke="#1f2937" strokeWidth="4" fill="none" strokeLinecap="round" />
      )}
      
      {/* Stubby arms */}
      <ellipse cx="55" cy="110" rx="12" ry="8" fill={`url(#${patternIdPrefix}rockyArm)`} transform="rotate(-15 55 110)" />
      <ellipse cx="145" cy="110" rx="12" ry="8" fill={`url(#${patternIdPrefix}rockyArm)`} transform="rotate(15 145 110)" />
      
      {/* Stubby legs */}
      <ellipse cx="85" cy="160" rx="15" ry="10" fill={`url(#${patternIdPrefix}rockyLeg)`} />
      <ellipse cx="115" cy="160" rx="15" ry="10" fill={`url(#${patternIdPrefix}rockyLeg)`} />
      
      {/* Little pebbles floating around */}
      <circle cx="50" cy="80" r="4" fill={`url(#${patternIdPrefix}rockyPebble)`} opacity="0.8" />
      <circle cx="150" cy="85" r="3" fill={`url(#${patternIdPrefix}rockyPebble)`} opacity="0.6" />
      <circle cx="45" cy="140" r="2.5" fill={`url(#${patternIdPrefix}rockyPebble)`} opacity="0.7" />
      <circle cx="155" cy="135" r="3.5" fill={`url(#${patternIdPrefix}rockyPebble)`} opacity="0.5" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('moss') && (
        <g>
          <ellipse cx="90" cy="60" rx="15" ry="8" fill={`url(#${patternIdPrefix}rockyMoss)`} opacity="0.7" />
          <ellipse cx="110" cy="65" rx="12" ry="6" fill={`url(#${patternIdPrefix}rockyMoss)`} opacity="0.6" />
          <ellipse cx="75" cy="150" rx="10" ry="5" fill={`url(#${patternIdPrefix}rockyMoss)`} opacity="0.5" />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}rockyBody`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#a8a29e" />
          <stop offset="30%" stopColor="#78716c" />
          <stop offset="70%" stopColor="#57534e" />
          <stop offset="100%" stopColor="#44403c" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}rockyInner`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#d6d3d1" />
          <stop offset="100%" stopColor="#a8a29e" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}rockyArm`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#78716c" />
          <stop offset="100%" stopColor="#44403c" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}rockyLeg`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#57534e" />
          <stop offset="100%" stopColor="#292524" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}rockyPebble`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#a8a29e" />
          <stop offset="100%" stopColor="#57534e" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}rockyMoss`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderCacti = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Main cactus body */}
      <rect x="85" y="80" width="30" height="80" rx="15" fill={`url(#${patternIdPrefix}cactiBody)`} />
      
      {/* Cactus arms */}
      <rect x="60" y="100" width="20" height="40" rx="10" fill={`url(#${patternIdPrefix}cactiArm)`} />
      <rect x="120" y="110" width="20" height="35" rx="10" fill={`url(#${patternIdPrefix}cactiArm)`} />
      
      {/* Cactus ridges */}
      <line x1="92" y1="85" x2="92" y2="155" stroke="#65a30d" strokeWidth="2" opacity="0.5" />
      <line x1="100" y1="85" x2="100" y2="155" stroke="#65a30d" strokeWidth="2" opacity="0.5" />
      <line x1="108" y1="85" x2="108" y2="155" stroke="#65a30d" strokeWidth="2" opacity="0.5" />
      
      {/* Cute eyes */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 82 105 Q 90 108 98 105" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 102 105 Q 110 108 118 105" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="90" cy="105" r="8" fill="white" />
          <circle cx="110" cy="105" r="8" fill="white" />
          <g style={{ transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="90" cy="105" r="5" fill="#1f2937" />
            <circle cx="92" cy="103" r="2" fill="white" />
          </g>
          <g style={{ transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="110" cy="105" r="5" fill="#1f2937" />
            <circle cx="112" cy="103" r="2" fill="white" />
          </g>
        </>
      )}
      
      {/* Sweet smile */}
      {mood === 'happy' && (
        <path d="M 92 120 Q 100 126 108 120" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 92 126 Q 100 120 108 126" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 94 123 Q 100 125 106 123" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      
      {/* Tiny spines */}
      <circle cx="88" cy="90" r="1" fill="#65a30d" />
      <circle cx="95" cy="95" r="1" fill="#65a30d" />
      <circle cx="105" cy="92" r="1" fill="#65a30d" />
      <circle cx="112" cy="88" r="1" fill="#65a30d" />
      <circle cx="65" cy="110" r="1" fill="#65a30d" />
      <circle cx="70" cy="120" r="1" fill="#65a30d" />
      <circle cx="125" cy="115" r="1" fill="#65a30d" />
      <circle cx="130" cy="125" r="1" fill="#65a30d" />
      
      {/* Little legs in pot */}
      <path d="M 75 160 L 80 175 L 120 175 L 125 160 Z" fill={`url(#${patternIdPrefix}cactiPot)`} />
      <rect x="75" y="160" width="50" height="5" fill={`url(#${patternIdPrefix}cactiPotRim)`} rx="2" />
      
      {/* Blooming flower */}
      <circle cx="100" cy="75" r="12" fill={`url(#${patternIdPrefix}cactiFlower)`} />
      <circle cx="100" cy="75" r="8" fill={`url(#${patternIdPrefix}cactiFlowerCenter)`} />
      <circle cx="100" cy="75" r="4" fill="#fbbf24" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('more_flowers') && (
        <g>
          <circle cx="85" cy="70" r="8" fill={`url(#${patternIdPrefix}cactiFlower2)`} />
          <circle cx="85" cy="70" r="5" fill={`url(#${patternIdPrefix}cactiFlowerCenter)`} />
          <circle cx="115" cy="70" r="8" fill={`url(#${patternIdPrefix}cactiFlower3)`} />
          <circle cx="115" cy="70" r="5" fill={`url(#${patternIdPrefix}cactiFlowerCenter)`} />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}cactiBody`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="30%" stopColor="#84cc16" />
          <stop offset="70%" stopColor="#65a30d" />
          <stop offset="100%" stopColor="#4d7c0f" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cactiArm`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#84cc16" />
          <stop offset="100%" stopColor="#65a30d" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cactiPot`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cactiPotRim`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cactiFlower`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cactiFlower2`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cactiFlower3`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}cactiFlowerCenter`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderMushie = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Mushroom stem */}
      <ellipse cx="100" cy="140" rx="25" ry="40" fill={`url(#${patternIdPrefix}mushieStem)`} />
      <ellipse cx="100" cy="135" rx="20" ry="35" fill={`url(#${patternIdPrefix}mushieStemHighlight)`} opacity="0.6" />
      
      {/* Mushroom cap */}
      <path d="M 50 110 Q 50 70 100 60 Q 150 70 150 110 Z" fill={`url(#${patternIdPrefix}mushieCap)`} />
      <path d="M 55 108 Q 55 75 100 65 Q 145 75 145 108 Z" fill={`url(#${patternIdPrefix}mushieCapHighlight)`} opacity="0.7" />
      
      {/* Cap spots */}
      <circle cx="80" cy="85" r="8" fill="white" opacity="0.8" />
      <circle cx="120" cy="80" r="10" fill="white" opacity="0.8" />
      <circle cx="100" cy="95" r="6" fill="white" opacity="0.7" />
      <circle cx="130" cy="100" r="5" fill="white" opacity="0.6" />
      <circle cx="70" cy="100" r="5" fill="white" opacity="0.6" />
      
      {/* Cute eyes on stem */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 80 130 Q 88 133 96 130" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 104 130 Q 112 133 120 130" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="88" cy="130" r="8" fill="white" />
          <circle cx="112" cy="130" r="8" fill="white" />
          <g style={{ transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="88" cy="130" r="5" fill="#1f2937" />
            <circle cx="90" cy="128" r="2" fill="white" />
          </g>
          <g style={{ transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="112" cy="130" r="5" fill="#1f2937" />
            <circle cx="114" cy="128" r="2" fill="white" />
          </g>
        </>
      )}
      
      {/* Happy smile */}
      {mood === 'happy' && (
        <path d="M 88 145 Q 100 153 112 145" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 88 153 Q 100 145 112 153" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 92 149 Q 100 151 108 149" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      
      {/* Little arms */}
      <ellipse cx="70" cy="140" rx="8" ry="12" fill={`url(#${patternIdPrefix}mushieArm)`} transform="rotate(-20 70 140)" />
      <ellipse cx="130" cy="140" rx="8" ry="12" fill={`url(#${patternIdPrefix}mushieArm)`} transform="rotate(20 130 140)" />
      
      {/* Floating spores */}
      <circle cx="55" cy="120" r="2" fill={`url(#${patternIdPrefix}mushieSpore)`} opacity="0.8" />
      <circle cx="145" cy="115" r="1.5" fill={`url(#${patternIdPrefix}mushieSpore)`} opacity="0.6" />
      <circle cx="50" cy="90" r="1" fill={`url(#${patternIdPrefix}mushieSpore)`} opacity="0.7" />
      <circle cx="150" cy="95" r="2" fill={`url(#${patternIdPrefix}mushieSpore)`} opacity="0.5" />
      <circle cx="65" cy="70" r="1.5" fill={`url(#${patternIdPrefix}mushieSpore)`} opacity="0.6" />
      <circle cx="135" cy="65" r="1" fill={`url(#${patternIdPrefix}mushieSpore)`} opacity="0.8" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('fairy_ring') && (
        <g>
          <circle cx="100" cy="180" r="35" stroke={`url(#${patternIdPrefix}mushieFairyRing)`} strokeWidth="3" fill="none" opacity="0.5" />
          <circle cx="70" cy="175" r="4" fill={`url(#${patternIdPrefix}mushieTinyMushroom)`} />
          <circle cx="70" cy="173" r="3" fill={`url(#${patternIdPrefix}mushieTinyMushroomCap)`} />
          <circle cx="130" cy="175" r="4" fill={`url(#${patternIdPrefix}mushieTinyMushroom)`} />
          <circle cx="130" cy="173" r="3" fill={`url(#${patternIdPrefix}mushieTinyMushroomCap)`} />
          <circle cx="100" cy="178" r="3" fill={`url(#${patternIdPrefix}mushieTinyMushroom)`} />
          <circle cx="100" cy="176" r="2.5" fill={`url(#${patternIdPrefix}mushieTinyMushroomCap)`} />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}mushieStem`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="30%" stopColor="#fde68a" />
          <stop offset="70%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}mushieStemHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}mushieCap`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="30%" stopColor="#ef4444" />
          <stop offset="70%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#b91c1c" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}mushieCapHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="100%" stopColor="#f87171" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}mushieArm`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}mushieSpore`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}mushieFairyRing`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}mushieTinyMushroom`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}mushieTinyMushroomCap`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderLeafy = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Sunflower stem */}
      <rect x="96" y="120" width="8" height="55" fill={`url(#${patternIdPrefix}leafyStem)`} rx="4" />
      <rect x="98" y="125" width="4" height="50" fill={`url(#${patternIdPrefix}leafyStemHighlight)`} rx="2" opacity="0.6" />
      
      {/* Stem leaves */}
      <ellipse cx="85" cy="140" rx="15" ry="8" fill={`url(#${patternIdPrefix}leafyStemLeaf)`} transform="rotate(-30 85 140)" />
      <ellipse cx="115" cy="150" rx="15" ry="8" fill={`url(#${patternIdPrefix}leafyStemLeaf)`} transform="rotate(30 115 150)" />
      <ellipse cx="87" cy="140" rx="10" ry="5" fill={`url(#${patternIdPrefix}leafyStemLeafHighlight)`} transform="rotate(-30 87 140)" opacity="0.7" />
      <ellipse cx="113" cy="150" rx="10" ry="5" fill={`url(#${patternIdPrefix}leafyStemLeafHighlight)`} transform="rotate(30 113 150)" opacity="0.7" />
      
      {/* Sunflower petals - outer ring */}
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(0 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(22.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(45 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(67.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(90 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(112.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(135 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(157.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(180 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(202.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(225 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(247.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(270 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(292.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(315 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill={`url(#${patternIdPrefix}leafyPetal)`} transform="rotate(337.5 100 85)" />
      
      {/* Sunflower center - outer ring */}
      <circle cx="100" cy="85" r="30" fill={`url(#${patternIdPrefix}leafyCenter)`} />
      <circle cx="100" cy="85" r="25" fill={`url(#${patternIdPrefix}leafyCenterInner)`} />
      
      {/* Seed pattern in center */}
      <circle cx="92" cy="77" r="2" fill={`url(#${patternIdPrefix}leafySeed)`} />
      <circle cx="108" cy="77" r="2" fill={`url(#${patternIdPrefix}leafySeed)`} />
      <circle cx="85" cy="85" r="2" fill={`url(#${patternIdPrefix}leafySeed)`} />
      <circle cx="115" cy="85" r="2" fill={`url(#${patternIdPrefix}leafySeed)`} />
      <circle cx="92" cy="93" r="2" fill={`url(#${patternIdPrefix}leafySeed)`} />
      <circle cx="108" cy="93" r="2" fill={`url(#${patternIdPrefix}leafySeed)`} />
      <circle cx="100" cy="75" r="1.5" fill={`url(#${patternIdPrefix}leafySeed)`} />
      <circle cx="100" cy="95" r="1.5" fill={`url(#${patternIdPrefix}leafySeed)`} />
      <circle cx="88" cy="90" r="1.5" fill={`url(#${patternIdPrefix}leafySeed)`} />
      <circle cx="112" cy="80" r="1.5" fill={`url(#${patternIdPrefix}leafySeed)`} />
      
      {/* Cute eyes */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 82 82 Q 90 85 98 82" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 102 82 Q 110 85 118 82" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="90" cy="82" r="8" fill="white" />
          <circle cx="110" cy="82" r="8" fill="white" />
          <g style={{ transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="90" cy="82" r="5" fill="#1f2937" />
            <circle cx="92" cy="80" r="2" fill="white" />
          </g>
          <g style={{ transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="110" cy="82" r="5" fill="#1f2937" />
            <circle cx="112" cy="80" r="2" fill="white" />
          </g>
        </>
      )}
      
      {/* Bright smile */}
      {mood === 'happy' && (
        <path d="M 88 92 Q 100 100 112 92" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 88 100 Q 100 92 112 100" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 92 96 Q 100 98 108 96" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      
      {/* Little arms - small leaves */}
      <ellipse cx="60" cy="85" rx="12" ry="6" fill={`url(#${patternIdPrefix}leafyArm)`} transform="rotate(-20 60 85)" />
      <ellipse cx="140" cy="85" rx="12" ry="6" fill={`url(#${patternIdPrefix}leafyArm)`} transform="rotate(20 140 85)" />
      
      {/* Base/roots */}
      <ellipse cx="95" cy="170" rx="8" ry="6" fill={`url(#${patternIdPrefix}leafyRoot)`} />
      <ellipse cx="105" cy="170" rx="8" ry="6" fill={`url(#${patternIdPrefix}leafyRoot)`} />
      
      {/* Floating pollen */}
      <circle cx="55" cy="60" r="2" fill={`url(#${patternIdPrefix}leafyPollen)`} opacity="0.8" />
      <circle cx="145" cy="65" r="1.5" fill={`url(#${patternIdPrefix}leafyPollen)`} opacity="0.6" />
      <circle cx="50" cy="110" r="1" fill={`url(#${patternIdPrefix}leafyPollen)`} opacity="0.7" />
      <circle cx="150" cy="105" r="2" fill={`url(#${patternIdPrefix}leafyPollen)`} opacity="0.5" />
      <circle cx="75" cy="45" r="1.5" fill={`url(#${patternIdPrefix}leafyPollen)`} opacity="0.9" />
      <circle cx="125" cy="50" r="1" fill={`url(#${patternIdPrefix}leafyPollen)`} opacity="0.8" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('bee_friends') && (
        <g>
          <ellipse cx="60" cy="70" rx="6" ry="4" fill={`url(#${patternIdPrefix}leafyBeeBody)`} />
          <ellipse cx="58" cy="70" rx="2" ry="1" fill="#1f2937" />
          <ellipse cx="62" cy="70" rx="2" ry="1" fill="#1f2937" />
          <ellipse cx="55" cy="68" rx="3" ry="1" fill={`url(#${patternIdPrefix}leafyBeeWing)`} opacity="0.7" />
          <ellipse cx="55" cy="72" rx="3" ry="1" fill={`url(#${patternIdPrefix}leafyBeeWing)`} opacity="0.7" />
          
          <ellipse cx="140" cy="100" rx="6" ry="4" fill={`url(#${patternIdPrefix}leafyBeeBody)`} />
          <ellipse cx="138" cy="100" rx="2" ry="1" fill="#1f2937" />
          <ellipse cx="142" cy="100" rx="2" ry="1" fill="#1f2937" />
          <ellipse cx="145" cy="98" rx="3" ry="1" fill={`url(#${patternIdPrefix}leafyBeeWing)`} opacity="0.7" />
          <ellipse cx="145" cy="102" rx="3" ry="1" fill={`url(#${patternIdPrefix}leafyBeeWing)`} opacity="0.7" />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}leafyStem`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}leafyStemHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}leafyStemLeaf`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}leafyStemLeafHighlight`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#4ade80" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}leafyPetal`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="30%" stopColor="#fde047" />
          <stop offset="70%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}leafyCenter`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#a16207" />
          <stop offset="50%" stopColor="#92400e" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}leafyCenterInner`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#a16207" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}leafySeed`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#451a03" />
          <stop offset="100%" stopColor="#292524" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}leafyArm`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}leafyRoot`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}leafyPollen`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fde047" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}leafyBeeBody`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}leafyBeeWing`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e5e7eb" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderRosey = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      
      {/* Rose stem */}
      <rect x="98" y="120" width="4" height="50" fill={`url(#${patternIdPrefix}roseyStem)`} rx="2" />
      
      {/* Thorns */}
      <path d="M 98 130 L 94 128" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
      <path d="M 102 145 L 106 143" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
      
      {/* Leaves */}
      <ellipse cx="85" cy="140" rx="12" ry="8" fill={`url(#${patternIdPrefix}roseyLeaf)`} transform="rotate(-30 85 140)" />
      <ellipse cx="115" cy="150" rx="12" ry="8" fill={`url(#${patternIdPrefix}roseyLeaf)`} transform="rotate(30 115 150)" />
      
      {/* Rose petals - layered */}
      <circle cx="100" cy="90" r="35" fill={`url(#${patternIdPrefix}roseyPetal1)`} />
      <path d="M 100 60 Q 120 70 125 90 Q 120 110 100 120 Q 80 110 75 90 Q 80 70 100 60" fill={`url(#${patternIdPrefix}roseyPetal2)`} />
      <path d="M 100 65 Q 115 73 118 90 Q 115 107 100 115 Q 85 107 82 90 Q 85 73 100 65" fill={`url(#${patternIdPrefix}roseyPetal3)`} />
      <circle cx="100" cy="90" r="20" fill={`url(#${patternIdPrefix}roseyCenter)`} />
      
      {/* Cute eyes */}
      {blobbi.state === 'sleeping' ? (
        <>
          <path d="M 82 85 Q 90 88 98 85" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M 102 85 Q 110 88 118 85" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="90" cy="85" r="8" fill="white" />
          <circle cx="110" cy="85" r="8" fill="white" />
          <g style={{ transform: `translate(${pupilOffset.left.x}px, ${pupilOffset.left.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="90" cy="85" r="5" fill="#1f2937" />
            <circle cx="92" cy="83" r="2" fill="white" />
          </g>
          <g style={{ transform: `translate(${pupilOffset.right.x}px, ${pupilOffset.right.y}px)`, transition: 'transform 0.1s ease-out' }}>
            <circle cx="110" cy="85" r="5" fill="#1f2937" />
            <circle cx="112" cy="83" r="2" fill="white" />
          </g>
        </>
      )}
      
      {/* Sweet smile */}
      {mood === 'happy' && (
        <path d="M 92 100 Q 100 106 108 100" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {mood === 'sad' && (
        <path d="M 92 106 Q 100 100 108 106" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      {(mood === 'neutral' || mood === 'sleepy') && (
        <path d="M 94 103 Q 100 105 106 103" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
      
      {/* Rosy cheeks */}
      <circle cx="75" cy="95" r="6" fill={`url(#${patternIdPrefix}roseyBlush)`} opacity="0.6" />
      <circle cx="125" cy="95" r="6" fill={`url(#${patternIdPrefix}roseyBlush)`} opacity="0.6" />
      
      {/* Little arms from center */}
      <ellipse cx="70" cy="90" rx="8" ry="12" fill={`url(#${patternIdPrefix}roseyArm)`} transform="rotate(-30 70 90)" />
      <ellipse cx="130" cy="90" rx="8" ry="12" fill={`url(#${patternIdPrefix}roseyArm)`} transform="rotate(30 130 90)" />
      
      {/* Floating petals */}
      <ellipse cx="55" cy="70" rx="8" ry="5" fill={`url(#${patternIdPrefix}roseyFloatingPetal)`} opacity="0.8" transform="rotate(45 55 70)" />
      <ellipse cx="145" cy="75" rx="7" ry="4" fill={`url(#${patternIdPrefix}roseyFloatingPetal)`} opacity="0.6" transform="rotate(-30 145 75)" />
      <ellipse cx="50" cy="120" rx="6" ry="3.5" fill={`url(#${patternIdPrefix}roseyFloatingPetal)`} opacity="0.7" transform="rotate(60 50 120)" />
      <ellipse cx="150" cy="115" rx="7" ry="4" fill={`url(#${patternIdPrefix}roseyFloatingPetal)`} opacity="0.5" transform="rotate(-45 150 115)" />
      
      {/* Accessories */}
      {blobbi.customization.accessories.includes('thorn_crown') && (
        <g>
          <circle cx="100" cy="55" r="25" stroke={`url(#${patternIdPrefix}roseyThorns)`} strokeWidth="3" fill="none" strokeDasharray="5,5" />
          <circle cx="85" cy="50" r="2" fill={`url(#${patternIdPrefix}roseyThornFlower)`} />
          <circle cx="100" cy="45" r="2.5" fill={`url(#${patternIdPrefix}roseyThornFlower)`} />
          <circle cx="115" cy="50" r="2" fill={`url(#${patternIdPrefix}roseyThornFlower)`} />
        </g>
      )}
      
      <defs>
        <radialGradient id={`${patternIdPrefix}roseyStem`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}roseyLeaf`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}roseyPetal1`} cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="30%" stopColor="#f9a8d4" />
          <stop offset="70%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#ec4899" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}roseyPetal2`} cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fbcfe8" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}roseyPetal3`} cx="0.5" cy="0.4">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f9a8d4" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}roseyCenter`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#f9a8d4" />
          <stop offset="100%" stopColor="#ec4899" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}roseyBlush`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}roseyArm`} cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#f9a8d4" />
          <stop offset="100%" stopColor="#ec4899" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}roseyFloatingPetal`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fbcfe8" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}roseyThorns`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id={`${patternIdPrefix}roseyThornFlower`} cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderPet = () => {
    switch (blobbi.evolutionForm) {
      case 'pandi': return renderPandi();
      case 'owli': return renderOwli();
      case 'catti': return renderCatti();
      case 'froggi': return renderFroggi();
      case 'cloudi': return renderCloudi();
      case 'crysti': return renderCrysti();
      case 'bloomi': return renderBloomi();
      case 'starri': return renderStarri();
      case 'flammi': return renderFlammi();
      case 'droppi': return renderDroppi();
      case 'breezy': return renderBreezy();
      case 'rocky': return renderRocky();
      case 'cacti': return renderCacti();
      case 'mushie': return renderMushie();
      case 'leafy': return renderLeafy();
      case 'rosey': return renderRosey();
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
  const isDirty = blobbi.stats.hygiene < 30;
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
        sizeClasses[displaySize as keyof typeof sizeClasses],
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
      
      <svg ref={svgRef} viewBox="0 0 200 200" className={cn("w-full h-full", animationClass)}>
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