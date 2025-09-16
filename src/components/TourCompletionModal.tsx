import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MarqueeTitle } from '@/components/MarqueeTitle';
import { useTourCompletion } from '@/hooks/useTourCompletion';
import { useToast } from '@/hooks/useToast';

interface TourCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExplore?: () => void;
}

export function TourCompletionModal({ isOpen, onClose, onExplore }: TourCompletionModalProps) {
  const { mutate: completeTour, isPending: isTourCompleting } = useTourCompletion();
  const { toast } = useToast();

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
      <DialogContent className="bg-pink-50 dark:bg-neutral-900 border-2 border-purple-200 dark:border-purple-600 rounded-2xl shadow-2xl max-w-md md:max-w-lg w-full mx-4 p-0 overflow-hidden">
        {/* Content */}
        <div className="p-6 md:p-8 text-center space-y-6">
          {/* Marquee Title */}
          <div className="relative">
            <div className="w-full">
              <MarqueeTitle className="w-full" />
            </div>
          </div>

          {/* Body copy */}
          <div className="space-y-3 md:space-y-4 max-w-sm mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
              You're all set!
            </h2>
            <p className="text-base md:text-lg leading-relaxed text-gray-800 dark:text-gray-100/90 text-center font-medium">
              Tour completed. You're ready to explore Blobbi.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              If you ever want to revisit the tour, you can start it again from the dashboard.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-2 border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 px-8 py-3 font-semibold rounded-lg transition-all duration-200 hover:scale-105"
            >
              Close
            </Button>
            <Button
              onClick={handleExplore}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 font-semibold rounded-lg transition-all duration-200 hover:scale-105 shadow-lg"
            >
              Explore
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}