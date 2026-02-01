export type Direction = "next" | "prev";

/**
 * Cutout hole shape for the tour overlay.
 * - 'rect': Rectangle with sharp corners
 * - 'rounded': Rectangle with configurable border radius
 * - 'circle': Perfect circle (uses min of width/height)
 * - 'pill': Rounded pill shape (radius = half of height)
 */
export type CutoutShape = 'rect' | 'rounded' | 'circle' | 'pill';

/**
 * Hand pointer configuration for highlighting the target element.
 */
export interface HandPointerConfig {
  /** Enable/disable the hand pointer */
  enabled: boolean;
  /** Which side of the target to place the hand pointer */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Horizontal offset in pixels (relative to default position) */
  offsetX?: number;
  /** Vertical offset in pixels (relative to default position) */
  offsetY?: number;
  /** Scale factor for the hand image (default: 1) */
  scale?: number;
}

/**
 * Cutout overlay configuration for highlighting specific UI elements.
 * 
 * **How to attach:**
 * 1. Add an ID to your target element: `<div id="my-element">...</div>`
 * 2. Reference it in your tour step: `selector: '#my-element'`
 * 
 * **How to configure the cutout hole:**
 * - `shape`: Choose 'rect', 'rounded', 'circle', or 'pill'
 * - `padding`: Space around the target element (default: 16)
 * - `radius`: Border radius for 'rounded' shape (default: 24)
 * - `holeWidth/holeHeight`: Override hole dimensions (otherwise uses element size + padding)
 * - `holeOffsetX/holeOffsetY`: Move hole relative to element position
 * 
 * **Example:**
 * ```typescript
 * {
 *   selector: '#dashboard-blobbi-visual',
 *   cutout: {
 *     shape: 'rounded',
 *     padding: 16,
 *     radius: 24,
 *     hand: { enabled: true, side: 'right' }
 *   }
 * }
 * ```
 */
export interface CutoutConfig {
  /** Shape of the cutout hole */
  shape?: CutoutShape;
  /** Padding around the target element in pixels */
  padding?: number;
  /** Border radius for 'rounded' shape in pixels */
  radius?: number;
  /** Override hole width (otherwise uses element width + padding) */
  holeWidth?: number;
  /** Override hole height (otherwise uses element height + padding) */
  holeHeight?: number;
  /** Horizontal offset for the hole in pixels */
  holeOffsetX?: number;
  /** Vertical offset for the hole in pixels */
  holeOffsetY?: number;
  /** Overlay opacity (0-1, default: 0.80) */
  overlayOpacity?: number;
  /** Hand pointer configuration */
  hand?: HandPointerConfig;
}

export interface TourStepMobile {
  imagePosition?: "below" | "above" | "left" | "right"; // Position relative to spotlight
  imageOffset?: number; // Legacy offset (maintained for backward compatibility)
  imageOffsetX?: number; // Horizontal offset relative to spotlight center
  imageOffsetY?: number; // Vertical offset relative to default placement
  imageWidth?: number | string; // Custom width (e.g., 400, "400px", "80%")
  imageHeight?: number | string; // Custom height (e.g., 300, "300px", "80%")
  imageMobile?: string; // Alternate image for mobile devices
  spotlightPadding?: number; // Padding for spotlight on mobile
  spotlightRadius?: number; // Radius for spotlight on mobile
  scrollAlign?: "start" | "center" | "end" | "nearest"; // Where the spotlighted element should land in the viewport
  scrollOffset?: number; // Extra pixel offset to apply (positive pushes it further down, negative moves it up)
  /** Cutout overlay configuration (overrides default spotlight) */
  cutout?: CutoutConfig;
}

export interface TourStep {
  selector: string;
  title: string;
  description?: string;
  nextLabel?: string; // Custom label for the next button
  image?: string; // Can be a string path or imported asset
  imageOffset?: number; // Legacy offset (maintained for backward compatibility)
  imageOffsetX?: number; // Horizontal offset relative to spotlight center
  imageOffsetY?: number; // Vertical offset relative to default placement
  imagePosition?: "below" | "above" | "left" | "right"; // Position relative to spotlight
  imageWidth?: number | string; // Custom width (e.g., 400, "400px", "80%")
  imageHeight?: number | string; // Custom height (e.g., 300, "300px", "80%")
  mobile?: TourStepMobile; // Mobile-specific overrides
  scrollAlign?: "start" | "center" | "end" | "nearest"; // Where the spotlighted element should land in the viewport
  scrollOffset?: number; // Extra pixel offset to apply (positive pushes it further down, negative moves it up)
  /** Cutout overlay configuration (overrides default spotlight) */
  cutout?: CutoutConfig;
  onEnter?(ctx: TourContext): void | Promise<void>;
  onBeforeAdvance?(dir: Direction, ctx: TourContext): void | Promise<void | OnBeforeAdvanceResult>;
  onLeave?(ctx: TourContext): void | Promise<void>;
}

export interface TourContext {
  setActiveTab?: (v: string) => void; // from BlobbiDashboard Tabs
  waitForVisible: (selector: string, opts?: { timeout?: number }) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  navigateTo: (path: string) => Promise<void>;
}

export interface OnBeforeAdvanceResult {
  skipAutoScroll?: boolean;
}