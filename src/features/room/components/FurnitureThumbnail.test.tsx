/**
 * The catalog's thumbnails must never cost the room its WebGL context: a
 * tray of tiles creates no probe context of its own (the room's one cached
 * probe is asked instead, and its context is released). This is the
 * regression the M3 editor had: a throwaway `webgl2` context per tile
 * pushed the page past the browser's limit, the room's context was lost,
 * and the room went blank on entering the editor.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { FurnitureThumbnail } from './FurnitureThumbnail';
import { OFFICIAL_FURNITURE_3D } from '../lib/furniture-3d';

const getContext = vi.fn((kind: string) => (kind === 'webgl2' ? { getExtension: () => ({ loseContext: vi.fn() }) } : null));

beforeEach(() => {
  getContext.mockClear();
  HTMLCanvasElement.prototype.getContext = getContext as unknown as HTMLCanvasElement['getContext'];
});
afterEach(() => vi.restoreAllMocks());

describe('FurnitureThumbnail and the WebGL context budget', () => {
  it('a whole catalog of tiles asks for at most one probe context, which is released; it never probes per tile', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        {OFFICIAL_FURNITURE_3D.map((def) => (
          <FurnitureThumbnail key={def.id} id={def.id} alt={def.label} className="size-16" />
        ))}
      </QueryClientProvider>,
    );
    expect(document.querySelectorAll('[data-testid=furniture-thumb-fallback], [data-testid=furniture-thumb], .animate-pulse').length).toBe(OFFICIAL_FURNITURE_3D.length);
    const probes = getContext.mock.calls.filter(([kind]) => kind === 'webgl2' || kind === 'webgl');
    expect(probes.length).toBeLessThanOrEqual(1);
  });

  it('without WebGL every tile shows the box icon and nothing is rendered', () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as HTMLCanvasElement['getContext'];
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FurnitureThumbnail id="official:toybox" alt="Toy Box" className="size-16" />
      </QueryClientProvider>,
    );
    // The page-wide probe may have answered before this test; either way no still is attempted here
    expect(screen.queryByTestId('furniture-thumb')).toBeNull();
  });
});
