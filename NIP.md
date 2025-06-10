# NIP-BB: Blobbi Virtual Pet Events

`draft` `optional`

This NIP defines event kinds for managing virtual pets called "Blobbi" on Nostr.

## Event Kinds

- **Kind 31124**: Current pet state (replaceable)
- **Kind 14919**: Pet interactions (regular)
- **Kind 14920**: Pet breeding (regular)
- **Kind 14921**: Pet records (regular, immutable)
- **Kind 31125**: Owner profile (replaceable)

## Pet Lifecycle

Blobbi pets have three stages: **egg** → **baby** → **adult**

### Egg Stage
- Requires daily care for 4+ days to hatch
- Care actions: warm, clean, check, sing, talk
- Each action gives care points (max 10 per day)
- Need 40+ total care points to hatch

### Baby Stage
- Newly hatched pets need 10 days of care
- Care actions: feed, play, clean, rest
- Stats: hunger, happiness, health, hygiene, energy (0-100)

### Adult Stage
- Fully evolved pets with established traits
- Lower maintenance requirements
- Can breed with other adults

## Event Examples

### Kind 31124: Pet State

```json
{
  "kind": 31124,
  "tags": [
    ["d", "blobbi-fluffy"],
    ["stage", "baby"],
    ["breeding_ready", "false"],
    ["generation", "1"],
    ["hunger", "75"],
    ["happiness", "85"],
    ["health", "90"],
    ["hygiene", "60"],
    ["energy", "70"],
    ["experience", "150"],
    ["care_streak", "3"],
    ["base_color", "#7C3AED"],
    ["eye_color", "blue"],
    ["mood", "happy"],
    ["last_interaction", "1703123456"]
  ],
  "content": "Fluffy is a happy baby Blobbi"
}
```

### Kind 14919: Interaction

```json
{
  "kind": 14919,
  "tags": [
    ["blobbi_id", "blobbi-fluffy"],
    ["action", "feed"],
    ["action_category", "care"],
    ["stat_change", "hunger:+30"],
    ["item_used", "berry"],
    ["experience_gained", "5"],
    ["care_points", "2"],
    ["blobbi_mood_before", "hungry"],
    ["blobbi_mood_after", "happy"]
  ],
  "content": "Fed Fluffy some berries"
}
```

### Kind 14920: Breeding

```json
{
  "kind": 14920,
  "tags": [
    ["parent_a", "blobbi-fluffy"],
    ["parent_b", "blobbi-sparkle"],
    ["owner_a", "npub1..."],
    ["owner_b", "npub2..."],
    ["breed_time", "2024-01-15T10:30:00Z"],
    ["success", "true"],
    ["offspring_id", "blobbi-baby"]
  ],
  "content": "New Blobbi born from Fluffy and Sparkle"
}
```

### Kind 14921: Record

```json
{
  "kind": 14921,
  "tags": [
    ["blobbi_id", "blobbi-fluffy"],
    ["record_type", "birth"],
    ["generation", "1"],
    ["origin", "wild"],
    ["rarity", "uncommon"],
    ["birth_location", "enchanted_grove"],
    ["weather_at_birth", "clear_sky"],
    ["shell_color", "purple"],
    ["initial_trait", "curious"],
    ["initial_trait", "playful"]
  ],
  "content": "Fluffy was adopted from the wild"
}
```

### Kind 31125: Owner Profile

```json
{
  "kind": 31125,
  "tags": [
    ["d", "blobbanaut-profile"],
    ["name", "BlobbiMaster"],
    ["coins", "2500"],
    ["pettingLevel", "15"],
    ["lifetimeBlobbis", "3"],
    ["favoriteBlobbi", "blobbi-fluffy"],
    ["starterBlobbi", "blobbi-sparkle"],
    ["has", "blobbi-fluffy"],
    ["has", "blobbi-sparkle"],
    ["achievements", "first_adoption"],
    ["achievements", "care_master"],
    ["welcome_mission", "claimed"],
    ["storage", "berry:5"],
    ["storage", "toy_ball:2"]
  ],
  "content": ""
}
```

