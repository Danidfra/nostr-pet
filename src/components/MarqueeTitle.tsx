import React from 'react';

interface MarqueeTitleProps {
  className?: string;
}

export function MarqueeTitle({ className }: MarqueeTitleProps) {
  return (
    <div className={`w-full ${className}`}>
      <svg
        viewBox="0 0 400 120"
        className="w-full h-auto"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Define filters for glow effects */}
        <defs>
          {/* Glow filter for bulbs */}
          <filter id="bulbGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Drop shadow for text */}
          <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.35"/>
          </filter>
        </defs>

        {/* Smile-shaped curved path for text */}
        <path
          id="textPath"
          d="M 50 40 Q 200 110 350 40"
          fill="none"
          stroke="none"
        />

        {/* Main arched text */}
        <text
          fill="#DC2626"
          stroke="#FFD700"
          strokeWidth="0.5"
          fontSize="24"
          fontWeight="bold"
          fontFamily="Arial, sans-serif"
          filter="url(#textShadow)"
        >
          <textPath href="#textPath" startOffset="50%" textAnchor="middle" dy="-2">
            to the Blobbi Community!
          </textPath>
        </text>

        {/* Yellow accent bulbs repositioned for smile arc */}
        {/* <circle cx="80" cy="45" r="4" fill="#FFC700" filter="url(#bulbGlow)" />
        <circle cx="120" cy="65" r="4" fill="#FFC700" filter="url(#bulbGlow)" />
        <circle cx="160" cy="85" r="4" fill="#FFC700" filter="url(#bulbGlow)" />
        <circle cx="200" cy="95" r="4" fill="#FFC700" filter="url(#bulbGlow)" />
        <circle cx="240" cy="85" r="4" fill="#FFC700" filter="url(#bulbGlow)" />
        <circle cx="280" cy="65" r="4" fill="#FFC700" filter="url(#bulbGlow)" />
        <circle cx="320" cy="45" r="4" fill="#FFC700" filter="url(#bulbGlow)" /> */}
      </svg>
    </div>
  );
}