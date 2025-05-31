# 🧊 Blobbi Cooldown System — Full Specification & Sync Logic

This document describes the cooldown system for Blobbi interactions. It ensures consistency across sessions and devices using Nostr events (`kind: 14919`) and precise synchronization windows per life stage.

---

## 📌 What Should Happen

When the user accesses `/blobbi`, the application **must**:

1. **Fetch recent interaction events (`kind: 14919`) from the relay.**
2. Use **maximum sync windows** depending on the Blobbi’s current life stage:

| Stage  | Max Cooldown Window (for Relay Sync) |
|--------|---------------------------------------|
| Egg    | 2 hours                               |
| Child  | 2 hours                               |
| Adult  | 24 hours                              |

3. Filter relevant interaction events (e.g. `warm`, `sing`, `feed`, etc.) based on the current stage.
4. Apply those timestamps to initialize cooldowns in the UI — ensuring **shared consistency** across tabs, devices, and sessions.
5. All UI cooldown states must **reflect the most recent synced event**, not just local timestamps.

---

## 🧠 Architecture Overview

### 1. 📦 Cooldown Storage: `src/lib/cooldown-storage.ts`

**Storage Layers:**
- `L1`: In-memory cache (fastest, volatile)
- `L2`: `localStorage` (fallback for older browsers)
- `L3`: IndexedDB (default, structured + persistent)

**Key Features:**
- Per-action, per-stage cooldown duration mapping
- Auto-cleanup of expired cooldown entries
- Tamper-resistant (relay events act as source of truth)
- Designed for sync across sessions/devices

---

## 🧰 Cooldown Definitions by Stage

### 🥚 Egg Stage

| Action     | Cooldown | Description |
|------------|----------|-------------|
| `warm`     | 30 min   | Long-lasting warmth effect |
| `sing`     | 15 min   | Adds happiness |
| `check`    | 5 min    | Can inspect status |
| `talk`     | 10 min   | Emotional bonding |
| `clean`    | 60 min   |
| `medicine` | 120 min  |

### 🐣 Child Stage

| Action     | Cooldown |
|------------|----------|
| `feed`     | 45 min   |
| `play`     | 30 min   |
| `clean`    | 60 min   |
| `rest`     | 90 min   |
| `medicine` | 120 min  |
| `check`    | 5 min    |
| `talk`     | 15 min   |

### 🧑‍🦱 Adult Stage

| Action     | Cooldown |
|------------|----------|
| `feed`     | 60 min   |
| `play`     | 45 min   |
| `clean`    | 90 min   |
| `rest`     | 120 min  |
| `medicine` | 180 min  |
| `check`    | 5 min    |
| `talk`     | 15 min   |
| `cruzar`   | 1 day    |

---

## 🔁 Sync Logic: When and How It Should Happen

### Trigger:
On visiting `/blobbi`, or when `Blobbi` data is rehydrated.

### Behavior:
1. Detect life stage of Blobbi (`egg`, `child`, `adult`)
2. Based on stage, calculate `MAX_LOOKBACK_WINDOW`:
    - `egg`/`child`: `now - 2 hours`
    - `adult`: `now - 24 hours`
3. Query relay for `kind: 14919` events authored by the user and tagged for that Blobbi within that window.
4. Extract relevant actions for the stage.
5. For each action:
    - Take the most recent event timestamp.
    - Use it to calculate cooldown expiration.
6. Store these in cache/IndexedDB and reflect in UI.

---

## 🖼️ UI Expectations (`src/components/blobbi/BlobbiActions.tsx`)

### Must:
- Show cooldowns **based on the latest synced event**, not local timestamps
- If action is in cooldown: disable button + show timer
- If action is available: enable button
- Sync with relay **before initializing UI**, so that data is always fresh
- Even when opened on a different browser or tab, the cooldowns should reflect the same values (shared truth)

### Optional:
- Manual refresh button to re-sync from relay
- Error icon if sync fails (uses local fallback only)

---

## 🔍 Hook Behavior: `useBlobbiCooldowns.ts`

### Core Responsibilities:
- Determine current stage
- On init:
    - Try cache
    - Fallback to IndexedDB
    - If no data or expired: fetch from relay
- Update cooldowns every second
- Sync with UI (reactive state)
- Graceful handling for offline state

---

## 📈 Data Flow

### App Initialization:
1. Get Blobbi stage
2. Look up cooldowns from memory → fallback to IndexedDB
3. If no valid cooldown exists, **fetch from relay**
4. Populate in-memory cache
5. Update UI with accurate cooldowns

### Performing an Action:
1. Check current cooldowns for action
2. If action allowed:
    - Send interaction to relay (emit `kind: 14919`)
    - Update local cooldown immediately
3. If on cooldown:
    - Block action
    - Show remaining time

---

## ⚠️ Critical Implementation Points

- Events must **always be fetched** when accessing `/blobbi`
- Sync window must be limited (max 2h or 24h based on stage)
- UI must be based on synced data — avoid relying only on local timestamps
- Cooldowns should behave identically across devices/sessions
- Cooldown state should be **reconstructible from Nostr events alone**

---

## 🔒 Integrity & Security

- Relay events (`kind: 14919`) are immutable, verifiable logs
- Timestamps are based on Nostr event creation (`created_at`)
- Cannot be forged or reset by local client
- Client trust is minimized — sync always possible from relay

---

## 🧪 Testing Scenarios

### Unit Tests:
- Cooldown math per action
- Stage-based filtering
- Event-to-cooldown translation
- Storage fallback behavior

### Integration Tests:
- Simulate multiple tabs/devices with different cooldown timestamps
- Check synchronization correctness
- Offline fallback behavior

---

## ✅ Summary

By enforcing relay-based synchronization and scoped sync windows, the cooldown system guarantees that Blobbi interactions remain consistent across tabs, devices, and sessions. Every cooldown is backed by an immutable event and respected by the UI. Local storage acts only as a convenience cache — never the source of truth.

---