# Blobbi Virtual Pet - UI Style Guide

*Complete visual design system documentation for the Blobbi Virtual Pet application*

---

## 1. Color Palette

### CSS Custom Properties (Light Mode)
```css
:root {
  /* Backgrounds - Off-white base (#FFF8EC) */
  --background: 45 67% 97%;           /* #FFF8EC - Off-white base */
  --foreground: 32 33% 15%;           /* #2C2419 - Warm dark brown text */

  --card: 42 43% 95%;                 /* #F5F0E8 - Cards and elevated surfaces */
  --card-foreground: 32 33% 15%;      /* #2C2419 - Card text */

  /* Primary colors - Purple gradient theme */
  --primary: 258 80% 50%;              /* Purple primary button background */
  --primary-foreground: 45 67% 97%;   /* #FFF8EC - Primary button text */

  /* Secondary colors - Subtle contrast */
  --secondary: 38 29% 84%;            /* #E5DDD0 - Secondary button background */
  --secondary-foreground: 32 33% 15%; /* #2C2419 - Secondary button text */

  /* Muted colors */
  --muted: 35 25% 87%;                /* #EDE6DB - Muted backgrounds */
  --muted-foreground: 28 17% 37%;     /* #6B5D4F - Muted text */

  /* Accent colors */
  --accent: 35 25% 87%;               /* #EDE6DB - Accent background */
  --accent-foreground: 32 33% 15%;    /* #2C2419 - Accent text */

  /* Status colors */
  --destructive: 20 42% 39%;          /* #A0522D - Error/destructive */
  --destructive-foreground: 45 67% 97%; /* #FFF8EC - Error text */

  /* Borders and inputs */
  --border: 38 29% 84%;               /* #E5DDD0 - Light borders */
  --input: 38 29% 84%;                /* #E5DDD0 - Input borders */
  --ring: 258 80% 40%;                 /* Purple focus rings */

  --radius: 0.75rem;                  /* 12px - Slightly more rounded */
}
```

### CSS Custom Properties (Dark Mode)
```css
.dark {
  /* Backgrounds - Warm dark base (#1C1814) */
  --background: 30 13% 10%;           /* #1C1814 - Warm dark base */
  --foreground: 42 43% 90%;           /* #F0E6D6 - Warm off-white text */

  --card: 30 17% 14%;                 /* #252018 - Cards and elevated surfaces */
  --card-foreground: 42 43% 90%;      /* #F0E6D6 - Card text */

  /* Primary colors - Bright purple accent */
  --primary: 278 86% 65%;              /* Bright purple primary button background */
  --primary-foreground: 30 13% 10%;   /* #1C1814 - Primary button text */

  /* Secondary colors */
  --secondary: 28 17% 21%;            /* #3A332A - Secondary backgrounds */
  --secondary-foreground: 42 43% 90%; /* #F0E6D6 - Secondary text */

  /* Status colors - Adjusted for dark mode */
  --destructive: 4 71% 57%;           /* #E74C3C - Error/destructive */
  --destructive-foreground: 42 43% 90%; /* #F0E6D6 - Error text */

  /* Borders and inputs */
  --border: 28 17% 21%;               /* #3A332A - Borders */
  --input: 28 17% 21%;                /* #3A332A - Input borders */
  --ring: 278 86% 40%;                 /* Bright purple focus rings */
}
```

### Semantic Color Mapping
```css
/* Success States */
.text-green-500 / bg-green-100 dark:bg-green-900/30

/* Warning States */  
.text-yellow-500 / bg-yellow-100 dark:bg-yellow-900/30

/* Error States */
.text-red-500 / bg-red-100 dark:bg-red-900/30

/* Info States */
.text-blue-500 / bg-blue-100 dark:bg-blue-900/30

/* Purple/Brand Colors */
.text-purple-500 / bg-purple-100 dark:bg-purple-900/30
.text-purple-600 / bg-purple-200 dark:bg-purple-800/30
.text-purple-700 / bg-purple-300 dark:bg-purple-700/30

/* Orange/Warm Colors */
.text-orange-500 / bg-orange-100 dark:bg-orange-900/30

/* Pink Colors */
.text-pink-500 / bg-pink-100 dark:bg-pink-900/30

/* Cyan/Blue Colors */
.text-cyan-500 / bg-cyan-100 dark:bg-cyan-900/30
```

