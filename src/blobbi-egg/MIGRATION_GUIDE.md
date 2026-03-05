# Blobbi Egg Module - Migration Guide

## How to Copy This Module to Another Project

This guide explains how to use the `src/blobbi-egg/` module in another project.

### Prerequisites

Your target project needs:
1. **React** 18.x or higher
2. **clsx** (2.x)
3. **tailwind-merge** (2.x)
4. A bundler that supports CSS imports (Vite, Webpack, etc.)

Optional:
- **Tailwind CSS** (recommended but not required - module has inline fallbacks)

### Installation Steps

#### 1. Copy the Module

Copy the entire `src/blobbi-egg/` folder to your target project:

```bash
# From your target project root
cp -r /path/to/source/src/blobbi-egg ./src/
```

#### 2. Install Dependencies

```bash
npm install clsx tailwind-merge
```

If you don't have React yet:
```bash
npm install react react-dom
```

#### 3. Import and Use

```tsx
// Import from the module
import { EggGraphic } from './blobbi-egg';
import type { EggVisualBlobbi } from './blobbi-egg';

// Create an egg object
const myEgg: EggVisualBlobbi = {
  baseColor: '#f2f2f2',
  eggTemperature: 50,
  lifeStage: 'egg',
};

// Render it
function MyComponent() {
  return (
    <div style={{ width: '200px', height: '250px' }}>
      <EggGraphic blobbi={myEgg} animated={true} />
    </div>
  );
}
```

### Verification

#### Quick Test

Use the demo component to verify everything works:

```tsx
import EggGraphicDemo from './blobbi-egg/__demo__/EggGraphicDemo';

// Render in your app temporarily
<EggGraphicDemo />
```

If you see eggs rendering with animations, the module is working correctly!

#### TypeScript Check

```bash
npx tsc --noEmit
```

Should compile without errors related to the blobbi-egg module.

### Troubleshooting

#### Issue: "Cannot find module 'clsx'"

**Solution**: Install dependencies
```bash
npm install clsx tailwind-merge
```

#### Issue: "Cannot resolve './styles/egg-animations.css'"

**Solution**: Ensure your bundler supports CSS imports. For Vite this works out of the box. For Webpack, ensure you have `css-loader` configured.

#### Issue: Eggs don't look right without Tailwind

**Solution**: The module includes inline fallbacks, but some styles use Tailwind. Either:
1. Install and configure Tailwind CSS (recommended)
2. Add custom CSS to override styles

#### Issue: TypeScript errors about EggVisualBlobbi

**Solution**: Make sure TypeScript can resolve the module:

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Or use relative imports:
```tsx
import { EggGraphic } from '../../blobbi-egg';
```

### Customization After Migration

#### Change Colors

Modify `src/blobbi-egg/lib/blobbi-egg-validation.ts` to add your own color palettes:

```typescript
export const VALID_BASE_COLORS = {
  common: ['#ffffff', '#f2f2f2', '#mycolor'],
  // ...
};
```

#### Change Animations

Edit `src/blobbi-egg/styles/egg-animations.css`:

```css
@keyframes egg-gentle-sway {
  /* Modify animation here */
}
```

#### Add New Special Marks

1. Add SVG to `src/blobbi-egg/components/SpecialMarkRenderer.tsx`
2. Add to `AVAILABLE_SPECIAL_MARKS` in `src/blobbi-egg/lib/special-marks-utils.ts`
3. Add validation in `src/blobbi-egg/lib/blobbi-egg-validation.ts`

### Best Practices

#### 1. Always Import from Module Root

✅ Good:
```tsx
import { EggGraphic } from './blobbi-egg';
```

❌ Bad:
```tsx
import { EggGraphic } from './blobbi-egg/components/EggGraphic';
```

#### 2. Use TypeScript Types

```tsx
import type { EggVisualBlobbi } from './blobbi-egg';

const myEgg: EggVisualBlobbi = {
  // TypeScript will validate this object
};
```

#### 3. Validate Egg Properties

```tsx
import { validateEggProperties } from './blobbi-egg';

const result = validateEggProperties({
  base_color: userInput.color,
  special_mark: userInput.mark,
});

if (!result.isValid) {
  console.error('Invalid egg:', result.errors);
}
```

#### 4. Check Divine Eggs

```tsx
import { isDivineEgg, DIVINE_BASE_COLOR } from './blobbi-egg';

if (isDivineEgg(myEgg)) {
  // Handle divine egg special case
}
```

### Module Independence

This module is **completely independent** and has:
- ✅ No path aliases (`@/...`)
- ✅ No external imports except React and utility libraries
- ✅ All types self-contained
- ✅ CSS bundled and imported internally
- ✅ No framework-specific dependencies

You can use it in:
- Next.js projects
- Create React App
- Vite projects
- Remix projects
- Any React-based project

### Support

For issues specific to this module in your new project:
1. Check the demo component works
2. Verify all dependencies are installed
3. Check bundler configuration for CSS support
4. Ensure TypeScript paths are configured correctly
