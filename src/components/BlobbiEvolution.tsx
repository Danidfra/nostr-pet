import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateBlobbiDialog } from '@/components/blobbi/CreateBlobbiDialog';
import { useBlobbiWithFakeStatus } from '@/hooks/useBlobbiWithFakeStatus';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface PetForm {
  name: string;
  personality: string;
  color: string;
  description: string;
}

const petForms: PetForm[] = [
  {
    name: 'Pandi',
    personality: 'Gentle & Peaceful',
    color: '#1f2937',
    description: 'A serene panda with geometric charm and zen-like calm'
  },
  {
    name: 'Owli',
    personality: 'Wise & Nocturnal',
    color: '#a8a29e',
    description: 'A wise little owl with big curious eyes'
  },
  {
    name: 'Catti',
    personality: 'Independent & Curious',
    color: '#f97316',
    description: 'A minimalist cat with a playful attitude'
  },
  {
    name: 'Froggi',
    personality: 'Silly & Energetic',
    color: '#22c55e',
    description: 'A bouncy frog with pop-out eyes'
  },
  {
    name: 'Cloudi',
    personality: 'Dreamy & Fluffy',
    color: '#e0e7ff',
    description: 'A soft cloud creature that floats and brings gentle rain'
  },
  {
    name: 'Crysti',
    personality: 'Sparkly & Magical',
    color: '#c084fc',
    description: 'A crystalline being that shimmers with rainbow colors'
  },
  {
    name: 'Bloomi',
    personality: 'Sweet & Fragrant',
    color: '#fbbf24',
    description: 'A flower-like creature that blooms with happiness'
  },
  {
    name: 'Starri',
    personality: 'Cosmic & Mysterious',
    color: '#1e1b4b',
    description: 'A celestial being that twinkles with stardust'
  },
  {
    name: 'Flammi',
    personality: 'Warm & Passionate',
    color: '#ef4444',
    description: 'A little flame with a big heart that dances with joy'
  },
  {
    name: 'Droppi',
    personality: 'Calm & Refreshing',
    color: '#06b6d4',
    description: 'A water droplet that ripples with tranquility'
  },
  {
    name: 'Breezy',
    personality: 'Fresh & Natural',
    color: '#22c55e',
    description: 'A green tree leaf that dances in the gentle breeze'
  },
  {
    name: 'Rocky',
    personality: 'Steady & Reliable',
    color: '#78716c',
    description: 'A pebble friend with a solid heart and gentle nature'
  },
  {
    name: 'Cacti',
    personality: 'Resilient & Cheerful',
    color: '#84cc16',
    description: 'A tiny cactus that blooms with unexpected kindness'
  },
  {
    name: 'Mushie',
    personality: 'Whimsical & Cozy',
    color: '#dc2626',
    description: 'A mushroom sprite that spreads magical spores of joy'
  },
  {
    name: 'Leafy',
    personality: 'Bright & Cheerful',
    color: '#eab308',
    description: 'A sunny sunflower that always faces the light and spreads joy'
  },
  {
    name: 'Rosey',
    personality: 'Elegant & Loving',
    color: '#ec4899',
    description: 'A rose bud that unfurls with grace and affection'
  }
];

