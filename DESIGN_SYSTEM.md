# Visual Design System

This document outlines the visual design style used in the application, providing a guide for maintaining a consistent user interface. The overall aesthetic is **elegant, warm, and soft**, with a focus on clarity and a comfortable user experience. It avoids harsh blacks and pure whites, opting for a palette of warm off-whites, rich browns, and gentle golds.

## Color Palette

The color system is defined using HSL values in `src/index.css` and mapped to semantic names in `tailwind.config.ts`. This allows for a flexible and themeable design.

### Light Mode

- **Primary Background (`--background`)**: `#FFF8EC` (HSL: 45 67% 97%) - A very light, warm off-white that serves as the base for the entire UI.
- **Primary Foreground (`--foreground`)**: `#2C2419` (HSL: 32 33% 15%) - A warm, dark brown for primary text, providing excellent readability against the light background.
- **Card Background (`--card`)**: `#F5F0E8` (HSL: 42 43% 95%) - A slightly darker off-white for cards and other elevated surfaces, creating subtle depth.
- **Primary Action (`--primary`)**: `#8B5A3C` (HSL: 20 42% 39%) - A rich, warm brown used for primary buttons and key interactive elements.
- **Primary Action Foreground (`--primary-foreground`)**: `#FFF8EC` (HSL: 45 67% 97%) - The base background color, used for text on primary buttons to ensure high contrast.
- **Secondary Action (`--secondary`)**: `#E5DDD0` (HSL: 38 29% 84%) - A muted, earthy tone for secondary buttons and less prominent interactive elements.
- **Muted Foreground (`--muted-foreground`)**: `#6B5D4F` (HSL: 28 17% 37%) - A softer brown for placeholder text, descriptions, and captions.
- **Borders & Inputs (`--border`, `--input`)**: `#E5DDD0` (HSL: 38 29% 84%) - A light, warm gray for borders and input fields, ensuring they are distinct but not jarring.
- **Focus Ring (`--ring`)**: `#A0522D` (HSL: 20 55% 40%) - A slightly more saturated brown to indicate focus on interactive elements.

### Dark Mode

- **Primary Background (`--background`)**: `#1C1814` (HSL: 30 13% 10%) - A deep, warm brown that replaces pure black for a softer, more comfortable dark theme.
- **Primary Foreground (`--foreground`)**: `#F0E6D6` (HSL: 42 43% 90%) - A warm off-white for primary text, ensuring readability in dark mode.
- **Card Background (`--card`)**: `#252018` (HSL: 30 17% 14%) - A slightly lighter warm brown for cards, maintaining the subtle depth of the light theme.
- **Primary Action (`--primary`)**: `#B8860B` (HSL: 43 91% 39%) - A vibrant, dark gold for primary actions, creating a focal point in the dark UI.
- **Primary Action Foreground (`--primary-foreground`)**: `#1C1814` (HSL: 30 13% 10%) - The base dark background color, used for text on primary buttons.
- **Secondary Action (`--secondary`)**: `#3A332A` (HSL: 28 17% 21%) - A muted, dark brown for secondary buttons.
- **Muted Foreground (`--muted-foreground`)**: `#A69B8A` (HSL: 32 17% 67%) - A soft, light brown for less important text.
- **Borders & Inputs (`--border`, `--input`)**: `#3A332A` (HSL: 28 17% 21%) - A subtle, dark brown for borders and inputs.
- **Focus Ring (`--ring`)**: `#DAA520` (HSL: 51 88% 67%) - A brighter gold for focus rings, ensuring visibility.

## Typography

The typography is designed to be clean, friendly, and highly readable.

- **Font Family**: The primary font is **Comfortaa**, a rounded, geometric sans-serif font. It is used for all text, from headings to body copy, creating a consistent and soft feel. The fallback stack is `system-ui`, then `sans-serif`.
- **Headings**:
  - `CardTitle` (`h3`): `text-2xl` (24px), `font-semibold`.
  - `DialogTitle`: `text-lg` (18px), `font-semibold`.
- **Body Text**: `text-base` (16px) or `text-sm` (14px), `font-medium`.
- **Captions & Descriptions**: `text-sm` (14px), with `text-muted-foreground` color for a softer appearance.

## Buttons and Input Fields

Interactive elements are styled for clarity, with clear visual feedback for different states.

- **General Style**: Buttons and inputs have a `rounded-md` shape, which corresponds to `calc(var(--radius) - 2px)`, resulting in a soft, modern look. The base radius is `0.75rem` (12px).
- **Variants**:
  - **Default**: Solid background (`primary`) with light text (`primary-foreground`). The main call-to-action style.
  - **Destructive**: Uses the `--destructive` color to indicate a potentially dangerous action.
  - **Outline**: Transparent background with a border. Used for secondary actions where a solid button would be too heavy.
  - **Secondary**: A less prominent solid button style.
  - **Ghost**: No background or border, used for the most subtle actions.
  - **Link**: Styled like a hyperlink for actions that navigate or are text-based.
- **Sizing**: Buttons come in `default` (40px height), `sm` (36px), and `lg` (44px) sizes, as well as an `icon` size (40x40px) for icon-only buttons.
- **Hover & Focus**:
  - Solid buttons (`default`, `destructive`, `secondary`) become slightly darker on hover (e.g., `hover:bg-primary/90`).
  - `Outline` and `ghost` buttons gain a subtle `accent` background on hover.
  - All interactive elements use a `ring-offset-background` and a `ring-2` outline with the `--ring` color for focus, ensuring high visibility and accessibility.
- **Input Fields**: Inputs share the same rounded shape and border style as buttons. They have a default height of 40px and use the `muted-foreground` color for placeholder text.

## Modals and Cards

Containers for content follow a consistent and elegant design pattern.

- **Border Radius**: All cards, popovers, and dialogs use a `rounded-lg` shape, which corresponds to the base radius of `0.75rem` (12px).
- **Padding**:
  - Cards and Dialogs use a generous padding of `p-6` (24px) for `CardHeader`, `CardContent`, and `CardFooter`.
  - The top padding is removed from `CardContent` and `CardFooter` to maintain consistent spacing when they follow a `CardHeader`.
- **Background Color**: They use the `--card` background color, which is slightly elevated from the main background to create a sense of depth.
- **Shadows**: A subtle `shadow-sm` is applied, which is defined in `index.css` as `.shadow-elegant`. This creates a soft, diffused shadow that enhances the feeling of depth without being heavy.
- **Borders**: A single-pixel border using the `--border` color is applied to all cards and dialogs, providing a clean edge.

## Layout and Spacing

The layout is clean and uses consistent spacing to create a balanced and readable interface.

- **Container**: The main content area is centered with a max-width of `1400px` and `2rem` of padding on the sides.
- **Spacing**: Spacing is handled primarily through Tailwind's utility classes and is consistent across components. For example, `space-y-1.5` is used in headers to create tight but readable spacing between titles and descriptions.
- **Alignment**: Flexbox is used extensively for alignment, with `items-center` and `justify-center` being common for centering content.

## Iconography

- **Icon Library**: **Lucide React** is used for all icons, providing a consistent, modern, and lightweight set of icons.
- **Usage**: Icons are typically sized at `16x16px` (`h-4 w-4`) and are used within buttons and other UI elements to provide visual cues without dominating the interface. They are set to `pointer-events-none` to ensure they don't interfere with click targets.

This comprehensive design system ensures a cohesive and elegant user experience throughout the application.
