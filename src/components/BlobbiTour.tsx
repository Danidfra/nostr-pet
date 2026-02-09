import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SpotlightOverlay } from './SpotlightOverlay';
import { CutoutOverlay } from './CutoutOverlay';
import { ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserBlobbis } from '@/hooks/useUserBlobbis';
import { useIsMobile } from '@/hooks/useIsMobile';
import { TourStep, TourContext } from '@/types/tour';
import { waitForVisible, sleep, applyAutoScroll } from '@/lib/tour-utils';

// Import step images explicitly for proper Vite asset handling
const mobileStep1Img = '/assets/overboard/blobbi-overboard-mobile-step-1.png';
const step1Img = '/assets/overboard/blobbi-overboard-step-1.png';
const step2Img = '/assets/overboard/blobbi-overboard-step-2.png';
const step3Img = '/assets/overboard/blobbi-overboard-step-3.png';
const step4Img = '/assets/overboard/blobbi-overboard-step-4.png';
const step5Img = '/assets/overboard/blobbi-overboard-step-5.png';
const step6Img = '/assets/overboard/blobbi-overboard-step-6.png';
const step7Img = '/assets/overboard/blobbi-overboard-step-7.png';
const step8Img = '/assets/overboard/blobbi-overboard-step-8.png';
const step9Img = '/assets/overboard/blobbi-overboard-step-9.png';

