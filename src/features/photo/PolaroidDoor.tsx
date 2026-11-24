import { Suspense, lazy } from 'react';
import type { PolaroidSheetProps } from './PolaroidSheet';

const PolaroidSheet = lazy(() => import('./PolaroidSheet'));

/**
 * The Polaroid sheet, loaded the first time it is opened: the canvas work,
 * the frames and the kit's string renderer stay out of the home's bundle
 * until a photo is wanted. Nothing is mounted (and nothing fetched) before.
 */
export function PolaroidDoor(props: PolaroidSheetProps) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <PolaroidSheet {...props} />
    </Suspense>
  );
}