---

## 2. Gradients

### Primary Brand Gradients
```css
/* Main Brand Gradient */
bg-gradient-to-r from-purple-500 to-pink-500
hover:from-purple-600 hover:to-pink-600

/* Feature Card Gradients */
bg-gradient-to-br from-purple-50/80 to-pink-50/80
dark:from-purple-900/30 dark:to-pink-900/30

/* Button Gradients */
bg-gradient-to-r from-purple-600 to-pink-600
hover:from-purple-700 hover:to-pink-700

/* Success Gradient */
bg-gradient-to-r from-green-500 to-emerald-500

/* Action Button Gradients */
bg-gradient-to-r from-blue-500 to-cyan-500
hover:from-blue-600 hover:to-cyan-600
```

### Background Gradients
```css
/* Page Background */
bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100
dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20

/* Card Backgrounds */
bg-gradient-to-br from-purple-50 to-pink-50
dark:from-purple-900/30 dark:to-pink-900/30

/* Overlay Gradients */
bg-gradient-to-r from-purple-100 to-pink-100
dark:from-purple-900/40 dark:to-pink-900/40

/* Glow Effects */
radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)
radial-gradient(circle, rgba(122, 217, 185, 0.5) 0%, transparent 70%)
```

### Text Gradients
```css
/* Gradient Text */
bg-gradient-to-r from-purple-600 to-pink-600
dark:from-purple-400 dark:to-pink-400
bg-clip-text text-transparent
```

---

## 3. Buttons

### Base Button Classes
```css
/* Core Button Structure */
inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0
```

### Size Variants
```css
/* Default */
h-10 px-4 py-2

/* Small */
h-9 rounded-md px-3

/* Large */ 
h-11 rounded-md px-8

/* Icon Only */
h-10 w-10
```

### Variant Styles

#### Default (Primary)
```css
bg-primary text-primary-foreground hover:bg-primary/90
/* Purple background with white text */
```

#### Secondary
```css
bg-secondary text-secondary-foreground hover:bg-secondary/80
/* Muted background with dark text */
```

#### Outline
```css
border border-input bg-background hover:bg-accent hover:text-accent-foreground
/* Transparent with colored border */
```

#### Ghost
```css
hover:bg-accent hover:text-accent-foreground
/* No background, hover effect only */
```

#### Link
```css
text-primary underline-offset-4 hover:underline
/* Text-only with underline hover */
```

#### Destructive
```css
bg-destructive text-destructive-foreground hover:bg-destructive/90
/* Error/danger styling */
```

### Custom Button Patterns

#### Game Action Buttons
```css
/* Care Action Grid Buttons */
flex flex-col gap-1 h-auto py-3 relative
/* 2-column grid for baby/adult, 3-column for eggs */

/* Disabled State */
opacity-50 cursor-not-allowed
```

#### Icon-Only Buttons
```css
/* Mobile Menu */
relative transition-all duration-300 ease-in-out
hover:shadow-elegant hover:scale-105 hover:border-primary/30
active:scale-95
focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2
bg-card/50 backdrop-blur-sm border-border/50
hover:glow-warm
```

### Button Interactions

#### Hover Effects
```css
/* Scale Transform */
hover:scale-[1.02]

/* Shadow Enhancement */
hover:shadow-xl hover:shadow-purple-200/20

/* Color Transitions */
transition-all duration-300
```

#### Loading States
```css
/* Spinner Inside Button */
<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>

/* Disabled During Loading */
disabled:opacity-50
```

---

## 4. Cards

### Base Card Structure
```css
rounded-lg border bg-card text-card-foreground shadow-sm
/* All cards inherit this base styling */
```

### Card Component Patterns

#### Standard Card Layout
```css
/* Card Header */
<CardHeader className="flex flex-col space-y-1.5 p-6">

/* Card Title */
<CardTitle className="text-2xl font-semibold leading-none tracking-tight">

/* Card Description */
<CardDescription className="text-sm text-muted-foreground">

/* Card Content */
<CardContent className="p-6 pt-0">

/* Card Footer */
<CardFooter className="flex items-center p-6 pt-0">
```

