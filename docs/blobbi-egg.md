# 🥚 Birth of a Blobbi Egg — Nostr Event Kind 31124

## 🌱 Overview

This document defines the structure and logic for creating a new **Blobbi Egg**, represented as a Nostr event of kind `31124`. This is the initial stage of every Blobbi's life.

When the event is created, it **must** contain the following base tags. Optional tags may be added randomly at the time of creation.

---

## 📋 Base Tags

| Tag                   | Description                              | Required | Example Value                        |
|-----------------------|------------------------------------------|----------|--------------------------------------|
| `d`                   | Unique Blobbi ID                         | ✅ Yes   | `blobbi-abc123`                      |
| `stage`               | Current life stage                       | ✅ Yes   | `egg`                                |
| `breeding_ready`      | Whether the Blobbi is ready to breed     | ✅ Yes   | `false`                              |
| `generation`          | Generation number                        | ✅ Yes   | `1`                                  |
| `hunger`              | Hunger level (0–100)                     | ✅ Yes   | `100`                                |
| `happiness`           | Happiness level (0–100)                  | ✅ Yes   | `random between 80–100`              |
| `health`              | Health level (0–100)                     | ✅ Yes   | `100`                                |
| `hygiene`             | Cleanliness level (0–100)                | ✅ Yes   | `random between 80–100`              |
| `energy`              | Energy level (0–100)                     | ✅ Yes   | `100`                                |
| `experience`          | Experience points                        | ✅ Yes   | `150`                                |
| `care_streak`         | Consecutive care days                    | ✅ Yes   | `5`                                  |
| `special_mark`        | Unique visual mark                       | ❌ No    | `star_forehead`                      |
| `base_color`          | Main color (hex)                         | ✅ Yes   | `#9999ff`                            |
| `secondary_color`     | Secondary color (hex)                    | ❌ No    | `#ccccff`                            |
| `pattern`             | Body pattern type                        | ✅ Yes   | `gradient`                           |
| `size`                | Size category                            | ✅ Yes   | `small`                              |
| `title`               | Earned title                             | ❌ No    | `Defender of the Grove`              |
| `incubation_time`     | Time required for hatching (in seconds)  | ✅ Yes   | `3600`                               |
| `incubation_progress` | Progress (0–100)                         | ✅ Yes   | `50`                                 |
| `egg_temperature`     | Temperature level (0–100)                | ✅ Yes   | `random between 80–100`              |
| `egg_status`          | Egg's status                             | ✅ Yes   | `cracking`                           |
| `shell_integrity`     | Shell health (0–100)                     | ✅ Yes   | `random between 80–100`              |
| `last_interaction`    | ISO timestamp of last user interaction   | ✅ Yes   | `2025-05-30T14:22:00Z`               |
| `last_interaction_type`| Type of last interaction                | ✅ Yes   | `tap`                                |
| `last_meal`           | ISO timestamp of last feeding            | ✅ Yes   | `2025-05-30T12:15:00Z`               |
| `last_bath`           | ISO timestamp of last cleaning           | ✅ Yes   | `2025-05-29T21:00:00Z`               |
| `visible_to_others`   | Should Blobbi appear in public spaces?   | ✅ Yes   | `true`                               |

---

## 🎯 Initialization Logic

- The following stats **must always be initialized at 100** when the Egg is created:
  - `hunger`
  - `health`
  - `energy`

- The following stats **must be randomly generated between 80 and 100**:
  - `happiness`
  - `hygiene`
  - `egg_temperature`
  - `shell_integrity`

- Optional tags (`special_mark`, `secondary_color`, `title`) may be added at random during creation, with their values also randomly chosen from a preset pool.

---

## 🧪 Example Tag Block

```json
[
  ["d", "blobbi-abc123"],
  ["stage", "egg"],
  ["breeding_ready", "false"],
  ["generation", "1"],
  ["hunger", "100"],
  ["happiness", "85"],
  ["health", "100"],
  ["hygiene", "88"],
  ["energy", "100"],
  ["experience", "150"],
  ["care_streak", "5"],
  ["base_color", "#9999ff"],
  ["pattern", "gradient"],
  ["size", "small"],
  ["incubation_time", "3600"],
  ["incubation_progress", "50"],
  ["egg_temperature", "90"],
  ["egg_status", "cracking"],
  ["shell_integrity", "95"],
  ["last_interaction", "2025-05-30T14:22:00Z"],
  ["last_interaction_type", "tap"],
  ["last_meal", "2025-05-30T12:15:00Z"],
  ["last_bath", "2025-05-29T21:00:00Z"],
  ["visible_to_others", "true"]
]
```

---

## 🎲 Blobbi Egg Rarity Specification

This part defines **rarity logic** for optional tags and their values used during the initialization of a Blobbi Egg (`kind 31124`). These elements are not required but, when present, can add distinctiveness and uniqueness to a Blobbi.

---

### 🧬 Required Tags & Rarity

#### 🎨 `base_color` (Required)

