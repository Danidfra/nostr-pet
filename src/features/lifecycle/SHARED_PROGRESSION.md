# Shared progression across the Blobbi ecosystem: an architectural proposal (M14.2)

*Status: proposal. Nothing here is implemented; no kit change, no new kind.
The findings are from the code as it stands on 2026-10-13 (`@blobbi-kit/core`
0.9, `@blobbi-kit/react` 0.9, this app's `src/features/lifecycle/`).*

## 1. The question

A player should be able to work toward hatching or evolving in Standalone,
continue in Blobbi Island and finish in a future Blobbi Carrier. Different
games contribute to the same objective without implementing the same
activity: "Build a stronger bond" is care and play here, exploration on the
Island, travelling together in Carrier. The canonical transition (egg → baby,
baby → adult) must stay what it is: one kind 31124 republish by the owner's
key, valid for every existing Blobbi.

## 2. What the protocol can represent today

### 2.1 Where progression lives

| Fact | Where | Written by | Read by |
|---|---|---|---|
| Stage, `progression_state`, `progression_started_at` | kind 31124 **tags** | the transition hooks | every app |
| Mission progress for the pending transition | kind 31124 **content**, `{"evolution": Mission[]}` | the host, in the same republish as the care action | `useHatchTasks` / `useEvolveTasks` |
| The care actions themselves | kind 1124 receipts (`a` → the Blobbi) | every app that cares | the Journey, the flame, the Island |
| Daily missions, XP, level | kind 11125 content and tags | the kit's daily hooks | every app |
| Ditto's adventures (themes, colour moments, profile tabs) | kinds 36767, 3367, 16769, 0 | Ditto, espy | the kit's task hooks, as a **backfill** |

A `Mission` is `{ id, target, count }` (a tally) or `{ id, target, events[] }`
(event ids). Completion is derived: `count ≥ target` or `events.length ≥
target`. `serializeEvolutionContent` keeps unknown top-level keys of the
content, so the content can carry more than the kit reads.

### 2.2 How completion is decided

`useHatchTasks` and `useEvolveTasks` (`@blobbi-kit/react`) map the kit's
**static** mission definitions (`HATCH_MISSIONS`, `EVOLVE_MISSIONS`) over the
`evolution[]` array, and take the larger of the stored progress and a live
query of the Ditto/espy event kinds since `progression_started_at`. The
`interactions` tally is incremented only by the host (`mission-tally.ts`
here, the same in Ditto) and written back in the care republish. Nothing in
the kit increments anything by itself, and **the transition hooks
(`useBlobbiHatch`, `useBlobbiEvolve`) enforce no mission at all**: whether to
offer the button is each host's policy. Standalone's policy since M14.1
(`homeMissionsDone`): the transition opens once every mission that can be
done here is done; the Ditto/espy missions are shown as optional adventures.

### 2.3 The checklist, honestly

| Requirement | Today | Why |
|---|---|---|
| Shared mission identifiers | **Partly.** `Mission.id` is a shared string, but the set is the kit's static list; an id no definition knows is dropped by `migrateEvolutionMissions` when a host "repairs" the array | ids exist, the vocabulary is closed |
| Partial progress | **Yes** for tallies and event lists | `count`, `events[]` |
| Completion state | **Derived, not recorded.** `count ≥ target`; no "completed at", no "completed by" | fine for a tally, lossy for an audit |
| Contributions from different apps | **No attribution.** A tally is one number. Two apps incrementing it both republish the whole 31124 | last writer wins |
| Idempotent updates | **Event missions yes** (ids are deduplicated). **Tallies no**: a retried republish, or two apps each adding one, double-counts | a tally has no memory of what was counted |
| Cross-device reconstruction | **Yes.** The content is the canonical record; a fresh device reads it from the relays (verified in `m14-1-reliability.test.tsx`) | |
| Protection against duplicate progress | **Event missions yes; tallies no** (above) | |
| Safe concurrent updates | **No.** Kind 31124 is a replaceable event: two apps republishing within the same second or from stale reads overwrite each other's `evolution[]`, and the stats, and anything else in the content | the kit's `fetchFreshBlobbiBeforeAction` narrows the window, nothing closes it |
| Game-specific activities feeding a shared objective | **No.** A mission's definition *is* an activity (create a theme in Ditto) | the id names the activity, not the objective |

So: sharing a tag or an id is not sufficient. Two things are missing: a
**contribution** that is its own record (idempotent, attributed, append-only),
and an **objective** that is separate from the activity that fulfils it.

## 3. The proposal: objectives, contributions, and one canonical fold

### 3.1 Three separate things

1. **Shared objectives** (ecosystem vocabulary, small and stable): what a
   Blobbi must do to grow. Proposed first set, mapped onto the kit's existing
   gates so no existing Blobbi changes meaning:
   - `bond` — "Build a stronger bond". Target 7 for the hatch, 21 for the
     evolution (today's `interactions`).
   - `wellbeing` — "Be well looked after". The dynamic stat gate (every stat
     ≥ 80 at the moment of evolving), computed, never stored.
   - `wonder` — "See something new" (today's theme + colour-moment missions,
     folded into one objective any world can serve).
   Each objective has an `id`, a `target` per transition and a line of copy.
   Objectives never name an app.

2. **Game-specific activities**: what each app does that counts toward an
   objective, and how much. Standalone: a feed, a play, a bath, a medicine
   → `bond` +1 each (as today). Island: an exploration milestone → `bond` +1,
   a new place → `wonder` +1. Carrier: a trip together → `bond` +2. Ditto: a
   theme → `wonder` +1. The mapping is each app's, declared in its code,
   never in the protocol.

3. **Canonical lifecycle transitions**: unchanged. The hatch and the
   evolution stay `useBlobbiHatch` / `useBlobbiEvolve`, one republish of the
   31124 by the owner, with the stats as they are. Eligibility is computed
   from the objectives (below) at the moment of the transition, by the app
   performing it, the way each app already decides whether to offer the
   button.

### 3.2 Contributions as records (no new kind)

The kind 1124 interaction receipt already is a per-action, signed, append-only
record pointing at the Blobbi (`a` tag), written by every app that cares, and
read by the Journey and the Island. A contribution is a 1124 with two more
tags:

```
["a", "31124:<owner>:<d>"]          existing
["action", "feed"]                   existing
["objective", "bond", "1"]           NEW: the shared objective and the amount
["client", "blobbi-standalone"]      existing in this app's writes: the attribution
```

- **Idempotent:** a contribution is an event; counting is `distinct event ids`
  per objective since `progression_started_at`. A retry republishes the same
  id; two apps' actions are two events. Nothing double-counts.
- **Attributed:** the `client` tag (already written here) says who
  contributed; the Journey can show "3 from the Island, 18 at home".
- **Concurrent:** 1124s are not replaceable; two apps writing at once lose
  nothing. The 31124 is republished only by the transition itself.
- **Cross-device:** read from the relays by `#a` and `authors`, as the
  Journey reads receipts today (`care-receipts.ts`).
- **No new kind, no change to 31124's shape.** An app that does not yet write
  the `objective` tag still contributes through its `action` tag: the reader
  maps `action` → `bond +1` for the known care actions, so **every existing
  receipt counts and every existing Blobbi is compatible**.

### 3.3 The fold: one summary in the 31124 content

Receipts can be many; the kit's hooks and every app already read the
`evolution[]` summary. Proposed: the summary stays, with one new entry shape
the kit preserves today as an unknown key:

```json
{
  "evolution": [ { "id": "interactions", "target": 21, "count": 18 } ],
  "objectives": {
    "bond":   { "target": 21, "count": 18, "last": "<1124 id>", "by": { "blobbi-standalone": 15, "blobbi-island": 3 } },
    "wonder": { "target": 3,  "count": 1,  "last": "<id>", "by": { "ditto": 1 } }
  }
}
```

- The fold is a **cache**, never the truth: any app may rebuild it from the
  receipts, and the eligibility check at the transition recounts the receipts
  (the kit's `ensureCanonicalBeforeAction` fresh read, plus a receipt query)
  rather than trusting the number.
- `last` is the newest receipt folded, so a fold is idempotent: receipts at or
  before `last` are already in.
- `evolution[]` keeps the kit's current meaning (the `interactions` tally
  mirrors `bond.count`), so Ditto's and the kit's task hooks keep working
  unchanged on a Blobbi whose progression came from other worlds.
- Written only in a republish an app makes anyway (a care action, a
  transition), as the tally is today. No background writes.

### 3.4 Where the code goes

A small shared module, first inside this app (`src/features/progression/
shared/`), extracted into `@blobbi-kit/core` once two apps use it:

| Operation (conceptual) | Pure or I/O | Notes |
|---|---|---|
| `recordContribution(action, objective, amount)` → the two tags for a 1124 template | pure | the app signs and publishes as it does today |
| `readContributions(receipts, startedAt)` → `{ [objective]: { count, ids, by } }` | pure | counts distinct ids since `progression_started_at`; maps legacy `action` → `bond` |
| `foldObjectives(content, contributions)` → new content string | pure | preserves unknown keys; mirrors `interactions` |
| `lifecycleEligibility(stage, objectives, stats, policy)` → `{ ready, missing[] }` | pure | each app passes its policy (which objectives it requires); the stat gate stays dynamic |
| `markObjectiveComplete` | **not needed** | completion is derived from the count; a "complete" flag would be a second truth |

Standalone would adopt it first: `mission-tally.ts` writes the `objective` tag
beside `action`, `care-receipts.ts` reads contributions, `lifecycle-view.ts`
computes readiness from objectives with the same policy as today (`bond`
required, `wonder` optional here). Nothing a player sees changes except the
Journey being able to say where the progress came from.

## 4. Compatibility

- **Existing Blobbis:** unchanged events, unchanged meaning. A Blobbi mid-
  evolution keeps its `evolution[]`; the first fold adds `objectives` beside
  it from the receipts that exist.
- **Existing canonical events:** the 31124 tags are untouched; the content
  gains a key the kit already round-trips as unknown. The 1124 gains two
  optional tags.
- **Ditto:** unchanged in this milestone. Its `useEvolveTasks` keeps reading
  `evolution[]`; a Blobbi evolved from Island contributions shows the kit's
  Ditto missions as incomplete in Ditto's UI until Ditto reads objectives.
  That is the one visible seam, and it exists today already (M14.1 policy).
- **Kit:** no change required to start. Two changes would make it clean later:
  `migrateEvolutionMissions` preserving unknown ids, and the task hooks
  reading `objectives` when present.
- **Guests:** the guest world holds unsigned 1124 records already; the
  contribution tags ride in them and travel in the 31124 fold at the save.

## 5. Risks and what needs a decision

1. **Who requires what.** Each app decides eligibility; the protocol does not.
   That is the current reality made explicit. If the ecosystem wants one
   rule, it belongs in the kit's hooks, which would be a kit change and a
   decision for every app.
2. **Amounts.** Carrier's "+2 per trip" is a balance question; the protocol
   carries any integer. A reader should clamp per-event amounts (say ≤ 5)
   so no client can complete an objective in one event.
3. **Receipt volume.** A receipt per care action is today's practice; counting
   is bounded by `progression_started_at`.
4. **Trust.** Receipts are signed by the owner, as care is today; a modified
   client can forge progress for its own Blobbi, exactly as it can today by
   editing `evolution[]`. Nothing here changes the trust model.
5. **New event kinds:** none proposed. If an ecosystem-wide objective registry
   is ever wanted (new objectives without a kit release), that would be a
   replaceable definition event by a trusted issuer, and a decision for later.

## 6. What this milestone does

Nothing of the above is implemented. Standalone keeps the M14.1 policy
(`homeMissionsDone`), which is compatible with every step of this proposal.
The next step, if approved: the pure module and the `objective` tag on this
app's receipts (additive, readable by nobody else yet), then the fold, then a
kit PR for the two reader changes.
