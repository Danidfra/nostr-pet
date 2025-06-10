# NIP-XX: Blobbi Virtual Pet Lifecycle Events

`draft` `optional`

This NIP defines event kinds `31124`, `14919`, and `14920` for managing virtual pet (Blobbi) lifecycle stages, interactions, and permanent records on Nostr.

## Abstract

This specification describes a system for creating, managing, and interacting with virtual pets called "Blobbi" on the Nostr network. Blobbi pets progress through three distinct life stages (egg, baby, and adult), each with unique care requirements and interaction possibilities. The system uses three event kinds: replaceable events for current state, regular events for interactions, and immutable records for permanent history.

## Motivation

Virtual pets provide an engaging way for users to interact on Nostr beyond traditional social messaging. By standardizing Blobbi lifecycle events, we enable:
- Cross-client compatibility for virtual pet experiences
- Persistent pet state across different applications
- Social interactions through pet care and evolution milestones
- Gamification elements that encourage regular platform engagement
- Immutable historical records of pet milestones and lineage
- Real-time state updates that can be efficiently queried

## Event Structure

The Blobbi system uses three distinct event kinds to manage different aspects of virtual pet lifecycle:

### Kind 31124: Blobbi Current State (Replaceable)
This replaceable event contains the current state of the Blobbi, including:
- Current lifecycle stage (egg, baby, adult)
- Current stats (hunger, happiness, health, hygiene, energy)
- Evolution progress and requirements
- Active traits and abilities
- Current appearance and characteristics

This event is updated whenever the Blobbi's state changes (through interactions, time passage, or evolution). Clients should query for the most recent event of this kind to get the current Blobbi state.

### Kind 14919: Blobbi Interactions (Regular)
These regular events record individual interactions with the Blobbi, such as:
- Feeding, playing, cleaning, resting
- Medical care and grooming
- Training and skill development
- Social interactions with other Blobbi

Each interaction generates a new event, creating a complete activity log. These events are used to calculate state changes and track care patterns.

### Kind 14920: Blobbi Records (Regular, Immutable)
These regular events serve as permanent, immutable records of significant milestones:
- Birth/adoption information and initial traits
- Parent lineage and breeding history
- Evolution milestones and transformations
- Major achievements and titles earned
- Unique life events and special moments

These records form the permanent history and lineage of each Blobbi, never to be modified or replaced.

## Lifecycle Stages

### Egg Stage

**Description**: The initial stage when a user adopts a Blobbi. The egg requires consistent daily care over multiple days to prepare for hatching.

**State Event**: Kind `31124` with `stage` tag set to "egg"
**Birth Record**: Kind `14920` containing adoption/birth information
**Interactions**: Kind `14919` for care actions (warming, cleaning, checking, etc.)

**Hatching Requirements**:
- **Duration**: 4 full real days minimum since adoption
- **Care Points**: At least 40 total care points required
- **Daily Care Cap**: Maximum 10 care points can be earned per day
- **Distinct Care Days**: Must provide care on at least 4 different days
- **Health Penalty**: If egg health drops below 50%, one penalty day is added to the required duration

**Care Mechanics**:
- Care points are earned through various interaction types (warming, cleaning, checking, singing, talking)
- Each interaction type provides different care point values
- Daily care is capped at 10 points to ensure consistent multi-day engagement
- The 4-day requirement ensures eggs cannot be rushed to hatching

**Care Requirements**:
- Temperature regulation (keep warmth above 50%)
- Regular cleaning (maintain cleanliness above 50%)
- Health monitoring (keep health above 50% to avoid penalties)
- Daily interactions to earn care points

### Baby Stage (Post-Hatch Phase)

**Description**: The newly hatched Blobbi enters a special post-hatch phase requiring continued daily care before becoming a full adult.

**State Event**: Kind `31124` with `stage` tag set to "baby"
**Hatching Record**: Kind `14920` containing hatching milestone and revealed traits
**Interactions**: Kind `14919` for care actions (feeding, playing, cleaning, etc.)

**Post-Hatch Phase Requirements** (for Blobbis hatched from eggs):
- **Duration**: 10 days minimum since hatching
- **Daily Care Cap**: Care points are still capped daily (configurable per implementation)
- **Health Penalty**: If health drops below 50%, one penalty day is added to the required duration
- **Completion**: After 10 days (plus any penalty days), the Blobbi becomes a full adult

