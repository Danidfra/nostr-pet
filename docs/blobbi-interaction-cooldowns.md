# Blobbi Interaction Cooldowns

To make interactions more engaging and prevent spammy behavior, each action in the Blobbi lifecycle has a cooldown system. This prevents repeated usage in a short period and encourages regular check-ins with meaningful care loops.

---

## ⏳ Cooldown Model

- Each action can be used **up to 4 times per session**.
- A **short cooldown** applies after each individual use.
- Once the **max uses per session** is reached, the action enters a **global cooldown**.
- Global cooldowns vary by action and Blobbi stage.

---

## 🥚 Egg Stage

| Action     | Cooldown per use | Max uses per session | Global cooldown | Description                                                       |
|------------|------------------|----------------------|------------------|-------------------------------------------------------------------|
| `warm`     | 5 min            | 4                    | 1.5 hours        | Warming provides a lasting effect; avoid spamming.                |
| `sing`     | 5 min            | 4                    | 1.5 hours        | Frequent bonding action, increases happiness.                     |
| `check`    | 3 min            | 4                    | 1 hour           | Can be used often to inspect Blobbi, minor happiness boost.       |
| `talk`     | 5 min            | 4                    | 1.5 hours        | Emotional bonding, low impact.                                    |
| `clean`    | 10 min           | 4                    | 1.5 hours        | Prevents hygiene abuse and farming.                               |
| `medicine` | 120 min          | 1                    | —                | High-impact action, should remain rare and meaningful.            |

---

## 🐣 Child Stage

| Action     | Cooldown per use | Max uses per session | Global cooldown | Description                                    |
|------------|------------------|----------------------|------------------|------------------------------------------------|
| `feed`     | 5 min            | 4                    | 1.5 hours        | Avoids overfeeding; promotes meaningful care.  |
| `play`     | 10 min           | 4                    | 2 hours          | Boosts happiness and energy.                   |
| `clean`    | 10 min           | 4                    | 1.5 hours        | Hygiene management.                            |
| `rest`     | —                | 1                    | Until full/4h     | Full rest cycle per session.                   |
| `talk`     | 5 min            | 4                    | 1.5 hours        | Builds bond through frequent interaction.      |
| `check`    | 3 min            | 4                    | 1 hour           | Status inspection.                             |
| `medicine` | 120 min          | 1                    | —                | Rare, impactful.                               |

---

## 🧑‍🦱 Adult Stage

| Action     | Cooldown per use | Max uses per session | Global cooldown | Description                                    |
|------------|------------------|----------------------|------------------|------------------------------------------------|
| `feed`     | 5 min            | 4                    | 1.5 hours        | Adults eat less frequently.                    |
| `play`     | 10 min           | 4                    | 2 hours          | Less playful than children, but still needed.  |
| `clean`    | 10 min           | 4                    | 1.5 hours        | Maintains hygiene.                             |
| `rest`     | —                | 1                    | Until full/4h     | Longer sleep cycles.                           |
| `talk`     | 5 min            | 4                    | 1.5 hours        | Low-impact social bonding.                     |
| `check`    | 3 min            | 4                    | 1 hour           | General status checking.                       |
| `medicine` | 180 min          | 1                    | —                | High-impact action.                            |
| `cruzar`   | —                | 1/day                | 24 hours         | Rare and meaningful reproductive event.        |

---

## 🔁 Cooldown Handling & Sync Logic

Cooldowns are enforced consistently, even if the app is closed or offline. The system uses a hybrid approach that prioritizes local data but can sync with the relay when needed.

### 🧠 Local-First Tracking

- The app **locally stores timestamps** of each action per Blobbi using mechanisms like `localStorage`, `IndexedDB`, or a mobile-safe database.
- On app resume, cooldowns are **calculated using local timestamps**, allowing for fast, offline-friendly interactions.
- This ensures a responsive experience without requiring a constant internet connection.

### 🌐 Relay Sync on Demand

If the app is reopened after a long time, or if the local data is missing or outdated:

- The client queries the relay for recent action events using **`kind: 31124`**, scoped to the relevant Blobbi.
- It reads the relevant **`last_<action>` tags** from these events to restore the correct cooldown state.

After fetching:

- Local timestamps are updated to match the most recent action data.
- Cooldown timers and button states in the UI are refreshed accordingly.

---

## ⚙️ Technical Notes

- Cooldowns are enforced **per action, per Blobbi**.
- The UI should:
  - **Disable actions** that are on cooldown.
  - **Show countdown timers** until actions become available.
- If a user tries to perform an action during a cooldown, the app should **block it locally**, with optional server-side validation for security.
- This hybrid model provides **offline support** while ensuring **data consistency** when the device reconnects.

---

## ⏳ Sync Validity Window

| Stage  | Max Age of Local Data Before Sync |
|--------|-----------------------------------|
| Egg    | 2 hours                           |
| Child  | 2 hours                           |
| Adult  | 24 hours                          |

After these limits, a relay sync is recommended to ensure cooldown accuracy.

---