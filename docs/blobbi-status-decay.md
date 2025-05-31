# 🐣 Blobbi Status Decay Specification

This document defines the rate at which a Blobbi’s status values decay over time. Blobbi has two distinct life stages: **Egg** and **Post-Hatch (Child/Adult)**, each with different visible stats and behaviors.

---

## 📘 General Decay Rules

- All stats use a 0–100 range.
- Decay occurs **every hour** when the Blobbi is in an `active` state.
- If the Blobbi is marked as `inactive`, decay is paused.
- No stat should ever fall below 0 or exceed 100.
- Multiple low stats may cause increased `health` decay.
- Ideal care involves interacting with the Blobbi **2–3 times a day**.

---

## 🥚 Egg Stage

During the egg stage, **four stats** are visible and managed:

| Attribute          | Display Name | Initial Value | Decay Rate (/hour) | Notes |
|--------------------|--------------|---------------|--------------------|-------|
| `egg_temperature`   | Warmth       | 100           | 3                  | Recovered via the "Warm" action. |
| `hygiene`          | Cleanliness  | 100           | 2                  | Clean the shell to maintain.     |
| `happiness`        | Happiness    | 100           | 3                  | Affected by actions like "Sing", "Talk", or "Check". |
| `shell_integrity`   | Health       | 100           | 0–9 (stacking)     | Depends on other stats, see below.|

### 🧪 Shell Integrity and Health Decay

`shell_integrity` decays based on the severity of neglect in the three core stats. Each stat has **two thresholds** that trigger different levels of shell decay:

| Condition                 | Shell Integrity Decay (/hour) |
|---------------------------|-------------------------------|
| `egg_temperature` < 70    | -2                            |
| `egg_temperature` < 40    | -4                            |
| `hygiene` < 50            | -1.5                          |
| `hygiene` < 20            | -3                            |
| `happiness` < 70          | -1                            |
| `happiness` < 40          | -2                            |

- These penalties **stack** if multiple conditions are met.
- Example: If `egg_temperature` = 25, `hygiene` = 15, and `happiness` = 45 →  
  `shell_integrity` decays by **4 (temp) + 3 (hygiene) + 1 (happiness) = 8/hour**.

- `shell_integrity` **does not recover passively**, unless special conditions are met (see below).

#### 🧴 Shell Repair Item (Emergency Use)

- A **special item** is available in the store to **restore shell_integrity**.
- This item is **expensive** and should only be used in **critical situations**.
- Applying this item will **partially restore** the shell based on item tier.
- Only one item can be used per day.

#### 🌟 Natural Regeneration (Perfect Care)

- If all three other egg stats (`egg_temperature`, `hygiene`, `happiness`) reach **100**, `shell_integrity` will **start to regenerate** at a rate of **+1/hour**.
- If any of these stats fall **below 90**, regeneration **pauses**.
- If any stat falls **below 30**, the shell may weaken again and return to active decay.

#### ⚠️ Critical Shell Integrity (Below 50)

If `shell_integrity` drops **below 50**:

- For every hour it stays below 50:
  - Emit a Nostr event of **kind `31124`** to penalize care.
  - Deduct **5 care points per hour** from the user.
  - The event must include tags:  
    - `["d", "blobbi-{name}"]`  
    - `["penalty", "shell_integrity_breach"]`  
    - `["value", "{current_shell_integrity}"]`  
    - `["care_points_deducted", "5"]`

### 🐣 Evolution Requirements

- Care points deducted when conditions are not met.
- To hatch (egg to child):
  - Minimum age: 7 days since adoption
  - Minimum care points: 40 (care points will be deducted on kind `31124` events if not met)
- If conditions are not met, evolution is delayed or penalized.

---

## 🧒 Post-Hatch Stage (Child/Adult)

After hatching, the Blobbi enters a new phase with **five main stats** decaying actively:

| Attribute  | Initial Value | Decay Rate (/hour)     | Notes |
|------------|---------------|-----------------------|-------|
| `hunger`   | 100           | -5.0                  | Feed to restore.                    |
| `happiness`| 100           | -3.0                  | Raised via play and attention.      |
| `energy`   | 100           | -6.0 (awake), +4.0 (sleeping) | Sleep regenerates energy.     |
| `hygiene`  | 100           | -4.0                  | Bathe the Blobbi regularly.         |
| `health`   | 100           | -1.0 (baseline)       | Decay increases with poor care.     |

### ⚠️ Health Decay Modifiers

When the following conditions are met, `health` decay is increased:

- `hunger` < 30 → +1.5/hour health decay  
- `hygiene` < 20 → +1.0/hour health decay  
- `energy` < 20 → +1.0/hour health decay  
- `happiness` < 30 → +1.0/hour health decay  

**Maximum health decay**: -4.5/hour (when all conditions are met).

### ❤️ Health Recovery

If all other stats are **above 80**, health regenerates at **+2/hour**.  
Actions that improve other stats may also slightly boost health.

### 🐾 Evolution to Adult

To evolve from Child to Adult:

- Minimum age: 10 days since adoption
- Minimum care points: 150 (must have at least 150 care points in addition to age requirement)
- At least 50 interaction events
- Happiness level: ≥ 70%
- Health level: ≥ 80%

If care points are below 150 or the minimum age has not passed, the Blobbi **will not evolve to adult**.

---

## 🕒 Update Cycle

The Blobbi engine should:

- Apply status decay **every hour**.
- Round all values to integers.
- Keep all stats within [0, 100].
- Persist current values in local or remote storage.

---

## 🧬 Initial Stat Values

| Life Stage  | hunger | happiness | energy | hygiene | health | egg_temperature | shell_integrity |
|-------------|--------|-----------|--------|---------|--------|-----------------|-----------------|
| Egg         | N/A    | 100       | N/A    | 100     | 100    | 100             | 100             |
| Post-Hatch  | 100    | 100       | 100    | 100     | 100    | N/A             | N/A             |

---

## 📆 Recommended Interaction Frequency

- **Egg Stage**: Interact **at least once every 12 hours**.
- **Post-Hatch Stage**: Interact **2–3 times daily** to maintain optimal stats.

---