import { useState } from 'react';
import { Dialog, DialogContent, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBlobbonautProfile } from '@/hooks/useBlobbonautProfile';
import { useSetOnboardingDone } from '@/hooks/useBlobbonautProfile';
import { MarqueeTitle } from '@/components/MarqueeTitle';
import { useWelcomeConfetti } from '@/hooks/useWelcomeConfetti';
import { useIsMobile } from '@/hooks/useIsMobile';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
}

export function WelcomeModal({ isOpen, onClose, onStartTour }: WelcomeModalProps) {
  const { data: profile } = useBlobbonautProfile();
  const { mutate: setOnboardingDone, isPending } = useSetOnboardingDone();
  const isMobile = useIsMobile();

  // Trigger confetti when modal opens
  useWelcomeConfetti(isOpen);

  const handleSkip = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        setOnboardingDone(true, {
          onSuccess: () => resolve(),
          onError: reject,
        });
      });
      onClose();
    } catch (error) {
      console.error('Failed to set onboarding done:', error);
      // Still close modal even if there's an error
      onClose();
    }
  };

  const handleStartTour = () => {
    onClose();
    onStartTour();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`
        bg-pink-50 dark:bg-neutral-900
        border-2 border-purple-200 dark:border-purple-600
        rounded-2xl shadow-2xl
        w-full
        ${isMobile
          ? 'max-w-[90vw] max-h-[85vh]'
          : 'max-w-md md:max-w-lg mx-4 p-0'
        }
        overflow-hidden
      `}>
        {/* Content */}
        <div className={`
          text-center space-y-4
          ${isMobile
            ? 'p-4 overflow-y-auto max-h-[75vh]'
            : 'p-6 md:p-8 space-y-6'
          }
        `}>
          {/* Marquee Title */}

          {/* Welcome image */}
          <div className="relative">
            <img
              src="/assets/overboard/blobbi-welcome.png"
              alt="Blobbi Welcome"
              className={`
                mx-auto object-contain drop-shadow-lg
                ${isMobile
                  ? 'w-32 h-32'
                  : 'w-56 h-56 md:w-64 md:h-64'
                }
              `}
            />
            {/* Subtle glow effect behind image */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-200/5 to-pink-200/5 rounded-full blur-xl -z-10"></div>
            <div className="w-full -mt-2 md:-mt-4">
              <MarqueeTitle className="w-full" />
            </div>
          </div>

          {/* Body copy */}
          <div className="space-y-2 md:space-y-3 max-w-sm mx-auto">
            <p className={`
              leading-relaxed text-gray-800 dark:text-gray-100/90 text-center font-medium
              ${isMobile ? 'text-sm' : 'text-base md:text-lg'}
            `}>
              First time here? Click Start Tour to explore. Already know Blobbi? Just click Skip!
            </p>
          </div>

          {/* Action buttons */}
          <div className={`
            flex gap-2 md:gap-3 justify-center pt-2 md:pt-4
            ${isMobile ? 'flex-col' : 'flex-col sm:flex-row'}
          `}>
            <Button
              onClick={handleSkip}
              disabled={isPending}
              variant="outline"
              className={`
                border-2 border-purple-200 dark:border-purple-600
                text-purple-700 dark:text-purple-300
                hover:bg-purple-50 dark:hover:bg-purple-900/30
                font-semibold rounded-lg transition-all duration-200 hover:scale-105
                ${isMobile
                  ? 'px-6 py-2.5 text-sm'
                  : 'px-8 py-3'
                }
              `}
            >
              {isPending ? 'Saving...' : 'Skip'}
            </Button>
            <Button
              onClick={handleStartTour}
              className={`
                bg-gradient-to-r from-purple-600 to-pink-600
                hover:from-purple-700 hover:to-pink-700
                text-white font-semibold rounded-lg transition-all duration-200
                hover:scale-105 shadow-lg
                ${isMobile
                  ? 'px-6 py-2.5 text-sm'
                  : 'px-8 py-3'
                }
              `}
            >
              Start Tour
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}