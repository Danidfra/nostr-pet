# NIP-XX: Blobbi Virtual Pet Events

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
    ["hunger", "75"],
    ["happiness", "85"],
    ["health", "90"],
    ["hygiene", "60"],
    ["energy", "70"]
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
    ["stat_change", "hunger:+30"]
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
    ["origin", "wild"],
    ["rarity", "uncommon"]
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
    ["coins", "2500"],
    ["has", "blobbi-fluffy"],
    ["has", "blobbi-sparkle"],
    ["achievements", "first_adoption"]
  ],
  "content": ""
}
```

## Key Tags

### Kind 31124 (Pet State)
- `d`: Pet ID (required)
- `stage`: "egg", "baby", or "adult"
- `hunger`, `happiness`, `health`, `hygiene`, `energy`: 0-100

### Kind 14919 (Interactions)
- `blobbi_id`: Pet ID
- `action`: "feed", "play", "clean", "rest", "warm", "check", "sing", "talk"
- `stat_change`: "stat_name:+/-value"

### Kind 14920 (Breeding)
- `parent_a`, `parent_b`: Parent pet IDs
- `success`: "true" or "false"
- `offspring_id`: New pet ID (if successful)

### Kind 14921 (Records)
- `blobbi_id`: Pet ID
- `record_type`: "birth", "hatched", "evolution", "adoption"

### Kind 31125 (Owner Profile)
- `d`: Profile ID (required)
- `coins`: Currency amount
- `has`: Owned pet IDs (multiple)
- `achievements`: Achievement IDs (multiple)

## Implementation Notes

1. Query Kind 31124 for current pet state
2. Process Kind 14919 events to update stats
3. Use Kind 14921 for permanent history
4. Stats decay over time without care
5. All pet IDs use format: "blobbi-{name}"