## Key Tags

### Kind 31124 (Pet State)

**Required Tags:**
- `d`: Pet ID (required)
- `stage`: "egg", "baby", or "adult"
- `breeding_ready`: "true" or "false"
- `generation`: Generation number
- `hunger`, `happiness`, `health`, `hygiene`, `energy`: 0-100
- `experience`: Total XP earned
- `care_streak`: Consecutive care days

**Optional Appearance Tags:**
- `base_color`: Primary color
- `secondary_color`: Secondary color
- `pattern`: Visual pattern
- `eye_color`: Eye color
- `special_mark`: Special markings
- `adult_type`: Evolution form for adults
- `manifestation`: Special manifestation
- `visual_effect`: Visual effects
- `blessing`: Special blessing

**Optional Personality Tags:**
- `personality`: Personality traits (multiple)
- `trait`: Character traits (multiple)
- `mood`: Current mood
- `favorite_food`: Preferred food
- `voice_type`: Voice characteristics
- `size`: Physical size
- `title`: Special title
- `skill`: Special skills

**Optional Egg-Specific Tags (only for stage="egg"):**
- `incubation_time`: Time spent incubating
- `incubation_progress`: Progress percentage
- `egg_temperature`: Temperature 0-100
- `egg_status`: Current egg status
- `shell_integrity`: Shell condition 0-100

**Optional Behavior Tags:**
- `is_sleeping`: "true" or "false"
- `is_dirty`: "true" or "false"
- `has_buff`: Active buff
- `has_debuff`: Active debuff
- `last_interaction`: Unix timestamp

**Optional Care Tracking Tags:**
- `last_meal`: Unix timestamp of last feeding
- `last_clean`: Unix timestamp of last cleaning
- `last_warm`: Unix timestamp of last warming
- `last_talk`: Unix timestamp of last talk
- `last_check`: Unix timestamp of last check
- `last_sing`: Unix timestamp of last singing
- `last_medicine`: Unix timestamp of last medicine

**Optional Social Tags:**
- `adopted_by`: Adopter pubkey
- `adopted_from`: Previous owner
- `current_location`: Current location
- `in_party`: "true" or "false"
- `visible_to_others`: "true" or "false"

**Optional Special Tags:**
- `fees`: Adoption fees
- `penalty`: Penalty type
- `value`: Penalty value
- `care_points_deducted`: Care points lost

### Kind 14919 (Interactions)

**Required Tags:**
- `blobbi_id`: Pet ID
- `action`: "feed", "play", "clean", "rest", "warm", "check", "sing", "talk", "medicine", "cruzar"
- `action_category`: Category of action
- `stat_change`: "stat_name:+/-value" (multiple allowed)

**Optional Item Tags:**
- `item_used`: Item identifier
- `item_quality`: Item quality level
- `time_of_day`: Time when action occurred

**Optional Mood Tags:**
- `blobbi_mood_before`: Mood before interaction
- `blobbi_mood_after`: Mood after interaction

**Optional Effect Tags:**
- `animation_played`: Animation identifier
- `sound_played`: Sound identifier
- `bonus_applied`: Bonus type
- `experience_gained`: XP gained
- `care_streak`: Current care streak
- `care_points`: Care points earned
- `achievement_progress`: "achievement:progress"
- `achievement_unlocked`: Achievement identifier
- `special_event`: Special event triggered
- `memory_created`: Memory identifier

**Optional Play-Specific Tags:**
- `game_type`: Type of game played
- `toy_used`: Toy identifier
- `play_duration`: Duration in minutes
- `location`: Play location
- `play_partner`: Partner identifier
- `skill_improved`: "skill:amount"
- `bond_increased`: "bond_type:amount"
- `new_move_learned`: New move learned

**Optional Clean-Specific Tags:**
- `cleaning_type`: Type of cleaning
- `water_temperature`: Water temperature
- `soap_used`: Soap type
- `grooming_tool`: Tool used
- `special_effect`: Special effect
- `scent_applied`: Scent applied
- `mood_boost`: Mood improvement

