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
      {/* Drop shadow */}
      <ellipse cx="105" cy="185" rx="45" ry="8" fill="rgba(0,0,0,0.15)" />
      
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
      {/* Drop shadow for 3D effect */}
      <ellipse cx="105" cy="185" rx="55" ry="8" fill="rgba(0,0,0,0.15)" />
      
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
      {/* Drop shadow for 3D effect */}
      <ellipse cx="105" cy="185" rx="40" ry="8" fill="rgba(0,0,0,0.15)" />
      
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
      {/* Drop shadow for 3D effect */}
      <ellipse cx="105" cy="185" rx="65" ry="8" fill="rgba(0,0,0,0.15)" />
      
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

  const renderPet = () => {
    switch (blobbi.evolutionForm) {
      case 'pandi': return renderPandi();
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
        sizeClasses[size],
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