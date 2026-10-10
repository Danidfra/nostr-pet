/**
 * Still pictures of many Blobbis from one WebGL context: the lab's
 * comparison matrix. Browsers cap live contexts (about sixteen, the oldest
 * lost past that), so a grid of stages is not an option; one stage draws
 * each model from each view in turn and hands back PNG data URLs.
 */
import type { BlobbiGenome } from '@blobbi-kit/renderer/procedural';
import { buildBlobbiModel } from './model';
import { morphologyOf, type Blobbi3dStage } from './identity';
import { BlobbiStage, type StageView } from './stage';

export type StillView = Exclude<StageView, 'turn'>;

export interface StillRequest {
  id: string;
  genome: BlobbiGenome;
  stage: Blobbi3dStage;
}

export interface Still {
  id: string;
  view: StillView;
  url: string;
}

/**
 * Draw each request from each view, calling back as each still is ready,
 * yielding to the page between requests. Resolves when all are drawn or
 * `signal` aborts. Throws if no context can be had.
 */
export async function renderStills(requests: readonly StillRequest[], views: readonly StillView[], size: number, onStill: (still: Still) => void, signal?: AbortSignal): Promise<void> {
  const host = document.createElement('div');
  const stage = new BlobbiStage(host, { reducedMotion: () => true });
  try {
    stage.resize(size, size);
    for (const request of requests) {
      if (signal?.aborted) return;
      const model = buildBlobbiModel(morphologyOf(request.genome, request.stage), request.genome.seed);
      stage.setModel(model);
      for (const view of views) {
        stage.setView(view);
        onStill({ id: request.id, view, url: stage.snapshot() });
      }
      stage.setModel(null);
      model.dispose();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    stage.dispose();
  }
}
