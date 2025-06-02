nsec para teste: nsec1r2e7qve8x4wxfyl6xvdtet0emwpvpjldyelaxrw89vf55j8n7qdqks8tw5


# NIP-BB: Blobbi Virtual Pet Lifecycle Events

`draft` `optional`

This NIP defines event kinds `31124`, `14919`, `14920`, and `14921` for managing virtual pet (Blobbi) lifecycle stages, structured interactions, and permanent records on Nostr.

## Abstract

This specification describes a system for creating, managing, and interacting with virtual pets called **Blobbi** on the Nostr network. Blobbi pets progress through three distinct life stages (`egg`, `baby`, and `adult`), each with unique care requirements and interaction possibilities.

The system introduces four event kinds:
- A **replaceable** event (`31124`) for tracking the Blobbi's current state
- **Regular** events (`14919`) for logging user interactions
- A **structured event schema** (`14920`) for interaction metadata
- **Immutable** events (`14921`) for recording permanent milestones and lineage

## Motivation

Virtual pets provide an engaging and playful way for users to interact on Nostr beyond traditional social messaging. By standardizing Blobbi lifecycle events, we enable:

- Cross-client compatibility for virtual pet experiences
- Persistent state across different applications and sessions
- Social interaction through shared care and evolution moments
- Gamification features to encourage regular platform engagement
- Immutable historical records for milestones, evolution, and genealogy
- Real-time updates with efficient querying using replaceable events
- Structured metadata to support analytics, badges, and care history tracking

## Event Structure

The Blobbi system uses three distinct event kinds to manage different aspects of virtual pet lifecycle:

---

### Kind 31124: Blobbi Current State (Addressable)
This addressable event contains the **current state** of a Blobbi, including:

- Current lifecycle stage (`egg`, `baby`, `adult`)
- Stats: `hunger`, `happiness`, `health`, `hygiene`, `energy`
- Evolution progress and current requirements
- Active traits and abilities
- Current appearance and characteristics

> 🔄 This event is **replaced** every time the Blobbi's state changes through interaction, passage of time, or evolution.

Clients should query for the **latest** event of this kind to retrieve the **current** status of a Blobbi.

---

### Kind 14919: Blobbi Interactions (Regular)
This regular event represents an individual **interaction** between the user and their Blobbi. Examples of interactions include:

- Feeding (`feed`)
- Playing (`play`)
- Cleaning (`clean`)
- Resting (`rest`)
- Medical care, grooming
- Training, skill development
- Social interactions (with other Blobbi)

Each interaction generates a **new immutable event** that can be used to:

- Track care history
- Calculate stat changes
- Identify care patterns
- Progress achievements

See the unified interaction table for detailed event structure.

---

### Kind 14920: Blobbi Interaction Event Schema (Structured Log)
This kind defines a **structured log format** for all types of **Blobbi interactions**, unifying them under a consistent schema.

#### Common Fields:
- `action`: Type of interaction (`feed`, `play`, `clean`, `rest`, etc.)
- `stat_change`: Affected stat and value (e.g., `["happiness", "+30"]`)
- `timestamp`: When the interaction occurred

#### Optional Interaction-Specific Fields:
- Feeding: `item_used`, `bonus_applied`, `experience_gained`, etc.
- Playing: `game_type`, `skill_improved`, `bond_increased`, etc.
- Cleaning: `cleaning_type`, `soap_used`, `mood_boost`, etc.
- Resting: `rest_type`, `sleep_duration`, `dream_type`, etc.

This schema supports rich interaction tracking for analytics, achievements, and care progression.  
🔁 **Each entry is a regular event.**

> See full interaction schema in the "🎮 Interaction Event" table.

---

### Kind 14921: Blobbi Records (Regular, Immutable)
These are **immutable historical records** capturing key moments and lineage:

- Birth or adoption record (timestamp, assigned ID)
- Parent lineage and genetic traits
- Initial traits and baseline stats
- Evolution milestones and transformations
- Major achievements and earned titles
- Unique life events (e.g., "first word", "first festival")

Once published, these records **cannot be edited or replaced**, and they form the **permanent biography** of a Blobbi.

---

## Lifecycle Stages

### Egg Stage

**Description**: The initial stage when a user adopts a Blobbi. The egg requires consistent daily care over multiple days to prepare for hatching.

**State Event**: Kind `31124` with `stage` tag set to "egg"
**Birth Record**: Kind `14921` containing adoption/birth information
**Interactions**: Kind `14919` for care actions (warming, cleaning, checking, etc.)

