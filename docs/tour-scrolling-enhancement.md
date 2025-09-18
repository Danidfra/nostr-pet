# Tour Auto-Scroll Enhancement

## Overview

The Blobbi tour system has been enhanced with advanced scrolling controls that provide precise control over where spotlighted elements appear in the viewport, with special consideration for mobile devices and fixed UI elements.

## Features

### New Step Configuration Options

#### `scrollAlign`
Controls where the spotlighted element should land in the viewport.

**Type:** `"start" | "center" | "end" | "nearest"`

**Values:**
- `"start"` - Positions element at the top of the viewport
- `"center"` - Centers element in the viewport (default on desktop)
- `"end"` - Positions element at the bottom of the viewport
- `"nearest"` - Automatically chooses the closest viewport edge for minimal scrolling

#### `scrollOffset`
Extra pixel offset to apply after alignment. Positive values push the element further down, negative values move it up.

**Type:** `number`

**Use Cases:**
- Compensate for fixed headers (positive offset)
- Fine-tune positioning for specific UI layouts
- Account for safe area insets on mobile devices

### Mobile-Specific Overrides

All scroll options can be overridden specifically for mobile devices within the `mobile` property:

```typescript
{
  selector: '#my-element',
  title: 'Example Step',
  // Default behavior (desktop)
  scrollAlign: 'center',
  scrollOffset: 0,
  // Mobile-specific overrides
  mobile: {
    scrollAlign: 'start',    // Mobile scrolls to top
    scrollOffset: 50         // Mobile has 50px offset
  }
}
```

## Default Behavior

### Mobile Devices
- **Default `scrollAlign`:** `"start"` (scrolls to top)
- **Default `scrollOffset`:** `0`
- **Reasoning:** Mobile screens have limited vertical space, so positioning elements at the top provides better visibility and context.

### Desktop
- **Default `scrollAlign`:** `"center"` (centers element)
- **Default `scrollOffset`:** `0`
- **Reasoning:** Desktop screens have more space, and centering provides a balanced viewing experience.

## Safe Area Support

The scrolling system automatically handles safe area insets on mobile devices with notches:

```css
/* Automatically detected and compensated */
env(safe-area-inset-top)
```

When `scrollAlign: "start"` is used, the system subtracts the safe area inset from the scroll position to ensure the element appears below the notch/camera area.

## Implementation Details

### Enhanced Scrolling Function

The core functionality is implemented in `scrollToElementWithAlignment()` in `src/lib/utils.ts`:

```typescript
export function scrollToElementWithAlignment(
  element: HTMLElement,
  options: {
    align?: "start" | "center" | "end" | "nearest";
    offset?: number;
    behavior?: ScrollBehavior;
  } = {}
): void
```

### Alignment Calculations

#### Start Alignment
```javascript
targetScrollTop = window.pageYOffset + rect.top - safeAreaInsetTop - offset;
```

#### Center Alignment
```javascript
targetScrollTop = window.pageYOffset + rect.top - (viewportHeight - rect.height) / 2 - offset;
```

#### End Alignment
```javascript
targetScrollTop = window.pageYOffset + rect.bottom - viewportHeight + offset;
```

#### Nearest Alignment
Automatically chooses between start and end based on which edge is closer:

```javascript
const distanceFromTop = rect.top;
const distanceFromBottom = viewportHeight - rect.bottom;
targetScrollTop = distanceFromTop <= distanceFromBottom 
  ? /* use start alignment */ 
  : /* use end alignment */;
```

### Integration Points

The enhanced scrolling is automatically applied in these scenarios:

