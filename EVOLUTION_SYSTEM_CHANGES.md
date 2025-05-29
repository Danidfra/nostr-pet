# Blobbi Evolution System - 4-Day Care Requirement

## Overview
The pet evolution system has been updated to require 4 full days of consistent care before a Blobbi can evolve. This creates a more meaningful progression system where users must demonstrate commitment to their pet.

## Key Changes

### 1. New Evolution Tracking System (`src/types/blobbi.ts`)
- Added `BlobbiEvolutionProgress` interface to track:
  - Total care days accumulated
  - Current consecutive care streak
  - Care sessions with timestamps
  - Evolution eligibility status
- Added `BlobbiCareSession` to track individual care periods
- Added `evolutionProgress` field to the main `Blobbi` interface

### 2. Evolution Logic (`src/lib/blobbi-evolution.ts`)
- **Care Requirements**:
  - 4 consecutive days of care required for evolution
  - Minimum 3 care actions per day to count as a "care day"
  - 24-hour session timeout (new session starts if no care for 24 hours)
  - 36-hour grace period to maintain streak
  
- **Key Functions**:
  - `updateEvolutionProgress()`: Updates progress when care actions are performed
  - `calculateCareDays()`: Calculates total and consecutive care days
  - `shouldTriggerEvolution()`: Checks if pet is ready to evolve
  - `determineEvolutionForm()`: Determines evolution form based on care patterns
  - `getEvolutionReadinessMessage()`: Provides user-friendly progress messages

### 3. Updated Game Logic (`src/lib/blobbi.ts`)
- Integrated evolution progress tracking into `applyAction()`
- Evolution now only triggers after 4 days of care (not on first action)
- Increased evolution reward from 50 to 100 coins
- Added backward compatibility for existing Blobbis

### 4. New UI Component (`src/components/blobbi/EvolutionProgress.tsx`)
- Visual progress bar showing care streak progress
- Current streak and total care days display
- Active/inactive streak status
- Clear messaging about requirements and progress
- "Ready to Evolve!" badge when eligible

### 5. Updated Game Interface (`src/components/blobbi/BlobbiGame.tsx`)
- Added evolution progress card to the game UI
- Removed old "Ready to evolve!" messages
- Shows evolution progress only to pet owners
- Integrated with existing game layout

## Technical Implementation Details

### Care Session Tracking
- Sessions track start time, end time (if ended), and action count
- New session starts if >24 hours since last action
- Sessions are stored in an array for historical tracking

### Streak Calculation
- Counts calendar days with at least 3 care actions
- Consecutive days counted backwards from current date
- Allows current day to have <3 actions without breaking streak
- Streak resets if >36 hours without care

### Evolution Determination
- Uses deterministic algorithm based on:
  - Owner's public key
  - Pet name
  - Birth time
  - Total care days
  - Experience points
  - Current stats
- Ensures consistent evolution form for same inputs

## Future Expansion Considerations

The system is designed to be easily expandable:

1. **Variable Evolution Times**: The 4-day requirement is defined as a constant and can be easily adjusted or made variable based on pet type.

2. **Care Quality Tracking**: The system tracks individual sessions, allowing future features like:
   - Care quality scores
   - Preferred care times
   - Care pattern analysis

3. **Multiple Evolution Stages**: The progress tracking supports future multi-stage evolutions.

4. **Achievement System**: Care streak data can be used for achievements and rewards.

5. **Social Features**: Care streaks could be displayed on profiles or used in leaderboards.

## Migration & Compatibility

- Existing Blobbis without evolution progress will have it initialized automatically
- The system gracefully handles missing fields
- No data loss for existing pets
- Evolution progress starts tracking from first interaction after update