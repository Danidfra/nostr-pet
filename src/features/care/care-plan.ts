/**
 * Care planning: what a care action changes, composed from kit primitives.
 *
 * Everything here is pure and every number comes from `@blobbi-kit`:
 *
 *  - decay:        `applyBlobbiDecay` (sleep regime included);
 *  - care effect:  the kit's own per-action care effect, obtained by running
 *                  `consolidateSocialInteractions` on the interaction this
 *                  action emits (the same effect the kit applies to a feed,
 *                  play or clean from anyone else). Item-specific effects
 *                  arrive with the inventory milestone through the kit's
 *                  `CatalogAdapter`; nothing local defines a stat delta;
 *  - XP:           `calculateInventoryActionXP` + `applyXPGain`;
 *  - streak:       `getStreakTagUpdates`;
 *  - tags:         `statsToTagUpdates` + `updateBlobbiTags`, which keep every
 *                  unmanaged tag and stamp `last_interaction` / `last_decay_at`.
 *
 * Rest has no dedicated kit primitive: as in Ditto, resting is the `state`
 * tag flipping between `active` and `sleeping` on a decayed, streak-updated
 * republish. Hibernation is not toggled from here.
 */
import {
  BLOBBI_ACTIVITY_STATES,
  KIND_BLOBBI_INTERACTION,
  KIND_BLOBBI_STATE,
  INTERNAL_TO_INTERACTION_ACTION,
  applyBlobbiDecay,
  buildInteractionEventTemplate,
  consolidateSocialInteractions,
  getVisibleStats,
  parseInteractionEvent,
  statsToTagUpdates,
  updateBlobbiTags,
  type BlobbiCompanion,
  type BlobbiState,
  type BlobbiStats,
  type InteractionEventParams,
  type NostrEvent,
} from '@blobbi-kit/core';
import { applyXPGain, calculateInventoryActionXP, getStreakTagUpdates, type PublishEventTemplate } from '@blobbi-kit/react';

export type CareAction = 'feed' | 'play' | 'clean' | 'rest';
export type CareInteraction = Exclude<CareAction, 'rest'>;

/** The `source` tag every interaction this app emits carries. */
export const CARE_SOURCE = 'blobbi-home';

/** The stat each interaction is about, for the UI and for stage visibility. */
export const CARE_PRIMARY_STAT: Record<CareInteraction, keyof BlobbiStats> = {
  feed: 'hunger',
  play: 'happiness',
  clean: 'hygiene',
};

/**
 * Egg semantics, carried from the ecosystem (Ditto's item rules): an egg can
 * be cleaned, not fed or played with. The kit has no stage-gating primitive
 * for care yet; this is the one rule the home states itself.
 */
const EGG_CARE: ReadonlySet<CareInteraction> = new Set(['clean']);

export interface CareAvailability {
  action: CareAction;
  /** What the button says. Rest reads "Wake" for a sleeping Blobbi. */
  label: string;
  available: boolean;
  /** Why not, in the player's words. */
  reason?: string;
}

const STATE_REASON: Record<Exclude<BlobbiState, 'active'>, string> = {
  sleeping: 'Sleeping right now. Wake up first.',
  hibernating: 'Hibernating. Nothing to do here for now.',
};

/** Which care actions make sense for this Blobbi, and why the others do not. */
export function availableCareActions(companion: BlobbiCompanion): CareAvailability[] {
  const visible = new Set(getVisibleStats(companion.stage));
  const interactions: CareInteraction[] = ['feed', 'play', 'clean'];

  const list: CareAvailability[] = interactions.map((action) => {
    if (companion.stage === 'egg' && !EGG_CARE.has(action)) {
      return { action, label: capitalize(action), available: false, reason: 'Not until it hatches.' };
    }
    if (!visible.has(CARE_PRIMARY_STAT[action])) {
      return { action, label: capitalize(action), available: false, reason: 'Not at this stage.' };
    }
    if (companion.state !== 'active') {
      return { action, label: capitalize(action), available: false, reason: STATE_REASON[companion.state] };
    }
    return { action, label: capitalize(action), available: true };
  });

  if (companion.state === 'hibernating') {
    list.push({ action: 'rest', label: 'Rest', available: false, reason: STATE_REASON.hibernating });
  } else {
    list.push({ action: 'rest', label: companion.state === 'sleeping' ? 'Wake' : 'Rest', available: true });
  }
  return list;
}

