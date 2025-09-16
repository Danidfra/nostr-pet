import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SpotlightOverlay } from './SpotlightOverlay';
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import step1Img from '@/assets/blobbi-overboard-details-step-1.png';
import step2Img from '@/assets/blobbi-overboard-details-step-2.png';
import step3Img from '@/assets/blobbi-overboard-details-step-3.png';
import step4Img from '@/assets/blobbi-overboard-details-step-4.png';

// Utility function to wait for an element to become visible
const waitForVisible = (selector: string, opts: { timeout?: number } = {}): Promise<void> => {
  const { timeout = 2000 } = opts;

  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.querySelector(selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          resolve();
          return;
        }
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        reject(new Error(`Element ${selector} not visible within ${timeout}ms`));
        return;
      }

      // Continue checking
      requestAnimationFrame(checkElement);
    };

    // Start checking
    checkElement();
  });
};

// Utility function to sleep
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

type Direction = "next" | "prev";

interface TourContext {
  setActiveTab?: (v: string) => void;
  waitForVisible: (selector: string, opts?: { timeout?: number }) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  navigateTo: (path: string) => Promise<void>;
}

interface TourStep {
  selector: string;
  title: string;
  description?: string;
  nextLabel?: string;
  image?: string;
  imageOffset?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  imagePosition?: "below" | "above" | "left" | "right";
  imageWidth?: number | string;
  imageHeight?: number | string;
  onEnter?(ctx: TourContext): void | Promise<void>;
  onBeforeAdvance?(dir: Direction, ctx: TourContext): void | Promise<void>;
  onLeave?(ctx: TourContext): void | Promise<void>;
}

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

      // Scroll to target element when step changes
      const scrollToTarget = () => {
        const targetElement = document.querySelector(currentStepData.selector);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
          });
        }
      };

      // Execute scroll immediately
      scrollToTarget();

      // Also scroll after a short delay to handle dynamic content/routing
      const scrollTimeout = setTimeout(scrollToTarget, 100);

      // Execute onEnter hook if it exists
      if (currentStepData.onEnter) {
        const result = currentStepData.onEnter(tourContext);
        if (result && typeof result.catch === 'function') {
          result.catch(error => {
            console.error('Error executing onEnter hook:', error);
          });
        }
      }

      return () => clearTimeout(scrollTimeout);
    }
  }, [currentStep, isOpen, isTransitioning]);

  const handleNext = async () => {
    if (isTransitioning) return;

    setIsTransitioning(true);

    try {
      const currentStepData = tourSteps[currentStep];

      // Execute onBeforeAdvance hook if it exists
      if (currentStepData.onBeforeAdvance) {
        await currentStepData.onBeforeAdvance('next', tourContext);
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
      if (currentStepData.onBeforeAdvance) {
        await currentStepData.onBeforeAdvance('prev', tourContext);
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