# SpotlightOverlay Component

The `SpotlightOverlay` component creates a full-screen transparent black overlay with a spotlight cutout over a target element. It's designed for interactive tours and onboarding experiences.

## Features

- **Spotlight Effect**: Darkens the entire screen except for a spotlight area around the target element
- **Flexible Targeting**: Supports both React refs and CSS selectors
- **Responsive**: Automatically adjusts to window resize, scroll, and DOM changes
- **Cross-browser**: Uses CSS masks with fallback for Safari and older browsers
- **Accessibility**: ESC key closes the overlay, respects reduced motion preferences
- **Portal Rendering**: Renders via portal to avoid z-index conflicts
- **Reusable**: Can be used for multiple tour steps with different targets

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `targetRef` | `React.RefObject<HTMLElement>` | `undefined` | React ref to the target element |
| `targetSelector` | `string` | `undefined` | CSS selector for the target element |
| `padding` | `number` | `12` | Extra space around the spotlight (pixels) |
| `radius` | `number` | `12` | Rounded corners of the spotlight (pixels) |
| `onClose` | `() => void` | Required | Function called when overlay should close |
| `children` | `React.ReactNode` | `undefined` | Content to render above the overlay (e.g., tour controls) |
| `className` | `string` | `undefined` | Additional CSS classes for the overlay |

**Note**: Either `targetRef` or `targetSelector` must be provided.

## Usage

### Basic Usage

```tsx
import { SpotlightOverlay } from '@/components/SpotlightOverlay';

function MyComponent() {
  const [isTourActive, setIsTourActive] = useState(false);

  return (
    <>
      <button onClick={() => setIsTourActive(true)}>
        Start Tour
      </button>

      {isTourActive && (
        <SpotlightOverlay
          targetSelector="#my-target-element"
          onClose={() => setIsTourActive(false)}
        >
          <div className="flex gap-2">
            <Button variant="outline">Previous</Button>
            <Button>Next</Button>
          </div>
        </SpotlightOverlay>
      )}
    </>
  );
}
```

### With React Ref

```tsx
import { useRef } from 'react';
import { SpotlightOverlay } from '@/components/SpotlightOverlay';

function MyComponent() {
  const targetRef = useRef<HTMLButtonElement>(null);
  const [isTourActive, setIsTourActive] = useState(false);

  return (
    <>
      <button ref={targetRef} onClick={() => setIsTourActive(true)}>
        Start Tour
      </button>

      {isTourActive && (
        <SpotlightOverlay
          targetRef={targetRef}
          padding={20}
          radius={8}
          onClose={() => setIsTourActive(false)}
        >
          <div className="flex gap-2">
            <Button variant="outline">Previous</Button>
            <Button>Next</Button>
          </div>
        </SpotlightOverlay>
      )}
    </>
  );
}
```

### Multi-step Tour

```tsx
import { useState } from 'react';
import { SpotlightOverlay } from '@/components/SpotlightOverlay';

const tourSteps = [
  { selector: '#step-1', title: 'Welcome' },
  { selector: '#step-2', title: 'Features' },
  { selector: '#step-3', title: 'Get Started' },
];

function TourComponent() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);

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

  return (
    <>
      {/* Tour content */}
      <button onClick={() => setIsTourActive(true)}>
        Start Tour
      </button>

      {isTourActive && (
        <SpotlightOverlay
          targetSelector={tourSteps[currentStep].selector}
          onClose={() => setIsTourActive(false)}
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
    </>
  );
}
```

## Implementation Details

### Masking Strategy

The component uses different approaches based on browser support:

1. **Modern Browsers**: Uses CSS `mask-image` with `radial-gradient()` for smooth spotlight effects
2. **Safari/Fallback**: Uses four absolutely positioned divs to create the "hole" effect

### Position Tracking

The component automatically tracks target element position changes through:

- **Resize Observer**: Monitors element size changes
- **Scroll Events**: Updates position on page scroll
- **Mutation Observer**: Detects DOM changes that might affect positioning
- **Window Resize**: Handles viewport size changes

### Portal Rendering

The overlay is rendered via `ReactDOM.createPortal` to:
- Avoid z-index conflicts with parent elements
- Ensure the overlay appears above all other content
- Prevent CSS inheritance issues

### Event Handling

- **Escape Key**: Closes the overlay when ESC is pressed
- **Click Outside**: Blocks clicks outside the spotlight area
- **Click Through**: Allows clicks within the spotlight area to reach the target element

## Browser Compatibility

- **Chrome/Edge**: Full support with CSS masks
- **Firefox**: Full support with CSS masks
- **Safari**: Fallback to four-div approach
- **Mobile**: Works on all modern mobile browsers

## Performance Considerations

- Uses `useCallback` for stable function references
- Efficient event listener cleanup
- Throttled resize/scroll handlers
- Minimal DOM manipulation

## Styling

The overlay uses these base styles:
- `fixed inset-0`: Covers entire viewport
- `bg-black/80`: Semi-transparent black background
- `backdrop-blur-sm`: Subtle blur effect
- `z-[90]`: High z-index layer

Tour controls are rendered at `z-[91]` to appear above the overlay.

## Examples

See `SpotlightTourDemo.tsx` for a complete working example with multiple tour steps.