**Hatching Requirements**:
- **Duration**: 4 full real days minimum since adoption
- **Care Points**: At least 40 total care points required
- **Daily Care Cap**: Maximum 10 care points can be earned per day
- **Distinct Care Days**: Must provide care on at least 4 different days
- **Health Penalty**:  If egg health drops below 50%, 5 care points are deducted.

**Care Mechanics**:
- Care points are earned through various interaction types (warming, cleaning, checking, singing, talking)
- Each interaction type provides different care point values
- Maximum daily care is 10 points to ensure consistent multi-day engagement
- The 4-day requirement ensures eggs cannot be rushed to hatching

**Care Requirements**:
- Temperature regulation (keep warmth above 70%, if it drops below, health will decrease)
- Regular cleaning (maintain cleanliness above 70%,  if it drops below, health will decrease)
- Emotional bonding (talk to your pet or play music to keep it happy and reduce stress, if it drops below 70%, health will decrease)
- Health monitoring (keep health above 50% to avoid penalties)
- Daily interactions to earn care points

### Baby Stage (Post-Hatch Phase)

**Description**: The newly hatched Blobbi enters a special post-hatch phase requiring continued daily care before becoming a full adult.

**State Event**: Kind `31124` with `stage` tag set to "baby"
**Hatching Record**: Kind `14921` containing hatching milestone and revealed traits
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
**Evolution Record**: Kind `14921` containing evolution milestone and final form details
**Interactions**: Kind `14919` for advanced care and social interactions
**Breeding Event**: Kind `14920` for cross-breeding with another adult Blobbi

**Evolution Conditions**:
- This is the final stage (no further evolution)

**Care Requirements**:
- Feeding every 8-12 hours
- Play sessions (1-2 times daily)
- Cleaning when hygiene < 30%
- Rest periods (6-8 hours daily)
- Social interactions with other Blobbi

---

## Event Formats

### Kind 31124: Blobbi Current State (Replaceable)

This replaceable event contains the current state of the Blobbi. The `d` tag contains the unique Blobbi identifier.

### Event Tag Reference

| Tag                   | Description                              | Required | Example Value                        |
|-----------------------|------------------------------------------|----------|--------------------------------------|
| `d`                   | Unique Blobbi ID                         | ✅ Yes   | `blobbi-abc123`                      |
| `stage`               | Current life stage (egg, baby, adult…)   | ✅ Yes   | `egg`                                |
| `breeding_ready`      | Whether the Blobbi is ready to breed     | ✅ Yes   | `false`                              |
| `generation`          | Generation number                        | ✅ Yes   | `1`                                  |
| `hunger`              | Hunger level (0–100)                     | ✅ Yes   | `75`                                 |
| `happiness`           | Happiness level (0–100)                  | ✅ Yes   | `85`                                 |
| `health`              | Health level (0–100)                     | ✅ Yes   | `90`                                 |
| `hygiene`             | Cleanliness level (0–100)                | ✅ Yes   | `60`                                 |
| `energy`              | Energy level (0–100)                     | ✅ Yes   | `70`                                 |
| `experience`          | Experience points                        | ✅ Yes   | `150`                                |
| `care_streak`         | Consecutive care days                    | ✅ Yes   | `5`                                  |

---

### Appearance & Identity

| Tag                   | Description                              | Required | Example Value                        |
|-----------------------|------------------------------------------|----------|--------------------------------------|
| `base_color`          | Main color (hex)                    | ❌ No    | `#9999ff`                            |
| `secondary_color`     | Secondary color (hex)                    | ❌ No    | `#ccccff`                            |
| `pattern`             | Cplor pattern type                        | ❌ No    | `gradient`                           |
| `eye_color`           | Eye color (hex)                          | ❌ No    | `#6633cc`                            |
| `special_mark`        | Unique visual mark                       | ❌ No    | `star_forehead`                      |
| `template_design`     | Reference design URL                     | ❌ No    | `https://github.com/.../egg-v1`      |

---

### Personality & Preferences

| Tag                   | Description                              | Required | Example Value                        |
|-----------------------|------------------------------------------|----------|--------------------------------------|
| `personality`         | Personality trait                        | ❌ No    | `curious`                            |
| `trait`               | Special trait                            | ❌ No    | `fast_learner`                       |
| `mood`                | Current mood                             | ❌ No    | `playful`                            |
| `favorite_food`       | Preferred food                           | ❌ No    | `starberries`                        |
| `voice_type`          | Pet's sound style                        | ❌ No    | `chirpy`                             |
| `size`                | Size category                            | ❌ No    | `small`                              |
| `title`               | Earned title                             | ❌ No    | `Defender of the Grove`              |
| `skill`               | Current active skill or talent           | ❌ No    | `spiral_jump`                        |