**Optional Rest-Specific Tags:**
- `rest_type`: Type of rest
- `bed_type`: Bed type used
- `lullaby_played`: Lullaby identifier
- `sleep_duration`: Sleep duration
- `dream_type`: Dream type
- `growth_bonus`: Growth bonus
- `dream_memory`: Dream memory

**Optional Social Tags:**
- `social_role`: "role:value"
- `interaction_quality`: Quality rating
- `emotion_triggered`: Emotion type
- `shared_memory`: Shared memory
- `interaction_context`: Context information

### Kind 14920 (Breeding)

**Required Tags:**
- `parent_a`, `parent_b`: Parent pet IDs
- `owner_a`, `owner_b`: Owner pubkeys
- `breed_time`: ISO timestamp
- `success`: "true" or "false"

**Optional Tags:**
- `offspring_id`: New pet ID (if successful)

### Kind 14921 (Records)

**Required Tags:**
- `blobbi_id`: Pet ID
- `record_type`: "birth", "hatched", "evolution", "adoption", "memory"

**Optional Common Tags:**
- `generation`: Generation number

**Birth Record Tags:**
- `origin`: Origin type
- `birth_location`: Birth location
- `weather_at_birth`: Weather conditions
- `shell_color`: Shell color
- `shell_pattern`: Shell pattern
- `initial_trait`: Initial traits (multiple)
- `rarity`: Rarity level
- `parent_1`, `parent_2`: Parent IDs
- `lineage_depth`: Lineage depth
- `genetic_marker`: Genetic markers
- `birth_season`: Birth season
- `birth_moon_phase`: Moon phase
- `creator`: Creator pubkey
- `design_url`: Design URL
- `adoption_fee`: Adoption fee
- `legacy_trait`: Legacy traits (multiple)
- `passive_trait`: Passive traits (multiple)
- `evolved_from`: Evolution source
- `hatch_fee`: Hatching fee
- `evolution_stage`: Evolution stage

**Hatched Record Tags:**
- `hatched_at`: ISO timestamp
- `hatched_by`: Hatcher pubkey
- `egg_type`: Egg type
- `incubation_time`: Incubation duration
- `eye_color`: Eye color
- `base_color`: Base color
- `pattern`: Pattern
- `secondary_color`: Secondary color
- `manifestation`: Manifestation
- `title`: Title
- `title_reason`: Title reason
- `blessing`: Blessing
- `memory_title`: Memory title
- `memory_description`: Memory description
- `memory_date`: Memory date
- `passive_trait`: Passive traits (multiple)

**Adoption Record Tags:**
- `adopted_by`: Adopter pubkey
- `adopted_on`: ISO timestamp
- `adoption_method`: Adoption method
- `title`: Title
- `title_reason`: Title reason

**Evolution Record Tags:**
- `evolution_stage`: New stage
- `evolution_reason`: Evolution reason
- `evolved_from`: Previous form

**Memory Record Tags:**
- `memory_title`: Memory title
- `memory_description`: Memory description
- `memory_date`: Memory date
- `discovered_trait`: Discovered trait
- `achievement`: Achievement
- `milestone`: Milestone

### Kind 31125 (Owner Profile)

**Required Tags:**
- `d`: Profile ID (required)
- `name`: Display name (can be empty)

**Optional Tags:**
- `coins`: Currency amount
- `pettingLevel`: Interaction level
- `lifetimeBlobbis`: Total Blobbis owned
- `favoriteBlobbi`: Favorite Blobbi ID
- `starterBlobbi`: First Blobbi ID
- `style`: Aesthetic style
- `background`: Background theme
- `title`: Custom title
- `has`: Owned pet IDs (multiple)
- `achievements`: Achievement IDs (multiple)
- `welcome_mission`: "unclaimed" or "claimed"
- `storage`: "item_id:quantity" format (multiple)

## Implementation Notes

1. Query Kind 31124 for current pet state
2. Process Kind 14919 events to update stats
3. Use Kind 14921 for permanent history
4. Stats decay over time without care
5. All pet IDs use format: "blobbi-{name}"