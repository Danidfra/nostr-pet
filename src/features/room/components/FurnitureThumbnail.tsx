/**
 * FurnitureThumbnail — a rendered still of a furniture item's 3D model, for
 * the decorator's catalog. Shows a box icon without WebGL (and in tests).
 *
 * Stills render one at a time on one shared WebGL context, released once
 * the catalog has finished: browsers allow only a handful of contexts, and a
 * fresh one per still would recompile every shader each time. Nothing here
 * creates a context of its own to ask whether WebGL exists: that is the
 * room's one cached probe, because every live context past the browser's
 * limit costs the oldest one, the room's.
 */
import { useQuery } from '@tanstack/react-query';
import { Box } from 'lucide-react';

import { cx } from '../lib/cx';
import type { StillRenderer } from '../lib/scene/still-renderer';
import { getOfficialFurnitureModel, type FurnitureModel } from '../hooks/useFurnitureModels';
import { webglAvailable } from '../hooks/useRoomScene';

const THUMB_PX = 192;
/** Idle time after the last still before the context is released. */
const RELEASE_MS = 3000;

let queue: Promise<unknown> = Promise.resolve();
let stills: StillRenderer | null | undefined;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

/** A still's object URL. Rejects when it couldn't be rendered, so it isn't cached and is tried again next time. */
function renderQueued(model: FurnitureModel): Promise<string> {
  const next = queue.then(async () => {
    clearTimeout(releaseTimer);
    const [{ createStillRenderer }, { buildSnoObject }] = await Promise.all([import('../lib/scene/still-renderer'), import('../lib/scene/sno-three')]);
    if (stills === undefined) stills = createStillRenderer() ?? null;
    const blob = await stills?.render(buildSnoObject(model.node), THUMB_PX, THUMB_PX);
    if (!blob) throw new Error('Still not rendered');
    return URL.createObjectURL(blob);
  });
  queue = next.catch(() => undefined).finally(() => {
    clearTimeout(releaseTimer);
    releaseTimer = setTimeout(() => {
      stills?.dispose();
      stills = undefined;
    }, RELEASE_MS);
  });
  return next;
}

interface FurnitureThumbnailProps {
  id: string;
  /** For network objects, the already-resolved model. */
  model?: FurnitureModel;
  alt: string;
  className?: string;
}

export function FurnitureThumbnail({ id, model, alt, className }: FurnitureThumbnailProps) {
  const resolved = model ?? getOfficialFurnitureModel(id) ?? undefined;
  const still = useQuery({
    queryKey: ['room-furniture-thumb', id],
    queryFn: () => renderQueued(resolved!),
    // The one page-wide WebGL check (useRoomScene): a probe context per tile would exhaust the browser's
    // context limit and lose the room's own context (the room went blank on entering the editor)
    enabled: !!resolved && !resolved.missing && webglAvailable(),
    staleTime: Infinity,
    gcTime: Infinity,
    // A failed still is tried again when the catalog next shows it, not in a loop
    retry: false,
  });

  if (still.data) return <img src={still.data} alt={alt} className={cx('object-contain', className)} draggable={false} data-testid="furniture-thumb" />;
  if (resolved && !resolved.missing && still.isLoading) return <span className={cx('rounded-md bg-foreground/10 animate-pulse', className)} aria-hidden />;
  return <Box className={cx('text-muted-foreground p-2', className)} aria-label={alt} data-testid="furniture-thumb-fallback" />;
}