---

### Egg-specific Tags

| Tag                   | Description                              | Required | Example Value                        |
|-----------------------|------------------------------------------|----------|--------------------------------------|
| `incubation_time`     | Time required for hatching (in seconds)  | ❌ No    | `3600`                               |
| `incubation_progress` | Progress (0–100)                         | ❌ No    | `50`                                 |
| `egg_temperature`     | Temperature level (0–100)                | ❌ No    | `90`                               |
| `egg_status`          | Egg's status                             | ❌ No    | `cracking`                           |
| `shell_integrity`     | Shell health (0–100)                     | ❌ No    | `95`                                 |

---

### Behavior & Temporary Effects

| Tag                      | Description                              | Required | Example Value                     |
|--------------------------|------------------------------------------|----------|-----------------------------------|
| `is_sleeping`            | Currently sleeping                       | ❌ No    | `true`                            |
| `has_buff`               | Current buff name                        | ❌ No    | `hyper_active`                    |
| `has_debuff`             | Current debuff name                      | ❌ No    | `sick`                            |
| `last_interaction`       | Unix timestamp of last user interaction  | ❌ No    | `1717292400`                      |
| `last_interaction_type`  | Unix timestamp of last user interaction  | ❌ No    | `1717296000`                      |
| `last_meal`              | Unix timestamp of last feeding           | ❌ No    | `1717303200`                      |
| `last_bath`              | Unix timestamp of last cleaning          | ❌ No    | `1717306800`                      |
| `last_warm`              | Unix timestamp of last `warm`            | ❌ No    | `1717285200`                      |
| `last_talk`              | Unix timestamp of last `talk`            | ❌ No    | `1717288800`                      |
| `last_check`             | Unix timestamp of last `check`           | ❌ No    | `1717292400`                      |
| `last_sing`              | Unix timestamp of last `sing`            | ❌ No    | `1717296000`                      |
| `last_medicine`          | Unix timestamp of last `medicine`        | ❌ No    | `1717303200`                      |
| `last_meal`              | Unix timestamp of last `feed`            | ❌ No    | `1717306800`                      |
| `last_clean`             | Unix timestamp of last `clean`           | ❌ No    | `1717310400`                      |
---

### Social & World

| Tag                   | Description                              | Required | Example Value                        |
|-----------------------|------------------------------------------|----------|--------------------------------------|
| `current_location`    | Area name or world zone                  | ❌ No    | `glimmering_shore`                   |
| `in_party`            | Currently in a party                     | ❌ No    | `true`                               |
| `visible_to_others`   | Should Blobbi appear in public spaces?   | ❌ No    | `true`                               |


```json
{
  "id": "f3c9d0e2a5b4c8d9e1f0a6b7c4d3e2f1a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4",
  "pubkey": "d2bed509aebadaa2d213081d446d329e0238791892364a7ea7241de890162ec6",
  "created_at": 1704067200,
  "kind": 31124,
  "tags": [
    ["d", "blobbi-alasca"],
    ["stage", "baby"],
    ["generation", "2"],
    ["hunger", "60"],
    ["happiness", "80"],
    ["health", "85"],
    ["hygiene", "70"],
    ["energy", "65"],
    ["experience", "250"],
    ["care_streak", "4"],
    ["base_color", "#ffccaa"],
    ["secondary_color", "#ffeecc"],
    ["pattern", "stripes"],
    ["eye_color", "#3366ff"],
    ["personality", "curious"],
    ["personality", "loyal"],
    ["trait", "fast_learner"],
    ["trait", "empathetic"],
    ["size", "small"],
    ["shape", "oval"],
    ["special_mark", "heart_tail"],
    ["voice_type", "soft_bell"],
    ["favorite_food", "moonberries"],
    ["mood", "playful"],
    ["template_design", "https://github.com/blobbi-project/designs/egg-v1"]
  ],
  "content": "Alasca is a baby Blobbi.",
  "sig": "9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7"
}
```

### Kind 14921: Blobbi Record (Immutable)

This event kind tracks immutable records from a Blobbi's life — including birth, hatching, evolution, memories, and other important milestones. Each event is permanent and contributes to the Blobbi's historical timeline.