const BlobbiEvolution: React.FC = () => {
  const [selectedForm, setSelectedForm] = useState<number | null>(null);
  const [showAccessory, setShowAccessory] = useState(false);
  const { user } = useCurrentUser();
  const { blobbi } = useBlobbiWithFakeStatus();

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
        fill="url(#blobbiBodySubtle)"
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
      <g id="left-eye">
        <ellipse cx="76" cy="90" rx="16" ry="20" fill="url(#blobbiEyeSubtle)" />
        <circle cx="76" cy="92" r="12" fill="url(#blobbiPupilSubtle)" />
        <circle cx="80" cy="88" r="4" fill="white" />
        <circle cx="82" cy="90" r="1.5" fill="white" opacity="0.8" />
      </g>
      <g id="right-eye">
        <ellipse cx="124" cy="90" rx="16" ry="20" fill="url(#blobbiEyeSubtle)" />
        <circle cx="124" cy="92" r="12" fill="url(#blobbiPupilSubtle)" />
        <circle cx="128" cy="88" r="4" fill="white" />
        <circle cx="130" cy="90" r="1.5" fill="white" opacity="0.8" />
      </g>
      
      {/* Happy mouth with gentle shading */}
      <path 
        d="M 84 124 Q 100 136 116 124" 
        stroke="url(#blobbiMouthSubtle)" 
        strokeWidth="5" 
        fill="none" 
        strokeLinecap="round" 
      />
      
      {/* Soft blush for cuteness */}
      <ellipse cx="44" cy="110" rx="12" ry="8" fill="rgba(255,182,193,0.5)" />
      <ellipse cx="156" cy="110" rx="12" ry="8" fill="rgba(255,182,193,0.5)" />
      
      {/* Optional accessory - simple hat with gentle shading */}
      {showAccessory && (
        <g>
          <ellipse cx="100" cy="45" rx="32" ry="12" fill="url(#blobbiHatSubtle)" />
          <rect x="78" y="38" width="44" height="15" fill="url(#blobbiHatBandSubtle)" rx="2" />
          <circle cx="100" cy="30" r="6" fill="url(#blobbiHatPompomSubtle)" />
          <circle cx="101" cy="29" r="2" fill="white" opacity="0.6" />
        </g>
      )}
      
      <defs>
        <radialGradient id="blobbiBodySubtle" cx="0.3" cy="0.25">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="60%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#6d28d9" />
        </radialGradient>
        <radialGradient id="blobbiEyeSubtle" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f1f5f9" />
        </radialGradient>
        <radialGradient id="blobbiPupilSubtle" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1e293b" />
        </radialGradient>
        <linearGradient id="blobbiMouthSubtle" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="50%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
        <radialGradient id="blobbiHatSubtle" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="blobbiHatBandSubtle" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id="blobbiHatPompomSubtle" cx="0.3" cy="0.3">
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
      
      {/* Black ear patches - perfect circles */}
      <circle cx="75" cy="65" r="18" fill="#1f2937" />
      <circle cx="125" cy="65" r="18" fill="#1f2937" />
      
      {/* Inner ears - smaller circles */}
      <circle cx="75" cy="65" r="12" fill="#374151" />
      <circle cx="125" cy="65" r="12" fill="#374151" />
      
      {/* Eye patches - perfect circles */}
      <circle cx="85" cy="85" r="20" fill="#1f2937" />
      <circle cx="115" cy="85" r="20" fill="#1f2937" />
      
      {/* Eyes - geometric circles */}
      <circle cx="85" cy="85" r="12" fill="white" />
      <circle cx="115" cy="85" r="12" fill="white" />
      <circle cx="85" cy="85" r="8" fill="#1f2937" />
      <circle cx="115" cy="85" r="8" fill="#1f2937" />
      <circle cx="88" cy="82" r="3" fill="white" />
      <circle cx="118" cy="82" r="3" fill="white" />
      
      {/* Nose - simple triangle */}
      <path d="M 100 95 L 95 105 L 105 105 Z" fill="#1f2937" />
      
      {/* Mouth - geometric curves */}
      <path d="M 90 110 Q 100 118 110 110" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Arms - simple circles */}
      <circle cx="55" cy="120" r="15" fill="#1f2937" />
      <circle cx="145" cy="120" r="15" fill="#1f2937" />
      
      {/* Legs - simple circles */}
      <circle cx="80" cy="165" r="18" fill="#1f2937" />
      <circle cx="120" cy="165" r="18" fill="#1f2937" />
      
      {/* Optional accessory - geometric bamboo hat */}
      {showAccessory && (
        <g>
          <rect x="70" y="45" width="60" height="8" fill="#22c55e" rx="4" stroke="#16a34a" strokeWidth="1" />
          <rect x="75" y="25" width="50" height="25" fill="#16a34a" rx="3" stroke="#15803d" strokeWidth="1" />
          <rect x="80" y="30" width="40" height="15" fill="#22c55e" rx="2" stroke="#16a34a" strokeWidth="1" />
        </g>
      )}
    </svg>
  );

  const renderOwli = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Drop shadow for 3D effect */}
      <ellipse cx="105" cy="185" rx="55" ry="8" fill="rgba(0,0,0,0.15)" />
      
      {/* Round body with enhanced 3D gradient */}
      <circle cx="100" cy="110" r="60" fill="url(#owliBody3D)" />
      
      {/* Triangle ears with depth */}
      <path d="M 60 70 L 70 48 L 82 70 Z" fill="url(#owliEar3D)" />
      <path d="M 118 70 L 130 48 L 140 70 Z" fill="url(#owliEar3D)" />
      <path d="M 65 65 L 70 52 L 77 65 Z" fill="url(#owliEarInner)" />
      <path d="M 123 65 L 130 52 L 135 65 Z" fill="url(#owliEarInner)" />
      
      {/* Large expressive eyes with enhanced depth */}
      <circle cx="80" cy="100" r="22" fill="url(#owliEyeWhite3D)" />
      <circle cx="120" cy="100" r="22" fill="url(#owliEyeWhite3D)" />
      <circle cx="80" cy="100" r="14" fill="url(#owliPupil3D)" />
      <circle cx="120" cy="100" r="14" fill="url(#owliPupil3D)" />
      <circle cx="84" cy="96" r="5" fill="white" opacity="0.9" />
      <circle cx="124" cy="96" r="5" fill="white" opacity="0.9" />
      <circle cx="86" cy="98" r="2" fill="white" />
      <circle cx="126" cy="98" r="2" fill="white" />
      
      {/* Enhanced beak with 3D shading */}
      <path d="M 100 112 L 94 122 L 100 128 L 106 122 Z" fill="url(#owliBeak3D)" />
      <path d="M 100 114 L 96 120 L 100 124 L 104 120 Z" fill="url(#owliBeakHighlight)" />
      
      {/* Subtle wing details with layered depth */}
      <ellipse cx="48" cy="110" rx="16" ry="32" fill="url(#owliWing3D)" transform="rotate(-20 48 110)" />
      <ellipse cx="152" cy="110" rx="16" ry="32" fill="url(#owliWing3D)" transform="rotate(20 152 110)" />
      <ellipse cx="50" cy="108" rx="12" ry="25" fill="url(#owliWingHighlight)" transform="rotate(-20 50 108)" />
      <ellipse cx="150" cy="108" rx="12" ry="25" fill="url(#owliWingHighlight)" transform="rotate(20 150 108)" />
      
      {/* Soft feather texture details */}
      <circle cx="70" cy="130" r="3" fill="rgba(255,255,255,0.2)" />
      <circle cx="130" cy="125" r="2.5" fill="rgba(255,255,255,0.2)" />
      <circle cx="85" cy="140" r="2" fill="rgba(255,255,255,0.15)" />
      <circle cx="115" cy="135" r="2.5" fill="rgba(255,255,255,0.15)" />
      
      {/* Optional accessory - enhanced bow tie */}
      {showAccessory && (
        <g>
          <path d="M 83 142 L 100 136 L 117 142 L 117 154 L 100 148 L 83 154 Z" fill="url(#bowTie3D)" />
          <rect x="94" y="136" width="12" height="18" fill="url(#bowTieCenter3D)" rx="2" />
          <ellipse cx="100" cy="145" rx="4" ry="6" fill="rgba(255,255,255,0.3)" />
        </g>
      )}
      
      <defs>
        <radialGradient id="owliBody3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#d6d3d1" />
          <stop offset="40%" stopColor="#a8a29e" />
          <stop offset="100%" stopColor="#78716c" />
        </radialGradient>
        <radialGradient id="owliEar3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#a8a29e" />
          <stop offset="100%" stopColor="#57534e" />
        </radialGradient>
        <radialGradient id="owliEarInner" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id="owliEyeWhite3D" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f5f5f4" />
          <stop offset="100%" stopColor="#e7e5e4" />
        </radialGradient>
        <radialGradient id="owliPupil3D" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <radialGradient id="owliBeak3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id="owliBeakHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id="owliWing3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#a8a29e" />
          <stop offset="100%" stopColor="#57534e" />
        </radialGradient>
        <radialGradient id="owliWingHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#d6d3d1" />
          <stop offset="100%" stopColor="#a8a29e" />
        </radialGradient>
        <radialGradient id="bowTie3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="50%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <radialGradient id="bowTieCenter3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderCatti = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Drop shadow for 3D effect */}
      <ellipse cx="105" cy="185" rx="40" ry="8" fill="rgba(0,0,0,0.15)" />
      
      {/* Oval upright body with enhanced 3D gradient */}
      <ellipse cx="100" cy="120" rx="45" ry="60" fill="url(#cattiBody3D)" />
      
      {/* Triangle ears with depth and inner detail */}
      <path d="M 68 72 L 58 48 L 82 62 Z" fill="url(#cattiEar3D)" />
      <path d="M 132 72 L 142 48 L 118 62 Z" fill="url(#cattiEar3D)" />
      <path d="M 70 62 L 64 52 L 76 58 Z" fill="url(#cattiEarInner)" />
      <path d="M 130 62 L 136 52 L 124 58 Z" fill="url(#cattiEarInner)" />
      
      {/* Enhanced expressive eyes with depth */}
      <ellipse cx="85" cy="100" rx="12" ry="16" fill="url(#cattiEyeWhite3D)" />
      <ellipse cx="115" cy="100" rx="12" ry="16" fill="url(#cattiEyeWhite3D)" />
      <ellipse cx="85" cy="100" rx="8" ry="12" fill="url(#cattiPupil3D)" />
      <ellipse cx="115" cy="100" rx="8" ry="12" fill="url(#cattiPupil3D)" />
      <ellipse cx="87" cy="97" rx="3" ry="4" fill="white" opacity="0.9" />
      <ellipse cx="117" cy="97" rx="3" ry="4" fill="white" opacity="0.9" />
      <ellipse cx="89" cy="99" rx="1.5" ry="2" fill="white" />
      <ellipse cx="119" cy="99" rx="1.5" ry="2" fill="white" />
      
      {/* Enhanced cat nose with 3D effect */}
      <path d="M 94 115 L 100 122 L 106 115 Z" fill="url(#cattiNose3D)" />
      <path d="M 96 116 L 100 120 L 104 116 Z" fill="url(#cattiNoseHighlight)" />
      
      {/* Cat mouth with subtle curves */}
      <path d="M 100 122 Q 88 128 82 122" stroke="url(#cattiMouth3D)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 100 122 Q 112 128 118 122" stroke="url(#cattiMouth3D)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      
      {/* Enhanced curved tail with gradient */}
      <path d="M 145 140 Q 165 115 158 95 Q 148 75 165 65" stroke="url(#cattiTail3D)" strokeWidth="22" fill="none" strokeLinecap="round" />
      <path d="M 145 140 Q 163 117 156 97 Q 148 79 163 69" stroke="url(#cattiTailHighlight)" strokeWidth="16" fill="none" strokeLinecap="round" />
      
      {/* Enhanced whiskers with subtle curves */}
      <path d="M 48 108 Q 58 110 72 108" stroke="#1e293b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M 48 118 Q 58 120 72 118" stroke="#1e293b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M 128 108 Q 138 110 152 108" stroke="#1e293b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M 128 118 Q 138 120 152 118" stroke="#1e293b" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      
      {/* Soft fur texture details */}
      <ellipse cx="75" cy="135" rx="3" ry="2" fill="rgba(255,255,255,0.2)" />
      <ellipse cx="125" cy="130" rx="2.5" ry="2" fill="rgba(255,255,255,0.2)" />
      <ellipse cx="90" cy="150" rx="2" ry="1.5" fill="rgba(255,255,255,0.15)" />
      
      {/* Optional accessory - enhanced collar with bell */}
      {showAccessory && (
        <g>
          <rect x="53" y="145" width="94" height="10" fill="url(#collar3D)" rx="5" />
          <circle cx="100" cy="157" r="8" fill="url(#bell3D)" />
          <circle cx="100" cy="155" r="6" fill="url(#bellHighlight)" />
          <line x1="100" y1="157" x2="100" y2="162" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}
      
      <defs>
        <radialGradient id="cattiBody3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="40%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#c2410c" />
        </radialGradient>
        <radialGradient id="cattiEar3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#c2410c" />
        </radialGradient>
        <radialGradient id="cattiEarInner" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="cattiEyeWhite3D" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f3f4f6" />
        </radialGradient>
        <radialGradient id="cattiPupil3D" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <radialGradient id="cattiNose3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#be185d" />
        </radialGradient>
        <radialGradient id="cattiNoseHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <linearGradient id="cattiMouth3D" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="50%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
        <radialGradient id="cattiTail3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fed7aa" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#c2410c" />
        </radialGradient>
        <radialGradient id="cattiTailHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fed7aa" />
        </radialGradient>
        <radialGradient id="collar3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <radialGradient id="bell3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id="bellHighlight" cx="0.4" cy="0.3">
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
      <ellipse cx="100" cy="120" rx="70" ry="50" fill="url(#froggiBody3D)" />
      
      {/* Big circular pop-out eyes with enhanced depth */}
      <circle cx="70" cy="80" r="27" fill="url(#froggiEyeBase3D)" />
      <circle cx="130" cy="80" r="27" fill="url(#froggiEyeBase3D)" />
      <circle cx="70" cy="80" r="22" fill="url(#froggiEyeWhite3D)" />
      <circle cx="130" cy="80" r="22" fill="url(#froggiEyeWhite3D)" />
      <circle cx="70" cy="80" r="16" fill="url(#froggiPupil3D)" />
      <circle cx="130" cy="80" r="16" fill="url(#froggiPupil3D)" />
      <circle cx="74" cy="76" r="6" fill="white" opacity="0.9" />
      <circle cx="134" cy="76" r="6" fill="white" opacity="0.9" />
      <circle cx="76" cy="78" r="2.5" fill="white" />
      <circle cx="136" cy="78" r="2.5" fill="white" />
      
      {/* Enhanced wide smile with depth */}
      <path d="M 45 120 Q 100 145 155 120" stroke="url(#froggiMouth3D)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M 50 122 Q 100 142 150 122" stroke="url(#froggiMouthHighlight)" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Enhanced nostrils with 3D effect */}
      <ellipse cx="90" cy="110" rx="4" ry="6" fill="url(#froggiNostril3D)" />
      <ellipse cx="110" cy="110" rx="4" ry="6" fill="url(#froggiNostril3D)" />
      <ellipse cx="90" cy="108" rx="2" ry="3" fill="url(#froggiNostrilHighlight)" />
      <ellipse cx="110" cy="108" rx="2" ry="3" fill="url(#froggiNostrilHighlight)" />
      
      {/* Enhanced webbed feet with depth */}
      <ellipse cx="60" cy="160" rx="22" ry="12" fill="url(#froggiFeet3D)" />
      <ellipse cx="140" cy="160" rx="22" ry="12" fill="url(#froggiFeet3D)" />
      <ellipse cx="60" cy="158" rx="18" ry="8" fill="url(#froggiFeetHighlight)" />
      <ellipse cx="140" cy="158" rx="18" ry="8" fill="url(#froggiFeetHighlight)" />
      
      {/* Enhanced webbed toes */}
      <path d="M 43 160 Q 47 155 52 160" stroke="url(#froggiToe3D)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 53 160 Q 57 155 62 160" stroke="url(#froggiToe3D)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 63 160 Q 67 155 72 160" stroke="url(#froggiToe3D)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 123 160 Q 127 155 132 160" stroke="url(#froggiToe3D)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 133 160 Q 137 155 142 160" stroke="url(#froggiToe3D)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 143 160 Q 147 155 152 160" stroke="url(#froggiToe3D)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      
      {/* Soft skin texture details */}
      <ellipse cx="75" cy="135" rx="4" ry="3" fill="rgba(255,255,255,0.2)" />
      <ellipse cx="125" cy="130" rx="3.5" ry="2.5" fill="rgba(255,255,255,0.2)" />
      <ellipse cx="85" cy="145" rx="3" ry="2" fill="rgba(255,255,255,0.15)" />
      <ellipse cx="115" cy="140" rx="3.5" ry="2.5" fill="rgba(255,255,255,0.15)" />
      
      {/* Optional accessory - enhanced crown */}
      {showAccessory && (
        <g>
          <path d="M 78 52 L 84 38 L 92 52 L 100 38 L 108 52 L 116 38 L 122 52 L 122 64 L 78 64 Z" fill="url(#crown3D)" />
          <path d="M 80 54 L 85 42 L 90 54 L 100 42 L 110 54 L 115 42 L 120 54 L 120 62 L 80 62 Z" fill="url(#crownHighlight)" />
          <circle cx="100" cy="46" r="4" fill="url(#gem3D)" />
          <circle cx="100" cy="44" r="2.5" fill="url(#gemHighlight)" />
        </g>
      )}
      
      <defs>
        <radialGradient id="froggiBody3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="40%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id="froggiEyeBase3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id="froggiEyeWhite3D" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f5f5f4" />
          <stop offset="100%" stopColor="#e7e5e4" />
        </radialGradient>
        <radialGradient id="froggiPupil3D" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1f2937" />
        </radialGradient>
        <linearGradient id="froggiMouth3D" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="50%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#374151" />
        </linearGradient>
        <linearGradient id="froggiMouthHighlight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </linearGradient>
        <radialGradient id="froggiNostril3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#14532d" />
        </radialGradient>
        <radialGradient id="froggiNostrilHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id="froggiFeet3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id="froggiFeetHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#4ade80" />
        </radialGradient>
        <linearGradient id="froggiToe3D" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>
        <radialGradient id="crown3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id="crownHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fefce8" />
          <stop offset="100%" stopColor="#fde047" />
        </radialGradient>
        <radialGradient id="gem3D" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="50%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <radialGradient id="gemHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fecaca" />
          <stop offset="100%" stopColor="#f87171" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderCloudi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Soft shadow */}
      <ellipse cx="105" cy="185" rx="60" ry="8" fill="rgba(0,0,0,0.1)" />
      
      {/* Main cloud body - multiple overlapping circles */}
      <circle cx="100" cy="120" r="45" fill="url(#cloudiBody)" />
      <circle cx="75" cy="110" r="35" fill="url(#cloudiBody)" />
      <circle cx="125" cy="110" r="35" fill="url(#cloudiBody)" />
      <circle cx="85" cy="95" r="25" fill="url(#cloudiBody)" />
      <circle cx="115" cy="95" r="25" fill="url(#cloudiBody)" />
      <circle cx="100" cy="85" r="30" fill="url(#cloudiBody)" />
      
      {/* Fluffy highlights */}
      <circle cx="90" cy="100" r="20" fill="url(#cloudiHighlight)" opacity="0.6" />
      <circle cx="110" cy="105" r="18" fill="url(#cloudiHighlight)" opacity="0.5" />
      <circle cx="100" cy="90" r="15" fill="url(#cloudiHighlight)" opacity="0.7" />
      
      {/* Cute eyes */}
      <circle cx="88" cy="100" r="8" fill="white" />
      <circle cx="112" cy="100" r="8" fill="white" />
      <circle cx="88" cy="100" r="5" fill="#64748b" />
      <circle cx="112" cy="100" r="5" fill="#64748b" />
      <circle cx="90" cy="98" r="2" fill="white" />
      <circle cx="114" cy="98" r="2" fill="white" />
      
      {/* Happy smile */}
      <path d="M 92 115 Q 100 122 108 115" stroke="#64748b" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Floating raindrops */}
      <circle cx="70" cy="140" r="3" fill="url(#cloudiRain)" opacity="0.8" />
      <circle cx="130" cy="145" r="2.5" fill="url(#cloudiRain)" opacity="0.6" />
      <circle cx="85" cy="155" r="2" fill="url(#cloudiRain)" opacity="0.7" />
      <circle cx="115" cy="150" r="2.5" fill="url(#cloudiRain)" opacity="0.5" />
      
      {/* Optional accessory - rainbow */}
      {showAccessory && (
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
        <radialGradient id="cloudiBody" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </radialGradient>
        <radialGradient id="cloudiHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.5)" />
        </radialGradient>
        <radialGradient id="cloudiRain" cx="0.5" cy="0.3">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#3b82f6" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderCrysti = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Prismatic shadow */}
      <ellipse cx="105" cy="185" rx="60" ry="8" fill="url(#crystiShadow)" opacity="0.3" />
      
      {/* Main crystal body - rounded hexagon shape */}
      <path d="M 100 50 L 140 80 L 140 130 L 100 160 L 60 130 L 60 80 Z" fill="url(#crystiBody)" />
      <path d="M 100 55 L 135 82 L 135 128 L 100 155 L 65 128 L 65 82 Z" fill="url(#crystiInner)" opacity="0.7" />
      
      {/* Crystal segments with rounded edges */}
      <path d="M 100 50 L 125 70 L 100 105 L 75 70 Z" fill="url(#crystiFacet1)" opacity="0.8" rx="5" />
      <path d="M 75 70 L 100 105 L 60 80 L 60 105 Z" fill="url(#crystiFacet2)" opacity="0.7" />
      <path d="M 125 70 L 140 80 L 140 105 L 100 105 Z" fill="url(#crystiFacet3)" opacity="0.7" />
      <path d="M 60 105 L 100 105 L 75 140 L 60 130 Z" fill="url(#crystiFacet4)" opacity="0.6" />
      <path d="M 100 105 L 140 105 L 125 140 L 100 105 Z" fill="url(#crystiFacet5)" opacity="0.6" />
      <path d="M 75 140 L 100 105 L 125 140 L 100 160 Z" fill="url(#crystiFacet6)" opacity="0.8" />
      
      {/* Sparkly eyes */}
      <circle cx="88" cy="95" r="10" fill="url(#crystiEye)" />
      <circle cx="112" cy="95" r="10" fill="url(#crystiEye)" />
      <circle cx="88" cy="95" r="6" fill="#1e1b4b" />
      <circle cx="112" cy="95" r="6" fill="#1e1b4b" />
      <circle cx="90" cy="93" r="3" fill="white" />
      <circle cx="114" cy="93" r="3" fill="white" />
      
      {/* Crystal smile */}
      <path d="M 90 115 Q 100 123 110 115" stroke="url(#crystiSmile)" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Floating sparkles */}
      <circle cx="65" cy="65" r="2" fill="url(#crystiSparkle1)" opacity="0.9" />
      <circle cx="135" cy="70" r="1.5" fill="url(#crystiSparkle2)" opacity="0.8" />
      <circle cx="70" cy="140" r="1" fill="url(#crystiSparkle3)" opacity="0.7" />
      <circle cx="130" cy="135" r="2" fill="url(#crystiSparkle1)" opacity="0.6" />
      <circle cx="50" cy="105" r="1.5" fill="url(#crystiSparkle2)" opacity="0.8" />
      <circle cx="150" cy="110" r="1" fill="url(#crystiSparkle3)" opacity="0.9" />
      <circle cx="100" cy="40" r="1.5" fill="url(#crystiSparkle1)" opacity="0.7" />
      <circle cx="100" cy="170" r="1" fill="url(#crystiSparkle2)" opacity="0.8" />
      
      {/* Optional accessory - crystal tiara */}
      {showAccessory && (
        <g>
          <path d="M 70 45 L 75 30 L 85 45 L 90 25 L 100 45 L 110 25 L 115 45 L 125 30 L 130 45" 
                stroke="url(#crystiCrown)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="90" cy="25" r="3" fill="url(#crystiGem)" />
          <circle cx="100" cy="20" r="4" fill="url(#crystiGem)" />
          <circle cx="110" cy="25" r="3" fill="url(#crystiGem)" />
        </g>
      )}
      
      <defs>
        <radialGradient id="crystiShadow" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id="crystiBody" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f3e8ff" />
          <stop offset="30%" stopColor="#e9d5ff" />
          <stop offset="70%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id="crystiInner" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </radialGradient>
        <linearGradient id="crystiFacet1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id="crystiFacet2" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="crystiFacet3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="crystiFacet4" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id="crystiFacet5" x1="1" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="crystiFacet6" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <radialGradient id="crystiEye" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e9d5ff" />
        </radialGradient>
        <linearGradient id="crystiSmile" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="50%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <radialGradient id="crystiSparkle1" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="crystiSparkle2" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#ec4899" />
        </radialGradient>
        <radialGradient id="crystiSparkle3" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
        <radialGradient id="crystiCrown" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id="crystiGem" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderBloomi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Soft shadow */}
      <ellipse cx="105" cy="185" rx="55" ry="8" fill="rgba(0,0,0,0.1)" />
      
      {/* Flower petals - overlapping circles */}
      <circle cx="100" cy="70" r="25" fill="url(#bloomiPetal1)" />
      <circle cx="130" cy="90" r="25" fill="url(#bloomiPetal2)" />
      <circle cx="130" cy="130" r="25" fill="url(#bloomiPetal3)" />
      <circle cx="100" cy="150" r="25" fill="url(#bloomiPetal4)" />
      <circle cx="70" cy="130" r="25" fill="url(#bloomiPetal5)" />
      <circle cx="70" cy="90" r="25" fill="url(#bloomiPetal6)" />
      
      {/* Center body - round and cheerful */}
      <circle cx="100" cy="110" r="35" fill="url(#bloomiCenter)" />
      <circle cx="100" cy="110" r="28" fill="url(#bloomiCenterHighlight)" opacity="0.6" />
      
      {/* Happy eyes */}
      <circle cx="88" cy="105" r="8" fill="white" />
      <circle cx="112" cy="105" r="8" fill="white" />
      <circle cx="88" cy="105" r="5" fill="#1f2937" />
      <circle cx="112" cy="105" r="5" fill="#1f2937" />
      <circle cx="90" cy="103" r="2" fill="white" />
      <circle cx="114" cy="103" r="2" fill="white" />
      
      {/* Sweet smile */}
      <path d="M 90 120 Q 100 128 110 120" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Rosy cheeks */}
      <circle cx="70" cy="115" r="8" fill="url(#bloomiBlush)" opacity="0.6" />
      <circle cx="130" cy="115" r="8" fill="url(#bloomiBlush)" opacity="0.6" />
      
      {/* Floating pollen particles */}
      <circle cx="60" cy="80" r="2" fill="url(#bloomiPollen)" opacity="0.8" />
      <circle cx="140" cy="85" r="1.5" fill="url(#bloomiPollen)" opacity="0.6" />
      <circle cx="55" cy="140" r="1" fill="url(#bloomiPollen)" opacity="0.7" />
      <circle cx="145" cy="135" r="2" fill="url(#bloomiPollen)" opacity="0.5" />
      <circle cx="75" cy="60" r="1.5" fill="url(#bloomiPollen)" opacity="0.9" />
      
      {/* Optional accessory - flower crown */}
      {showAccessory && (
        <g>
          <circle cx="85" cy="75" r="6" fill="url(#bloomiSmallFlower1)" />
          <circle cx="100" cy="70" r="7" fill="url(#bloomiSmallFlower2)" />
          <circle cx="115" cy="75" r="6" fill="url(#bloomiSmallFlower3)" />
          <circle cx="87" cy="75" r="3" fill="url(#bloomiFlowerCenter)" />
          <circle cx="100" cy="70" r="3" fill="url(#bloomiFlowerCenter)" />
          <circle cx="113" cy="75" r="3" fill="url(#bloomiFlowerCenter)" />
        </g>
      )}
      
      <defs>
        <radialGradient id="bloomiPetal1" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id="bloomiPetal2" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fed7d7" />
          <stop offset="100%" stopColor="#f87171" />
        </radialGradient>
        <radialGradient id="bloomiPetal3" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id="bloomiPetal4" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id="bloomiPetal5" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#dcfce7" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
        <radialGradient id="bloomiPetal6" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#3b82f6" />
        </radialGradient>
        <radialGradient id="bloomiCenter" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="bloomiCenterHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </radialGradient>
        <radialGradient id="bloomiBlush" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id="bloomiPollen" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id="bloomiSmallFlower1" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id="bloomiSmallFlower2" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id="bloomiSmallFlower3" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#dcfce7" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
        <radialGradient id="bloomiFlowerCenter" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderFlammi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Warm glow shadow */}
      <ellipse cx="105" cy="185" rx="65" ry="8" fill="url(#flammiGlow)" opacity="0.4" />
      
      {/* Main flame body with wider, rounder organic shape */}
      <path d="M 100 160 Q 60 140 50 110 Q 45 80 70 60 Q 80 40 100 25 Q 120 40 130 60 Q 155 80 150 110 Q 140 140 100 160 Z" 
            fill="url(#flammiBody)" />
      <path d="M 100 155 Q 65 138 58 115 Q 55 90 75 70 Q 82 50 100 35 Q 118 50 125 70 Q 145 90 142 115 Q 135 138 100 155 Z" 
            fill="url(#flammiInner)" opacity="0.8" />
      
      {/* Inner flame core */}
      <path d="M 100 145 Q 70 130 65 110 Q 62 95 80 80 Q 85 65 100 55 Q 115 65 120 80 Q 138 95 135 110 Q 130 130 100 145 Z" 
            fill="url(#flammiCore)" opacity="0.9" />
      
      {/* Cute eyes */}
      <circle cx="88" cy="100" r="10" fill="white" />
      <circle cx="112" cy="100" r="10" fill="white" />
      <circle cx="88" cy="100" r="6" fill="#1f2937" />
      <circle cx="112" cy="100" r="6" fill="#1f2937" />
      <circle cx="90" cy="98" r="3" fill="white" />
      <circle cx="114" cy="98" r="3" fill="white" />
      
      {/* Happy smile */}
      <path d="M 88 115 Q 100 125 112 115" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Little arms */}
      <ellipse cx="55" cy="110" rx="8" ry="15" fill="url(#flammiArm)" transform="rotate(-30 55 110)" />
      <ellipse cx="145" cy="110" rx="8" ry="15" fill="url(#flammiArm)" transform="rotate(30 145 110)" />
      
      {/* Little legs */}
      <ellipse cx="90" cy="155" rx="10" ry="8" fill="url(#flammiLeg)" />
      <ellipse cx="110" cy="155" rx="10" ry="8" fill="url(#flammiLeg)" />
      
      {/* Floating embers */}
      <circle cx="45" cy="80" r="2" fill="url(#flammiEmber)" opacity="0.8" />
      <circle cx="155" cy="85" r="1.5" fill="url(#flammiEmber)" opacity="0.6" />
      <circle cx="40" cy="130" r="1" fill="url(#flammiEmber)" opacity="0.7" />
      <circle cx="160" cy="125" r="2" fill="url(#flammiEmber)" opacity="0.5" />
      
      {/* Optional accessory - flame crown */}
      {showAccessory && (
        <g>
          <path d="M 85 65 Q 87 55 90 65 Q 92 55 95 65 Q 97 50 100 65 Q 103 50 105 65 Q 107 55 110 65 Q 112 55 115 65" 
                stroke="url(#flammiCrown)" strokeWidth="4" fill="none" strokeLinecap="round" />
          <circle cx="100" cy="50" r="3" fill="url(#flammiCrownGem)" />
        </g>
      )}
      
      <defs>
        <radialGradient id="flammiGlow" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </radialGradient>
        <radialGradient id="flammiBody" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="30%" stopColor="#f97316" />
          <stop offset="70%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
        <radialGradient id="flammiInner" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </radialGradient>
        <radialGradient id="flammiCore" cx="0.5" cy="0.4">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fde047" />
        </radialGradient>
        <radialGradient id="flammiArm" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
        <radialGradient id="flammiLeg" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#b91c1c" />
        </radialGradient>
        <radialGradient id="flammiEmber" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#f97316" />
        </radialGradient>
        <radialGradient id="flammiCrown" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id="flammiCrownGem" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fde047" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderDroppi = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Ripple shadow */}
      <ellipse cx="105" cy="185" rx="55" ry="8" fill="url(#droppiRipple)" opacity="0.3" />
      
      {/* Main water drop body */}
      <path d="M 100 40 Q 100 30 100 40 Q 135 60 140 110 Q 140 150 100 165 Q 60 150 60 110 Q 65 60 100 40" 
            fill="url(#droppiBody)" />
      
      {/* Inner water reflection */}
      <ellipse cx="100" cy="100" rx="35" ry="45" fill="url(#droppiInner)" opacity="0.6" />
      <ellipse cx="90" cy="80" rx="20" ry="25" fill="url(#droppiHighlight)" opacity="0.7" />
      
      {/* Cute eyes */}
      <circle cx="85" cy="95" r="12" fill="white" />
      <circle cx="115" cy="95" r="12" fill="white" />
      <circle cx="85" cy="95" r="8" fill="#0891b2" />
      <circle cx="115" cy="95" r="8" fill="#0891b2" />
      <circle cx="88" cy="92" r="4" fill="white" />
      <circle cx="118" cy="92" r="4" fill="white" />
      <circle cx="89" cy="94" r="2" fill="white" />
      <circle cx="119" cy="94" r="2" fill="white" />
      
      {/* Gentle smile */}
      <path d="M 88 115 Q 100 123 112 115" stroke="#0891b2" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Little arms */}
      <ellipse cx="60" cy="110" rx="10" ry="18" fill="url(#droppiArm)" transform="rotate(-25 60 110)" />
      <ellipse cx="140" cy="110" rx="10" ry="18" fill="url(#droppiArm)" transform="rotate(25 140 110)" />
      
      {/* Little legs */}
      <ellipse cx="85" cy="160" rx="12" ry="10" fill="url(#droppiLeg)" />
      <ellipse cx="115" cy="160" rx="12" ry="10" fill="url(#droppiLeg)" />
      
      {/* Water droplets floating around */}
      <circle cx="55" cy="75" r="3" fill="url(#droppiDroplet)" opacity="0.8" />
      <circle cx="145" cy="80" r="2.5" fill="url(#droppiDroplet)" opacity="0.6" />
      <circle cx="50" cy="135" r="2" fill="url(#droppiDroplet)" opacity="0.7" />
      <circle cx="150" cy="130" r="2.5" fill="url(#droppiDroplet)" opacity="0.5" />
      
      {/* Optional accessory - water crown */}
      {showAccessory && (
        <g>
          <circle cx="100" cy="35" r="20" stroke="url(#droppiCrown)" strokeWidth="3" fill="none" opacity="0.7" />
          <circle cx="100" cy="35" r="15" stroke="url(#droppiCrown)" strokeWidth="2" fill="none" opacity="0.5" />
          <circle cx="85" cy="30" r="2" fill="url(#droppiCrownGem)" />
          <circle cx="100" cy="25" r="3" fill="url(#droppiCrownGem)" />
          <circle cx="115" cy="30" r="2" fill="url(#droppiCrownGem)" />
        </g>
      )}
      
      <defs>
        <radialGradient id="droppiRipple" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
        <radialGradient id="droppiBody" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="30%" stopColor="#22d3ee" />
          <stop offset="70%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
        <radialGradient id="droppiInner" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </radialGradient>
        <radialGradient id="droppiHighlight" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </radialGradient>
        <radialGradient id="droppiArm" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
        <radialGradient id="droppiLeg" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#0284c7" />
        </radialGradient>
        <radialGradient id="droppiDroplet" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#06b6d4" />
        </radialGradient>
        <radialGradient id="droppiCrown" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#22d3ee" />
        </radialGradient>
        <radialGradient id="droppiCrownGem" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderBreezy = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Nature shadow */}
      <ellipse cx="105" cy="185" rx="50" ry="8" fill="rgba(0,0,0,0.1)" />
      
      {/* Main leaf body - classic leaf shape */}
      <path d="M 100 40 Q 70 60 60 90 Q 55 120 70 140 Q 85 155 100 160 Q 115 155 130 140 Q 145 120 140 90 Q 130 60 100 40" 
            fill="url(#breezyBody)" />
      
      {/* Leaf veins - central vein */}
      <path d="M 100 45 L 100 155" stroke="url(#breezyVein)" strokeWidth="3" opacity="0.6" />
      
      {/* Side veins */}
      <path d="M 100 70 L 80 85" stroke="url(#breezyVein)" strokeWidth="2" opacity="0.5" />
      <path d="M 100 70 L 120 85" stroke="url(#breezyVein)" strokeWidth="2" opacity="0.5" />
      <path d="M 100 100 L 75 115" stroke="url(#breezyVein)" strokeWidth="2" opacity="0.5" />
      <path d="M 100 100 L 125 115" stroke="url(#breezyVein)" strokeWidth="2" opacity="0.5" />
      <path d="M 100 130 L 85 140" stroke="url(#breezyVein)" strokeWidth="2" opacity="0.5" />
      <path d="M 100 130 L 115 140" stroke="url(#breezyVein)" strokeWidth="2" opacity="0.5" />
      
      {/* Inner leaf highlight */}
      <path d="M 100 50 Q 75 65 68 85 Q 65 105 75 120 Q 85 130 100 135 Q 115 130 125 120 Q 135 105 132 85 Q 125 65 100 50" 
            fill="url(#breezyInner)" opacity="0.6" />
      
      {/* Cute eyes */}
      <circle cx="85" cy="90" r="10" fill="white" />
      <circle cx="115" cy="90" r="10" fill="white" />
      <circle cx="85" cy="90" r="6" fill="#1f2937" />
      <circle cx="115" cy="90" r="6" fill="#1f2937" />
      <circle cx="87" cy="88" r="3" fill="white" />
      <circle cx="117" cy="88" r="3" fill="white" />
      
      {/* Cheerful smile */}
      <path d="M 85 110 Q 100 120 115 110" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Little arms */}
      <path d="M 65 100 Q 55 95 50 105 Q 55 115 65 110" fill="url(#breezyArm)" />
      <path d="M 135 100 Q 145 95 150 105 Q 145 115 135 110" fill="url(#breezyArm)" />
      
      {/* Little legs */}
      <ellipse cx="90" cy="155" rx="10" ry="8" fill="url(#breezyLeg)" />
      <ellipse cx="110" cy="155" rx="10" ry="8" fill="url(#breezyLeg)" />
      
      {/* Floating leaves */}
      <path d="M 50 70 Q 45 75 50 80 Q 55 75 50 70" fill="url(#breezyFloating)" opacity="0.8" />
      <path d="M 150 75 Q 145 80 150 85 Q 155 80 150 75" fill="url(#breezyFloating)" opacity="0.6" />
      <path d="M 45 130 Q 40 135 45 140 Q 50 135 45 130" fill="url(#breezyFloating)" opacity="0.7" />
      <path d="M 155 125 Q 150 130 155 135 Q 160 130 155 125" fill="url(#breezyFloating)" opacity="0.5" />
      
      {/* Optional accessory - flower crown */}
      {showAccessory && (
        <g>
          <circle cx="85" cy="55" r="5" fill="url(#breezyFlower1)" />
          <circle cx="100" cy="50" r="6" fill="url(#breezyFlower2)" />
          <circle cx="115" cy="55" r="5" fill="url(#breezyFlower3)" />
          <circle cx="85" cy="55" r="2" fill="#fbbf24" />
          <circle cx="100" cy="50" r="2.5" fill="#fbbf24" />
          <circle cx="115" cy="55" r="2" fill="#fbbf24" />
        </g>
      )}
      
      <defs>
        <radialGradient id="breezyBody" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="30%" stopColor="#4ade80" />
          <stop offset="70%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id="breezyInner" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="100%" stopColor="#86efac" />
        </radialGradient>
        <linearGradient id="breezyVein" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#15803d" />
          <stop offset="50%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
        <radialGradient id="breezyArm" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id="breezyLeg" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id="breezyFloating" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
        <radialGradient id="breezyFlower1" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id="breezyFlower2" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id="breezyFlower3" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fed7d7" />
          <stop offset="100%" stopColor="#f87171" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderRocky = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Solid shadow */}
      <ellipse cx="105" cy="185" rx="50" ry="8" fill="rgba(0,0,0,0.2)" />
      
      {/* Main rocky body - rounded boulder shape */}
      <path d="M 100 50 L 130 70 L 140 110 L 130 150 L 100 165 L 70 150 L 60 110 L 70 70 Z" 
            fill="url(#rockyBody)" />
      <path d="M 100 55 L 125 72 L 135 108 L 125 145 L 100 158 L 75 145 L 65 108 L 75 72 Z" 
            fill="url(#rockyInner)" opacity="0.8" />
      
      {/* Rock texture lines */}
      <path d="M 75 80 L 125 85" stroke="#57534e" strokeWidth="2" opacity="0.5" />
      <path d="M 70 110 L 130 115" stroke="#57534e" strokeWidth="2" opacity="0.5" />
      <path d="M 80 140 L 120 135" stroke="#57534e" strokeWidth="2" opacity="0.5" />
      
      {/* Cute eyes */}
      <circle cx="85" cy="95" r="12" fill="white" />
      <circle cx="115" cy="95" r="12" fill="white" />
      <circle cx="85" cy="95" r="8" fill="#1f2937" />
      <circle cx="115" cy="95" r="8" fill="#1f2937" />
      <circle cx="88" cy="92" r="4" fill="white" />
      <circle cx="118" cy="92" r="4" fill="white" />
      
      {/* Gentle smile */}
      <path d="M 88 115 Q 100 123 112 115" stroke="#1f2937" strokeWidth="4" fill="none" strokeLinecap="round" />
      
      {/* Stubby arms */}
      <ellipse cx="55" cy="110" rx="12" ry="8" fill="url(#rockyArm)" transform="rotate(-15 55 110)" />
      <ellipse cx="145" cy="110" rx="12" ry="8" fill="url(#rockyArm)" transform="rotate(15 145 110)" />
      
      {/* Stubby legs */}
      <ellipse cx="85" cy="160" rx="15" ry="10" fill="url(#rockyLeg)" />
      <ellipse cx="115" cy="160" rx="15" ry="10" fill="url(#rockyLeg)" />
      
      {/* Little pebbles floating around */}
      <circle cx="50" cy="80" r="4" fill="url(#rockyPebble)" opacity="0.8" />
      <circle cx="150" cy="85" r="3" fill="url(#rockyPebble)" opacity="0.6" />
      <circle cx="45" cy="140" r="2.5" fill="url(#rockyPebble)" opacity="0.7" />
      <circle cx="155" cy="135" r="3.5" fill="url(#rockyPebble)" opacity="0.5" />
      
      {/* Optional accessory - moss patches */}
      {showAccessory && (
        <g>
          <ellipse cx="90" cy="60" rx="15" ry="8" fill="url(#rockyMoss)" opacity="0.7" />
          <ellipse cx="110" cy="65" rx="12" ry="6" fill="url(#rockyMoss)" opacity="0.6" />
          <ellipse cx="75" cy="150" rx="10" ry="5" fill="url(#rockyMoss)" opacity="0.5" />
        </g>
      )}
      
      <defs>
        <radialGradient id="rockyBody" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#a8a29e" />
          <stop offset="30%" stopColor="#78716c" />
          <stop offset="70%" stopColor="#57534e" />
          <stop offset="100%" stopColor="#44403c" />
        </radialGradient>
        <radialGradient id="rockyInner" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#d6d3d1" />
          <stop offset="100%" stopColor="#a8a29e" />
        </radialGradient>
        <radialGradient id="rockyArm" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#78716c" />
          <stop offset="100%" stopColor="#44403c" />
        </radialGradient>
        <radialGradient id="rockyLeg" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#57534e" />
          <stop offset="100%" stopColor="#292524" />
        </radialGradient>
        <radialGradient id="rockyPebble" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#a8a29e" />
          <stop offset="100%" stopColor="#57534e" />
        </radialGradient>
        <radialGradient id="rockyMoss" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderCacti = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Desert shadow */}
      <ellipse cx="105" cy="185" rx="40" ry="8" fill="rgba(0,0,0,0.15)" />
      
      {/* Main cactus body */}
      <rect x="85" y="80" width="30" height="80" rx="15" fill="url(#cactiBody)" />
      
      {/* Cactus arms */}
      <rect x="60" y="100" width="20" height="40" rx="10" fill="url(#cactiArm)" />
      <rect x="120" y="110" width="20" height="35" rx="10" fill="url(#cactiArm)" />
      
      {/* Cactus ridges */}
      <line x1="92" y1="85" x2="92" y2="155" stroke="#65a30d" strokeWidth="2" opacity="0.5" />
      <line x1="100" y1="85" x2="100" y2="155" stroke="#65a30d" strokeWidth="2" opacity="0.5" />
      <line x1="108" y1="85" x2="108" y2="155" stroke="#65a30d" strokeWidth="2" opacity="0.5" />
      
      {/* Cute eyes */}
      <circle cx="90" cy="105" r="8" fill="white" />
      <circle cx="110" cy="105" r="8" fill="white" />
      <circle cx="90" cy="105" r="5" fill="#1f2937" />
      <circle cx="110" cy="105" r="5" fill="#1f2937" />
      <circle cx="92" cy="103" r="2" fill="white" />
      <circle cx="112" cy="103" r="2" fill="white" />
      
      {/* Sweet smile */}
      <path d="M 92 120 Q 100 126 108 120" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      
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
      <path d="M 75 160 L 80 175 L 120 175 L 125 160 Z" fill="url(#cactiPot)" />
      <rect x="75" y="160" width="50" height="5" fill="url(#cactiPotRim)" rx="2" />
      
      {/* Blooming flower */}
      <circle cx="100" cy="75" r="12" fill="url(#cactiFlower)" />
      <circle cx="100" cy="75" r="8" fill="url(#cactiFlowerCenter)" />
      <circle cx="100" cy="75" r="4" fill="#fbbf24" />
      
      {/* Optional accessory - more flowers */}
      {showAccessory && (
        <g>
          <circle cx="85" cy="70" r="8" fill="url(#cactiFlower2)" />
          <circle cx="85" cy="70" r="5" fill="url(#cactiFlowerCenter)" />
          <circle cx="115" cy="70" r="8" fill="url(#cactiFlower3)" />
          <circle cx="115" cy="70" r="5" fill="url(#cactiFlowerCenter)" />
        </g>
      )}
      
      <defs>
        <radialGradient id="cactiBody" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="30%" stopColor="#84cc16" />
          <stop offset="70%" stopColor="#65a30d" />
          <stop offset="100%" stopColor="#4d7c0f" />
        </radialGradient>
        <radialGradient id="cactiArm" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#84cc16" />
          <stop offset="100%" stopColor="#65a30d" />
        </radialGradient>
        <radialGradient id="cactiPot" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>
        <radialGradient id="cactiPotRim" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
        <radialGradient id="cactiFlower" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id="cactiFlower2" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id="cactiFlower3" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id="cactiFlowerCenter" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderMushie = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Forest floor shadow */}
      <ellipse cx="105" cy="185" rx="55" ry="8" fill="rgba(0,0,0,0.12)" />
      
      {/* Mushroom stem */}
      <ellipse cx="100" cy="140" rx="25" ry="40" fill="url(#mushieStem)" />
      <ellipse cx="100" cy="135" rx="20" ry="35" fill="url(#mushieStemHighlight)" opacity="0.6" />
      
      {/* Mushroom cap */}
      <path d="M 50 110 Q 50 70 100 60 Q 150 70 150 110 Z" fill="url(#mushieCap)" />
      <path d="M 55 108 Q 55 75 100 65 Q 145 75 145 108 Z" fill="url(#mushieCapHighlight)" opacity="0.7" />
      
      {/* Cap spots */}
      <circle cx="80" cy="85" r="8" fill="white" opacity="0.8" />
      <circle cx="120" cy="80" r="10" fill="white" opacity="0.8" />
      <circle cx="100" cy="95" r="6" fill="white" opacity="0.7" />
      <circle cx="130" cy="100" r="5" fill="white" opacity="0.6" />
      <circle cx="70" cy="100" r="5" fill="white" opacity="0.6" />
      
      {/* Cute eyes on stem */}
      <circle cx="88" cy="130" r="8" fill="white" />
      <circle cx="112" cy="130" r="8" fill="white" />
      <circle cx="88" cy="130" r="5" fill="#1f2937" />
      <circle cx="112" cy="130" r="5" fill="#1f2937" />
      <circle cx="90" cy="128" r="2" fill="white" />
      <circle cx="114" cy="128" r="2" fill="white" />
      
      {/* Happy smile */}
      <path d="M 88 145 Q 100 153 112 145" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Little arms */}
      <ellipse cx="70" cy="140" rx="8" ry="12" fill="url(#mushieArm)" transform="rotate(-20 70 140)" />
      <ellipse cx="130" cy="140" rx="8" ry="12" fill="url(#mushieArm)" transform="rotate(20 130 140)" />
      
      {/* Floating spores */}
      <circle cx="55" cy="120" r="2" fill="url(#mushieSpore)" opacity="0.8" />
      <circle cx="145" cy="115" r="1.5" fill="url(#mushieSpore)" opacity="0.6" />
      <circle cx="50" cy="90" r="1" fill="url(#mushieSpore)" opacity="0.7" />
      <circle cx="150" cy="95" r="2" fill="url(#mushieSpore)" opacity="0.5" />
      <circle cx="65" cy="70" r="1.5" fill="url(#mushieSpore)" opacity="0.6" />
      <circle cx="135" cy="65" r="1" fill="url(#mushieSpore)" opacity="0.8" />
      
      {/* Optional accessory - fairy ring */}
      {showAccessory && (
        <g>
          <circle cx="100" cy="180" r="35" stroke="url(#mushieFairyRing)" strokeWidth="3" fill="none" opacity="0.5" />
          <circle cx="70" cy="175" r="4" fill="url(#mushieTinyMushroom)" />
          <circle cx="70" cy="173" r="3" fill="url(#mushieTinyMushroomCap)" />
          <circle cx="130" cy="175" r="4" fill="url(#mushieTinyMushroom)" />
          <circle cx="130" cy="173" r="3" fill="url(#mushieTinyMushroomCap)" />
          <circle cx="100" cy="178" r="3" fill="url(#mushieTinyMushroom)" />
          <circle cx="100" cy="176" r="2.5" fill="url(#mushieTinyMushroomCap)" />
        </g>
      )}
      
      <defs>
        <radialGradient id="mushieStem" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="30%" stopColor="#fde68a" />
          <stop offset="70%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="mushieStemHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
        </radialGradient>
        <radialGradient id="mushieCap" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="30%" stopColor="#ef4444" />
          <stop offset="70%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#b91c1c" />
        </radialGradient>
        <radialGradient id="mushieCapHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="100%" stopColor="#f87171" />
        </radialGradient>
        <radialGradient id="mushieArm" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="mushieSpore" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <radialGradient id="mushieFairyRing" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
        <radialGradient id="mushieTinyMushroom" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id="mushieTinyMushroomCap" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderLeafy = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Sunny shadow */}
      <ellipse cx="105" cy="185" rx="50" ry="8" fill="rgba(0,0,0,0.1)" />
      
      {/* Sunflower stem */}
      <rect x="96" y="120" width="8" height="55" fill="url(#leafyStem)" rx="4" />
      <rect x="98" y="125" width="4" height="50" fill="url(#leafyStemHighlight)" rx="2" opacity="0.6" />
      
      {/* Stem leaves */}
      <ellipse cx="85" cy="140" rx="15" ry="8" fill="url(#leafyStemLeaf)" transform="rotate(-30 85 140)" />
      <ellipse cx="115" cy="150" rx="15" ry="8" fill="url(#leafyStemLeaf)" transform="rotate(30 115 150)" />
      <ellipse cx="87" cy="140" rx="10" ry="5" fill="url(#leafyStemLeafHighlight)" transform="rotate(-30 87 140)" opacity="0.7" />
      <ellipse cx="113" cy="150" rx="10" ry="5" fill="url(#leafyStemLeafHighlight)" transform="rotate(30 113 150)" opacity="0.7" />
      
      {/* Sunflower petals - outer ring */}
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(0 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(22.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(45 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(67.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(90 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(112.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(135 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(157.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(180 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(202.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(225 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(247.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(270 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(292.5 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(315 100 85)" />
      <ellipse cx="100" cy="85" rx="45" ry="12" fill="url(#leafyPetal)" transform="rotate(337.5 100 85)" />
      
      {/* Sunflower center - outer ring */}
      <circle cx="100" cy="85" r="30" fill="url(#leafyCenter)" />
      <circle cx="100" cy="85" r="25" fill="url(#leafyCenterInner)" />
      
      {/* Seed pattern in center */}
      <circle cx="92" cy="77" r="2" fill="url(#leafySeed)" />
      <circle cx="108" cy="77" r="2" fill="url(#leafySeed)" />
      <circle cx="85" cy="85" r="2" fill="url(#leafySeed)" />
      <circle cx="115" cy="85" r="2" fill="url(#leafySeed)" />
      <circle cx="92" cy="93" r="2" fill="url(#leafySeed)" />
      <circle cx="108" cy="93" r="2" fill="url(#leafySeed)" />
      <circle cx="100" cy="75" r="1.5" fill="url(#leafySeed)" />
      <circle cx="100" cy="95" r="1.5" fill="url(#leafySeed)" />
      <circle cx="88" cy="90" r="1.5" fill="url(#leafySeed)" />
      <circle cx="112" cy="80" r="1.5" fill="url(#leafySeed)" />
      
      {/* Cute eyes */}
      <circle cx="90" cy="82" r="8" fill="white" />
      <circle cx="110" cy="82" r="8" fill="white" />
      <circle cx="90" cy="82" r="5" fill="#1f2937" />
      <circle cx="110" cy="82" r="5" fill="#1f2937" />
      <circle cx="92" cy="80" r="2" fill="white" />
      <circle cx="112" cy="80" r="2" fill="white" />
      
      {/* Bright smile */}
      <path d="M 88 92 Q 100 100 112 92" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Little arms - small leaves */}
      <ellipse cx="60" cy="85" rx="12" ry="6" fill="url(#leafyArm)" transform="rotate(-20 60 85)" />
      <ellipse cx="140" cy="85" rx="12" ry="6" fill="url(#leafyArm)" transform="rotate(20 140 85)" />
      
      {/* Base/roots */}
      <ellipse cx="95" cy="170" rx="8" ry="6" fill="url(#leafyRoot)" />
      <ellipse cx="105" cy="170" rx="8" ry="6" fill="url(#leafyRoot)" />
      
      {/* Floating pollen */}
      <circle cx="55" cy="60" r="2" fill="url(#leafyPollen)" opacity="0.8" />
      <circle cx="145" cy="65" r="1.5" fill="url(#leafyPollen)" opacity="0.6" />
      <circle cx="50" cy="110" r="1" fill="url(#leafyPollen)" opacity="0.7" />
      <circle cx="150" cy="105" r="2" fill="url(#leafyPollen)" opacity="0.5" />
      <circle cx="75" cy="45" r="1.5" fill="url(#leafyPollen)" opacity="0.9" />
      <circle cx="125" cy="50" r="1" fill="url(#leafyPollen)" opacity="0.8" />
      
      {/* Optional accessory - bee friends */}
      {showAccessory && (
        <g>
          <ellipse cx="60" cy="70" rx="6" ry="4" fill="url(#leafyBeeBody)" />
          <ellipse cx="58" cy="70" rx="2" ry="1" fill="#1f2937" />
          <ellipse cx="62" cy="70" rx="2" ry="1" fill="#1f2937" />
          <ellipse cx="55" cy="68" rx="3" ry="1" fill="url(#leafyBeeWing)" opacity="0.7" />
          <ellipse cx="55" cy="72" rx="3" ry="1" fill="url(#leafyBeeWing)" opacity="0.7" />
          
          <ellipse cx="140" cy="100" rx="6" ry="4" fill="url(#leafyBeeBody)" />
          <ellipse cx="138" cy="100" rx="2" ry="1" fill="#1f2937" />
          <ellipse cx="142" cy="100" rx="2" ry="1" fill="#1f2937" />
          <ellipse cx="145" cy="98" rx="3" ry="1" fill="url(#leafyBeeWing)" opacity="0.7" />
          <ellipse cx="145" cy="102" rx="3" ry="1" fill="url(#leafyBeeWing)" opacity="0.7" />
        </g>
      )}
      
      <defs>
        <radialGradient id="leafyStem" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id="leafyStemHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#22c55e" />
        </radialGradient>
        <radialGradient id="leafyStemLeaf" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id="leafyStemLeafHighlight" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="100%" stopColor="#4ade80" />
        </radialGradient>
        <radialGradient id="leafyPetal" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="30%" stopColor="#fde047" />
          <stop offset="70%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </radialGradient>
        <radialGradient id="leafyCenter" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#a16207" />
          <stop offset="50%" stopColor="#92400e" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>
        <radialGradient id="leafyCenterInner" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#a16207" />
        </radialGradient>
        <radialGradient id="leafySeed" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#451a03" />
          <stop offset="100%" stopColor="#292524" />
        </radialGradient>
        <radialGradient id="leafyArm" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id="leafyRoot" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>
        <radialGradient id="leafyPollen" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fde047" />
        </radialGradient>
        <radialGradient id="leafyBeeBody" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id="leafyBeeWing" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e5e7eb" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderRosey = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Elegant shadow */}
      <ellipse cx="105" cy="185" rx="45" ry="8" fill="rgba(0,0,0,0.12)" />
      
      {/* Rose stem */}
      <rect x="98" y="120" width="4" height="50" fill="url(#roseyStem)" rx="2" />
      
      {/* Thorns */}
      <path d="M 98 130 L 94 128" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
      <path d="M 102 145 L 106 143" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
      
      {/* Leaves */}
      <ellipse cx="85" cy="140" rx="12" ry="8" fill="url(#roseyLeaf)" transform="rotate(-30 85 140)" />
      <ellipse cx="115" cy="150" rx="12" ry="8" fill="url(#roseyLeaf)" transform="rotate(30 115 150)" />
      
      {/* Rose petals - layered */}
      <circle cx="100" cy="90" r="35" fill="url(#roseyPetal1)" />
      <path d="M 100 60 Q 120 70 125 90 Q 120 110 100 120 Q 80 110 75 90 Q 80 70 100 60" fill="url(#roseyPetal2)" />
      <path d="M 100 65 Q 115 73 118 90 Q 115 107 100 115 Q 85 107 82 90 Q 85 73 100 65" fill="url(#roseyPetal3)" />
      <circle cx="100" cy="90" r="20" fill="url(#roseyCenter)" />
      
      {/* Cute eyes */}
      <circle cx="90" cy="85" r="8" fill="white" />
      <circle cx="110" cy="85" r="8" fill="white" />
      <circle cx="90" cy="85" r="5" fill="#1f2937" />
      <circle cx="110" cy="85" r="5" fill="#1f2937" />
      <circle cx="92" cy="83" r="2" fill="white" />
      <circle cx="112" cy="83" r="2" fill="white" />
      
      {/* Sweet smile */}
      <path d="M 92 100 Q 100 106 108 100" stroke="#1f2937" strokeWidth="3" fill="none" strokeLinecap="round" />
      
      {/* Rosy cheeks */}
      <circle cx="75" cy="95" r="6" fill="url(#roseyBlush)" opacity="0.6" />
      <circle cx="125" cy="95" r="6" fill="url(#roseyBlush)" opacity="0.6" />
      
      {/* Little arms from center */}
      <ellipse cx="70" cy="90" rx="8" ry="12" fill="url(#roseyArm)" transform="rotate(-30 70 90)" />
      <ellipse cx="130" cy="90" rx="8" ry="12" fill="url(#roseyArm)" transform="rotate(30 130 90)" />
      
      {/* Floating petals */}
      <ellipse cx="55" cy="70" rx="8" ry="5" fill="url(#roseyFloatingPetal)" opacity="0.8" transform="rotate(45 55 70)" />
      <ellipse cx="145" cy="75" rx="7" ry="4" fill="url(#roseyFloatingPetal)" opacity="0.6" transform="rotate(-30 145 75)" />
      <ellipse cx="50" cy="120" rx="6" ry="3.5" fill="url(#roseyFloatingPetal)" opacity="0.7" transform="rotate(60 50 120)" />
      <ellipse cx="150" cy="115" rx="7" ry="4" fill="url(#roseyFloatingPetal)" opacity="0.5" transform="rotate(-45 150 115)" />
      
      {/* Optional accessory - crown of thorns (but cute!) */}
      {showAccessory && (
        <g>
          <circle cx="100" cy="55" r="25" stroke="url(#roseyThorns)" strokeWidth="3" fill="none" strokeDasharray="5,5" />
          <circle cx="85" cy="50" r="2" fill="url(#roseyThornFlower)" />
          <circle cx="100" cy="45" r="2.5" fill="url(#roseyThornFlower)" />
          <circle cx="115" cy="50" r="2" fill="url(#roseyThornFlower)" />
        </g>
      )}
      
      <defs>
        <radialGradient id="roseyStem" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id="roseyLeaf" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </radialGradient>
        <radialGradient id="roseyPetal1" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="30%" stopColor="#f9a8d4" />
          <stop offset="70%" stopColor="#f472b6" />
          <stop offset="100%" stopColor="#ec4899" />
        </radialGradient>
        <radialGradient id="roseyPetal2" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fbcfe8" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id="roseyPetal3" cx="0.5" cy="0.4">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f9a8d4" />
        </radialGradient>
        <radialGradient id="roseyCenter" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#f9a8d4" />
          <stop offset="100%" stopColor="#ec4899" />
        </radialGradient>
        <radialGradient id="roseyBlush" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id="roseyArm" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#f9a8d4" />
          <stop offset="100%" stopColor="#ec4899" />
        </radialGradient>
        <radialGradient id="roseyFloatingPetal" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fbcfe8" />
          <stop offset="100%" stopColor="#f472b6" />
        </radialGradient>
        <radialGradient id="roseyThorns" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </radialGradient>
        <radialGradient id="roseyThornFlower" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderStarri = () => (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      {/* Cosmic shadow */}
      <ellipse cx="105" cy="185" rx="65" ry="10" fill="url(#starriShadow)" opacity="0.4" />
      
      {/* Main star body - larger 5-pointed star shape */}
      <path d="M 100 25 L 115 75 L 165 75 L 125 110 L 140 160 L 100 130 L 60 160 L 75 110 L 35 75 L 85 75 Z" 
            fill="url(#starriBody)" />
      <path d="M 100 35 L 112 70 L 150 70 L 120 95 L 132 135 L 100 115 L 68 135 L 80 95 L 50 70 L 88 70 Z" 
            fill="url(#starriInner)" opacity="0.8" />
      
      {/* Twinkling eyes */}
      <circle cx="88" cy="95" r="10" fill="url(#starriEye)" />
      <circle cx="112" cy="95" r="10" fill="url(#starriEye)" />
      <circle cx="88" cy="95" r="6" fill="#1e1b4b" />
      <circle cx="112" cy="95" r="6" fill="#1e1b4b" />
      <circle cx="90" cy="93" r="3" fill="white" />
      <circle cx="114" cy="93" r="3" fill="white" />
      
      {/* Cosmic smile */}
      <path d="M 88 115 Q 100 125 112 115" stroke="url(#starriSmile)" strokeWidth="4" fill="none" strokeLinecap="round" />
      
      {/* Floating stardust - more particles */}
      <circle cx="55" cy="60" r="2" fill="url(#starriDust1)" opacity="0.9" />
      <circle cx="145" cy="65" r="1.5" fill="url(#starriDust2)" opacity="0.8" />
      <circle cx="60" cy="140" r="2.5" fill="url(#starriDust3)" opacity="0.7" />
      <circle cx="140" cy="135" r="2" fill="url(#starriDust1)" opacity="0.6" />
      <circle cx="40" cy="100" r="1.5" fill="url(#starriDust2)" opacity="0.8" />
      <circle cx="160" cy="105" r="2" fill="url(#starriDust3)" opacity="0.9" />
      <circle cx="70" cy="45" r="1.5" fill="url(#starriDust1)" opacity="0.7" />
      <circle cx="130" cy="50" r="2" fill="url(#starriDust2)" opacity="0.8" />
      <circle cx="100" cy="15" r="1" fill="url(#starriDust3)" opacity="0.9" />
      <circle cx="100" cy="175" r="1.5" fill="url(#starriDust1)" opacity="0.6" />
      <circle cx="25" cy="85" r="1" fill="url(#starriDust2)" opacity="0.7" />
      <circle cx="175" cy="90" r="1.5" fill="url(#starriDust3)" opacity="0.8" />
      
      {/* Constellation lines */}
      <path d="M 55 60 L 70 45 L 130 50 L 145 65" stroke="url(#starriConstellation)" strokeWidth="1.5" opacity="0.5" />
      <path d="M 40 100 L 60 140 L 140 135 L 160 105" stroke="url(#starriConstellation)" strokeWidth="1.5" opacity="0.5" />
      <path d="M 100 15 L 100 175" stroke="url(#starriConstellation)" strokeWidth="1" opacity="0.3" />
      
      {/* Optional accessory - larger cosmic halo */}
      {showAccessory && (
        <g>
          <circle cx="100" cy="100" r="85" stroke="url(#starriHalo)" strokeWidth="2" fill="none" opacity="0.6" />
          <circle cx="100" cy="100" r="90" stroke="url(#starriHalo)" strokeWidth="1" fill="none" opacity="0.4" />
          <circle cx="70" cy="35" r="3" fill="url(#starriHaloStar)" />
          <circle cx="130" cy="40" r="2.5" fill="url(#starriHaloStar)" />
          <circle cx="165" cy="100" r="3" fill="url(#starriHaloStar)" />
          <circle cx="130" cy="160" r="2.5" fill="url(#starriHaloStar)" />
          <circle cx="70" cy="165" r="3" fill="url(#starriHaloStar)" />
          <circle cx="35" cy="100" r="2.5" fill="url(#starriHaloStar)" />
          <circle cx="100" cy="10" r="2" fill="url(#starriHaloStar)" />
          <circle cx="100" cy="190" r="2" fill="url(#starriHaloStar)" />
        </g>
      )}
      
      <defs>
        <radialGradient id="starriShadow" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
        <radialGradient id="starriBody" cx="0.3" cy="0.2">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="30%" stopColor="#3730a3" />
          <stop offset="70%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
        <radialGradient id="starriInner" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
        <radialGradient id="starriEye" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </radialGradient>
        <linearGradient id="starriSmile" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <radialGradient id="starriDust1" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="starriDust2" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </radialGradient>
        <radialGradient id="starriDust3" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </radialGradient>
        <linearGradient id="starriConstellation" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <radialGradient id="starriHalo" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#c084fc" />
        </radialGradient>
        <radialGradient id="starriHaloStar" cx="0.5" cy="0.5">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fbbf24" />
        </radialGradient>
      </defs>
    </svg>
  );

  const renderPet = (index: number) => {
    switch (index) {
      case 0: return renderPandi();
      case 1: return renderOwli();
      case 2: return renderCatti();
      case 3: return renderFroggi();
      case 4: return renderCloudi();
      case 5: return renderCrysti();
      case 6: return renderBloomi();
      case 7: return renderStarri();
      case 8: return renderFlammi();
      case 9: return renderDroppi();
      case 10: return renderBreezy();
      case 11: return renderRocky();
      case 12: return renderCacti();
      case 13: return renderMushie();
      case 14: return renderLeafy();
      case 15: return renderRosey();
      default: return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900 dark:text-gray-100">Evolution System</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300 mt-2">
                After 4 full days of consistent care, your Blobbi will evolve into one of many adorable forms! 
                Care for your Blobbi at least 3 times per day to maintain your care streak.
              </CardDescription>
            </div>
            {user && !blobbi && (
              <CreateBlobbiDialog>
                <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                  Create Your First Blobbi
                </Button>
              </CreateBlobbiDialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Original Blobbi</h3>
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl p-8 border border-blue-200 dark:border-blue-600">
                <div className="w-48 h-48 mx-auto">
                  {renderBlobbi()}
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                Your cute blob companion awaiting evolution
              </p>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAccessory(!showAccessory)}
                  className="border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                >
                  {showAccessory ? 'Remove' : 'Add'} Accessories
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Evolution Preview</h3>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 rounded-2xl p-8 min-h-[256px] flex items-center justify-center border border-gray-200 dark:border-gray-600">
                {selectedForm !== null ? (
                  <div className="w-48 h-48">
                    {renderPet(selectedForm)}
                  </div>
                ) : (
                  <p className="text-gray-600 dark:text-gray-300">Select an evolution form below</p>
                )}
              </div>
              {selectedForm !== null && (
                <div className="text-center space-y-2">
                  <h4 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{petForms[selectedForm].name}</h4>
                  <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    {petForms[selectedForm].personality}
                  </Badge>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{petForms[selectedForm].description}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-6">
        {petForms.map((form, index) => (
          <Card 
            key={form.name}
            className={`cursor-pointer transition-all hover:shadow-lg bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border ${
              selectedForm === index 
                ? 'ring-2 ring-purple-500 border-purple-300 dark:border-purple-500' 
                : 'border-purple-200 dark:border-purple-600 hover:border-purple-300 dark:hover:border-purple-500'
            }`}
            onClick={() => setSelectedForm(index)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-gray-900 dark:text-gray-100">{form.name}</CardTitle>
              <Badge variant="outline" className="w-fit text-xs border-purple-200 dark:border-purple-600 text-purple-600 dark:text-purple-400">
                {form.personality}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="w-32 h-32 mx-auto mb-3">
                {renderPet(index)}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 text-center">
                {form.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-yellow-200 dark:border-yellow-600">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span className="text-yellow-500">✨</span>
            Design Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <span className="text-purple-500">✨</span>
            <div>
              <strong className="text-gray-900 dark:text-gray-100">Soft, minimal aesthetic</strong>
              <span className="text-gray-600 dark:text-gray-300"> with flat colors and gentle gradients</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-pink-500">🎨</span>
            <div>
              <strong className="text-gray-900 dark:text-gray-100">Simple geometric shapes</strong>
              <span className="text-gray-600 dark:text-gray-300"> for easy animation and recognition</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-yellow-500">😊</span>
            <div>
              <strong className="text-gray-900 dark:text-gray-100">Expressive personalities</strong>
              <span className="text-gray-600 dark:text-gray-300"> through facial features and body language</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-500">🎩</span>
            <div>
              <strong className="text-gray-900 dark:text-gray-100">Accessory support</strong>
              <span className="text-gray-600 dark:text-gray-300"> for customization (hats, glasses, collars, etc.)</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-green-500">🎲</span>
            <div>
              <strong className="text-gray-900 dark:text-gray-100">Evolution after 4 days</strong>
              <span className="text-gray-600 dark:text-gray-300"> of consistent care - each Blobbi's form is determined by your care patterns!</span>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-red-500">📅</span>
            <div>
              <strong className="text-gray-900 dark:text-gray-100">Daily care requirement</strong>
              <span className="text-gray-600 dark:text-gray-300"> - perform at least 3 care actions per day to maintain your streak</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BlobbiEvolution;