#### Blobbi Card Variants

##### Size-Based Configurations
```css
/* Small Cards */
.visualHeight: min-h-[120px]
.visualPadding: p-3
.titleSize: text-base
.descriptionSize: text-xs
.borderRadius: rounded-xl

/* Medium Cards (Default) */
.visualHeight: min-h-[200px]
.visualPadding: p-6
.titleSize: text-lg
.descriptionSize: text-sm
.borderRadius: rounded-2xl

/* Large Cards */
.visualHeight: min-h-[300px]
.visualPadding: p-8
.titleSize: text-xl
.descriptionSize: text-sm
.borderRadius: rounded-2xl
```

##### Blobbi Card Specific Styling
```css
/* Main Container */
group transition-all duration-300 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-purple-200/60 dark:border-purple-600/60 shadow-sm hover:shadow-xl hover:shadow-purple-200/20 dark:hover:shadow-purple-900/20

/* Visual Container */
flex items-center justify-center transition-all duration-500 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl border-2 border-purple-100/60 dark:border-purple-600/30 group-hover:border-purple-200/80 dark:group-hover:border-purple-500/50 min-h-[300px] p-8
```

#### Game-Specific Card Patterns

##### Growth Hub Card
```css
/* Collapsible Growth Tracking */
relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600

/* Task List Items */
flex items-start gap-3 p-3 rounded-lg border transition-all
/* Green when completed */
bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800
/* Gray when incomplete */
bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700
```

##### Stats Card
```css
/* Progress Bar Container */
relative w-full bg-secondary/50 rounded-full h-3 overflow-hidden

/* Animated Progress Fill */
h-full transition-all duration-300
```

---

## 5. Modals / Overlays

### Dialog System Structure

#### Base Dialog Overlay
```css
/* Overlay Background */
fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0

/* Dialog Content */
fixed left-[50%] top-[50%] z-50 grid w-[calc(100vw-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-4 sm:p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-lg max-h-[calc(100vh-2rem)] overflow-y-auto
```

#### Modal Variants

##### Inventory Modal
```css
/* Large Modal for Item Selection */
w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden

/* Item Grid */
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pr-2

/* Item Cards */
group cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02]
/* Selected State */
ring-2 ring-purple-500 shadow-lg scale-[1.02] bg-gradient-to-br from-purple-50 to-pink-50
```

##### Shop Modal
```css
/* Full-width Shopping Experience */
w-full max-w-6xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm

/* Product Cards */
bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden
```

### Modal Animation Patterns

#### Entrance Animations
```css
/* Fade In */
animate-in fade-in-0

/* Scale */
zoom-in-95

/* Slide */
slide-in-from-left-1/2 slide-in-from-top-[48%]
```

#### Exit Animations
```css
/* Fade Out */
animate-out fade-out-0

/* Scale Down */
zoom-out-95

/* Slide Out */
slide-out-to-left-1/2 slide-out-to-top-[48%]
```

---

## 6. Navigation / Layout

### Overall Layout Structure

#### Main Dashboard Layout
```css
/* Container Grid */
.container mx-auto pt-2 pb-8 px-4

/* 4-Column Grid System */
.grid lg:grid-cols-4 gap-6
/* Sidebar: lg:col-span-1 */
/* Main Content: lg:col-span-3 */
```

#### Page Backgrounds
```css
/* Standard Page Background */
min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/10 dark:to-blue-900/20

/* Blobbi Layout Wrapper */
relative min-h-screen
```

### Navigation Patterns

#### Header Layout
```css
/* Main Header Container */
flex flex-wrap justify-between items-center mb-8 gap-4

/* Logo/Title Section */
flex items-center gap-4

/* Action Buttons Section */
hidden md:flex items-center gap-2 /* Desktop */
flex md:hidden gap-2 /* Mobile */
```

#### Sidebar Navigation
```css
/* Dashboard Sidebar */
lg:col-span-1

/* Navigation Cards */
bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600
```

### Tab System

#### Tab Container
```css
/* Tab List */
inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground

/* Tab Triggers */
inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm
```

---

## 7. Icons

### Icon System Overview