1. **Step Entry** - When entering a new tour step
2. **Navigation** - After Next/Prev button clicks
3. **Tab Changes** - After `waitForVisible()` resolves and tabs/routes change
4. **Orientation Changes** - When mobile device is rotated (re-applies current step's scroll settings)

## Usage Examples

### Basic Usage

```typescript
const tourSteps = [
  {
    selector: '#feature-1',
    title: 'Feature 1',
    // Uses defaults: center on desktop, start on mobile
  },
  {
    selector: '#feature-2', 
    title: 'Feature 2',
    scrollAlign: 'start', // Both mobile and desktop scroll to top
  }
];
```

### Header Compensation

```typescript
const tourSteps = [
  {
    selector: '#content-section',
    title: 'Content Section',
    scrollAlign: 'start',
    scrollOffset: 80, // Compensates for 80px fixed header
    mobile: {
      scrollOffset: 60 // Mobile header is 60px
    }
  }
];
```

### Mixed Alignment Strategy

```typescript
const tourSteps = [
  {
    selector: '#top-navigation',
    title: 'Navigation',
    scrollAlign: 'start', // Always show at top
    mobile: {
      scrollOffset: 20 // Extra spacing on mobile
    }
  },
  {
    selector: '#main-content',
    title: 'Main Content',
    scrollAlign: 'center', // Center main content
  },
  {
    selector: '#footer-actions',
    title: 'Footer Actions',
    scrollAlign: 'end', // Show at bottom
    mobile: {
      scrollAlign: 'nearest' // Let mobile decide optimal position
    }
  }
];
```

### Nearest Alignment for Dynamic Content

```typescript
const tourSteps = [
  {
    selector: '#dynamic-element',
    title: 'Dynamic Content',
    scrollAlign: 'nearest', // Automatically chooses best position
    // Useful when element position varies based on content
  }
];
```

## Browser Compatibility

The enhanced scrolling uses `window.scrollTo()` with behavior options for maximum compatibility:

- **Modern Browsers:** Full support for smooth scrolling
- **Older Browsers:** Fallback to instant scrolling (behavior not supported)
- **Mobile:** Full support including safe area insets

### Fallback Behavior

If the enhanced scrolling fails, the system automatically falls back to the original `scrollIntoView()` method:

```typescript
try {
  // Try enhanced scrolling
  await scrollTourTarget(selector, options);
} catch (error) {
  console.error('Error scrolling to target:', error);
  // Fallback to basic scrolling
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center'
  });
}
```

## Testing

### Unit Tests

The `scrollToElementWithAlignment` function is fully unit tested in `src/lib/utils.test.ts` with coverage for:

- All alignment options (start, center, end, nearest)
- Offset calculations
- Safe area inset handling
- Viewport boundary conditions
- Error scenarios

### Demo Component

A demo component (`BlobbiTourDemo.tsx`) is available to showcase all scrolling features:

```typescript
import { BlobbiTourDemo } from '@/components/BlobbiTourDemo';

// In your app:
<BlobbiTourDemo />
```

The demo includes examples of all scroll alignment options and mobile/desktop behavior differences.

## Performance Considerations

1. **Smooth Scrolling:** Uses native browser smooth scrolling for optimal performance
2. **Debounced Updates:** Orientation changes and resize events are handled with appropriate delays
3. **Efficient Calculations:** All positioning calculations use efficient DOM API calls
4. **Fallback Safety:** Graceful degradation ensures the tour always works, even if enhanced scrolling fails

## Migration Guide

### Existing Tours

Existing tours will continue to work without changes. The new features are opt-in and backward compatible.

### Upgrading Tours

To take advantage of the new scrolling controls:

1. **Add scroll alignment** to steps that need specific positioning
2. **Add mobile overrides** where mobile behavior should differ from desktop
3. **Add offsets** to compensate for fixed headers or other UI elements
4. **Test on both mobile and desktop** to ensure optimal user experience

### Before (Basic Tour)

```typescript
{
  selector: '#my-element',
  title: 'My Step',
  description: 'Description'
}
```

### After (Enhanced Tour)

```typescript
{
  selector: '#my-element',
  title: 'My Step', 
  description: 'Description',
  scrollAlign: 'start',
  scrollOffset: 60,
  mobile: {
    scrollAlign: 'start',
    scrollOffset: 40
  }
}
```

## Best Practices

1. **Mobile-First Defaults:** Start with mobile-friendly positioning (`scrollAlign: 'start'`)
2. **Header Compensation:** Always add offset for fixed headers
3. **Consistent Patterns:** Use similar alignment strategies across related tour steps
4. **Test Real Devices:** Verify behavior on actual mobile devices, not just emulators
5. **Consider Content:** Choose alignment based on content type (headers at top, footers at bottom)
6. **Use Nearest Wisely:** Reserve `nearest` alignment for truly dynamic content positions

## Troubleshooting

### Common Issues

**Element not visible after scroll:**
- Check if `scrollOffset` needs adjustment for fixed headers
- Verify safe area insets are properly compensated
- Test with different alignment options

**Mobile vs Desktop inconsistencies:**
- Review mobile-specific overrides in the `mobile` property
- Ensure mobile detection is working correctly
- Check viewport height calculations

**Scrolling not smooth:**
- Verify browser supports smooth scrolling
- Check for conflicting CSS transitions
- Ensure no JavaScript errors are interrupting the scroll

### Debug Mode

Add console logging to troubleshoot scrolling issues:

```typescript
// In BlobbiTour.tsx, temporarily add debug logging
console.log('Scroll config:', { align, offset, isMobileDevice });
console.log('Element rect:', element.getBoundingClientRect());
console.log('Viewport:', { height: window.innerHeight, pageYOffset: window.pageYOffset });
```

## Future Enhancements

Potential future improvements:

1. **Dynamic Header Detection:** Automatically detect and compensate for fixed headers
2. **Animation Presets:** Predefined scroll animation curves for different effects
3. **Responsive Offsets:** Automatically adjust offsets based on viewport size
4. **Scroll Persistence:** Remember scroll positions when navigating between tour steps
5. **Accessibility Mode:** Reduced motion options for users who prefer no animations