**Standard Evolution Conditions** (for directly adopted Blobbis):
- Minimum age: 7 days since adoption
- Care score: ≥ 150 points
- At least 50 interaction events
- Happiness level: ≥ 70%
- Health level: ≥ 80%

**Care Requirements**:
- Feeding every 4-6 hours
- Play sessions (3-4 times daily)
- Cleaning when hygiene < 50%
- Rest periods (8-10 hours daily)
- Medical attention when sick
- Daily care point tracking (for post-hatch phase)

### Adult Stage

**Description**: The fully evolved Blobbi with established personality traits and advanced interaction capabilities.

**State Event**: Kind `31124` with `stage` tag set to "adult"
**Evolution Record**: Kind `14920` containing evolution milestone and final form details
**Interactions**: Kind `14919` for advanced care and social interactions

**Evolution Conditions**:
- This is the final stage (no further evolution)

**Care Requirements**:
- Feeding every 8-12 hours
- Play sessions (1-2 times daily)
- Cleaning when hygiene < 30%
- Rest periods (6-8 hours daily)
- Social interactions with other Blobbi

## Interaction Events

**Kind**: `14919` (Blobbi Interaction Event)

Interaction events modify the Blobbi's status attributes and contribute to evolution requirements. Each interaction generates a new event that is processed to update the current state (Kind 31124).

### Interaction Types and Effects

| Action | Hunger | Happiness | Health | Hygiene | Energy |
|--------|--------|-----------|---------|----------|---------|
| Feed   | +30    | +10       | +5      | -5       | +10     |
| Play   | -10    | +25       | +5      | -10      | -20     |
| Clean  | 0      | +5        | +10     | +40      | -5      |
| Rest   | -5     | 0         | +15     | 0        | +30     |
| Medicine | 0    | -10       | +30     | 0        | -5      |
| Pet    | 0      | +15       | +5      | 0        | -5      |

**Note**: Care points for egg and post-hatch phases are tracked separately from these stat effects. Each interaction type awards different care point values during these phases, with daily caps enforced.

## Event Formats

### Kind 31124: Blobbi Current State (Replaceable)

This replaceable event contains the current state of the Blobbi. The `d` tag contains the unique Blobbi identifier.

```json
{
  "id": "a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890",
  "pubkey": "f7e3b1d8a0c4e9f6b2d1a2e6f3c8d7b1c9a3b0d5e2f1c8a7b6d4e3a2f1c9e7d6",
  "created_at": 1717087000,
  "kind": 31124,
  "tags": [
    ["d", "b-a7f1c2e8d3b9f6c1"],
    ["stage", "baby"],
    ["generation", "1"],
    ["hunger", "75"],
    ["happiness", "85"],
    ["health", "90"],
    ["hygiene", "60"],
    ["energy", "70"],
    ["experience", "150"],
    ["care_streak", "5"],
    ["evolution_progress", "3"],
    ["evolution_required", "4"],
    ["base_color", "#9999ff"],
    ["secondary_color", "#ccccff"],
    ["pattern", "gradient"],
    ["eye_color", "#6633cc"],
    ["personality", "playful"],
    ["personality", "curious"],
    ["trait", "fast_learner"],
    ["trait", "social"],
    ["size", "small"],
    ["shape", "round"],
    ["special_mark", "star_forehead"],
    ["voice_type", "chirpy"],
    ["favorite_food", "starberries"],
    ["last_fed", "1717086000"],
    ["last_played", "1717085000"],
    ["last_cleaned", "1717084000"],
    ["mood", "happy"],
    ["activity_state", "playing"]
  ],
  "content": "Current state of Fluffy the baby Blobbi. Playful and curious, with sparkling purple eyes and a star-shaped mark on its forehead. Currently happy and energetic!",
  "sig": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855f4e1c80a1b3a7f1fddc3b342e56789ab75d8f3dabe1c2b934cf2e56789a7c3210"
}
```

### Kind 14920: Blobbi Birth Record (Immutable)

This event records the permanent birth/adoption information of a Blobbi.