---

## 🏷️ Base Tags (Always Required)

| Tag            | Description                                          | Required | Example              |
|----------------|------------------------------------------------------|----------|----------------------|
| `blobbi_id`    | Unique identifier for the Blobbi                     | ✅ Yes   | `blobbi-alasca`      |
| `record_type`  | Type of record (e.g., `birth`, `hatched`, `memory`)  | ✅ Yes   | `birth`, `memory`    |

---

## 🔀 Conditional Tags (By `record_type`)

---

### 📌 `record_type: birth`

| Tag               | Description                               | Required | Example                             |
|-------------------|-------------------------------------------|----------|-------------------------------------|
| `generation`      | Generation number                         | ✅ Yes   | `1`                                 |
| `origin`          | Origin (e.g., wild, lab)                  | ❌ No    | `wild`                              |
| `birth_location`  | Location where it was born                | ❌ No    | `enchanted_grove`                   |
| `weather_at_birth`| Weather during birth                      | ❌ No    | `misty_morning`                     |
| `shell_color`     | Shell color (hex)                         | ❌ No    | `#ccccff`                           |
| `shell_pattern`   | Pattern of the shell                      | ❌ No    | `speckled`                          |
| `initial_trait`   | Initial personality traits                | ❌ No    | `warm`, `quiet`                     |
| `rarity`          | Rarity level                              | ❌ No    | `uncommon`                          |
| `parent_1`        | First parent's ID                         | ❌ No    | `b-d9e8f7c6b5a4`                    |
| `parent_2`        | Second parent's ID                        | ❌ No    | `b-c8b7a6d5e4f3`                    |
| `lineage_depth`   | Depth of ancestral lineage                | ❌ No    | `3`                                 |
| `genetic_marker`  | Special genetic marker or bloodline       | ❌ No    | `stellar_line`                      |
| `birth_season`    | Season of birth                           | ❌ No    | `spring`                            |
| `birth_moon_phase`| Lunar phase at birth                      | ❌ No    | `new_moon`                          |
| `adopted_from`    | Origin of adoption or app version         | ❌ No    | `BlobbiWorld/1.0.0`                 |
| `creator`         | Creator public key                        | ❌ No    | `npub1...`                          |
| `design_url`      | Visual design reference URL               | ❌ No    | `https://github.com/.../egg-v1`     |
| `adoption_fee`    | Fee required for adoption                 | ❌ No    | `1000`                              |
| `legacy_trait`    | Trait that can be inherited by offspring  | ❌ No    | `ice_touch`, `bravery`, `empathic`  |
| `passive_trait`   | Inherent traits                           | ❌ No    | `introverted`, `resilient`          |

---

### 🐣 Hatching & Egg-Related Tags (`record_type: hatched`)

| Tag               | Description                         | Required | Example                 |
|-------------------|-------------------------------------|----------|-------------------------|
| `hatched_at`      | Timestamp of hatching               | ❌ No    | `2025-05-30T14:32:00Z`  |
| `hatched_by`      | Public key of user who hatched      | ❌ No    | `npub1...`              |
| `egg_type`        | Type/category of the egg            | ❌ No    | `mystic`, `volcanic`    |
| `incubation_time` | Time spent incubating               | ❌ No    | `72h`                   |

---

### 👤 Adoption & Title Tags (`record_type: adoption`)

| Tag               | Description                         | Required | Example                      |
|-------------------|-------------------------------------|----------|------------------------------|
| `adopted_by`      | Public key of adopter               | ❌ No    | `npub1...`                   |
| `adopted_on`      | Timestamp of adoption               | ❌ No    | `2025-06-01T09:00:00Z`       |
| `adoption_method` | How the adoption happened           | ❌ No    | `auction`, `gift`            |
| `title`           | Title granted to the Blobbi         | ❌ No    | `Explorer of Shadows`        |
| `title_reason`    | Reason for title                    | ❌ No    | `Discovered the lost ruins`  |

---

### 🔄 Evolution & Growth (`record_type: evolution`)

| Tag               | Description                         | Required | Example              |
|-------------------|-------------------------------------|----------|----------------------|
| `evolution_stage` | Stage of evolution                  | ❌ No    | `juvenile`, `mature` |
| `evolution_reason`| What triggered evolution            | ❌ No    | `moon_alignment`     |
| `evolved_from`    | Previous Blobbi ID                  | ❌ No    | `blobbi-eggling22`   |

