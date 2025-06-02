# 🐣 Blobbi Status Decay & Regeneration Specification

This document defines how a Blobbi’s status values decay and regenerate over time, across its life stages: **Egg**, **Baby**, and **Adult**.

---

## 📘 General Decay & Regeneration Rules

- All stats use a 0–100 range.
- Decay and regeneration occur **once per hour** when the Blobbi is `active`.
- If the Blobbi is marked as `inactive`, status changes are **paused**.
- No stat should fall below 0 or exceed 100.
- Ideal care involves interacting with the Blobbi:
  - **Egg**: 2–3 times daily (minimum: once every 12 hours)
  - **Baby**: At least 2 times daily
  - **Adult**: At least 2 times daily

---

## 🥚 Egg Stage

### ⚙️ Stats

| Attribute        | Display Name | Initial | Decay Rate (/hr) | Regeneration (/hr) | Notes |
|------------------|--------------|---------|-------------------|---------------------|-------|
| `egg_temperature`| Warmth       | 100     | -3                | —                   | Use “Warm” action to restore |
| `hygiene`        | Cleanliness  | 100     | -2                | —                   | Restored with “Clean” action |
| `happiness`      | Happiness    | 100     | -3                | —                   | Raised via “Sing”, “Talk” or “Check” |
| `shell_integrity`| Shell Health | 100     | 0–9 (conditional) | +1 (if perfect care) | Represents egg’s overall health |

### 🧪 Shell Integrity Decay Conditions

Shell integrity degrades based on **low** values in the other three stats:

| Condition                  | Decay (/hr) |
|----------------------------|-------------|
| `egg_temperature` < 70     | -2          |
| `egg_temperature` < 40     | -4          |
| `hygiene` < 50             | -1.5        |
| `hygiene` < 20             | -3          |
| `happiness` < 70           | -1          |
| `happiness` < 40           | -2          |

These decay values **stack**.  
Example: If temperature = 30, hygiene = 15, happiness = 65 → shell decays by **4 + 3 + 1 = 8/hour**

### ❤️ Shell Integrity Regeneration

Shell integrity **regenerates** naturally if the user provides **perfect care**:

- All three stats (`egg_temperature`, `hygiene`, `happiness`) must be at **100** →  
  ✅ `shell_integrity` regenerates at **+1/hour**

- If **any stat drops below 90**, regeneration **pauses**  
- If **any stat drops below 30**, decay resumes as per rules above

---

### 🧴 Emergency Shell Repair

- An expensive **item** is available to restore `shell_integrity`
- Only **one use per day** allowed
- Restores based on **item tier**

---

### 🐣 Hatching Requirements

- Minimum egg age: **7 days**
- Minimum care points: **40**

---

## 👶 Baby Stage

| Attribute   | Initial | Decay Rate (/hr)         | Regeneration Conditions     |
|-------------|---------|---------------------------|-----------------------------|
| `hunger`    | 100     | -5                        | —                           |
| `happiness` | 100     | -3                        | —                           |
| `energy`    | 100     | -6 (awake), +4 (asleep)   | Sleep action                |
| `hygiene`   | 100     | -4                        | —                           |
| `health`    | 100     | -1 baseline               | +2 if all other stats > 80  |

### ⚠️ Health Decay Boosts

When thresholds are breached:

- `hunger` < 30 → +1.5/hr
- `hygiene` < 20 → +1/hr
- `energy` < 20 → +1/hr
- `happiness` < 30 → +1/hr

Max `health` decay: **-4.5/hour**

---

## 🧑 Adult Stage

Same decay system as Baby, but with **slightly slower hunger and energy cycles**.

- Encourages consistent but less intense care

---

## 🧬 Initial Stat Values

| Stage       | hunger | happiness | energy | hygiene | health | egg_temp | shell_integrity |
|-------------|--------|-----------|--------|---------|--------|----------|------------------|
| Egg         | —      | 100       | —      | 100     | —      | 100      | 100              |
| Baby        | 100    | 100       | 100    | 100     | 100    | —        | —                |
| Adult       | 100    | 100       | 100    | 100     | 100    | —        | —                |

---

## 📆 Engine Update Cycle

- Decay and regeneration apply **once per hour**
- Values are rounded to integers
- Stats must remain in [0–100]
- Persistent state is saved locally or remotely

---

## 🔁 Interaction Frequency Summary

| Stage  | Recommended Interactions Per Day |
|--------|----------------------------------|
| Egg    | 2–3 (minimum once every 12h)     |
| Baby   | At least 2                       |
| Adult  | At least 2                       |

---