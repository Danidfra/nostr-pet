# ⏱️ Blobbi Status Decay - Client Calculation Guide

This document defines how a Blobbi client should calculate and update a Blobbi’s status upon user login, ensuring that care stats continue to decay while the user is offline. This approach guarantees consistency across devices and clients by deriving current state from historical events and timestamps.

---

## 📌 Why This Is Needed

Blobbi's care stats decay in real-time, even when the user is offline. Since the client is responsible for status updates, it must **simulate and apply decay retroactively** when the player logs in again.

---

## 🔁 General Approach

1. **Fetch last known status.**  
   Pull the most recent `kind: 31124` event from the user (the last full status snapshot).

2. **Fetch recent interaction events.**  
   Retrieve all user events that affect care (`kind: 31125`, `kind: 31126`, etc.), between the last status update and now.

3. **Determine the time window.**  
   Calculate how many full hours have passed since the last status update (`t = now - lastStatusTimestamp`).

4. **Recalculate care values.**  
   Simulate hour-by-hour decay using the logic from `blobbi-status-decay.md`:
   - Apply base decay per stat per hour.
   - Apply conditional or stacked penalties (e.g., shell_integrity decay based on thresholds).
   - Track and apply deductions of care points when shell_integrity < 50.

5. **Clamp stat values.**  
   After each hour of decay, ensure all stats stay between `0–100`.

6. **Emit a new status update event.**  
   Publish a new `kind: 31124` event representing the updated stats and conditions.

---

## 🗃️ Data Required

To correctly compute the current state, the client must collect:

- ✅ The **last known status event** (`kind: 31124`)
  - This includes current stats (hunger, hygiene, shell_integrity, etc.).
  - Use the timestamp as the base reference for elapsed time.
  
- ✅ All **interaction events** (e.g., feeding, cleaning, singing)
  - Use these to restore or boost certain stats if they occurred in the decay period.
  - Include timestamps and values where applicable.

- ✅ The **Blobbi’s current stage**
  - Egg or Post-Hatch (Child/Adult), as this changes which stats are relevant and how they decay.

---

## 📉 Simulating Decay

For each hour between the `lastStatusTimestamp` and now:

1. **Apply decay rules** according to the Blobbi's life stage:
   - Egg: `egg_temperature`, `hygiene`, `happiness`, `shell_integrity`
   - Post-Hatch: `hunger`, `happiness`, `energy`, `hygiene`, `health`

2. **Adjust shell_integrity** (if egg stage):
   - Use thresholds from the decay spec to determine stackable penalties.

3. **Deduct care points** (if shell_integrity < 50):
   - For each hour where shell_integrity is below 50, deduct 5 care points.
   - Emit a `kind: 31124` penalty tag like:  
     `["penalty", "shell_integrity_breach"]`,  
     `["care_points_deducted", "5"]`,  
     `["timestamp", "{hour_of_breach}"]`

4. **Respect interactions**:
   - If an interaction happened at a certain hour (e.g., feeding), simulate its effect at that moment before continuing decay.

5. **Clamp values**:
   - Keep all care stats in the 0–100 range.
   - Prevent health/shell_integrity from becoming negative.

---

## 📤 Emitting the New Status

After the simulation:

- Emit a new `kind: 31124` event including:
  - All updated stats.
  - Tags:
    - `["d", "blobbi-{name}"]`
    - `["calculated_until", "{ISO timestamp}"]`
    - `["stage", "egg" or "post-hatch"]`
    - `["care_points", "{current_value}"]`
    - `["trace_hash", "{optional_hash_of_calc}"]` for auditing

- Optionally emit `care_points_deducted` for each penalty as a separate tag or event (configurable).

- Avoid posting duplicates:
  - Before emitting, check if a `kind: 31124` event already exists for the calculated period (e.g. same hour).

---

## ✅ Good Practices

- ⏳ Use UTC timestamps for all calculations.
- 📦 Store all calculated transitions in memory or temporary storage before posting.
- 🔒 Ensure deterministic and reproducible logic across all clients.
- 🧪 Use hash-based traceability to verify status transitions.
- 🐛 Log decay steps for debugging or syncing purposes (optional).
- 🕓 Only simulate **whole hours** between the last known status and now (round down fractional hours).
- 📉 Never emit a decay if the Blobbi is marked `inactive`.

---

## 🧬 Example Flow

1. User logs in on May 31st 10:00 UTC.
2. Last status event was on May 29th 18:00 UTC (Δt = 40 hours).
3. Client applies 40 rounds of decay.
4. Applies interactions at hours 4, 12, and 36 (cleaning, feeding, talking).
5. Shell integrity dropped below 50 from hour 30 to 40 → 11 hours of penalty.
6. 55 care points deducted.
7. A new `kind: 31124` status is posted with updated stats and care points.
8. Each penalty is tagged or posted as additional events.

---

## 📦 Event Types Summary

| Kind | Description                              |
|------|------------------------------------------|
| 31124 | Blobbi status update (stats + metadata) |
| 31125 | Care interaction (feed, play, clean)    |
| 31126 | Evolution attempt / change stage        |
| 31127 | Penalty notification (optional)         |

---