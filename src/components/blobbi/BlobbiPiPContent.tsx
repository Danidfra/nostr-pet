import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Blobbi } from '@/types/blobbi';
import { BlobbiVisual } from './BlobbiVisual';
import { BlobbiEvolvedVisual } from './BlobbiEvolvedVisual';

interface BlobbiPiPContentProps {
  blobbi: Blobbi;
  pipWindow: Window;
}

/**
 * Component that renders inside the Picture-in-Picture window
 */
export function BlobbiPiPContent({ blobbi, pipWindow }: BlobbiPiPContentProps) {
  const [timeAwaySeconds, setTimeAwaySeconds] = useState(0);
  const [lastInteraction, setLastInteraction] = useState(Date.now());

  // Track time away from game
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAwaySeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Handle clicks on Blobbi
  const handleBlobbiClick = () => {
    setLastInteraction(Date.now());

    // Show a reaction
    const messages = [
      "👋 Miss me?",
      "💜 Come back soon!",
      "🎮 Ready to play?",
      "✨ I'm still here!",
      "🌟 Don't forget about me!",
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];

    // Create floating message
    const messageEl = pipWindow.document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      z-index: 100;
      animation: fadeInOut 2s ease-in-out;
      pointer-events: none;
    `;

    // Add animation
    const style = pipWindow.document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      }
    `;
    pipWindow.document.head.appendChild(style);

    const container = pipWindow.document.getElementById('blobbi-pip-container');
    if (container) {
      container.appendChild(messageEl);
      setTimeout(() => {
        messageEl.remove();
      }, 2000);
    }
  };

  // Determine Blobbi's behavior based on time away
  const getBlobbiBehavior = () => {
    if (timeAwaySeconds < 30) {
      return { mood: 'neutral', message: 'Just chilling...' };
    } else if (timeAwaySeconds < 120) {
      return { mood: 'sleepy', message: 'Getting sleepy...' };
    } else {
      return { mood: 'sad', message: 'Missing you...' };
    }
  };

  const behavior = getBlobbiBehavior();

  // Calculate idle time since last interaction
  const idleSeconds = Math.floor((Date.now() - lastInteraction) / 1000);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '20px',
      }}
    >
      {/* Blobbi Character */}
      <div
        onClick={handleBlobbiClick}
        style={{
          cursor: 'pointer',
          transform: idleSeconds > 10 ? 'scale(0.95)' : 'scale(1)',
          transition: 'transform 0.3s ease',
        }}
      >
        {blobbi.evolutionForm ? (
          <BlobbiEvolvedVisual
            blobbi={blobbi}
            size="medium"
          />
        ) : (
          <BlobbiVisual
            blobbi={blobbi}
            size="medium"
            forceInlineSvg={true}
          />
        )}
      </div>

      {/* Status Text */}
      <div
        style={{
          textAlign: 'center',
          color: 'white',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
          {blobbi.name}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.9 }}>
          {behavior.message}
        </div>
        {timeAwaySeconds > 60 && (
          <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>
            Away for {Math.floor(timeAwaySeconds / 60)}m {timeAwaySeconds % 60}s
          </div>
        )}
      </div>

      {/* Floating particles for ambiance */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.3)',
              left: `${Math.random() * 100}%`,
              animation: `float ${5 + Math.random() * 5}s infinite ease-in-out`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <style>
        {`
          @keyframes float {
            0%, 100% {
              transform: translateY(0) translateX(0);
              opacity: 0;
            }
            10% {
              opacity: 1;
            }
            90% {
              opacity: 1;
            }
            50% {
              transform: translateY(-100vh) translateX(${Math.random() * 40 - 20}px);
            }
          }
        `}
      </style>
    </div>
  );
}