export interface CarePlan {
  /** The kind 31124 republish, ready for the publish adapter. */
  event: PublishEventTemplate & { tags: string[][]; content: string; prev: NostrEvent };
  /** The kind 1124 interaction to emit after the republish, when there is one. */
  interaction?: InteractionEventParams;
  /** Net stat change this action produced on top of decay (only non-zero entries). */
  statsChanged: Partial<BlobbiStats>;
  xpGained: number;
  /** The activity state after the action. */
  nextState: BlobbiState;
}

/** Feed, play or clean: decay, then the kit's care effect for that action. */
export function planCareInteraction(companion: BlobbiCompanion, action: CareInteraction, now: number): CarePlan {
  const interactionAction = INTERNAL_TO_INTERACTION_ACTION[action];
  if (!interactionAction) throw new Error(`No interaction for ${action}`);

  const interaction: InteractionEventParams = {
    ownerPubkey: companion.event.pubkey,
    blobbiDTag: companion.d,
    action: interactionAction,
    source: CARE_SOURCE,
  };

  // The effect is the kit's: parse the very interaction we are about to emit
  // and let the kit's consolidation apply its per-action care effect.
  const template = buildInteractionEventTemplate(interaction);
  const parsed = parseInteractionEvent({
    ...template,
    kind: KIND_BLOBBI_INTERACTION,
    id: '',
    sig: '',
    pubkey: companion.event.pubkey,
    created_at: now,
  });
  if (!parsed) throw new Error('The kit refused this interaction');

  const decayed = applyBlobbiDecay({
    stage: companion.stage,
    state: companion.state,
    stats: companion.stats,
    lastDecayAt: companion.lastDecayAt,
    now,
  });
  const { stats } = consolidateSocialInteractions(decayed.stats, [parsed]);

  const xpGained = calculateInventoryActionXP(action, 1);
  const experience = applyXPGain(companion.experience, xpGained);
  const streak = getStreakTagUpdates(companion, new Date(now * 1000)) ?? {};

  const tags = updateBlobbiTags(companion.allTags, {
    ...statsToTagUpdates(stats, now),
    experience: String(experience),
    ...streak,
  });

  return {
    event: { kind: KIND_BLOBBI_STATE, content: companion.event.content, tags, prev: companion.event },
    interaction,
    statsChanged: diffStats(decayed.stats, stats),
    xpGained,
    nextState: companion.state,
  };
}

/** Rest or wake: decay under the current regime, then flip the activity state. */
export function planRestToggle(companion: BlobbiCompanion, now: number): CarePlan {
  if (companion.state === 'hibernating') throw new Error(STATE_REASON.hibernating);
  const nextState: BlobbiState = companion.state === 'sleeping' ? 'active' : 'sleeping';
  if (!BLOBBI_ACTIVITY_STATES.includes(nextState)) throw new Error(`Unknown state ${nextState}`);

  const decayed = applyBlobbiDecay({
    stage: companion.stage,
    state: companion.state,
    stats: companion.stats,
    lastDecayAt: companion.lastDecayAt,
    now,
  });
  const streak = getStreakTagUpdates(companion, new Date(now * 1000)) ?? {};
  const tags = updateBlobbiTags(companion.allTags, {
    ...statsToTagUpdates(decayed.stats, now),
    state: nextState,
    ...streak,
  });

  return {
    event: { kind: KIND_BLOBBI_STATE, content: companion.event.content, tags, prev: companion.event },
    statsChanged: {},
    xpGained: 0,
    nextState,
  };
}

export function planCareAction(companion: BlobbiCompanion, action: CareAction, now: number): CarePlan {
  return action === 'rest' ? planRestToggle(companion, now) : planCareInteraction(companion, action, now);
}

function diffStats(before: BlobbiStats, after: BlobbiStats): Partial<BlobbiStats> {
  const out: Partial<BlobbiStats> = {};
  for (const key of Object.keys(after) as (keyof BlobbiStats)[]) {
    const delta = after[key] - before[key];
    if (delta !== 0) out[key] = delta;
  }
  return out;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
