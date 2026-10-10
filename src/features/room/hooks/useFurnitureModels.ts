/**
 * Resolve furniture placements to Simple Nostr Object trees for the 3D room.
 *
 * Only official furniture, from the bundled models, built once per id and
 * cached. Ditto also fetches `sno:` placements from relays here; that
 * arrives with the milestone that places network objects, and until then an
 * unknown id has no model and is skipped by the scene.
 */

import { useMemo } from 'react';

import { isOfficialFurnitureId } from '../lib/furniture-3d';
import type { FurniturePlacement } from '../lib/room-furniture';
import { getOfficialModel, type ModelExtras } from '../lib/scene/official-models';
import { snoNodeFromPayload, type SnoNode } from '../lib/scene/sno-object';

export interface FurnitureModel {
  node: SnoNode;
  extras?: ModelExtras;
  /** Object name, from the model. */
  name: string;
  /** A stand-in for an object that couldn't be loaded. */
  missing?: boolean;
}

const officialNodes = new Map<string, FurnitureModel | null>();

/** Official model as a parsed SNO tree, or null if the ID has no model. */
export function getOfficialFurnitureModel(id: string): FurnitureModel | null {
  const cached = officialNodes.get(id);
  if (cached !== undefined) return cached;
  const model = getOfficialModel(id);
  const result: FurnitureModel | null = model ? { node: snoNodeFromPayload(model.payload), extras: model.extras, name: model.payload.name } : null;
  officialNodes.set(id, result);
  return result;
}

/** Models for each placement, by array index. Placements without a model are absent. */
export function useFurnitureModels(placements: readonly FurniturePlacement[] | undefined): Map<number, FurnitureModel> {
  return useMemo(() => {
    const models = new Map<number, FurnitureModel>();
    (placements ?? []).forEach((p, i) => {
      const model = isOfficialFurnitureId(p.id) ? getOfficialFurnitureModel(p.id) : null;
      if (model) models.set(i, model);
    });
    return models;
  }, [placements]);
}
