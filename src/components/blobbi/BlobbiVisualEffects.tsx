import { Blobbi } from '@/types/blobbi';

interface BlobbiVisualEffectsProps {
  blobbi: Blobbi;
  patternIdPrefix: string;
}

export function BlobbiVisualEffects({ blobbi, patternIdPrefix }: BlobbiVisualEffectsProps) {
  // Extract visual tags from blobbi data
  const manifestation = blobbi.manifestation || blobbi.specialMark;
  const pattern = blobbi.pattern;
  const visualEffect = blobbi.visualEffect;
  const blessing = blobbi.blessing;
  
  return (
    <g className="visual-effects">
      {/* Manifestation Effects */}
      {manifestation && <ManifestationEffect type={manifestation} patternIdPrefix={patternIdPrefix} />}
      
      {/* Pattern Effects */}
      {pattern && <PatternEffect type={pattern} patternIdPrefix={patternIdPrefix} />}
      
      {/* Visual Effects */}
      {visualEffect && <VisualEffect type={visualEffect} patternIdPrefix={patternIdPrefix} />}
      
      {/* Blessing Effects */}
      {blessing && <BlessingEffect type={blessing} patternIdPrefix={patternIdPrefix} />}
    </g>
  );
}

// Manifestation Effects Component
function ManifestationEffect({ type, patternIdPrefix }: { type: string; patternIdPrefix: string }) {
  switch (type) {
    case 'dot_center':
      return <circle cx="50" cy="50" r="3" fill="rgba(255,255,255,0.8)" />;
    
    case 'oval_spots':
      return (
        <g>
          <ellipse cx="35" cy="40" rx="4" ry="6" fill="rgba(255,255,255,0.6)" />
          <ellipse cx="65" cy="55" rx="3" ry="5" fill="rgba(255,255,255,0.6)" />
          <ellipse cx="50" cy="70" rx="3" ry="4" fill="rgba(255,255,255,0.6)" />
        </g>
      );
    
    case 'side_bands':
      return (
        <g>
          <rect x="20" y="35" width="4" height="30" fill="rgba(255,255,255,0.5)" rx="2" />
          <rect x="76" y="35" width="4" height="30" fill="rgba(255,255,255,0.5)" rx="2" />
        </g>
      );
    
    case 'dot_speckle':
      return (
        <g>
          <circle cx="30" cy="35" r="1.5" fill="rgba(255,255,255,0.7)" />
          <circle cx="45" cy="30" r="1" fill="rgba(255,255,255,0.7)" />
          <circle cx="60" cy="40" r="1.5" fill="rgba(255,255,255,0.7)" />
          <circle cx="35" cy="60" r="1" fill="rgba(255,255,255,0.7)" />
          <circle cx="65" cy="65" r="1.5" fill="rgba(255,255,255,0.7)" />
        </g>
      );
    
    case 'light_dash':
      return (
        <g>
          <line x1="25" y1="45" x2="35" y2="45" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" />
          <line x1="65" y1="55" x2="75" y2="55" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    
    case 'freckle_patch':
      return (
        <g>
          <circle cx="40" cy="50" r="0.8" fill="rgba(139,69,19,0.6)" />
          <circle cx="43" cy="52" r="0.6" fill="rgba(139,69,19,0.6)" />
          <circle cx="38" cy="53" r="0.7" fill="rgba(139,69,19,0.6)" />
          <circle cx="41" cy="48" r="0.5" fill="rgba(139,69,19,0.6)" />
        </g>
      );
    
    case 'sparkle_trail':
      return (
        <g className="animate-sparkle">
          <path d="M 30 30 L 32 28 L 34 30 L 32 32 Z" fill="rgba(255,255,255,0.9)" />
          <path d="M 55 25 L 56 24 L 57 25 L 56 26 Z" fill="rgba(255,255,255,0.8)" />
          <path d="M 70 35 L 71.5 33.5 L 73 35 L 71.5 36.5 Z" fill="rgba(255,255,255,0.7)" />
        </g>
      );
    
    case 'light_smoke':
      return (
        <g className="animate-mist" opacity="0.6">
          <ellipse cx="50" cy="20" rx="8" ry="4" fill="rgba(255,255,255,0.3)" />
          <ellipse cx="48" cy="15" rx="6" ry="3" fill="rgba(255,255,255,0.2)" />
          <ellipse cx="52" cy="10" rx="4" ry="2" fill="rgba(255,255,255,0.1)" />
        </g>
      );
    
    case 'dusty_aura':
      return (
        <g className="animate-glow">
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
        </g>
      );
    
    case 'ring_mark':
      return <circle cx="50" cy="50" r="20" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />;
    
    case 'blush_sides':
      return (
        <g>
          <ellipse cx="22" cy="55" rx="6" ry="4" fill="rgba(255,182,193,0.7)" />
          <ellipse cx="78" cy="55" rx="6" ry="4" fill="rgba(255,182,193,0.7)" />
        </g>
      );
    
    case 'tiger_stripe':
      return (
        <g>
          <path d="M 25 35 Q 30 40 25 45" stroke="rgba(139,69,19,0.6)" strokeWidth="3" fill="none" />
          <path d="M 75 40 Q 70 45 75 50" stroke="rgba(139,69,19,0.6)" strokeWidth="3" fill="none" />
          <path d="M 45 25 Q 50 30 55 25" stroke="rgba(139,69,19,0.6)" strokeWidth="2" fill="none" />
        </g>
      );
    
    case 'glow_ring':
      return (
        <g className="animate-pulse">
          <circle cx="50" cy="50" r="25" fill="none" stroke={`url(#${patternIdPrefix}glowRing)`} strokeWidth="2" />
        </g>
      );
    
    case 'wavy_spots':
      return (
        <g>
          <path d="M 30 40 Q 35 35 40 40 Q 35 45 30 40" fill="rgba(255,255,255,0.6)" />
          <path d="M 60 55 Q 65 50 70 55 Q 65 60 60 55" fill="rgba(255,255,255,0.6)" />
        </g>
      );
    
    case 'mist_drift':
      return (
        <g className="animate-pulse" opacity="0.4">
          <ellipse cx="30" cy="25" rx="12" ry="6" fill="rgba(255,255,255,0.3)" />
          <ellipse cx="70" cy="30" rx="10" ry="5" fill="rgba(255,255,255,0.2)" />
          <ellipse cx="50" cy="20" rx="8" ry="4" fill="rgba(255,255,255,0.25)" />
        </g>
      );
    
    // Rare manifestations
    case 'rune_top':
      return (
        <g>
          <path d="M 45 15 L 50 10 L 55 15 L 50 20 Z" fill="rgba(138,43,226,0.8)" />
          <circle cx="50" cy="15" r="2" fill="rgba(255,255,255,0.9)" />
        </g>
      );
    
    case 'shimmer_band':
      return (
        <g className="animate-shimmer">
          <rect x="20" y="45" width="60" height="3" fill={`url(#${patternIdPrefix}shimmerGradient)`} rx="1.5" />
        </g>
      );
    
    case 'spirit_knot':
      return (
        <g>
          <path d="M 45 50 Q 50 45 55 50 Q 50 55 45 50" fill="none" stroke="rgba(138,43,226,0.7)" strokeWidth="2" />
          <circle cx="50" cy="50" r="3" fill="rgba(255,255,255,0.8)" />
        </g>
      );
    
    case 'crescent_moon':
      return (
        <path d="M 45 25 Q 50 20 55 25 Q 50 30 45 25" fill="rgba(255,255,255,0.8)" />
      );
    
    case 'tiny_star':
      return (
        <path d="M 50 25 L 52 30 L 57 30 L 53 33 L 55 38 L 50 35 L 45 38 L 47 33 L 43 30 L 48 30 Z" 
              fill="rgba(255,255,255,0.9)" />
      );
    
    case 'wave_stroke':
      return (
        <path d="M 25 50 Q 35 45 45 50 Q 55 55 65 50 Q 75 45 85 50" 
              stroke="rgba(255,255,255,0.7)" strokeWidth="2" fill="none" />
      );
    
    case 'glow_blue':
      return (
        <g className="animate-pulse">
          <circle cx="50" cy="50" r="35" fill={`url(#${patternIdPrefix}blueGlow)`} opacity="0.3" />
        </g>
      );
    
    case 'glimmer_gold':
      return (
        <g className="animate-pulse">
          <circle cx="50" cy="50" r="30" fill={`url(#${patternIdPrefix}goldGlimmer)`} opacity="0.4" />
        </g>
      );
    
    case 'mist_wisp':
      return (
        <g className="animate-pulse" opacity="0.5">
          <path d="M 30 30 Q 40 25 50 30 Q 60 35 70 30" stroke="rgba(255,255,255,0.6)" strokeWidth="3" fill="none" />
          <path d="M 25 50 Q 35 45 45 50 Q 55 55 65 50" stroke="rgba(255,255,255,0.4)" strokeWidth="2" fill="none" />
        </g>
      );
    
    // Legendary manifestations
    case 'sigil_eye':
      return (
        <g>
          <circle cx="50" cy="35" r="8" fill="rgba(138,43,226,0.8)" />
          <circle cx="50" cy="35" r="5" fill="rgba(255,255,255,0.9)" />
          <circle cx="50" cy="35" r="2" fill="rgba(138,43,226,1)" />
          <path d="M 42 35 L 58 35 M 50 27 L 50 43" stroke="rgba(138,43,226,0.6)" strokeWidth="1" />
        </g>
      );
    
    case 'glow_crack_pattern':
      return (
        <g className="animate-pulse">
          <path d="M 30 30 L 45 45 L 35 60 M 70 35 L 55 50 L 65 65 M 50 20 L 50 40 L 40 50" 
                stroke={`url(#${patternIdPrefix}crackGlow)`} strokeWidth="2" fill="none" />
        </g>
      );
    
    case 'ethereal_rune':
      return (
        <g className="animate-rune">
          <circle cx="50" cy="40" r="12" fill="none" stroke="rgba(138,43,226,0.8)" strokeWidth="2" />
          <path d="M 45 35 L 55 35 M 50 30 L 50 50 M 42 42 L 58 42" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" />
          <circle cx="50" cy="40" r="3" fill="rgba(255,255,255,0.9)" />
        </g>
      );
    
    case 'leaf_stamp':
      return (
        <path d="M 50 30 Q 45 35 50 45 Q 55 35 50 30" fill="rgba(34,197,94,0.7)" />
      );
    
    case 'divine_circle':
      return (
        <g className="animate-pulse">
          <circle cx="50" cy="50" r="20" fill="none" stroke="rgba(255,215,0,0.8)" strokeWidth="3" />
          <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
          <circle cx="50" cy="50" r="10" fill="none" stroke="rgba(255,215,0,0.4)" strokeWidth="2" />
        </g>
      );
    
    case 'ancestral_knot':
      return (
        <g>
          <path d="M 40 40 Q 50 30 60 40 Q 50 50 40 40 M 40 60 Q 50 50 60 60 Q 50 70 40 60" 
                fill="none" stroke="rgba(139,69,19,0.8)" strokeWidth="2" />
          <circle cx="50" cy="50" r="2" fill="rgba(255,255,255,0.9)" />
        </g>
      );
    
    case 'angel_halo':
      return (
        <g className="animate-pulse">
          <ellipse cx="50" cy="15" rx="15" ry="3" fill="none" stroke="rgba(255,215,0,0.9)" strokeWidth="2" />
          <ellipse cx="50" cy="15" rx="12" ry="2" fill="rgba(255,255,255,0.3)" />
        </g>
      );
    
    case 'aurora_waves':
      return (
        <g className="animate-aurora">
          <path d="M 20 40 Q 30 35 40 40 Q 50 45 60 40 Q 70 35 80 40" 
                stroke={`url(#${patternIdPrefix}auroraGradient)`} strokeWidth="3" fill="none" />
          <path d="M 25 50 Q 35 45 45 50 Q 55 55 65 50 Q 75 45 85 50" 
                stroke={`url(#${patternIdPrefix}auroraGradient2)`} strokeWidth="2" fill="none" />
        </g>
      );
    
    case 'radiant_line':
      return (
        <g className="animate-pulse">
          <line x1="50" y1="20" x2="50" y2="80" stroke={`url(#${patternIdPrefix}radiantGradient)`} strokeWidth="3" />
          <circle cx="50" cy="30" r="3" fill="rgba(255,255,255,0.9)" />
          <circle cx="50" cy="50" r="2" fill="rgba(255,255,255,0.8)" />
          <circle cx="50" cy="70" r="3" fill="rgba(255,255,255,0.9)" />
        </g>
      );
    
    default:
      return null;
  }
}

// Pattern Effects Component
function PatternEffect({ type, patternIdPrefix }: { type: string; patternIdPrefix: string }) {
  switch (type) {
    case 'stripes':
      return (
        <g>
          <rect x="30" y="25" width="40" height="3" fill="rgba(255,255,255,0.3)" />
          <rect x="30" y="35" width="40" height="3" fill="rgba(255,255,255,0.3)" />
          <rect x="30" y="45" width="40" height="3" fill="rgba(255,255,255,0.3)" />
          <rect x="30" y="55" width="40" height="3" fill="rgba(255,255,255,0.3)" />
          <rect x="30" y="65" width="40" height="3" fill="rgba(255,255,255,0.3)" />
        </g>
      );
    
    case 'dots':
      return (
        <g>
          <circle cx="35" cy="35" r="2" fill="rgba(255,255,255,0.4)" />
          <circle cx="50" cy="30" r="2" fill="rgba(255,255,255,0.4)" />
          <circle cx="65" cy="35" r="2" fill="rgba(255,255,255,0.4)" />
          <circle cx="40" cy="50" r="2" fill="rgba(255,255,255,0.4)" />
          <circle cx="60" cy="50" r="2" fill="rgba(255,255,255,0.4)" />
          <circle cx="35" cy="65" r="2" fill="rgba(255,255,255,0.4)" />
          <circle cx="50" cy="70" r="2" fill="rgba(255,255,255,0.4)" />
          <circle cx="65" cy="65" r="2" fill="rgba(255,255,255,0.4)" />
        </g>
      );
    
    case 'gradient':
      return (
        <ellipse cx="50" cy="50" rx="25" ry="35" fill={`url(#${patternIdPrefix}patternGradient)`} opacity="0.3" />
      );
    
    case 'soft_wave':
      return (
        <g>
          <path d="M 25 40 Q 35 35 45 40 Q 55 45 65 40 Q 75 35 85 40" 
                stroke="rgba(255,255,255,0.4)" strokeWidth="3" fill="none" />
          <path d="M 25 55 Q 35 50 45 55 Q 55 60 65 55 Q 75 50 85 55" 
                stroke="rgba(255,255,255,0.4)" strokeWidth="3" fill="none" />
        </g>
      );
    
    case 'spiral_twist':
      return (
        <path d="M 50 25 Q 60 30 65 40 Q 60 50 50 55 Q 40 50 35 40 Q 40 30 50 25" 
              stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="none" />
      );
    
    case 'galaxy_dust':
      return (
        <g className="animate-pulse">
          <circle cx="30" cy="30" r="1" fill="rgba(255,255,255,0.8)" />
          <circle cx="45" cy="25" r="0.5" fill="rgba(255,255,255,0.6)" />
          <circle cx="60" cy="35" r="1.5" fill="rgba(255,255,255,0.9)" />
          <circle cx="35" cy="50" r="0.8" fill="rgba(255,255,255,0.7)" />
          <circle cx="65" cy="55" r="1.2" fill="rgba(255,255,255,0.8)" />
          <circle cx="40" cy="70" r="0.6" fill="rgba(255,255,255,0.6)" />
          <circle cx="70" cy="70" r="1" fill="rgba(255,255,255,0.8)" />
        </g>
      );
    
    case 'crackled_lines':
      return (
        <g>
          <path d="M 30 30 L 35 35 L 30 40 L 35 45" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" />
          <path d="M 70 35 L 65 40 L 70 45 L 65 50" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" />
          <path d="M 45 25 L 50 30 L 55 25 L 50 35" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" />
        </g>
      );
    
    case 'nebula_bloom':
      return (
        <g className="animate-pulse">
          <ellipse cx="50" cy="50" rx="20" ry="15" fill={`url(#${patternIdPrefix}nebulaGradient)`} opacity="0.4" />
          <ellipse cx="50" cy="50" rx="15" ry="10" fill={`url(#${patternIdPrefix}nebulaGradient2)`} opacity="0.3" />
        </g>
      );
    
    case 'sacred_geometry':
      return (
        <g>
          <polygon points="50,30 60,45 50,60 40,45" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
          <circle cx="50" cy="45" r="8" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
          <circle cx="50" cy="45" r="3" fill="rgba(255,255,255,0.7)" />
        </g>
      );
    
    case 'shifting_rings':
      return (
        <g className="animate-spin" style={{ transformOrigin: '50px 50px', animationDuration: '10s' }}>
          <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
          <circle cx="50" cy="50" r="20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <circle cx="50" cy="50" r="25" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        </g>
      );
    
    default:
      return null;
  }
}

// Visual Effect Component
function VisualEffect({ type, patternIdPrefix }: { type: string; patternIdPrefix: string }) {
  switch (type) {
    case 'glow_aura':
      return (
        <g className="animate-pulse">
          <circle cx="50" cy="50" r="40" fill={`url(#${patternIdPrefix}glowAura)`} opacity="0.3" />
        </g>
      );
    
    case 'sparkle_effect':
      return (
        <g className="animate-pulse">
          <path d="M 30 30 L 32 28 L 34 30 L 32 32 Z" fill="rgba(255,255,255,0.9)" />
          <path d="M 70 40 L 71.5 38.5 L 73 40 L 71.5 41.5 Z" fill="rgba(255,255,255,0.8)" />
          <path d="M 40 70 L 41 69 L 42 70 L 41 71 Z" fill="rgba(255,255,255,0.7)" />
        </g>
      );
    
    case 'shimmer':
      return (
        <g className="animate-pulse">
          <rect x="20" y="30" width="60" height="2" fill={`url(#${patternIdPrefix}shimmerGradient)`} rx="1" />
          <rect x="25" y="50" width="50" height="2" fill={`url(#${patternIdPrefix}shimmerGradient)`} rx="1" />
          <rect x="30" y="70" width="40" height="2" fill={`url(#${patternIdPrefix}shimmerGradient)`} rx="1" />
        </g>
      );
    
    default:
      return null;
  }
}

// Blessing Effect Component
function BlessingEffect({ type, patternIdPrefix }: { type: string; patternIdPrefix: string }) {
  switch (type) {
    case 'telepathic':
      return (
        <g className="animate-pulse">
          <circle cx="50" cy="25" r="8" fill="none" stroke="rgba(138,43,226,0.6)" strokeWidth="2" />
          <circle cx="50" cy="25" r="4" fill="rgba(255,255,255,0.8)" />
        </g>
      );
    
    case 'keen_sense':
      return (
        <g>
          <path d="M 45 20 L 50 15 L 55 20 L 50 25 Z" fill="rgba(255,215,0,0.7)" />
          <circle cx="50" cy="20" r="2" fill="rgba(255,255,255,0.9)" />
        </g>
      );
    
    case 'light_heal':
      return (
        <g className="animate-pulse">
          <circle cx="50" cy="50" r="30" fill={`url(#${patternIdPrefix}healGlow)`} opacity="0.2" />
          <path d="M 50 35 L 50 65 M 35 50 L 65 50" stroke="rgba(255,255,255,0.8)" strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    
    case 'night_vision':
      return (
        <g>
          <circle cx="38" cy="45" r="12" fill="none" stroke="rgba(138,43,226,0.5)" strokeWidth="1" />
          <circle cx="62" cy="45" r="12" fill="none" stroke="rgba(138,43,226,0.5)" strokeWidth="1" />
          <circle cx="38" cy="45" r="8" fill="rgba(138,43,226,0.2)" />
          <circle cx="62" cy="45" r="8" fill="rgba(138,43,226,0.2)" />
        </g>
      );
    
    case 'inner_peace':
      return (
        <g className="animate-pulse">
          <circle cx="50" cy="50" r="25" fill="none" stroke="rgba(34,197,94,0.4)" strokeWidth="2" />
          <circle cx="50" cy="50" r="15" fill="rgba(34,197,94,0.1)" />
        </g>
      );
    
    case 'sun_gifted':
      return (
        <g className="animate-pulse">
          <circle cx="50" cy="30" r="8" fill="rgba(255,215,0,0.8)" />
          <path d="M 50 15 L 50 25 M 42 22 L 58 22 M 35 30 L 45 30 M 55 30 L 65 30 M 42 38 L 58 38" 
                stroke="rgba(255,215,0,0.6)" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    
    case 'eternal_grace':
      return (
        <g className="animate-pulse">
          <ellipse cx="50" cy="15" rx="20" ry="4" fill="none" stroke="rgba(255,215,0,0.9)" strokeWidth="2" />
          <circle cx="50" cy="50" r="35" fill={`url(#${patternIdPrefix}graceGlow)`} opacity="0.2" />
        </g>
      );
    
    case 'blessing_of_light':
      return (
        <g className="animate-pulse">
          <circle cx="50" cy="50" r="40" fill={`url(#${patternIdPrefix}lightBlessing)`} opacity="0.3" />
          <path d="M 50 20 L 50 80 M 20 50 L 80 50 M 30 30 L 70 70 M 70 30 L 30 70" 
                stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    
    case 'soul_touch':
      return (
        <g className="animate-pulse">
          <circle cx="50" cy="50" r="20" fill="none" stroke="rgba(138,43,226,0.6)" strokeWidth="3" />
          <circle cx="50" cy="50" r="10" fill="rgba(255,255,255,0.3)" />
          <circle cx="50" cy="50" r="5" fill="rgba(138,43,226,0.8)" />
        </g>
      );
    
    default:
      return null;
  }
}

// Gradient Definitions Component
export function BlobbiVisualEffectGradients({ patternIdPrefix }: { patternIdPrefix: string }) {
  return (
    <defs>
      {/* Glow effects */}
      <radialGradient id={`${patternIdPrefix}glowRing`} cx="0.5" cy="0.5">
        <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
        <stop offset="100%" stopColor="rgba(138,43,226,0.6)" />
      </radialGradient>
      
      <radialGradient id={`${patternIdPrefix}blueGlow`} cx="0.5" cy="0.5">
        <stop offset="0%" stopColor="rgba(59,130,246,0.6)" />
        <stop offset="100%" stopColor="rgba(59,130,246,0.1)" />
      </radialGradient>
      
      <radialGradient id={`${patternIdPrefix}goldGlimmer`} cx="0.5" cy="0.5">
        <stop offset="0%" stopColor="rgba(255,215,0,0.8)" />
        <stop offset="100%" stopColor="rgba(255,215,0,0.2)" />
      </radialGradient>
      
      <radialGradient id={`${patternIdPrefix}glowAura`} cx="0.5" cy="0.5">
        <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
      </radialGradient>
      
      <radialGradient id={`${patternIdPrefix}healGlow`} cx="0.5" cy="0.5">
        <stop offset="0%" stopColor="rgba(34,197,94,0.6)" />
        <stop offset="100%" stopColor="rgba(34,197,94,0.1)" />
      </radialGradient>
      
      <radialGradient id={`${patternIdPrefix}graceGlow`} cx="0.5" cy="0.5">
        <stop offset="0%" stopColor="rgba(255,215,0,0.4)" />
        <stop offset="100%" stopColor="rgba(255,215,0,0.1)" />
      </radialGradient>
      
      <radialGradient id={`${patternIdPrefix}lightBlessing`} cx="0.5" cy="0.5">
        <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
      </radialGradient>
      
      {/* Shimmer effects */}
      <linearGradient id={`${patternIdPrefix}shimmerGradient`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
        <stop offset="50%" stopColor="rgba(255,255,255,0.8)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
      </linearGradient>
      
      {/* Crack glow */}
      <linearGradient id={`${patternIdPrefix}crackGlow`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="rgba(138,43,226,0.8)" />
        <stop offset="50%" stopColor="rgba(255,255,255,0.9)" />
        <stop offset="100%" stopColor="rgba(138,43,226,0.8)" />
      </linearGradient>
      
      {/* Aurora effects */}
      <linearGradient id={`${patternIdPrefix}auroraGradient`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="rgba(34,197,94,0.6)" />
        <stop offset="33%" stopColor="rgba(59,130,246,0.6)" />
        <stop offset="66%" stopColor="rgba(168,85,247,0.6)" />
        <stop offset="100%" stopColor="rgba(236,72,153,0.6)" />
      </linearGradient>
      
      <linearGradient id={`${patternIdPrefix}auroraGradient2`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="rgba(236,72,153,0.4)" />
        <stop offset="33%" stopColor="rgba(168,85,247,0.4)" />
        <stop offset="66%" stopColor="rgba(59,130,246,0.4)" />
        <stop offset="100%" stopColor="rgba(34,197,94,0.4)" />
      </linearGradient>
      
      {/* Radiant effects */}
      <linearGradient id={`${patternIdPrefix}radiantGradient`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
        <stop offset="50%" stopColor="rgba(255,215,0,0.8)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.9)" />
      </linearGradient>
      
      {/* Pattern gradients */}
      <radialGradient id={`${patternIdPrefix}patternGradient`} cx="0.5" cy="0.5">
        <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
      </radialGradient>
      
      <radialGradient id={`${patternIdPrefix}nebulaGradient`} cx="0.5" cy="0.5">
        <stop offset="0%" stopColor="rgba(168,85,247,0.6)" />
        <stop offset="100%" stopColor="rgba(59,130,246,0.3)" />
      </radialGradient>
      
      <radialGradient id={`${patternIdPrefix}nebulaGradient2`} cx="0.5" cy="0.5">
        <stop offset="0%" stopColor="rgba(236,72,153,0.4)" />
        <stop offset="100%" stopColor="rgba(168,85,247,0.2)" />
      </radialGradient>
    </defs>
  );
}