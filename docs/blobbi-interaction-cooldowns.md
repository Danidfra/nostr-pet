# Blobbi Interaction Cooldowns

To make interactions more engaging and prevent spammy behavior, each action in the Blobbi lifecycle has a cooldown. This prevents repeated usage in a short period and encourages regular check-ins.

---

## 🥚 Egg Stage

| Action  | Cooldown | Description                                    |
|---------|----------|------------------------------------------------|
| `warm`  | 30 min   | Warming provides a long-lasting effect and should not be spammed. |
| `sing`  | 15 min   | Frequent bonding action, adds happiness.       |
| `check` | 5 min    | Can be used often to inspect Blobbi.            |
| `talk`  | 10 min   | Emotional bonding, minor impact.                 |

---

## 🐣 Post-Hatched (Child Stage)

| Action     | Cooldown | Description                                    |
|------------|----------|------------------------------------------------|
| `feed`     | 45 min   | Avoids overfeeding. Should feel meaningful.     |
| `play`     | 30 min   | Boosts happiness and energy. Should be spaced out. |
| `clean`    | 60 min   | Hygiene needs time to accumulate. Prevents farming. |
| `rest`     | 90 min   | Sleep cycles need to feel natural.              |
| `medicine` | 120 min  | High-impact action, should be rare and meaningful. |
| `check`    | 5 min    | Can be used often to inspect status.            |
| `talk`     | 15 min   | Similar to `sing`, increases connection.        |

---

## 🧑‍🦱 Adult Stage

| Action     | Cooldown | Description                                    |
|------------|----------|------------------------------------------------|
| `feed`     | 60 min   | Adults eat less frequently.                     |
| `play`     | 45 min   | Less frequent than with children.               |
| `clean`    | 90 min   | Same hygiene cycle as child.                     |
| `rest`     | 120 min  | Longer rest cycle for adults.                    |
| `medicine` | 180 min  | High-impact and rare usage.                       |
| `check`    | 5 min    | Always available.                                |
| `talk`     | 15 min   | Low impact, social interaction.                  |
| `cruzar`   | 1 day    | Special action. Must feel rare and important.    |

---

## 🔁 Cooldown Handling & Sync Logic

To ensure a smooth and consistent experience, cooldowns must be reliably tracked even if the app is closed or offline for a while. Here's how cooldowns are managed on the client side:

### 🧠 Local Cache First

- The client **caches the last performed actions and their timestamps locally** (e.g., `localStorage`, `IndexedDB`, or encrypted local database on mobile).
- When the app is opened or resumed, the client **first checks this local cache** to determine if an action is currently on cooldown.
- This guarantees quick interaction without requiring a network call if the app was recently used.

### 🌐 Fallback to Relay Sync

If no recent cached data is available or the app has been closed for a longer period:

- The client must **query the relay** for the **most recent interaction events** for each action type (`kind: 14919`) associated with the current Blobbi.
- This query should filter events by:
  - `#d` tag identifying the action (e.g., `feed`, `warm`, etc.)
  - `created_at` timestamp within a defined window:
    - **2 hours** for Blobbi in **Egg** or **Child** stages (due to the maximum cooldown of 120 min).
    - **24 hours** for **Adult** stage Blobbi (to include actions like `cruzar`).

- After receiving the events, the client should:
  - **Update the local cache** with the most recent timestamps.
  - **Update the UI** accordingly (e.g., disabling buttons, showing timers).

#### Special Case: Egg Stage

- If the Blobbi is still in the **egg** stage, the client should additionally:
  - Fetch the latest **status events** (`kind: 14919`) tagged for that egg Blobbi.
  - Use these to **restore UI elements specific to incubation**, such as `warm` or `sing` timers and the egg state visuals.

### ⚙️ Implementation Notes

- Cooldowns are **per Blobbi and per action**.
- The app should **block or disable the UI for actions still on cooldown**, showing a timer or progress indicator.
- Attempting an action during cooldown should be prevented client-side or rejected server-side for consistency.
- This hybrid approach balances **performance** (via cache) with **accuracy** (via recent relay sync).
- It also supports **offline mode** gracefully by relying on cached timestamps.

---

## ⏳ Summary

| Stage  | Max Cooldown Window for Sync Request |
|--------|-------------------------------------|
| Egg    | 2 hours                            |
| Child  | 2 hours                            |
| Adult  | 24 hours                           |

This ensures cooldown enforcement aligns with the Blobbi lifecycle and interaction pacing.

---