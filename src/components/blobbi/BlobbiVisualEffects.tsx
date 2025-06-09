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
      
      {/* Pattern Effects - REMOVED VISUAL DISPLAY */}
      {/* {pattern && <PatternEffect type={pattern} patternIdPrefix={patternIdPrefix} />} */}
      
      {/* Visual Effects */}
      {visualEffect && <VisualEffect type={visualEffect} patternIdPrefix={patternIdPrefix} />}
      
      {/* Blessing Effects - REMOVED VISUAL DISPLAY */}
      {/* {blessing && <BlessingEffect type={blessing} patternIdPrefix={patternIdPrefix} />} */}
    </g>
  );
}

// Manifestation Effects Component
function ManifestationEffect({ type, patternIdPrefix }: { type: string; patternIdPrefix: string }) {
  switch (type) {
    case 'dot_center':
      return <circle cx="50" cy="50" r="1.5" fill="rgba(255, 255, 255, 0.563)" />;
    
    case 'oval_spots':
      return (
        <svg width="80" height="120" viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="#6b4423">
  <ellipse cx="40" cy="30" rx="2.5" ry="4" />
  <ellipse cx="55" cy="50" rx="3" ry="5" />
  <ellipse cx="45" cy="70" rx="2" ry="3.5" />
</svg>
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
        <svg width="80" height="120" viewBox="0 0 80 120" xmlns="http://www.w3.org/2000/svg" fill="#6b4423">
  <g transform="rotate(90 16 35) translate(-16 -25)">
    <circle cx="22" cy="26" r="1" />
    <circle cx="28" cy="17" r="2" />
    <circle cx="34" cy="25" r="1.3" />
    <circle cx="40" cy="22" r="1.2" />
    <circle cx="46" cy="30" r="1.7" />
    <circle cx="52" cy="20" r="1" />
    <circle cx="58" cy="26" r="1.4" />
    <circle cx="64" cy="24" r="1.1" />
    <circle cx="70" cy="30" r="1.6" />
    <circle cx="30" cy="42" r="1.2" />
    <circle cx="42" cy="39" r="1.5" />
    <circle cx="54" cy="46" r="1.3" />
    <circle cx="66" cy="42" r="1" />
  </g>
</svg>
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
        <svg width="140" height="100" viewBox="0 0 140 100" xmlns="http://www.w3.org/2000/svg">
  <g fill="#5A3311" transform="translate(2,25) scale(0.8)">
    <circle cx="37" cy="40" r="1.2" opacity="0.9" />
    <circle cx="42" cy="42" r="0.9" opacity="0.7" />
    <circle cx="39" cy="45" r="1.1" opacity="0.8" />
    <circle cx="44" cy="47" r="1.3" opacity="1" />
    <circle cx="47" cy="44" r="1" opacity="0.9" />
    <circle cx="49" cy="41" r="0.8" opacity="0.7" />
    <circle cx="35" cy="43" r="1" opacity="0.8" />
    <circle cx="40" cy="38" r="1.1" opacity="0.9" />
    <circle cx="45" cy="39" r="0.9" opacity="0.7" />
    <circle cx="43" cy="44" r="1.2" opacity="0.9" />
    <circle cx="70" cy="40" r="1.2" opacity="0.9" />
    <circle cx="75" cy="42" r="0.9" opacity="0.7" />
    <circle cx="72" cy="45" r="1.1" opacity="0.8" />
    <circle cx="77" cy="47" r="1.3" opacity="1" />
    <circle cx="80" cy="44" r="1" opacity="0.9" />
    <circle cx="82" cy="41" r="0.8" opacity="0.7" />
    <circle cx="68" cy="43" r="1" opacity="0.8" />
    <circle cx="73" cy="38" r="1.1" opacity="0.9" />
    <circle cx="78" cy="39" r="0.9" opacity="0.7" />
    <circle cx="76" cy="44" r="1.2" opacity="0.9" />
  </g>
</svg>
      );
    
    case 'sparkle_trail':
      return (
        <svg width="100" height="70" viewBox="0 0 100 70" xmlns="http://www.w3.org/2000/svg">
  <g>
    <path d="M 24 30 L 26 28 L 28 30 L 26 32 Z" fill="white">
      <animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" repeatCount="indefinite" />
    </path>
    <path d="M 42 20 L 43.5 18.5 L 45 20 L 43.5 21.5 Z" fill="white">
      <animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" begin="0.3s" repeatCount="indefinite" />
    </path>
    <path d="M 59 25 L 61 23 L 63 25 L 61 27 Z" fill="white">
      <animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" begin="0.6s" repeatCount="indefinite" />
    </path>
    <path d="M 72 34 L 73.5 32.5 L 75 34 L 73.5 35.5 Z" fill="white">
      <animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" begin="0.9s" repeatCount="indefinite" />
    </path>
    <path d="M 54 50 L 56 48 L 58 50 L 56 52 Z" fill="white">
      <animate attributeName="opacity" values="0.2;1;0.2" dur="1.5s" begin="1.2s" repeatCount="indefinite" />
    </path>
  </g>
</svg>
      );
    
    case 'light_smoke':
      return (
        <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" fill="none">
  <defs>
    <radialGradient id="smokeGradient" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#aaa" stop-opacity="0.85" />
      <stop offset="70%" stop-color="#666" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#333" stop-opacity="0.25" />
    </radialGradient>
    <filter id="blurSmoke" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" />
    </filter>
  </defs>

  <g>
    <ellipse cx="40" cy="20" rx="30" ry="18" fill="url(#smokeGradient)" filter="url(#blurSmoke)">
      <animateTransform attributeName="transform" attributeType="XML" type="scale"
        values="1;1.1;1" dur="3s" repeatCount="indefinite" additive="sum" />
    </ellipse>
    <ellipse cx="70" cy="30" rx="28" ry="16" fill="url(#smokeGradient)" filter="url(#blurSmoke)">
      <animateTransform attributeName="transform" attributeType="XML" type="scale"
        values="1;1.1;1" dur="3s" repeatCount="indefinite" additive="sum" />
    </ellipse>
    <ellipse cx="55" cy="45" rx="25" ry="15" fill="url(#smokeGradient)" filter="url(#blurSmoke)">
      <animateTransform attributeName="transform" attributeType="XML" type="scale"
        values="1;1.1;1" dur="3s" repeatCount="indefinite" additive="sum" />
    </ellipse>
    <ellipse cx="30" cy="30" rx="20" ry="12" fill="url(#smokeGradient)" filter="url(#blurSmoke)">
      <animateTransform attributeName="transform" attributeType="XML" type="scale"
        values="1;1.1;1" dur="3s" repeatCount="indefinite" additive="sum" />
    </ellipse>
    <ellipse cx="48" cy="32" rx="26" ry="16" fill="url(#smokeGradient)" filter="url(#blurSmoke)">
      <animateTransform attributeName="transform" attributeType="XML" type="scale"
        values="1;1.1;1" dur="3s" repeatCount="indefinite" additive="sum" />
    </ellipse>
  </g>
</svg>
      );
    
    case 'dusty_aura':
      return (
        <svg width="400" height="400" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none">
  <defs>
    <radialGradient id="auraGradient" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#d2b48c" stop-opacity="0.8" />
      <stop offset="70%" stop-color="#a0522d" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#5c3317" stop-opacity="0" />
    </radialGradient>
    <filter id="blurAura" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="5" />
    </filter>
  </defs>

  <circle cx="10" cy="10" r="10" fill="url(#auraGradient)" filter="url(#blurAura)">
    <animate 
      attributeName="r" 
      values="8;12;8" 
      dur="3s" 
      repeatCount="indefinite" />
    <animate 
      attributeName="fill-opacity" 
      values="0.6;0.85;0.6" 
      dur="3s" 
      repeatCount="indefinite" />
  </circle>
</svg>
      );

    case 'ring_mark':
  return <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="2" />;



    case 'glow_ring':
      return (
        <svg width="600" height="600" viewBox="0 0 1200 1200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="auraGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feDropShadow dx="0" dy="0" stdDeviation="20" flood-color="#6A5ACD" flood-opacity="1">
        <animate 
          attributeName="flood-opacity" 
          values="0.3;1;0.3" 
          dur="3s" 
          repeatCount="indefinite" />
      </feDropShadow>
      <feDropShadow dx="0" dy="0" stdDeviation="35" flood-color="#6A5ACD" flood-opacity="0.8">
        <animate 
          attributeName="flood-opacity" 
          values="0.1;0.8;0.1" 
          dur="3s" 
          repeatCount="indefinite" />
      </feDropShadow>
      <feDropShadow dx="0" dy="0" stdDeviation="50" flood-color="#6A5ACD" flood-opacity="0.6">
        <animate 
          attributeName="flood-opacity" 
          values="0.05;0.6;0.05" 
          dur="3s" 
          repeatCount="indefinite" />
      </feDropShadow>
    </filter>
  </defs>

  <circle 
    cx="120" cy="120" r="80" 
    stroke="#6A5ACD" stroke-width="10" fill="none" 
    filter="url(#auraGlow)" 
  />
</svg>
      );
    
    case 'wavy_spots':
      return (
        <svg width="300" height="500" viewBox="0 0 500 800" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" />
          </filter>
        </defs>
      
        <g filter="url(#blur)" fill="#A0A0A0" opacity="0.6"
           transform="rotate(90) translate(0, -300)">
          <path d="M 100 150 
                   C 70 120, 130 100, 160 130 
                   C 190 160, 160 200, 120 190 
                   C 80 180, 100 170, 100 150 Z" />
      
          <path d="M 260 110 
                   C 230 90, 280 70, 310 100 
                   C 340 130, 310 170, 280 150 
                   C 250 130, 270 120, 260 110 Z" />
      
          <path d="M 180 220 
                   C 150 200, 210 180, 240 210 
                   C 270 240, 230 260, 200 240 
                   C 170 230, 190 225, 180 220 Z" />
      
          <path d="M 370 160 
                   C 340 140, 390 120, 420 150 
                   C 450 180, 410 210, 380 190 
                   C 350 170, 370 160, 370 160 Z" />
        </g>
      </svg>
      );
    
    case 'mist_drift':
      return (
        <svg width="280" height="160" viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg" fill="none">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#bbb" flood-opacity="0.7"/>
      <feDropShadow dx="0" dy="0" stdDeviation="12" flood-color="#bbb" flood-opacity="0.4"/>
    </filter>

    <radialGradient id="foggyFill" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ccc" stop-opacity="0.8"/>
      <stop offset="70%" stop-color="#999" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#666" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <g fill="url(#foggyFill)" filter="url(#glow)" transform-origin="140 90" id="cloudFog">
    <circle cx="80" cy="90" r="40" />
    <circle cx="130" cy="70" r="45" />
    <circle cx="180" cy="90" r="40" />
    <circle cx="155" cy="105" r="50" />
    <circle cx="120" cy="105" r="38" />
    <circle cx="170" cy="85" r="35" />
    <circle cx="100" cy="80" r="30" />
  </g>

  <animateTransform href="#cloudFog" attributeName="transform" attributeType="XML"
    type="scale"
    values="1;1.08;1"
    dur="7s"
    repeatCount="indefinite"
  />
</svg>
      );
    
    // Rare manifestations
    case 'rune_top':
      return (
        <svg width="100" height="14" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#D2691E" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="0.4" flood-color="#FF8C00" flood-opacity="0.5"/>
      <feDropShadow dx="0" dy="0" stdDeviation="0.8" flood-color="#FF8C00" flood-opacity="0.3"/>
    </filter>

    <radialGradient id="pulseGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF8C00" stop-opacity="0.8">
        <animate attributeName="stop-opacity" values="0.8;0.3;0.8" dur="3s" repeatCount="indefinite" />
      </stop>
      <stop offset="100%" stop-color="#D2691E" stop-opacity="0" />
    </radialGradient>
  </defs>

  <polygon points="32,6 12,38 52,38" fill="url(#pulseGrad)" />
  <polygon points="32,6 12,38 52,38" filter="url(#glow)" />
  <line x1="32" y1="6" x2="32" y2="58" filter="url(#glow)" />
  <polygon points="32,12 22,32 42,32" filter="url(#glow)" />
  <line x1="12" y1="38" x2="20" y2="54" filter="url(#glow)" />
  <line x1="52" y1="38" x2="44" y2="54" filter="url(#glow)" />
  <line x1="20" y1="54" x2="44" y2="54" filter="url(#glow)" />
</svg>
      );
    
    case 'removed_effect_shimmer_band':
      return null;
    
    case 'spirit_knot':
      return (
        <svg width="140" height="140" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#7B3FD6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <defs>
    <radialGradient id="gradPulse" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#7B3FD6" />
      <stop offset="100%" stop-color="#C6A9F7" />
    </radialGradient>
    <filter id="glowPulse" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="1.4" flood-color="#B69CFF" flood-opacity="0.8" />
      <feDropShadow dx="0" dy="0" stdDeviation="2.8" flood-color="#7B3FD6" flood-opacity="0.6" />
    </filter>
  </defs>

  <g filter="url(#glowPulse)" fill="none" stroke="url(#gradPulse)">
    <path d="
      M32 8
      L24 20
      C22 22 22 26 24 28
      L32 36
      L40 28
      C42 26 42 22 40 20
      L32 8
      Z
      M32 56
      L40 44
      C42 42 42 38 40 36
      L32 28
      L24 36
      C22 38 22 42 24 44
      L32 56
      Z
    " stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <path transform="rotate(90 32 32)" d="
      M32 8
      L24 20
      C22 22 22 26 24 28
      L32 36
      L40 28
      C42 26 42 22 40 20
      L32 8
      Z
      M32 56
      L40 44
      C42 42 42 38 40 36
      L32 28
      L24 36
      C22 38 22 42 24 44
      L32 56
      Z
    " stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
  </g>
</svg>
      );
    
    case 'crescent_moon':
      return null;
    
    case 'tiny_star':
      return (
        <svg width="250" height="250" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="aura" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">
            <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#FFD700" flood-opacity="0.8"/>
            <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="#FFD700" flood-opacity="0.4"/>
          </filter>
        </defs>
        <path 
          filter="url(#aura)"
          fill="#FFD700" 
          stroke="#FFA500" 
          stroke-width="1" 
          d="M12 2.5l2.92 5.91 6.53.95-4.73 4.61 1.12 6.53-5.84-3.07-5.84 3.07 1.12-6.53-4.73-4.61 6.53-.95L12 2.5z"
        >
          <animate attributeName="fill-opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite" />
        </path>
      </svg>
    );
    
    case 'removed_effect_wave_stroke':
      return null;
    
    case 'glow_blue':
      return (
        <svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="blueHalo" cx="50%" cy="50%" r="60%">
      <stop offset="40%" stop-color="#4a90e2" stop-opacity="0.7" />
      <stop offset="100%" stop-color="#4a90e2" stop-opacity="0" />
    </radialGradient>

    <mask id="waveMask">
      <rect width="200" height="200" fill="white" />
      <circle cx="100" cy="100" r="50" fill="black" />
      <circle cx="100" cy="100" r="65" fill="url(#blueHalo)">
        <animate attributeName="r" values="60;68;60" dur="5s" repeatCount="indefinite" />
        <animate attributeName="cx" values="100;110;100" dur="5s" repeatCount="indefinite" />
      </circle>
    </mask>

    <filter id="softBlur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" />
    </filter>

    <circle id="sparkle" r="3" fill="#aaddff" opacity="0">
      <animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite" />
      <animate attributeName="r" values="2;4;2" dur="1.8s" repeatCount="indefinite" />
    </circle>
  </defs>

  <g transform="translate(-30, -20) scale(0.8)">
    <circle cx="100" cy="100" r="70" fill="url(#blueHalo)" mask="url(#waveMask)" filter="url(#softBlur)">
      <animate attributeName="opacity" values="0.6;0.9;0.6" dur="6s" repeatCount="indefinite" />
    </circle>

    <use href="#sparkle" x="60" y="70" />
    <use href="#sparkle" x="140" y="90" />
    <use href="#sparkle" x="110" y="140" />
    <use href="#sparkle" x="80" y="120" />
  </g>
</svg>
      );
    
    case 'removed_effect_glimmer_gold':
      return null;
    
    case 'removed_effect_mist_wisp':
      return null;
    
    // Legendary manifestations
    case 'sigil_eye':
      return (
        <svg width="118" height="40" viewBox="0 50 500 450" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="iris" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#e0e0ff"/>
      <stop offset="40%" stop-color="#9c8fdb"/>
      <stop offset="80%" stop-color="#3f2f92"/>
    </radialGradient>
    <filter id="glow-soft">
      <feGaussianBlur stdDeviation="1.2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="pulse-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#6a4fff" flood-opacity="0.8">
        <animate attributeName="flood-opacity" values="0.8;0.5;0.8" dur="3s" repeatCount="indefinite"/>
      </feDropShadow>
    </filter>

    <radialGradient id="pupilGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#6a4fff" stop-opacity="0.9">
        <animate attributeName="stop-opacity" values="0.9;0.4;0.9" dur="3s" repeatCount="indefinite"/>
      </stop>
      <stop offset="100%" stop-color="#3f2f92" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <path d="M50,100 Q150,10 250,100 Q150,190 50,100 Z"
        stroke="#6a4fff" stroke-width="3" fill="none" filter="url(#pulse-glow)"/>

  <g id="eyeContent">
    <circle cx="150" cy="100" r="35" fill="url(#iris)" filter="url(#glow-soft)"/>
    <circle cx="150" cy="100" r="15" fill="url(#pupilGlow)"/>
    <circle cx="150" cy="100" r="10" fill="#1a1a1a"/>
    <circle cx="150" cy="100" r="40" fill="#b4aef7" opacity="0.1"/>
  </g>
</svg>
      );
    
    case 'removed_effect_glow_crack_pattern':
      return null;
    
    case 'ethereal_rune':
      return (
        <svg width="100" height="100" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <g id="rune">
      <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(0,180,255,0.9)" stroke-width="2" />
      <path d="M6 12 L12 6 L18 12 L12 18 Z" fill="none" stroke="rgba(0,180,255,1)" stroke-width="2" />
      <path d="M12 6 L12 18" stroke="rgba(0,180,255,1)" stroke-width="2" />
      <path d="M6 12 L18 12" stroke="rgba(0,180,255,1)" stroke-width="2" />
    </g>
  </defs>

  <use href="#rune" x="0" y="0" >
    <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
  </use>
</svg>
      );
    
    case 'leaf_stamp':
      return (
        <svg width="110" height="110" viewBox="-40 -15 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="leafGradient" cx="50%" cy="50%" r="60%">
      <stop offset="10%" stop-color="rgba(20,140,60,1)" />
      <stop offset="90%" stop-color="rgba(15,90,35,1)" />
    </radialGradient>
  </defs>
  <path
    d="M 50 30
       Q 42 45 50 60
       Q 58 45 50 30
       Z"
    fill="url(#leafGradient)"
    stroke="rgba(10,70,30,1)"
    stroke-width="0.25"
  />
  <path
    d="M 50 30
       L 50 60"
    stroke="rgba(10,70,30,1)"
    stroke-width="0.2"
    stroke-linecap="round"
  />
</svg>
      );
    
    case 'divine_circle':
      return (
        <svg width="140" height="140" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="divineGlowYellow" cx="50%" cy="50%" r="50%">
      <stop offset="40%" stop-color="rgba(255,215,0,0.8)" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="rgba(255,215,0,0)" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="circleLightYellow" cx="50%" cy="50%" r="50%">
      <stop offset="30%" stop-color="#fff8dc" stop-opacity="1"/>
      <stop offset="100%" stop-color="rgba(255,215,0,0)" stop-opacity="0"/>
    </radialGradient>

    <filter id="softGlowYellow" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="rgba(255,215,0,0.7)" flood-opacity="0.7" />
      <feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="rgba(255,215,0,0.5)" flood-opacity="0.5" />
    </filter>
  </defs>

  <circle cx="70" cy="70" r="56" fill="url(#divineGlowYellow)" filter="url(#softGlowYellow)">
    <animate attributeName="opacity" values="0.6;1;0.6" dur="4s" repeatCount="indefinite" />
  </circle>

  <circle cx="70" cy="70" r="50" fill="none" stroke="url(#circleLightYellow)" stroke-width="4" filter="url(#softGlowYellow)">
    <animate attributeName="stroke-opacity" values="0.3;1;0.3" dur="4s" repeatCount="indefinite" />
  </circle>

  <circle cx="70" cy="70" r="40" fill="none" stroke="rgba(255,215,0,0.9)" stroke-width="1.5" stroke-dasharray="5 8" />
  <circle cx="70" cy="70" r="30" fill="none" stroke="rgba(255,215,0,0.7)" stroke-width="1.2" stroke-dasharray="2 4" />

  <g>
    <circle cx="70" cy="70" r="16" fill="none" stroke="rgba(255,215,0,0.8)" stroke-width="2">
      <animate attributeName="r" values="15;17;15" dur="2.5s" repeatCount="indefinite" />
    </circle>
    <circle cx="70" cy="70" r="11" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="1">
      <animate attributeName="opacity" values="0.3;1;0.3" dur="3s" repeatCount="indefinite" />
    </circle>
    <circle cx="70" cy="70" r="7" fill="none" stroke="rgba(255,215,0,0.4)" stroke-width="1.5">
      <animate attributeName="r" values="6;8;6" dur="2s" repeatCount="indefinite" />
    </circle>
  </g>

  <g stroke="rgba(255,215,0,0.8)" stroke-width="1" fill="rgba(255,215,0,0.7)">
    <circle cx="70" cy="12" r="2">
      <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite" />
    </circle>
    <circle cx="112" cy="30" r="1.5">
      <animate attributeName="opacity" values="0;1;0" dur="3.5s" repeatCount="indefinite" />
    </circle>
    <circle cx="126" cy="70" r="2">
      <animate attributeName="opacity" values="0;1;0" dur="4s" repeatCount="indefinite" />
    </circle>
    <circle cx="104" cy="112" r="1.5">
      <animate attributeName="opacity" values="0;1;0" dur="3.3s" repeatCount="indefinite" />
    </circle>
    <circle cx="65" cy="127" r="2">
      <animate attributeName="opacity" values="0;1;0" dur="3.8s" repeatCount="indefinite" />
    </circle>
    <circle cx="28" cy="112" r="1.5">
      <animate attributeName="opacity" values="0;1;0" dur="3.1s" repeatCount="indefinite" />
    </circle>
    <circle cx="12" cy="70" r="2">
      <animate attributeName="opacity" values="0;1;0" dur="3.6s" repeatCount="indefinite" />
    </circle>
    <circle cx="28" cy="28" r="1.5">
      <animate attributeName="opacity" values="0;1;0" dur="3.2s" repeatCount="indefinite" />
    </circle>
  </g>
</svg>
      );
    
    case 'removed_effect_ancestral_knot':
      return null;
    
    case 'angel_halo':
      return (
        <g className="animate-pulse">
          <ellipse cx="50" cy="15" rx="15" ry="3" fill="none" stroke="rgba(255,215,0,0.9)" strokeWidth="2" />
          <ellipse cx="50" cy="15" rx="12" ry="2" fill="rgba(255,255,255,0.3)" />
        </g>
      );
    
    case 'removed_effect_aurora_waves':
      return null;
    
    case 'removed_effect_radiant_line':
      return null;
    
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