#### Primary Icon Library: Lucide React
```typescript
import { 
  // Game/Action Icons
  Heart, Utensils, Gamepad2, Bath, Moon, Sun, Pill, Trophy, Thermometer, Eye, Music, MessageCircle,
  
  // UI/System Icons  
  Sparkles, Zap, Smile, Crown, Activity, AlertTriangle, CheckCircle, Circle, Camera, Send, Wifi, WifiOff, ChevronDown, ChevronUp, MoreVertical, X, Settings, Users, BarChart3,
  
  // Status Icons
  Loader2 // Loading spinner
} from 'lucide-react';
```

### Icon Size Standards

#### Standard Icon Sizes
```css
/* Small Icons (Buttons, Badges) */
w-3 h-3
w-4 h-4

/* Medium Icons (Cards, Headers) */
w-5 h-5
w-6 h-6

/* Large Icons (Hero Section, Features) */
w-8 h-8
w-10 h-10
w-12 h-12
```

#### Icon Container Patterns
```css
/* Circular Icon Containers */
w-7 h-7 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center

/* Square Icon Containers */
w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg
```

### Icon Color Usage

#### Semantic Icon Colors
```css
/* Status Icons */
.text-red-500 /* Health, Danger */
.text-blue-500 /* Energy, Info */
.text-yellow-500 /* Happiness, Warning */
.text-purple-500 /* Hygiene, Magic */
.text-orange-500 /* Hunger, Warmth */
.text-green-500 /* Success, Shell Integrity */

/* Interactive Icons */
.text-purple-600 /* Primary actions */
.text-gray-600 /* Secondary actions */

/* Animated Icons */
.animate-pulse /* Low status warnings */
.animate-spin /* Loading states */
```

### Icon Animation Patterns

#### Hover Animations
```css
/* Mobile Menu Icon */
hover:rotate-90 transition-transform duration-200

/* Scale on Hover */
hover:scale-105 transition-transform
```

---

## 8. Typography

### Font System

#### Primary Font Family
```css
/* Tailwind Config */
fontFamily: {
  sans: ['Comfortaa Variable', 'Comfortaa', 'system-ui', 'sans-serif'],
}
```

#### Font Weight Hierarchy
```css
/* Headings */
font-bold /* Main titles */
font-semibold /* Subtitles, card titles */
font-medium /* Section headers, labels */

/* Body Text */
font-normal /* Default body text */

/* Small Text */
font-light /* Captions, metadata (rarely used) */
```

### Typography Scale

#### Heading Styles
```css
/* Page Titles */
.text-2xl sm:text-3xl md:text-4xl font-bold

/* Card Titles */
.text-xl font-semibold
.text-lg font-semibold

/* Section Headers */
.text-2xl font-bold
.text-lg font-semibold
```

#### Body Text Styles
```css
/* Primary Body */
.text-sm /* Default body text */
.text-base /* Larger body text */

/* Secondary/Muted Text */
.text-xs /* Small labels, metadata */
.text-sm text-muted-foreground /* Descriptions */

/* Large Body Text */
.text-lg /* Feature descriptions */
.text-xl /* Hero descriptions */
```

#### Special Typography
```css
/* Gradient Text */
bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent

/* Handwriting Font */
.font-handwriting /* 'Comic Neue', cursive */
```

### Text Alignment & Spacing

#### Text Alignment Patterns
```css
/* Centered Text */
text-center

/* Left Aligned (Default) */
text-left

/* Responsive Alignment */
text-center sm:text-left
```

#### Line Height & Spacing
```css
/* Tight Line Height */
leading-none /* Button text */
leading-tight /* Headings */

/* Normal Line Height */
leading-normal /* Body text */

/* Relaxed Line Height */
leading-relaxed /* Feature descriptions */
```

---

## 9. Component Patterns

