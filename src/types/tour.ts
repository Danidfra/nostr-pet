export type Direction = "next" | "prev";

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