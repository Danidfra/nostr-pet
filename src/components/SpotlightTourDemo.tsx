import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SpotlightOverlay } from './SpotlightOverlay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SpotlightTourDemo() {
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const tourSteps = [
    {
      selector: '#demo-tab-1',
      title: 'First Tab',
      description: 'This is the first tab in our demo'
    },
    {
      selector: '#demo-button',
      title: 'Action Button',
      description: 'Click this button to perform an action'
    },
    {
      selector: '#demo-card',
      title: 'Info Card',
      description: 'This card contains important information'
    }
  ];

  const startTour = () => {
    setIsTourActive(true);
    setCurrentStep(0);
  };

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsTourActive(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setIsTourActive(false);
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Spotlight Tour Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            This demo shows how the SpotlightOverlay component works. Click the button below to start the tour.
          </p>
          <Button onClick={startTour}>
            Start Demo Tour
          </Button>
        </CardContent>
      </Card>

      {/* Demo Elements */}
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 border-b">
          <button
            id="demo-tab-1"
            className="px-4 py-2 border-b-2 border-purple-500 text-purple-600"
          >
            First Tab
          </button>
          <button
            id="demo-tab-2"
            className="px-4 py-2 text-muted-foreground"
          >
            Second Tab
          </button>
        </div>

        {/* Action Button */}
        <Button id="demo-button" variant="outline">
          Demo Action
        </Button>

        {/* Info Card */}
        <Card id="demo-card">
          <CardHeader>
            <CardTitle>Information Card</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This is a demo card that will be highlighted during the tour.</p>
          </CardContent>
        </Card>
      </div>

      {/* Tour Overlay */}
      {isTourActive && (
        <SpotlightOverlay
          targetSelector={tourSteps[currentStep].selector}
          padding={16}
          radius={8}
          onClose={handleClose}
        >
          <div className="flex gap-3">
            <Button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              variant="outline"
            >
              Previous
            </Button>
            <Button onClick={handleNext}>
              {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </div>
        </SpotlightOverlay>
      )}

      {/* Tour Progress */}
      {isTourActive && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg z-[92]">
          <p className="text-sm font-medium">
            Step {currentStep + 1} of {tourSteps.length}: {tourSteps[currentStep].title}
          </p>
        </div>
      )}
    </div>
  );
}