### Blobbi Card Component
```css
/* Container */
group transition-all duration-300 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-purple-200/60 dark:border-purple-600/60 shadow-sm hover:shadow-xl hover:shadow-purple-200/20 dark:hover:shadow-purple-900/20 rounded-2xl

/* Header */
flex items-start justify-between space-y-1.5 p-4 pb-3

/* Visual Container */
flex items-center justify-center transition-all duration-500 bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl border-2 border-purple-100/60 dark:border-purple-600/30 group-hover:border-purple-200/80 dark:group-hover:border-purple-500/50 min-h-[300px] p-8

/* Stats Grid */
flex justify-around pt-3 border-t border-purple-100 dark:border-purple-600/30

/* Action Buttons */
flex flex-col gap-2 w-full pt-4 border-t border-purple-100 dark:border-purple-600/30
```

### Blobbi Actions Component
```css
/* Action Grid */
grid gap-2
/* 3-column for eggs */
grid-cols-3
/* 2-column for baby/adult */
grid-cols-2

/* Action Buttons */
flex flex-col gap-1 h-auto py-3 relative

/* Icon + Label Layout */
flex flex-col gap-1 h-auto py-3
```

### Growth Hub Card Component
```css
/* Collapsible Container */
relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600

/* Task List Items */
flex items-start gap-3 p-3 rounded-lg border transition-all

/* Progress Bars */
relative w-full bg-secondary/50 rounded-full h-3 overflow-hidden

/* Progress Fill */
h-full transition-all duration-300
```

### Stats Component
```css
/* Stats Card */
bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-purple-200 dark:border-purple-600

/* Stat Item Layout */
flex items-center justify-between text-sm

/* Progress Bar Container */
relative w-full bg-secondary/50 rounded-full h-3 overflow-hidden

/* Icon + Value Layout */
flex items-center gap-2
```

### Inventory Modal Component
```css
/* Large Modal */
w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm

/* Item Grid */
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4

/* Item Cards */
group cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-purple-200/50 dark:border-purple-600/50 rounded-2xl overflow-hidden

/* Item Header */
relative p-4 pb-3 flex items-start justify-between

/* Effect Badges */
inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-lg border border-emerald-200/50 dark:border-emerald-700/50
```

---

## 10. Interaction Feedback

### Hover States

#### Card Hover Effects
```css
/* Scale Transform */
hover:scale-[1.02] transition-all duration-300

/* Shadow Enhancement */
hover:shadow-xl hover:shadow-purple-200/20

/* Border Color Change */
hover:border-purple-200/80 dark:hover:border-purple-500/50
```

#### Button Hover Effects
```css
/* Primary Buttons */
hover:from-purple-600 hover:to-pink-600

/* Scale Effect */
hover:scale-105 transition-transform duration-200

/* Shadow on Hover */
hover:shadow-elegant hover:scale-105 hover:border-primary/30
```

### Loading States

#### Skeleton Loading
```css
/* Base Skeleton */
animate-pulse rounded-md bg-muted

/* Card Skeleton */
<div className="space-y-3">
  <Skeleton className="h-4 w-24" />
  <Skeleton className="h-3 w-16" />
</div>

/* Full Card Skeleton */
<Card>
  <CardHeader>
    <div className="flex items-center space-x-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="space-y-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  </CardContent>
</Card>
```

#### Spinners
```css
/* Standard Spinner */
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>

/* Button Spinner */
<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>

/* Loading Text */
<div className="flex items-center gap-2">
  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
  Using...
</div>
```

### Success/Error Feedback

#### Toast Notifications
```css
/* Toast Container */
fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]

/* Toast Styles */
group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all

/* Success Toast */
border bg-background text-foreground

/* Error Toast */
destructive group border-destructive bg-destructive text-destructive-foreground
```

#### Progress Indicators
```css
/* Progress Bar */
relative h-4 w-full overflow-hidden rounded-full bg-secondary

/* Progress Fill */
h-full w-full flex-1 bg-primary transition-all
transform: translateX(-${100 - (value || 0)}%)
```

### Optimistic UI Patterns

#### Fake Status Indicators
```css
/* Pending Status Badge */
inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-full border border-amber-200/50 dark:border-amber-600/50

/* Pulse Animation for Pending */
animate-pulse
```

#### Immediate Feedback
```css
/* Quick Success Flash */
bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800

/* Error Flash */
bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800
```

---

## 11. App-Specific UI Rules

### Blobbi Character Display

