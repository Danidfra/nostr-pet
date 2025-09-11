import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SpotlightOverlay } from './SpotlightOverlay';
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';

// Import step images explicitly for proper Vite asset handling
import step1Img from '@/assets/blobbi-overboard-step-1.png';
import step2Img from '@/assets/blobbi-overboard-step-2.png';
import step3Img from '@/assets/blobbi-overboard-step-3.png';

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
  setActiveTab?: (v: string) => void; // from BlobbiDashboard Tabs
  waitForVisible: (selector: string, opts?: { timeout?: number }) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
}

interface TourStep {
  selector: string;
  title: string;
  description?: string;
  image?: string; // Can be a string path or imported asset
  imageOffset?: number; // Legacy offset (maintained for backward compatibility)
  imageOffsetX?: number; // Horizontal offset relative to spotlight center
  imageOffsetY?: number; // Vertical offset relative to default placement
  imagePosition?: "below" | "above" | "left" | "right"; // Position relative to spotlight
  imageWidth?: number | string; // Custom width (e.g., 400, "400px", "80%")
  imageHeight?: number | string; // Custom height (e.g., 300, "300px", "80%")
  onEnter?(ctx: TourContext): void | Promise<void>;
  onBeforeAdvance?(dir: Direction, ctx: TourContext): void | Promise<void>;
  onLeave?(ctx: TourContext): void | Promise<void>;
}

interface BlobbiTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  customSteps?: TourStep[];
  currentStep?: number;
  onNext?: () => void;
  onPrevious?: () => void;
  setActiveTab?: (v: string) => void;
}

export function BlobbiTour({
  isOpen,
  onClose,
  onComplete,
  customSteps,
  currentStep: propCurrentStep,
  onNext,
  onPrevious,
  setActiveTab: setActiveTabFromProps
}: BlobbiTourProps) {
  const [internalCurrentStep, setInternalCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Use either controlled or uncontrolled step state
  const currentStep = propCurrentStep !== undefined ? propCurrentStep : internalCurrentStep;

  // Create TourContext
  const tourContext: TourContext = {
    setActiveTab: setActiveTabFromProps,
    waitForVisible,
    sleep
  };

  // Use custom steps if provided, otherwise use default steps
  const tourSteps = customSteps || [
    // Step 1 — My Blobbies
    {
      selector: '#tab-my-blobbies',
      title: 'My Blobbies',
      description: 'View and manage all your Blobbi pets in one place',
      image: step1Img,
      imagePosition: 'below',
      imageOffsetY: -100,
      imageOffsetX: -180,
      async onBeforeAdvance(dir, { setActiveTab, waitForVisible }) {
        if (dir === 'next') {
          setActiveTab?.('missions');
          await waitForVisible('#tab-missions', { timeout: 2000 });
        }
        // No 'prev' from the first step
      }
    },

    // Step 2 — Missions
    {
      selector: '#tab-missions',
      title: 'Missions',
      description: 'Complete missions to earn rewards and help your Blobbis grow',
      image: step2Img,
      imagePosition: 'below',
      imageOffsetX: -60,
      imageOffsetY: -90,
      async onBeforeAdvance(dir, { setActiveTab, waitForVisible }) {
        if (dir === 'next') {
          setActiveTab?.('incubation');
          await waitForVisible('#tab-growth-hub', { timeout: 2000 });
        } else if (dir === 'prev') {
          setActiveTab?.('blobbis');
          await waitForVisible('#tab-my-blobbies', { timeout: 2000 });
        }
      }
    },

    // Step 3 — Growth Hub (tab trigger)
    {
      selector: '#tab-growth-hub',
      title: 'Growth Hub',
      description: 'The Growth Hub is where your Blobbi hatches, evolves, and tracks its progress through special tasks',
      image: step3Img,
      imagePosition: 'below',
      imageOffsetX: -260,
      imageOffsetY: 0,
      imageHeight: 400,
      async onBeforeAdvance(dir, { setActiveTab, waitForVisible }) {
        if (dir === 'next') {
          // Open tab content before going to step 4
          setActiveTab?.('incubation');
          await waitForVisible('#tab-growth-hub-open', { timeout: 2000 });
        } else if (dir === 'prev') {
          // Going back to Missions
          setActiveTab?.('missions');
          await waitForVisible('#tab-missions', { timeout: 2000 });
        }
      }
    },

    // Step 4 — Growth Hub (open/content)
    {
      selector: '#tab-growth-hub-open',
      title: 'Growth Hub',
      description: 'The Growth Hub is where your Blobbi hatches, evolves, and tracks its progress through special tasks',
      imagePosition: 'below',
      imageOffsetX: -260,
      imageOffsetY: 0,
      imageHeight: 400,
      async onBeforeAdvance(dir, { setActiveTab, waitForVisible }) {
        if (dir === 'prev') {
          // Keep the Growth Hub tab active, just move spotlight back to the trigger
          setActiveTab?.('incubation');
          await waitForVisible('#tab-growth-hub', { timeout: 2000 });
        }
        // No special 'next' from the last step (unless you add more)
      }
    }
  ];

  // Reset to first step when tour opens (only for internal state)
  useEffect(() => {
    if (isOpen && propCurrentStep === undefined) {
      setInternalCurrentStep(0);
    }
  }, [isOpen, propCurrentStep]);

  // Execute onEnter hook when step changes
  useEffect(() => {
    if (isOpen && !isTransitioning) {
      const currentStepData = tourSteps[currentStep];
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
                'Finish'
              ) : (
                <>
                  Next
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