// Types are now imported from '@/types/tour'

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
  const navigate = useNavigate();
  const { data: userBlobbis = [] } = useUserBlobbis();
  const isMobile = useIsMobile();

  // Extract first Blobbi ID for stable memoization (only needed for last step's navigation)
  const firstBlobbiId = userBlobbis[0]?.id;

  // Use either controlled or uncontrolled step state
  const currentStep = propCurrentStep !== undefined ? propCurrentStep : internalCurrentStep;

  // Ref to handle skipAutoScroll from onBeforeAdvance
  const skipAutoScrollRef = useRef(false);

  // Memoize TourContext to prevent unnecessary re-renders
  const tourContext: TourContext = useMemo(() => ({
    setActiveTab: setActiveTabFromProps,
    waitForVisible,
    sleep,
    navigateTo: async (path: string) => {
      navigate(path);
      // Wait a bit for navigation to complete
      await sleep(100);
    }
  }), [setActiveTabFromProps, navigate]);

  // Memoize tourSteps to prevent unnecessary re-renders
  // Only depends on customSteps and userBlobbis (needed for last step's navigation)
  const tourSteps: TourStep[] = useMemo(() => customSteps || [
    // Step 0 — Dashboard Blobbi Visual (NEW - using cutout overlay)
    {
      selector: '#dashboard-blobbi-visual',
      title: 'Meet Your Blobbi!',
      description: 'This is your Blobbi companion. Take care of it by feeding, playing, and completing tasks together!',
      cutout: {
        shape: 'rounded',
        padding: 16,
        radius: 24,
        hand: {
          enabled: true,
          side: 'left',
          offsetX: 0,
          offsetY: 0,
          scale: 1,
        },
        controlsPosition: 'top-center',
      },
    },

    // Step 1 — My Blobbies
    {
      selector: '#tab-my-blobbies',
      title: 'My Blobbies',
      description: 'View and manage all your Blobbi pets in one place',
      cutout: {
        shape: 'rounded',
        padding: 16,
        radius: 24,
        hand: {
          enabled: true,
          side: 'right',
          offsetX: -20,
          offsetY: 10,
          scale: 1,
        },
        controlsPosition: 'top-center',
      },
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
      },
      mobile: {
        imagePosition: 'right',
        imageOffsetX: 100,
        imageOffsetY: 100,
        imageHeight: 220,
        imageMobile: step2Img // Same image for now, but could be different
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
      imageOffsetY: -80,
      imageHeight: 500,
      async onBeforeAdvance(dir, { setActiveTab, waitForVisible }) {
        if (dir === 'next') {
          // Open tab content before going to step 4
          setActiveTab?.('incubation');
          await waitForVisible('#tab-growth-hub-incubating-eggs', { timeout: 2000 });
        } else if (dir === 'prev') {
          // Going back to Missions
          setActiveTab?.('missions');
          await waitForVisible('#tab-missions', { timeout: 2000 });
        }
      },
        mobile: {
        imagePosition: 'left',
        imageOffsetX: 60,
        imageOffsetY: 140,
        imageHeight: 280,
        imageMobile: step3Img // Same image for now, but could be different
      }
    },

    // Step 4 — Growth Hub (tab trigger)
    {
      selector: '#tab-growth-hub-incubating-eggs',
      title: 'Incubating Eggs',
      description: 'Incubating eggs lets you track all the steps needed for hatching and monitor their overall progress.',
      image: step4Img,
      imagePosition: 'right',
      imageOffsetX: 0,
      imageOffsetY: 80,
      imageHeight: 240,
      mobile: {
        imagePosition: 'left',
        imageOffsetX: 60,
        imageOffsetY: 200,
        imageHeight: 280,
        imageMobile: step3Img // Same image for now, but could be different
      },
      async onBeforeAdvance(dir, { setActiveTab, waitForVisible }) {
        if (dir === 'prev') {
          // Keep the Growth Hub tab active, just move spotlight back to the trigger
          setActiveTab?.('incubation');
          await waitForVisible('#tab-growth-hub', { timeout: 2000 });
        }
      }
    },

    // Step 5 — Growth Hub (egg selection)
    {
      selector: '#tab-growth-hub-egg-selection',
      title: 'Select Your Egg',
      description: 'Pick an egg, and let\'s get it ready to hatch!',
      image: step5Img,
      imagePosition: 'right',
      imageOffsetX: 0,
      imageOffsetY: 80,
      imageHeight: 240,
      async onBeforeAdvance(dir, { setActiveTab, waitForVisible }) {
        if (dir === 'prev') {
          // Keep the Growth Hub tab active, just move spotlight back to the trigger
          setActiveTab?.('incubation');
          await waitForVisible('#tab-growth-hub', { timeout: 2000 });
        }
      }
    },

    // Step 6 — Growth Hub (start incubation)
    {
      selector: '#tab-growth-hub-start-incubation',
      title: 'Start Incubation',
      description: 'Begin the journey of your Blobbi\'s egg by starting the incubation process.',
      image: step6Img,
      imagePosition: 'left',
      imageOffsetX: 0,
      imageOffsetY: 80,
      imageHeight: 380,
      async onBeforeAdvance(dir, { setActiveTab, waitForVisible }) {
        if (dir === 'prev') {
          // Keep the Growth Hub tab active, just move spotlight back to the trigger
          setActiveTab?.('incubation');
          await waitForVisible('#tab-growth-hub', { timeout: 2000 });
        }
      }
    },

    // Step 7 — Growth Hub (tasks)
    {
      selector: '#tab-growth-hub-tasks-0',
      title: 'Tasks',
      description: 'Complete these missions to help your Blobbi hatch and grow.',
      image: step7Img,
      imagePosition: 'right',
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageHeight: 340,
      async onBeforeAdvance(dir, { setActiveTab, waitForVisible }) {
         if (dir === 'next') {
          setActiveTab?.('blobbis');
          await waitForVisible('#daily-missions-card', { timeout: 2000 });
        } else if (dir === 'prev') {
          // Keep the Growth Hub tab active, just move spotlight back to the trigger
          setActiveTab?.('incubation');
          await waitForVisible('#tab-growth-hub', { timeout: 2000 });
        }
      }
    },

    // Step 8 — Growth Hub (tasks)
    {
      selector: '#daily-missions-card',
      title: 'Daily Missions',
      description: 'Complete daily missions to earn coins and keep your Blobbi happy. Come back every day for missions and rewards!',
      image: step8Img,
      imagePosition: 'right',
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageHeight: 340,
      async onBeforeAdvance(dir, { setActiveTab, waitForVisible }) {
        if (dir === 'prev') {
          // Keep the Growth Hub tab active, just move spotlight back to the trigger
          setActiveTab?.('incubation');
          await waitForVisible('#tab-growth-hub', { timeout: 2000 });
        }
      }
    },

    // Step 9 — My Blobbies
    {
      selector: '#tab-my-blobbies-card',
      title: 'Next up: Blobbi details',
      description: 'We\'ll open your Blobbi page to continue the tour.',
      image: step9Img,
      imagePosition: 'right',
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageHeight: 340,
      nextLabel: 'Next part',
      async onBeforeAdvance(dir, { navigateTo }) {
        if (dir === 'next' && firstBlobbiId) {
          // Store handoff token
          sessionStorage.setItem('tour.resume', JSON.stringify({
            next: 'details',
            startIndex: 0,
            blobbiId: firstBlobbiId
          }));

          await navigateTo(`/blobbi/${firstBlobbiId}`);
          // Do NOT advance step here; details tour will take over
        }
      }
    },
  ], [customSteps, firstBlobbiId]);

  // Reset to first step when tour opens (only for internal state)
  useEffect(() => {
    if (isOpen && propCurrentStep === undefined) {
      setInternalCurrentStep(0);
    }
  }, [isOpen, propCurrentStep]);

  // Execute onEnter hook when step changes and scroll to target
  // Single source of truth for step lifecycle
  useEffect(() => {
    if (isOpen && !isTransitioning) {
      const currentStepData = tourSteps[currentStep];

      const handleStepChange = async () => {
        try {
          // Wait for the target element to be visible
          await waitForVisible(currentStepData.selector, { timeout: 2000 });

          // Execute onEnter hook if it exists
          if (currentStepData.onEnter) {
            await currentStepData.onEnter(tourContext);
          }

          // Check if auto-scroll should be skipped (from onBeforeAdvance)
          if (skipAutoScrollRef.current) {
            skipAutoScrollRef.current = false; // Reset flag
            return;
          }

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
    }
  }, [currentStep, isOpen, isTransitioning, tourSteps, tourContext, isMobile]);

  // Handle orientation changes - re-apply scroll when orientation changes
  useEffect(() => {
    if (!isOpen || isTransitioning) return;

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
  }, [currentStep, isOpen, isTransitioning, tourSteps, isMobile]);

  const handleNext = async () => {
    if (isTransitioning) return;

    // Check if we're at the last step
    if (currentStep >= tourSteps.length - 1) {
      handleClose();
      return;
    }

    setIsTransitioning(true);

    try {
      const currentStepData = tourSteps[currentStep];

      // Execute onBeforeAdvance hook if it exists
      if (currentStepData.onBeforeAdvance) {
        const result = await currentStepData.onBeforeAdvance('next', tourContext);
        if (result && typeof result === 'object' && result.skipAutoScroll) {
          skipAutoScrollRef.current = true;
        }
      }

      // Execute onLeave hook if it exists
      if (currentStepData.onLeave) {
        await currentStepData.onLeave(tourContext);
      }

      // Trigger step change (controlled or uncontrolled)
      // The step-change effect will handle onEnter and applyAutoScroll
      if (onNext) {
        onNext();
      } else {
        setInternalCurrentStep(prev => prev + 1);
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

    // Check if we're at the first step
    if (currentStep <= 0) return;

    setIsTransitioning(true);

    try {
      const currentStepData = tourSteps[currentStep];

      // Execute onBeforeAdvance hook if it exists
      if (currentStepData.onBeforeAdvance) {
        const result = await currentStepData.onBeforeAdvance('prev', tourContext);
        if (result && typeof result === 'object' && result.skipAutoScroll) {
          skipAutoScrollRef.current = true;
        }
      }

      // Execute onLeave hook if it exists
      if (currentStepData.onLeave) {
        await currentStepData.onLeave(tourContext);
      }

      // Trigger step change (controlled or uncontrolled)
      // The step-change effect will handle onEnter and applyAutoScroll
      if (onPrevious) {
        onPrevious();
      } else {
        setInternalCurrentStep(prev => prev - 1);
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

  // Merge mobile overrides if on mobile device
  const getImageProps = () => {
    // Create effective step configuration: { ...step, ...(isMobile ? step.mobile : {}) }
    const baseStep = {
      imageUrl: currentTourStep.image,
      imageOffsetX: currentTourStep.imageOffsetX,
      imageOffsetY: currentTourStep.imageOffsetY,
      imagePosition: currentTourStep.imagePosition,
      imageWidth: currentTourStep.imageWidth,
      imageHeight: currentTourStep.imageHeight,
    };

    if (isMobile && currentTourStep.mobile) {
      const mobileOverrides = {
        imageUrl: currentTourStep.mobile.imageMobile ?? currentTourStep.image,
        imageOffsetX: currentTourStep.mobile.imageOffsetX,
        imageOffsetY: currentTourStep.mobile.imageOffsetY,
        imagePosition: currentTourStep.mobile.imagePosition,
        imageWidth: currentTourStep.mobile.imageWidth,
        imageHeight: currentTourStep.mobile.imageHeight,
      };

      // Merge: mobile overrides take precedence
      const effectiveStep = { ...baseStep, ...mobileOverrides };

      // Ensure offsets are numbers (fallback to 0)
      effectiveStep.imageOffsetX = effectiveStep.imageOffsetX ?? 0;
      effectiveStep.imageOffsetY = effectiveStep.imageOffsetY ?? 0;

      return effectiveStep;
    }

    // Desktop: ensure offsets are numbers (fallback to 0)
    const effectiveStep = { ...baseStep };
    effectiveStep.imageOffsetX = effectiveStep.imageOffsetX ?? 0;
    effectiveStep.imageOffsetY = effectiveStep.imageOffsetY ?? 0;

    return effectiveStep;
  };

  const imageProps = getImageProps();

  // Determine which overlay to use: CutoutOverlay if step has cutout config, otherwise SpotlightOverlay
  const effectiveCutout = isMobile && currentTourStep.mobile?.cutout 
    ? currentTourStep.mobile.cutout 
    : currentTourStep.cutout;

  const useCutoutOverlay = !!effectiveCutout;

  // Tour content card (shared between both overlay types)
  const tourCard = (
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

        {/* Description - hidden on mobile, visible on desktop */}
        {currentTourStep.description && (
          <CardContent className="pt-0 hidden md:block">
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
                'Next part'
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
  );

  // Render with appropriate overlay type
  if (useCutoutOverlay && effectiveCutout) {
    return (
      <CutoutOverlay
        targetSelector={currentTourStep.selector}
        padding={effectiveCutout.padding}
        radius={effectiveCutout.radius}
        shape={effectiveCutout.shape}
        holeWidth={effectiveCutout.holeWidth}
        holeHeight={effectiveCutout.holeHeight}
        holeOffsetX={effectiveCutout.holeOffsetX}
        holeOffsetY={effectiveCutout.holeOffsetY}
        overlayOpacity={effectiveCutout.overlayOpacity}
        hand={effectiveCutout.hand}
        controlsPosition={effectiveCutout.controlsPosition}
        controlsInset={effectiveCutout.controlsInset}
        controlsOffsetX={effectiveCutout.controlsOffsetX}
        controlsOffsetY={effectiveCutout.controlsOffsetY}
        onClose={handleClose}
      >
        {tourCard}
      </CutoutOverlay>
    );
  }

  // Default: use SpotlightOverlay
  return (
    <SpotlightOverlay
      targetSelector={currentTourStep.selector}
      padding={12}
      radius={12}
      onClose={handleClose}
      {...imageProps}
    >
      {tourCard}
    </SpotlightOverlay>
  );
}