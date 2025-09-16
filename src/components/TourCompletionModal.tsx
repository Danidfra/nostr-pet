import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MarqueeTitle } from '@/components/MarqueeTitle';
import { useTourCompletion } from '@/hooks/useTourCompletion';
import { useToast } from '@/hooks/useToast';
import { useIsMobile } from '@/hooks/useIsMobile';

interface TourCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExplore?: () => void;
}

export function TourCompletionModal({ isOpen, onClose, onExplore }: TourCompletionModalProps) {
  const { mutate: completeTour, isPending: isTourCompleting } = useTourCompletion();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Trigger tour completion update when modal opens
  useEffect(() => {
    if (isOpen) {
      // Immediately update kind 31125 with onboarding_done=true when modal opens
      completeTour(undefined, {
        onSuccess: () => {
          toast({
            title: "Profile Updated! ✅",
            description: "Your onboarding status has been saved.",
            duration: 3000,
          });
        },
        onError: (error) => {
          toast({
            title: "Update Failed",
            description: "Could not update your profile. Please try again.",
            variant: "destructive",
            duration: 3000,
          });
        },
      });
    }
  }, [isOpen, completeTour, toast]);

  const handleExplore = () => {
    onExplore?.();
    onClose();
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
          <div className="relative">
            <div className="w-full">
              <MarqueeTitle className="w-full" />
            </div>
          </div>

          {/* Body copy */}
          <div className="space-y-2 md:space-y-3 max-w-sm mx-auto">
            <h2 className={`
              font-bold text-gray-900 dark:text-gray-100
              ${isMobile ? 'text-xl md:text-2xl' : 'text-2xl md:text-3xl'}
            `}>
              You're all set!
            </h2>
            <p className={`
              leading-relaxed text-gray-800 dark:text-gray-100/90 text-center font-medium
              ${isMobile ? 'text-sm' : 'text-base md:text-lg'}
            `}>
              Tour completed. You're ready to explore Blobbi.
            </p>
            <p className={`
              text-gray-600 dark:text-gray-400 text-center
              ${isMobile ? 'text-xs' : 'text-sm'}
            `}>
              If you ever want to revisit the tour, you can start it again from the dashboard.
            </p>
          </div>

          {/* Action buttons */}
          <div className={`
            flex gap-2 md:gap-3 justify-center pt-2 md:pt-4
            ${isMobile ? 'flex-col' : 'flex-col sm:flex-row'}
          `}>
            <Button
              onClick={onClose}
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
              Close
            </Button>
            <Button
              onClick={handleExplore}
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
              Explore
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}