#### Character Sizes & Containers
```css
/* Egg Graphic Container */
w-32 h-40 /* Fixed size for all eggs */

/* Blobbi Visual Container */
min-h-[300px] p-8 /* Fixed visual area */

/* Character Scaling */
/* All Blobbis display at medium size regardless of data size */
displaySize = 'medium' // Consistent visual scale
```

#### Character Positioning
```css
/* Centered Display */
flex items-center justify-center

/* Shadow Animation */
animate-blobbi-shadow

/* Jump Animation (Active Blobbis) */
animate-blobbi-jump
```

### Stats Display Patterns

#### Stat Bar Layout
```css
/* Stat Item Container */
space-y-1

/* Icon + Label Row */
flex items-center justify-between text-sm

/* Value Display */
<span className="text-xs text-muted-foreground/70">Math.round(stat.value)/100</span>

/* Progress Bar */
relative w-full bg-secondary/50 rounded-full h-3 overflow-hidden
```

#### Status Indicators
```css
/* Low Status Warning */
text-red-500 animate-pulse

/* Normal Status */
text-foreground/70

/* High Status */
text-green-500
```

### Profile & Badge Styles

#### Rank Badges
```css
/* Rank Display */
bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-900 border-0 shadow-sm

/* Crown Icon */
w-3 h-3 mr-1
```

#### Status Badges
```css
/* Life Stage Badge */
border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-900/20

/* State Badge */
/* Active State */
bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700

/* Inactive State */
bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300
```

### Special Effects & Animations

#### Egg-Specific Animations
```css
/* Gentle Sway */
.animate-egg-sway /* 3s ease-in-out infinite */

/* Warmth Pulse */
.animate-egg-warmth /* 2s ease-in-out infinite */

/* Crack Shake */
.animate-egg-crack /* 0.5s ease-in-out infinite */
```

#### Magical Effects
```css
/* Glow Effects */
.glow-warm /* 0 0 20px hsl(var(--primary) / 0.3) */
.glow-warm-lg /* 0 0 40px hsl(var(--primary) / 0.4) */

/* Particle Effects */
.animate-ping /* Floating particles */

/* Shimmer Effects */
.animate-shimmer /* 3s ease-in-out infinite */
```

#### Blobbi Animations
```css
/* Jump Animation */
@keyframes blobbi-jump {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15%); }
}

/* Shadow Animation */
@keyframes blobbi-shadow {
  0%, 100% { transform: scale(1, 1); }
  50% { transform: scale(0.85, 0.85); }
}
```

### Responsive Design Rules

#### Breakpoint System
```css
/* Mobile First */
/* Base styles for mobile */

/* sm: 640px */
/* Medium screens - tablet */

/* md: 768px */ 
/* Large tablets/small desktops */

/* lg: 1024px */
/* Desktop screens */

/* xl: 1400px */
/* Large desktops */
```

#### Responsive Patterns
```css
/* Grid Adjustments */
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3

/* Text Scaling */
text-2xl sm:text-3xl md:text-4xl

/* Spacing Adjustments */
p-4 sm:p-6

/* Display Controls */
hidden md:block /* Desktop only */
block md:hidden /* Mobile only */
```

### Performance Considerations

#### Animation Optimizations
```css
/* Hardware Acceleration */
transform: translateZ(0)
will-change: transform

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  animation: none !important;
}
```

#### Image & Asset Loading
```css
/* Blur Up Loading */
animate-pulse rounded-md bg-muted

/* Lazy Loading Containers */
aspect-ratio-video
```

---

## Implementation Notes

### CSS Custom Properties Usage
All colors use CSS custom properties for theme switching. Always reference the HSL values defined in the `:root` and `.dark` sections.

### Component Class Merging
Use the `cn()` utility for conditional class merging:
```typescript
cn(
  "base-classes",
  condition && "conditional-classes",
  className // Allow overrides
)
```

### Animation Performance
- Use `transform` and `opacity` for smooth animations
- Add `will-change` sparingly for complex animations
- Respect `prefers-reduced-motion` for accessibility

### Dark Mode Implementation
All components support dark mode through CSS custom properties. Test both light and dark variants for all new components.

---

*This style guide represents the complete visual design system of the Blobbi Virtual Pet application as of the current version. Update this document when introducing new visual patterns or modifying existing ones.*