---

### ⭐ Achievements & Unique Traits (`record_type: memory`)

| Tag                   | Description                           | Required | Example                           |
|-----------------------|---------------------------------------|----------|-----------------------------------|
| `memory_title`        | Title of the memory                   | ❌ No    | `First Flight`                    |
| `memory_description`  | Description or details of the memory  | ❌ No    | `Learned to fly after many tries` |
| `memory_date`         | When the memory occurred              | ❌ No    | `2025-05-20`                      |
| `discovered_trait`    | New trait discovered                  | ❌ No    | `telepathic`                      |
| `achievement`         | Achievement unlocked                  | ❌ No    | `100km walked`                    |
| `milestone`           | General milestone reached             | ❌ No    | `first_zap_sent`                  |

---

*Note:* Only `blobbi_id` and `record_type` are mandatory for all events. Other tags are optional and only relevant depending on the `record_type`.

---
```json
{
  "id": "b2c3d4e5f67890123456789012345678901234567890123456789012345678901",
  "pubkey": "d2bed509aebadaa2d213081d446d329e0238791892364a7ea7241de890162ec6",
  "created_at": 1717000000,
  "kind": 14921,
  "tags": [
    ["blobbi_id", "blobbi-alasca"],
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
  "content": "Adopted record: A mysterious Blobbi egg has been adopted from the wild!",
  "sig": "f4e1c80a1b3a7f1fddc3b342e56789ab75d8f3dabe1c2b934cf2e56789a7c3210e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

### Kind 14920: Blobbi Breeding Event Regular

This event represents the act of breeding two Blobbis. It can be used to request, confirm, or register a breeding action. Depending on your application, this event may be ephemeral (for breeding proposals) or regular (for confirmed offspring generation). 

It includes the public keys of both parent Blobbis and metadata about the result, including the egg ID (if produced).

---

### Event Tag Reference

| Tag              | Description                                 | Required | Example Value                    |
|------------------|---------------------------------------------|----------|----------------------------------|
| `parent_a`       | First Blobbi ID (`d` value from Kind 31124) | ✅ Yes   | `blobbi-abc123`                  |
| `parent_b`       | Second Blobbi ID                            | ✅ Yes   | `blobbi-xyz456`                  |
| `owner_a`        | `npub` of parent A's owner                  | ✅ Yes   | `npub1abcd...`                   |
| `owner_b`        | `npub` of parent B's owner                  | ✅ Yes   | `npub1xyz...`                    |
| `breed_time`     | ISO timestamp of the breeding event         | ✅ Yes   | `2025-05-30T18:42:00Z`           |
| `success`        | Boolean indicating if breeding succeeded    | ✅ Yes   | `true`                           |
| `location`       | Area where the breeding occurred            | ❌ No    | `crystal_meadow`                 |
| `method`         | Breeding method (natural/lab/magic/etc.)    | ❌ No    | `natural`                        |
| `offspring_id`   | New egg Blobbi ID (if any)                  | ❌ No    | `blobbi-egg789`                  |
| `egg_traits`     | Summary of inherited traits (comma list)    | ❌ No    | `curious,fast_learner,small`     |
| `generation`     | Generation number of the offspring          | ❌ No    | `2`                              |
| `cooldown_a`     | Cooldown time (seconds) for parent A        | ❌ No    | `86400`                          |
| `cooldown_b`     | Cooldown time (seconds) for parent B        | ❌ No    | `86400`                          |

---

### Notes

- `success = false` events can be used to log failed attempts or rejections.
- If `offspring_id` is present, a matching Kind 31124 event with `stage = egg` should be posted shortly after.
- Cooldown prevents repeated rapid breeding; values are in seconds.
- `egg_traits` can be used to preview randomized or inherited features from both parents.

---

### Example

```json
{
  "kind": 14920,
  "created_at": 1762039320,
  "tags": [
    ["parent_a", "blobbi-abc123"],
    ["parent_b", "blobbi-xyz456"],
    ["owner_a", "npub1abcd..."],
    ["owner_b", "npub1xyz..."],
    ["breed_time", "2025-05-30T18:42:00Z"],
    ["location", "crystal_meadow"],
    ["method", "natural"],
    ["success", "true"],
    ["offspring_id", "blobbi-egg789"],
    ["egg_traits", "curious,fast_learner,small"],
    ["generation", "2"],
    ["cooldown_a", "86400"],
    ["cooldown_b", "86400"]
  ],
  "content": "New life is forming ✨"
}
```

# 📋 Kind 14919 — Blobbi Interaction Event

Este documento descreve o evento do tipo `14919`, usado para registrar interações com um Blobbi (pet digital). Cada evento representa uma ação específica do usuário, como alimentar, brincar, limpar ou colocar para descansar o Blobbi.

---

## 🎮 Interaction Event

| Tag                   | Description                               | Required | Example Value                        |
|-----------------------|-------------------------------------------|----------|--------------------------------------|
| `action`              | Type of interaction                       | ✅ Yes   | `feed`, `play`, `clean`, `rest`      |
| `action_category`     | Interaction category                      | ✅ Yes   | `enrichment`, `hygiene`, `recovery`  |
| `stat_change`         | Stat modified (name + value)              | ✅ Yes   | `["hunger", "+35"]`                  |
| `item_used`           | Item used in the action                   | ❌ No    | `starberries`, `glowing_orb`         |
| `item_quality`        | Quality of the item                       | ❌ No    | `excellent`                          |
| `time_of_day`         | Time of day interaction occurred          | ❌ No    | `morning`                            |
| `blobbi_mood_before`  | Mood before interaction                   | ❌ No    | `hungry`                             |
| `blobbi_mood_after`   | Mood after interaction                    | ❌ No    | `satisfied`                          |
| `animation_played`    | Animation shown                           | ❌ No    | `happy_eating`                       |
| `sound_played`        | Sound played                              | ❌ No    | `nom_nom_delighted`                  |
| `bonus_applied`       | Bonus triggered                           | ❌ No    | `favorite_food_bonus`                |
| `experience_gained`   | Experience points                         | ❌ No    | `10`                                 |
| `care_streak`         | Days of consecutive care                  | ❌ No    | `5`                                  |
| `care_oints`          | Care points earned in this actions        | ❌ No    | `2`                                  |
| `achievement_progress`| Progress toward achievement               | ❌ No    | `["gourmet_chef", "15/50"]`          |
| `achievement_unlocked`| Achievement unlocked                      | ❌ No    | `first_friend`                       |
| `companion_reaction`  | Reaction from other Blobbi                | ❌ No    | `["blobbi-hani", "jealous"]`         |
| `special_event`       | Rare/hidden event triggered               | ❌ No    | `discovered_new_flavor`              |
| `memory_created`      | Memory entry created                      | ❌ No    | `first_starberry_feast`              |
| `game_type`           | Name of game played                       | ❌ No    | `cosmic_catch`                       |
| `toy_used`            | Toy or object used                        | ❌ No    | `glowing_orb`                        |
| `play_duration`       | Duration in seconds                       | ❌ No    | `900`                                |
| `location`            | Location of the interaction               | ❌ No    | `zezinhos_pub`                       |
| `play_partner`        | Another Blobbi involved                   | ❌ No    | `blobbi-hani`                        |
| `skill_improved`      | Skill that improved                       | ❌ No    | `["agility", "+2"]`                  |
| `bond_increased`      | Bond level increased                      | ❌ No    | `["blobbi-hani", "+5"]`              |
| `new_move_learned`    | Move or behavior learned                  | ❌ No    | `spiral_jump`                        |
| `cleaning_type`       | Type of cleaning                          | ❌ No    | `bubble_bath`                        |
| `water_temperature`   | Water temperature                         | ❌ No    | `warm`                               |
| `soap_used`           | Soap or product used                      | ❌ No    | `lavender_bubbles`                   |
| `grooming_tool`       | Tool used                                 | ❌ No    | `soft_brush`                         |
| `special_effect`      | Cosmetic or gameplay effect               | ❌ No    | `sparkly_clean`                      |
| `scent_applied`       | Fragrance applied                         | ❌ No    | `lavender_dreams`                    |
| `mood_boost`          | Mood status change                        | ❌ No    | `relaxed`                            |
| `rest_type`           | Type of rest                              | ❌ No    | `deep_sleep`                         |
| `bed_type`            | Bed or rest location                      | ❌ No    | `cloud_nest`                         |
| `lullaby_played`      | Music or audio used                       | ❌ No    | `stellar_symphony`                   |
| `sleep_duration`      | Duration of rest in seconds               | ❌ No    | `28800`                              |
| `dream_type`          | Type of dream                             | ❌ No    | `adventure`                          |
| `growth_bonus`        | Hidden growth stat bonus                  | ❌ No    | `+2`                                 |
| `dream_memory`        | Memory from the dream                     | ❌ No    | `flying_through_stars`               |
| `social_role`         | Type of social bond or relationship       | ❌ No    | `["blobbi-hani", "best_friend"]`     |
| `interaction_quality` | Perceived quality of the interaction      | ❌ No    | `excellent`, `awkward`, `neutral`    |
| `emotion_triggered`   | Emotion caused by the interaction         | ❌ No    | `jealousy`, `pride`, `comfort`       |
| `shared_memory`       | ID of a shared memory or event            | `m-xyz789abc`                           | When both Blobbis experience a significant moment together   |
| `interaction_context` | Social or environmental context of event  | `birthday_party`, `exploration_trip`   | Helps define special moments or unique interaction settings  |
 
--- 

## 🧪 Base JSON Template

```json
{
  "id": "<unique_event_id>",
  "pubkey": "d2bed509aebadaa2d213081d446d329e0238791892364a7ea7241de890162ec6",
  "created_at": 1717092040,
  "kind": 14919,
  "tags": [
    ["blobbi_id", "blobbi-alasca"],
    ["action", "feed"],
    ["item_used", "sttarberries"],
    ["stat_change", "hunger", "+35"],
    ["memory_created", "first_starberry_feast"]
  ],
  "content": "Blobbi ate the delicious sttarberries and looks happier than ever!",
  "sig": "<valid_signature>"
}
```

## Implementation Considerations

### Event Architecture and Data Flow

1. **Addressable vs. Immutable Event Design**:
   - **Kind 31124** (addressable): Represents the **current snapshot** of a Blobbi's state. Each update replaces the previous version, ensuring clients always have access to the latest information without processing historical changes.
   - **Kind 14919** (regular): Captures **individual interactions** as immutable records. These events build the complete care history and enable stat recalculation when needed.
   - **Kind 14921** (regular): Stores **permanent milestones** that form the Blobbi's unchangeable biography. Once published, these records establish lineage, evolution moments, and achievements that cannot be modified.

2. **State Synchronization Strategy**:
   - Query the most recent Kind 31124 event using the Blobbi's unique `d` tag to retrieve current state
   - Process Kind 14919 interaction events since the last state timestamp to calculate any pending changes
   - Publish updated Kind 31124 events when significant state changes occur (evolution, major stat shifts, or periodic updates)
   - Use Kind 14921 records to verify evolution eligibility and track permanent achievements

3. **Record Type Implementation**:
   - **`record_type: birth`**: Must be the first Kind 14921 event for any Blobbi, establishing its unique identity and initial traits
   - **`record_type: hatched`**: Published when an egg transitions to baby stage, revealing inherited characteristics
   - **`record_type: evolution`**: Marks permanent stage transitions with immutable timestamps and conditions met
   - **`record_type: memory`**: Captures special moments, achievements, and unique experiences throughout the Blobbi's life
   - **`record_type: adoption`**: Records ownership transfers and title grants

### Lifecycle Management

4. **Time-Based Stat Degradation**:
   - Implement consistent degradation rates: Hunger (-5/hour), Happiness (-3/hour), Hygiene (-2/hour), Energy (-4/hour during active periods)
   - Calculate degradation from `last_interaction` timestamp in Kind 31124 events
   - Pause energy degradation during sleep periods (when `is_sleeping` tag is present)
   - Publish updated state events when stats cross critical thresholds (below 30% or above 90%)

5. **Evolution Condition Validation**:
   - **Egg to Baby**: Verify 4-day minimum incubation, 40+ care points, and health above 50%
   - **Baby to Adult**: Check post-hatch duration (10 days) or standard conditions (7 days + care score ≥150)
   - Cross-reference Kind 14919 interaction events to validate care point accumulation
   - Ensure evolution records (Kind 14921) are published before updating stage in Kind 31124

6. **Data Integrity and Validation**:
   - Enforce stat ranges (0-100) with graceful clamping rather than rejection
   - Validate `blobbi_id` references across all event kinds to prevent orphaned records
   - Ensure unique Blobbi IDs per user through `d` tag enforcement in Kind 31124 events
   - Implement timestamp validation to prevent backdated interactions or future events

### Query Optimization and Client Features

7. **Efficient Query Patterns**:
   - **Current state**: `{"kinds": [31124], "#d": ["blobbi-{id}"], "authors": ["{pubkey}"], "limit": 1}`
   - **Recent interactions**: `{"kinds": [14919], "#blobbi_id": ["blobbi-{id}"], "since": {last_update}, "limit": 50}`
   - **Life timeline**: `{"kinds": [14921], "#blobbi_id": ["blobbi-{id}"], "#record_type": ["birth", "evolution", "memory"]}`
   - **User's Blobbis**: `{"kinds": [31124], "authors": ["{pubkey}"]}`

8. **Client Implementation Guidelines**:
   - Cache Kind 31124 events locally and refresh based on `last_interaction` timestamps
   - Implement background stat degradation calculations to provide real-time updates
   - Use Kind 14921 records to build rich lineage trees and achievement galleries
   - Provide visual indicators for care requirements based on current stat levels and time since last interaction
   - Support offline interaction queuing with timestamp validation upon reconnection

9. **Social and Breeding Features**:
   - Cross-reference Kind 14920 breeding events with parent Blobbi states to validate breeding eligibility
   - Implement cooldown tracking using breeding event timestamps
   - Support multi-user breeding scenarios with proper consent mechanisms
   - Enable Blobbi discovery through public Kind 31124 events with `visible_to_others` tag

## Security Considerations

### Event Integrity and Authentication

1. **Signature Verification and Timestamp Validation**:
   - All Blobbi events must undergo standard Nostr signature verification to ensure authenticity
   - Validate event timestamps against reasonable bounds (not more than 5 minutes in the future, not older than the Blobbi's birth record)
   - Cross-reference interaction timestamps with previous state updates to detect potential replay attacks or backdated events
   - Reject events with malformed `blobbi_id` references or invalid tag structures

2. **State Consistency and Anti-Tampering**:
   - Implement deterministic stat calculation algorithms that produce identical results across all clients
   - Validate stat changes in Kind 14919 events against reasonable interaction limits (e.g., feeding cannot increase hunger by more than 50 points)
   - Ensure Kind 31124 state events reflect legitimate progression from previous states and interaction history
   - Detect and handle conflicting state updates by prioritizing events with valid interaction chains

### Abuse Prevention and Rate Limiting

3. **Interaction Spam Protection**:
   - Enforce minimum time intervals between interactions of the same type (e.g., 30 seconds between feeding actions)
   - Implement daily care point caps to prevent stat manipulation through rapid interactions
   - Monitor for suspicious patterns like identical interaction sequences or unrealistic care streaks
   - Apply exponential backoff for clients that exceed reasonable interaction rates

4. **Economic and Social Safeguards**:
   - Validate breeding consent through mutual Kind 14920 events from both Blobbi owners
   - Implement cooldown periods for breeding to prevent rapid offspring generation
   - Monitor for artificial stat inflation that could affect breeding eligibility or achievement unlocking
   - Protect against Blobbi ID collision attacks by enforcing unique identifiers per user

### Privacy and Data Protection

5. **Sensitive Information Handling**:
   - Support optional encryption of personal Blobbi data using NIP-44 for enhanced privacy
   - Allow users to mark Blobbis as private through the `visible_to_others` tag to control social visibility
   - Implement selective sharing of interaction history while maintaining public milestone records
   - Protect user identity in cross-breeding scenarios by supporting pseudonymous participation

6. **Client-Side Security Measures**:
   - Validate all incoming events against the complete Blobbi lifecycle schema before processing
   - Implement secure local storage for cached Blobbi states with appropriate encryption
   - Provide user controls for data retention and deletion of non-essential interaction history
   - Support backup and recovery mechanisms for critical Blobbi records while maintaining security

### Network and Relay Considerations

7. **Relay Trust and Data Availability**:
   - Distribute critical Blobbi records across multiple relays to ensure availability and prevent data loss
   - Implement relay selection strategies that prioritize trusted sources for Blobbi lifecycle events
   - Monitor for relay censorship or selective event filtering that could disrupt Blobbi continuity
   - Support relay migration scenarios where users can transfer their Blobbi history to new infrastructure

8. **Consensus and Conflict Resolution**:
   - Establish clear precedence rules for conflicting events (timestamp-based with signature verification)
   - Implement graceful degradation when partial event history is available from relays
   - Support community-driven validation mechanisms for disputed evolution or achievement claims
   - Provide audit trails for significant Blobbi lifecycle events to enable dispute resolution

## References

- NIP-01: Basic protocol flow description
- NIP-33: Parameterized Replaceable Events (used for Kind 31124)
- NIP-78: Application-specific data
- NIP-16: Event Treatment (regular events for interactions and records)