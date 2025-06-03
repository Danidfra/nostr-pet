# 🐣 Blobbi Incubation & Evolution System (via Nostr)

This document outlines the incubation system for Blobbi (from egg to baby) and the process of evolving into an adult using interactions on the Nostr network.

---

## 🚀 Overview

When a user adopts a Blobbi (in egg form), they must complete a set of **social interactions on Nostr** in order to make it **hatch**. Later, more interactions — combined with the passage of time — will allow the Blobbi to evolve into an adult.

All progress is tracked by **listening to event kinds via WebSocket connections** to the user's Nostr relays.

---

## 🥚 Egg Hatching Criteria

To hatch a Blobbi egg, the user must complete the following Nostr interactions:

1. **Publish a post using the #Blobbi hashtag** (`kind:1` containing #Blobbi)
2. **Publish the first post** (`kind:1`)
3. **Follow someone** (`kind:3`)
4. **Like any post** (`kind:7`)

Once all 4 tasks are completed, the egg will hatch and reveal the Blobbi.

> During the egg phase, the `incubation_progress` tag will represent a progress bar divided into **4 parts**, one for each task.

---

## 🧬 Evolution to Adult Blobbi

After hatching, the Blobbi must grow by interacting more with Nostr. Evolution is only possible after **at least 1 full day has passed** since the egg hatched.

### Required interactions for evolution:
- Publish **3 new posts**
- **Repost** at least 2 posts from other users
- Receive at least **5 likes** from different people
- **Receive** or **send** a zap (if supported by the client)
- **Reply** to someone’s post
- Use any **custom tag or emoji reaction** (`kind:6` or `kind:7` with `tags`)
- **Post an image of your Blobbi** (`kind:1` containing an image link ending in .jpg, .png, or .gif)

These actions do not need to happen all at once, but they must be completed before evolution can happen.

> Once the Blobbi reaches the adult stage, the `incubation_progress` tag will be **removed**, and a new tag called `evolve_progress` will be used instead. This tag tracks the completion of **14 evolution tasks**.

---

## 🔗 Relay Listening & Event Handling

Once the user adopts an egg, the app opens a **persistent WebSocket connection** to one or more Nostr relays defined by the client.

The app must then:
- Keep listening for events from the user’s pubkey
- Watch for specific `kind`s: `0`, `1`, `3`, `6`, `7`, `9735` and more if needed
- Filter by `authors: [userPubKey]`, and optionally by `#p` for related events

> When a matching event is received, mark that objective as completed and update the appropriate progress tag (`incubation_progress` or `evolve_progress`).  
> Keep the socket open to wait for the remaining objectives.

---

## 🧾 Task Confirmation Events

Every time the app detects one of the required interactions (tasks) has been performed, it will:

1. **Mark the task as completed locally**
2. **Publish a confirmation to Nostr using `kind: 31124`**
   - The event will include a tag in the format: `(<task_name>)_confirmed`
   - The value for the tag will be `true`
   – The value of the current progress tag will also increase, based on the number of tasks completed per stage.

This allows external systems or users to verify task completion via the Nostr protocol itself.

Example confirmation tag:
```json
["(first_post)_confirmed", "true"]
```

These confirmation events will be published automatically and can be subscribed to by any client watching the user’s activity.

### 📊 Task Progress Breakdown

The total number of tasks that impact the progress tags are distributed as follows:

| Stage                 | Task Count | Tag Used             |
|----------------------|------------|----------------------|
| 🥚 Egg Hatching       | 4 tasks    | `incubation_progress` |
| 🧬 Evolution to Adult | 14 tasks   | `evolve_progress`      |
| **Total**            | **18 tasks** | —                    |

Each completed task should increment the relevant tag by `+1`. This progress helps track how far the Blobbi has advanced from egg to adulthood and can be verified publicly through the user's `kind: 31124` event.

---

## ✅ Recommended Relay Filters

Here’s an example of a lightweight and effective filter:

```json
{
  "kinds": [1, 3, 6, 7, 9735],
  "authors": ["<userPubKey>"],
  "#p": ["<userPubKey>"]
}
```

This ensures:
- Events **by** the user (posts, likes, follows, zaps, etc.)
- Events **about** the user (like reposts of their posts)

---

## 🧠 Best Practices for Listening to Nostr Relays

To keep the system light and responsive:

- Use a **small list of reliable relays** (2–5 max)
- Always use **specific filters** with `authors` and `kinds`
- Avoid excessive reconnects or constantly reopening sockets
- Cache previously seen events to prevent duplicates
- Consider pausing listening when the app is not visible (to save resources)

---

## 🧬 Blobbi Evolution System – Relay & Subscription Guide

This guide defines how the WebSocket subscription flow should work for the new Blobbi evolution system to ensure stability, reduce redundancy, and maintain efficient performance.

---

### 🔄 Subscription Flow & Connection Management

To avoid redundant WebSocket activity and maintain efficient relay communication, the system must follow a **single-request, persistent-subscription** model.

#### 🧷 How to structure the subscription flow:

1. **Initial Load (kind: 31124):**
   - On page or session start, initiate **only one request** for `kind: 31124` using the user's pubkey.
   - This request is used to **fetch Blobbi metadata**, task confirmations, and progress tags.

2. **Follow-up Real-Time Listening:**
   - After the `kind: 31124` fetch completes, immediately open **one persistent REQ** to listen for all user activity relevant to Blobbi tasks.
   - Use this filter:
     ```json
     {
       "kinds": [1, 3, 6, 7, 9735],
       "authors": ["<userPubKey>"],
       "#p": ["<userPubKey>"]
     }
     ```
   - **Do not close** this subscription unless the session ends or the user navigates away.

3. **Avoid creating repeated REQ+`CLOSE` pairs** for the same filter. This leads to:
   - Missed events
   - Resource overuse
   - Flickering task states or progress issues

---

### ✅ Reuse Existing Logic

Always use the system’s existing method for loading the Blobbi data via `kind: 31124` before initializing the open channel for tracking tasks. Ensure that:

- The second REQ is started only **after** the initial `kind: 31124` response is received.
- Both REQ connections remain open and live in parallel:
  - One for metadata and confirmation tracking (`kind: 31124`)
  - One for real-time task activity

---

This approach ensures a scalable and responsive system that respects relay connection best practices.


---

## 💡 Client Recommendations (To be added)

Create a dedicated section in the app to recommend Nostr clients that support these actions and are compatible with Ditto.pub. For example:

- Gleasonator (https://gleasonator.dev/)
- Ditto (https://ditto.pub/)
- Cobrafuma (https://cobrafuma.com/)

---

This system allows a more engaging, interactive evolution process using real decentralized social activity, instead of waiting based on a static timer.
