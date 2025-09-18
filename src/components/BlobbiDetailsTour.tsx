import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SpotlightOverlay } from './SpotlightOverlay';
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/useIsMobile';

import step1Img from '@/assets/blobbi-overboard-details-step-1.png';
import step2Img from '@/assets/blobbi-overboard-details-step-2.png';
import step3Img from '@/assets/blobbi-overboard-details-step-3.png';
import step4Img from '@/assets/blobbi-overboard-details-step-4.png';

import { TourStep, TourContext, Direction, OnBeforeAdvanceResult } from '@/types/tour';
import { waitForVisible, sleep, scrollTourTarget, applyAutoScroll } from '@/lib/tour-utils';

interface BlobbiDetailsTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  currentStep?: number;
  onNext?: () => void;
  onPrevious?: () => void;
  blobbiId: string;
}

export function BlobbiDetailsTour({
  isOpen,
  onClose,
  onComplete,
  currentStep: propCurrentStep,
  onNext,
  onPrevious,
  blobbiId
}: BlobbiDetailsTourProps) {
  const [internalCurrentStep, setInternalCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Use either controlled or uncontrolled step state
  const currentStep = propCurrentStep !== undefined ? propCurrentStep : internalCurrentStep;

  // Create TourContext
  const tourContext: TourContext = {
    waitForVisible,
    sleep,
    navigateTo: async (path: string) => {
      navigate(path);
      // Wait a bit for navigation to complete
      await sleep(100);
    }
  };

  // Details tour steps
  const tourSteps: TourStep[] = [
    // Step 1 — Blobbi Visual
    {
      selector: '#blobbi-details-visual',
      title: 'Your Blobbi',
      description: 'See your Blobbi here! Its look will evolve as you take care of it.',
      image: step1Img,
      imagePosition: 'right',
      imageOffsetY: 50,
      // Scroll to start on mobile (default), center on desktop (default)
      // No custom scroll properties needed - uses defaults
    },

    // Step 2 — Stats
    {
      selector: '#blobbi-details-stats',
      title: 'Blobbi Stats',
      description: 'Monitor your Blobbi\'s health, happiness, and other vital stats here.',
      image: step2Img,
      imagePosition: 'right',
      imageOffsetX: 0,
      imageOffsetY: 0,
      // Custom scroll configuration
      scrollAlign: 'start', // Both mobile and desktop scroll to top
      scrollOffset: 20, // Extra 20px offset for better visibility
      mobile: {
        scrollOffset: 10 // Mobile gets smaller offset
      }
    },

    // Step 3 — Actions Tab
    {
      selector: '#blobbi-details-actions-0',
      title: 'Care Actions',
      description: 'Use these actions to feed, play with, and care for your Blobbi.',
      image: step3Img,
      imagePosition: 'right',
      imageOffsetY: 0,
      imageHeight: 400,
      // Different alignment for mobile vs desktop
      scrollAlign: 'center', // Desktop centers the actions
      mobile: {
        scrollAlign: 'start', // Mobile scrolls to top for better visibility
        scrollOffset: 15 // Small offset to account for mobile UI
      }
    },

    // Step 4 — Quick Actions
    {
      selector: '[data-testid="quick-actions"]',
      title: 'Quick Actions',
      description: 'Access shop, storage, and other Blobbi management features here.',
      image: step4Img,
      imagePosition: 'above',
      imageOffsetX: 300,
      imageOffsetY: 0,
      nextLabel: 'Finish Tour',
      // Use nearest alignment for optimal positioning
      scrollAlign: 'nearest',
      scrollOffset: 30, // Compensate for any fixed headers
      mobile: {
        scrollOffset: 20, // Mobile offset
        scrollAlign: 'start' // Force start on mobile for consistency
      },
      async onBeforeAdvance(dir, { navigateTo }) {
        if (dir === 'next') {
          // Set return token and navigate back to dashboard
          sessionStorage.setItem('tour.resume', JSON.stringify({
            next: 'dashboard-complete'
          }));
          // await navigateTo('/blobbi');
        }
      }
    },
  ];

  // Reset to first step when tour opens (only for internal state)
  useEffect(() => {
    if (isOpen && propCurrentStep === undefined) {
      setInternalCurrentStep(0);
    }
  }, [isOpen, propCurrentStep]);

  // Execute onEnter hook when step changes and scroll to target
  useEffect(() => {
    if (isOpen && !isTransitioning) {
      const currentStepData = tourSteps[currentStep];

      const handleStepChange = async () => {
        try {
          // Wait for the target element to be visible
          await waitForVisible(currentStepData.selector, { timeout: 2000 });

          // Apply auto-scroll using unified system
          await applyAutoScroll(currentStepData.selector, currentStepData, isMobile);
        } catch (error) {
          console.error('Error during step change:', error);
          // Fallback to basic scrolling
          const targetElement = document.querySelector(currentStepData.selector) as HTMLElement;
          if (targetElement) {
            targetElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'center'
            });
          }
        }
      };

      // Execute step change handling
      handleStepChange().catch(console.error);

      // Execute onEnter hook if it exists
      if (currentStepData.onEnter) {
        const result = currentStepData.onEnter(tourContext);
        if (result && typeof result.catch === 'function') {
          result.catch(error => {
            console.error('Error executing onEnter hook:', error);
          });
        }
      }
    }
  }, [currentStep, isOpen, isTransitioning]);

  // Handle orientation changes - re-apply scroll when orientation changes
  useEffect(() => {
    if (isOpen && !isTransitioning) {
      const currentStepData = tourSteps[currentStep];

      const handleOrientationChange = async () => {
        // Wait a bit for the orientation change to complete and layout to settle
        await sleep(300);

        // Re-apply scroll with current step configuration
        try {
          await applyAutoScroll(currentStepData.selector, currentStepData, isMobile);
        } catch (error) {
          console.error('Error re-scrolling after orientation change:', error);
        }
      };

      window.addEventListener('orientationchange', handleOrientationChange);

      return () => {
        window.removeEventListener('orientationchange', handleOrientationChange);
      };
    }
  }, [currentStep, isOpen, isTransitioning]);

  const handleNext = async () => {
    if (isTransitioning) return;

    setIsTransitioning(true);

    try {
      const currentStepData = tourSteps[currentStep];

      // Execute onBeforeAdvance hook if it exists
      let skipAutoScroll = false;
      if (currentStepData.onBeforeAdvance) {
        const result = await currentStepData.onBeforeAdvance('next', tourContext);
        if (result && typeof result === 'object' && result.skipAutoScroll) {
          skipAutoScroll = true;
        }
      }

      // Execute onLeave hook if it exists
      if (currentStepData.onLeave) {
        await currentStepData.onLeave(tourContext);
      }

      if (onNext) {
        onNext();
      } else if (currentStep < tourSteps.length - 1) {
        setInternalCurrentStep(currentStep + 1);
      } else {
        handleClose();
        return;
      }

      // Execute onEnter hook for the next step if it exists
      const nextStepData = tourSteps[currentStep + 1];
      if (nextStepData && nextStepData.onEnter) {
        await nextStepData.onEnter(tourContext);
      }

      // Apply auto-scroll for the new step unless explicitly skipped
      if (!skipAutoScroll && currentStep < tourSteps.length - 1) {
        const nextStep = tourSteps[currentStep + 1];
        try {
          await waitForVisible(nextStep.selector, { timeout: 2000 });
          await applyAutoScroll(nextStep.selector, nextStep, isMobile);
        } catch (error) {
          console.error('Error applying auto-scroll after transition:', error);
        }
      }
    } catch (error) {
      console.error('Error during tour step transition:', error);
      // Stay on current step if there's an error
    } finally {
      setIsTransitioning(false);
    }
  };

  const handlePrevious = async () => {
    if (isTransitioning) return;

    setIsTransitioning(true);

    try {
      const currentStepData = tourSteps[currentStep];

      // Execute onBeforeAdvance hook if it exists
      let skipAutoScroll = false;
      if (currentStepData.onBeforeAdvance) {
        const result = await currentStepData.onBeforeAdvance('prev', tourContext);
        if (result && typeof result === 'object' && result.skipAutoScroll) {
          skipAutoScroll = true;
        }
      }

      // Execute onLeave hook if it exists
      if (currentStepData.onLeave) {
        await currentStepData.onLeave(tourContext);
      }

      if (onPrevious) {
        onPrevious();
      } else if (currentStep > 0) {
        setInternalCurrentStep(currentStep - 1);
      }

      // Execute onEnter hook for the previous step if it exists
      const prevStepData = tourSteps[currentStep - 1];
      if (prevStepData && prevStepData.onEnter) {
        await prevStepData.onEnter(tourContext);
      }

      // Apply auto-scroll for the new step unless explicitly skipped
      if (!skipAutoScroll && currentStep > 0) {
        const prevStep = tourSteps[currentStep - 1];
        try {
          await waitForVisible(prevStep.selector, { timeout: 2000 });
          await applyAutoScroll(prevStep.selector, prevStep, isMobile);
        } catch (error) {
          console.error('Error applying auto-scroll after transition:', error);
        }
      }
    } catch (error) {
      console.error('Error during tour step transition:', error);
      // Stay on current step if there's an error
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleClose = () => {
    onClose();
    onComplete?.();
  };

  const currentTourStep = tourSteps[currentStep];

  if (!isOpen || !currentTourStep) {
    return null;
  }

  return (
    <SpotlightOverlay
      targetSelector={currentTourStep.selector}
      padding={12}
      radius={12}
      onClose={handleClose}
      imageUrl={currentTourStep.image}
      imageOffset={currentTourStep.imageOffset}
      imageOffsetX={currentTourStep.imageOffsetX}
      imageOffsetY={currentTourStep.imageOffsetY}
      imagePosition={currentTourStep.imagePosition}
      imageWidth={currentTourStep.imageWidth}
      imageHeight={currentTourStep.imageHeight}
    >
      {/* Tour content card */}
      <Card className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-2 border-purple-200 dark:border-purple-600 shadow-2xl max-w-sm mx-auto pointer-events-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {currentTourStep.title}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-6 w-6 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-purple-600 dark:bg-purple-400'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        </CardHeader>
        {currentTourStep.description && (
          <CardContent className="pt-0">
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {currentTourStep.description}
            </p>
          </CardContent>
        )}
        <CardContent className="pt-3">
          <div className="flex gap-2">
            <Button
              onClick={handlePrevious}
              disabled={currentStep === 0 || isTransitioning}
              variant="outline"
              className="flex-1 border-2 border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30"
            >
              {isTransitioning ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <ChevronLeft className="h-4 w-4 mr-1" />
              )}
              Previous
            </Button>
            <Button
              onClick={handleNext}
              disabled={isTransitioning}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              {isTransitioning ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : currentStep === tourSteps.length - 1 ? (
                currentTourStep.nextLabel || 'Finish'
              ) : (
                <>
                  {currentTourStep.nextLabel || 'Next'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </SpotlightOverlay>
  );
}