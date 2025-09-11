import { useEffect } from 'react';
import confetti from 'canvas-confetti';

export function useWelcomeConfetti(show: boolean) {
  useEffect(() => {
    if (!show) return;

    // Respect reduced motion preference
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      return;
    }

    const duration = 600; // ~0.6s burst
    const end = Date.now() + duration;
    const defaults = {
      startVelocity: 55,
      spread: 70,
      ticks: 200,
      scalar: 0.9,
      colors: ['#DC2626', '#FFC700', '#8B5CF6', '#EC4899', '#10B981', '#3B82F6'],
    };

    // Two symmetric bursts from top corners
    function frame() {
      confetti({
        ...defaults,
        particleCount: 60,
        origin: { x: 0.2, y: 0.2 },
      });
      
      confetti({
        ...defaults,
        particleCount: 60,
        origin: { x: 0.8, y: 0.2 },
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }

    frame();

    // Cleanup function
    return () => {
      // Cancel any remaining frames if component unmounts
      confetti.reset();
    };
  }, [show]);
}