```json
{
  "id": "b2c3d4e5f67890123456789012345678901234567890123456789012345678901",
  "pubkey": "f7e3b1d8a0c4e9f6b2d1a2e6f3c8d7b1c9a3b0d5e2f1c8a7b6d4e3a2f1c9e7d6",
  "created_at": 1717000000,
  "kind": 14920,
  "tags": [
    ["blobbi_id", "b-a7f1c2e8d3b9f6c1"],
    ["record_type", "birth"],
    ["generation", "1"],
    ["origin", "wild"],
    ["birth_location", "enchanted_grove"],
    ["weather_at_birth", "misty_morning"],
    ["shell_color", "#ccccff"],
    ["shell_pattern", "speckled"],
    ["initial_trait", "warm"],
    ["initial_trait", "quiet"],
    ["initial_trait", "mysterious"],
    ["rarity", "uncommon"],
    ["parent_1", "b-d9e8f7c6b5a4"],
    ["parent_2", "b-c8b7a6d5e4f3"],
    ["lineage_depth", "3"],
    ["genetic_marker", "stellar_line"],
    ["birth_season", "spring"],
    ["birth_moon_phase", "new_moon"],
    ["creator", "f7e3b1d8a0c4e9f6b2d1a2e6f3c8d7b1c9a3b0d5e2f1c8a7b6d4e3a2f1c9e7d6"],
    ["design_url", "https://github.com/blobbi-project/designs/egg-v1"],
    ["adopted_from", "BlobbiWorld/1.0.0"],
    ["adoption_fee", "1000"]
  ],
  "content": "Birth record: A mysterious Blobbi egg has been adopted from the wild! 🌿🥚 This speckled egg radiates a gentle warmth and occasionally trembles with life. Born under a new moon in the enchanted grove during a misty spring morning.",
  "sig": "f4e1c80a1b3a7f1fddc3b342e56789ab75d8f3dabe1c2b934cf2e56789a7c3210e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

### Kind 14920: Blobbi Evolution Record (Immutable)

This event records a permanent evolution milestone.

```json
{
  "id": "c3d4e5f678901234567890123456789012345678901234567890123456789012",
  "pubkey": "f7e3b1d8a0c4e9f6b2d1a2e6f3c8d7b1c9a3b0d5e2f1c8a7b6d4e3a2f1c9e7d6",
  "created_at": 1717691200,
  "kind": 14920,
  "tags": [
    ["blobbi_id", "b-a7f1c2e8d3b9f6c1"],
    ["record_type", "evolution"],
    ["e", "b2c3d4e5f67890123456789012345678901234567890123456789012345678901", "wss://relay.example.com", "reply"],
    ["evolution_from", "baby"],
    ["evolution_to", "adult"],
    ["evolved_at", "1717691200"],
    ["evolution_duration", "604800"],
    ["evolution_type", "natural"],
    ["final_form", "celestial_guardian"],
    ["care_days_completed", "7"],
    ["total_interactions", "156"],
    ["evolution_trigger", "care_milestone"],
    ["primary_color", "#6666ff"],
    ["secondary_color", "#9999ff"],
    ["tertiary_color", "#ccccff"],
    ["pattern", "cosmic_swirl"],
    ["size", "medium"],
    ["wingspan", "large"],
    ["special_ability", "starlight_dash"],
    ["special_ability", "healing_aura"],
    ["passive_trait", "night_vision"],
    ["passive_trait", "weather_sense"],
    ["achievement", "perfect_care_week"],
    ["achievement", "social_butterfly"],
    ["title_earned", "Star Guardian"],
    ["design_url", "https://github.com/blobbi-project/designs/adult-celestial-v1"],
    ["animation_set", "majestic_float"],
    ["sound_pack", "celestial_harmonies"],
    ["legacy_trait", "stellar_offspring"]
  ],
  "content": "Evolution milestone: Fluffy has transformed into a magnificent Celestial Guardian! ✨ After 7 days of dedicated care and 156 interactions, this baby Blobbi evolved into its final form with cosmic swirls and starlight abilities. Now bearing the title of Star Guardian, it watches over other Blobbi with wisdom and grace.",
  "sig": "1b3a7f1fddc3b342e56789ab75d8f3dabe1c2b934cf2e56789a7c3210e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855f4e1c80a"
}
```

### Kind 14919: Blobbi Interaction Event

This event records individual interactions with the Blobbi.

```json
{
  "id": "d4e5f6789012345678901234567890123456789012345678901234567890123",
  "pubkey": "f7e3b1d8a0c4e9f6b2d1a2e6f3c8d7b1c9a3b0d5e2f1c8a7b6d4e3a2f1c9e7d6",
  "created_at": 1717087000,
  "kind": 14919,
  "tags": [
    ["blobbi_id", "b-a7f1c2e8d3b9f6c1"],
    ["action", "feed"],
    ["action_category", "care"],
    ["item_used", "premium_starberries"],
    ["item_quality", "excellent"],
    ["location", "home_garden"],
    ["weather", "sunny"],
    ["time_of_day", "morning"],
    ["blobbi_mood_before", "hungry"],
    ["blobbi_mood_after", "satisfied"],
    ["animation_played", "happy_eating"],
    ["sound_played", "nom_nom_delighted"],
    ["stat_change", "hunger", "+35"],
    ["stat_change", "happiness", "+15"],
    ["stat_change", "health", "+8"],
    ["stat_change", "energy", "+12"],
    ["bonus_applied", "favorite_food_bonus"],
    ["experience_gained", "10"],
    ["care_streak", "5"],
    ["achievement_progress", "gourmet_chef", "15/50"],
    ["companion_reaction", "b-d9e8f7c6b5a4", "jealous"],
    ["special_event", "discovered_new_flavor"],
    ["memory_created", "first_starberry_feast"]
  ],
  "content": "🍇 Fed premium starberries to Fluffy! The baby Blobbi's eyes lit up with delight as it savored its favorite food. It performed a happy dance and chirped melodiously. The morning sunshine made the berries extra sweet! Fluffy discovered a new flavor combination and will remember this special meal.",
  "sig": "298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855f4e1c80a1b3a7f1fddc3b342e56789ab75d8f3dabe1c2b934cf2e56789a7c3210e3b0c44"
}
```

## Additional Interaction Examples

### Play Interaction

```json
{
  "id": "e5f67890123456789012345678901234567890123456789012345678901234",
  "pubkey": "f7e3b1d8a0c4e9f6b2d1a2e6f3c8d7b1c9a3b0d5e2f1c8a7b6d4e3a2f1c9e7d6",
  "created_at": 1717090600,
  "kind": 14919,
  "tags": [
    ["blobbi_id", "b-a7f1c2e8d3b9f6c1"],
    ["e", "b2c3d4e5f67890123456789012345678901234567890123456789012345678901", "wss://relay.example.com", "reply"],
    ["action", "play"],
    ["action_category", "enrichment"],
    ["game_type", "cosmic_catch"],
    ["toy_used", "glowing_orb"],
    ["play_duration", "900"],
    ["location", "starlight_meadow"],
    ["play_partner", "b-d9e8f7c6b5a4"],
    ["stat_change", "happiness", "+30"],
    ["stat_change", "energy", "-25"],
    ["stat_change", "hunger", "-15"],
    ["skill_improved", "agility", "+2"],
    ["bond_increased", "b-d9e8f7c6b5a4", "+5"],
    ["achievement_unlocked", "first_friend"],
    ["new_move_learned", "spiral_jump"]
  ],
  "content": "🎮 Played cosmic catch with Fluffy and their friend Sparkle! The two Blobbi bounced and spiraled through the air, chasing the glowing orb. Fluffy learned a new spiral jump move and strengthened their friendship bond!",
  "sig": "3b342e56789ab75d8f3dabe1c2b934cf2e56789a7c3210e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855f4e1c80a1b3a7f1fddc"
}
```

### Clean Interaction

```json
{
  "id": "f67890123456789012345678901234567890123456789012345678901234567",
  "pubkey": "f7e3b1d8a0c4e9f6b2d1a2e6f3c8d7b1c9a3b0d5e2f1c8a7b6d4e3a2f1c9e7d6",
  "created_at": 1717094200,
  "kind": 14919,
  "tags": [
    ["blobbi_id", "b-a7f1c2e8d3b9f6c1"],
    ["e", "b2c3d4e5f67890123456789012345678901234567890123456789012345678901", "wss://relay.example.com", "reply"],
    ["action", "clean"],
    ["action_category", "hygiene"],
    ["cleaning_type", "bubble_bath"],
    ["water_temperature", "warm"],
    ["soap_used", "lavender_bubbles"],
    ["grooming_tool", "soft_brush"],
    ["stat_change", "hygiene", "+45"],
    ["stat_change", "happiness", "+8"],
    ["stat_change", "health", "+12"],
    ["special_effect", "sparkly_clean"],
    ["scent_applied", "lavender_dreams"],
    ["mood_boost", "relaxed"]
  ],
  "content": "🛁 Gave Fluffy a luxurious bubble bath! The baby Blobbi splashed playfully in the warm lavender bubbles. Now sparkling clean with a lovely scent, Fluffy feels refreshed and relaxed.",
  "sig": "4c8996fb92427ae41e4649b934ca495991b7852b855f4e1c80a1b3a7f1fddc3b342e56789ab75d8f3dabe1c2b934cf2e56789a7c3210e3b0c44298fc1c149afbf"
}
```

### Rest Interaction

```json
{
  "id": "078901234567890123456789012345678901234567890123456789012345678",
  "pubkey": "f7e3b1d8a0c4e9f6b2d1a2e6f3c8d7b1c9a3b0d5e2f1c8a7b6d4e3a2f1c9e7d6",
  "created_at": 1717108800,
  "kind": 14919,
  "tags": [
    ["blobbi_id", "b-a7f1c2e8d3b9f6c1"],
    ["e", "b2c3d4e5f67890123456789012345678901234567890123456789012345678901", "wss://relay.example.com", "reply"],
    ["action", "rest"],
    ["action_category", "recovery"],
    ["rest_type", "deep_sleep"],
    ["bed_type", "cloud_nest"],
    ["lullaby_played", "stellar_symphony"],
    ["sleep_duration", "28800"],
    ["dream_type", "adventure"],
    ["stat_change", "energy", "+40"],
    ["stat_change", "health", "+20"],
    ["stat_change", "happiness", "+5"],
    ["growth_bonus", "+2"],
    ["dream_memory", "flying_through_stars"]
  ],
  "content": "😴 Tucked Fluffy into their cozy cloud nest for a deep sleep. Soft stellar symphonies played as they drifted off to dreamland. Fluffy dreamed of flying through stars and woke up fully refreshed!",
  "sig": "5dabe1c2b934cf2e56789a7c3210e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855f4e1c80a1b3a7f1fddc3b342e56789ab75d8f3"
}
```

## Tag Specifications

### Common Tags for All Events

- `blobbi_id`: Unique identifier for the Blobbi (format: "b-[16 char hex]")
- `e`: References to related events (birth records, evolution records, etc.)
- `generation`: Breeding generation number

### Kind 31124 (Current State) Tags

- `d`: Unique identifier for the Blobbi (same as blobbi_id, required for replaceable events)
- `stage`: Current lifecycle stage ("egg", "baby", "adult")
- `hunger`, `happiness`, `health`, `hygiene`, `energy`: Current stat values (0-100)
- `experience`: Total experience points earned
- `care_streak`: Current consecutive care days
- `evolution_progress`: Days of care completed toward evolution
- `evolution_required`: Total days of care required for evolution
- `base_color`, `secondary_color`, `tertiary_color`: Color attributes
- `pattern`: Visual pattern type
- `personality`: Personality traits (multiple allowed)
- `trait`: Active traits (multiple allowed)
- `size`, `shape`: Physical characteristics
- `special_mark`: Unique identifying features
- `mood`: Current emotional state
- `activity_state`: Current activity ("sleeping", "playing", "eating", etc.)
- `last_fed`, `last_played`, `last_cleaned`: Timestamps of last care actions

### Kind 14920 (Records) Tags

#### Birth Records
- `record_type`: Set to "birth" for birth/adoption records
- `origin`: Source of the Blobbi ("wild", "bred", "gift", "special_event")
- `birth_location`: Where the Blobbi was born/found
- `weather_at_birth`: Weather conditions at birth
- `shell_color`, `shell_pattern`: Egg appearance (for egg stage)
- `initial_trait`: Starting traits (multiple allowed)
- `rarity`: Rarity classification
- `parent_1`, `parent_2`: Parent Blobbi IDs (for bred Blobbis)
- `lineage_depth`: Generations from original wild Blobbi
- `genetic_marker`: Lineage family identifier
- `creator`: The pubkey of the Blobbi owner
- `adopted_from`: Client name and version that generated the event

#### Evolution Records
- `record_type`: Set to "evolution" for evolution milestones
- `evolution_from`: Previous stage
- `evolution_to`: New stage
- `evolved_at`: Timestamp of evolution
- `evolution_duration`: Time spent in previous stage
- `evolution_type`: Type of evolution ("natural", "special", "forced")
- `final_form`: The specific adult variant achieved (for adult evolution)
- `care_days_completed`: Total care days that triggered evolution
- `total_interactions`: Total interactions during previous stage
- `evolution_trigger`: What caused the evolution
- `special_ability`: New abilities gained (multiple allowed)
- `passive_trait`: New passive traits (multiple allowed)
- `achievement`: Achievements unlocked during evolution (multiple allowed)
- `title_earned`: Special titles earned
- `legacy_trait`: Traits that can be passed to offspring

### Kind 14919 (Interactions) Tags

- `action`: The interaction type performed ("feed", "play", "clean", "rest", etc.)
- `action_category`: Category of action ("care", "enrichment", "hygiene", "recovery")
- `stat_change`: Format: ["stat_change", "stat_name", "modifier"]
- `item_used`: Specific item used in the interaction
- `item_quality`: Quality of item used
- `location`: Where the interaction took place
- `weather`: Weather conditions during interaction
- `time_of_day`: Time period of interaction
- `blobbi_mood_before`, `blobbi_mood_after`: Emotional state changes
- `animation_played`: Animation triggered by interaction
- `sound_played`: Sound effect played
- `bonus_applied`: Special bonuses that applied
- `experience_gained`: Experience points earned
- `care_streak`: Current care streak after interaction
- `achievement_progress`: Progress toward achievements
- `companion_reaction`: Reactions from other Blobbis
- `special_event`: Special events triggered
- `memory_created`: New memories formed

## Implementation Considerations

1. **State Management**: 
   - Clients should query for the most recent Kind 31124 event to get current Blobbi state
   - Process Kind 14919 interaction events since the last state update to calculate current stats
   - Use Kind 14920 records for historical information and lineage tracking
   - State updates should be published as new Kind 31124 events when significant changes occur

2. **Event Processing Order**:
   - Birth records (Kind 14920 with record_type "birth") establish the Blobbi
   - Interaction events (Kind 14919) modify state and trigger evolution checks
   - Evolution records (Kind 14920 with record_type "evolution") mark permanent milestones
   - Current state events (Kind 31124) reflect the latest calculated state

3. **Time-based Degradation**: Stats should decrease over time based on last interaction timestamp:
   - Hunger: -5 per hour
   - Happiness: -3 per hour
   - Hygiene: -2 per hour
   - Energy: -4 per hour (except during rest periods)
   - State should be recalculated and published periodically

4. **Validation Rules**:
   - Stats must remain within 0-100 range
   - Interaction events must reference valid Blobbi IDs
   - Evolution can only occur when all conditions are met
   - Each Blobbi ID must be unique per user (enforced by `d` tag in Kind 31124)
   - Record events (Kind 14920) are immutable and should never be deleted

5. **Query Patterns**:
   - Current state: Query Kind 31124 with specific `d` tag
   - Interaction history: Query Kind 14919 with specific `blobbi_id` tag
   - Life records: Query Kind 14920 with specific `blobbi_id` tag
   - All user Blobbis: Query Kind 31124 by author pubkey

6. **Client Features**:
   - Visual representation of current stage and stats
   - Notification system for care reminders
   - Achievement tracking for milestones
   - Social features for Blobbi interactions
   - Lineage browser using birth and evolution records
   - Historical timeline of major milestones

## Security Considerations

- Clients must verify event signatures and timestamps
- Rate limiting should prevent interaction spam
- State calculations must be deterministic across clients
- Private Blobbi data can be encrypted using NIP-04 or NIP-44

## References

- NIP-01: Basic protocol flow description
- NIP-33: Parameterized Replaceable Events (used for Kind 31124)
- NIP-78: Application-specific data
- NIP-16: Event Treatment (regular events for interactions and records)