**Always Present**

The `base_color` defines the predominant color of the Blobbi egg shell. While it's always present, the color is chosen based on a rarity system. Some colors hint at special origins, ancient lineages, or magical traits.

| Rarity     | Probability | Color Options (Hex)                     | Description                                  |
|------------|-------------|-----------------------------------------|----------------------------------------------|
| Common     | 50%         | `#ffffff`, `#f2f2f2`, `#e6e6ff`         | Neutral or cool light tones                  |
| Uncommon   | 30%         | `#99ccff`, `#ccffcc`, `#ffffcc`         | Pastel shades of blue, green, and yellow     |
| Rare       | 15%         | `#cc99ff`, `#ffb3cc`, `#66ffcc`         | Soft vibrant hues, slightly magical          |
| Legendary  | 5%          | `#6633cc`, `#ff3399`, `#00ffff`         | Extremely vivid or ethereal colors           |

---

### 📏 `size` (Required)

**Always Present**

The `size` defines the physical size of the Blobbi egg at the moment of generation. Although always present, the size is rolled using a rarity system. Extreme sizes (very small or very large) may be tied to future traits once the Blobbi hatches.

| Rarity     | Probability | Size Value | Description                                      |
|------------|-------------|------------|--------------------------------------------------|
| Common     | 60%         | `small`    | Small, lightweight eggs                          |
| Uncommon   | 25%         | `medium`   | Standard-sized eggs                              |
| Rare       | 10%         | `large`    | Bigger eggs, hint at physical strength or power  |
| Legendary  | 5%          | `tiny`     | Extremely small, mysterious and magical eggs     |

---

### 🧬 Optional Tags & Rarity

##### 🎨 `secondary_color` (Optional)

**Spawn Chance**: 45%

| Rarity     | Probability | Example Colors (Hex)              |
|------------|-------------|-----------------------------------|
| Common     | 60%         | `#cccccc`, `#f0f0f0`, `#aabbcc`   |
| Uncommon   | 25%         | `#99ccff`, `#ccffcc`, `#ffcc99`   |
| Rare       | 10%         | `#ff99ff`, `#9966ff`, `#66cccc`   |
| Legendary  | 5%          | `#9933ff`, `#ff3399`, `#00ffcc`   |

---

### ✳️ `special_mark` (Optional)

**Spawn Chance**: 15%

Essas marcas aparecem na casca do ovo e são puramente visuais, podendo indicar linhagens especiais ou traços místicos.

| Rarity     | Probability | Mark Variants                          |
|------------|-------------|-----------------------------------------|
| Common     | 50%         | `dot_center`, `oval_spots`             |
| Uncommon   | 30%         | `ring_mark`, `blush_sides`             |
| Rare       | 15%         | `rune_top`, `shimmer_band`             |
| Legendary  | 5%          | `sigil_eye`, `glow_crack_pattern`      |

---

#### 🏅 `title` (Optional)

**Spawn Chance**: 10%

| Rarity     | Probability | Titles                                |
|------------|-------------|----------------------------------------|
| Common     | 50%         | `Hatchling`, `Watcher of the Nest`    |
| Uncommon   | 30%         | `Tender of Flames`, `Whisperer`       |
| Rare       | 15%         | `Echo of Ancients`, `Shellbound Hero` |
| Legendary  | 5%          | `Defender of the Grove`, `The Primordial` |

---

#### 🔹 `base_color` (Required)

Even though `base_color` is required, different colors can imply different rarity levels for visual recognition and future breeding bonuses.

| Rarity     | Probability | Base Colors (Hex)                     |
|------------|-------------|----------------------------------------|
| Common     | 50%         | `#ffffff`, `#cccccc`, `#ffcc99`        |
| Uncommon   | 30%         | `#99ccff`, `#ccffcc`, `#ffccff`        |
| Rare       | 15%         | `#6666ff`, `#33cc99`, `#ff6699`        |
| Legendary  | 5%          | `#9900cc`, `#ff0033`, `#00ffff`        |

---

### 📈 Optional Rarity Summary Table

| Tag             | Spawn Chance | Rarity Distribution (% Common / Uncommon / Rare / Legendary) |
|------------------|--------------|--------------------------------------------------------------|
| `base_color`     | 100%         | 50 / 30 / 15 / 5                                              |
| `size`           | 100%         | 60 / 25 / 10 / 5                                              |
| `secondary_color`| 45%          | 60 / 25 / 10 / 5                                              |
| `special_mark`   | 15%          | 50 / 30 / 15 / 5                                              |
| `title`          | 10%          | 50 / 30 / 15 / 5                                              |

---

### 💡 Integration Tips

- When generating a new Blobbi Egg:
  - Roll a random chance to determine whether each optional tag appears.
  - If the tag appears, roll again to determine its rarity tier.
  - Then, randomly choose a value from the list corresponding to the rarity tier.

- These rarities may influence **breeding**, **evolution paths**, or **special interactions** in later stages of Blobbi's life.

---