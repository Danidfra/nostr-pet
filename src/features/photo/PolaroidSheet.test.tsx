/**
 * The Photo sheet: the live preview follows the frame, the caption and the date; the picture shown is the picture
 * shared or saved; nothing worn that cannot be drawn is hidden from the player.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { parseModernBlobbiEvent, type BlobbiCompanion } from '@blobbi-kit/core';
import { blobbiEvent } from '@/test/fixtures';
import { PolaroidSheet } from './PolaroidSheet';
import { PolaroidDoor } from './PolaroidDoor';
import { PhotoTile } from './PhotoTile';
import { PhotoError, type PolaroidInput, type PolaroidResult } from './compose-polaroid';

vi.mock('@/features/home/shell/GameOverlay', () => ({
  GameOverlay: ({ children, open, title }: { children: React.ReactNode; open: boolean; title: string }) => (open ? <div role="dialog" aria-label={title}>{children}</div> : null),
}));

const blobbi = (stage: 'egg' | 'baby' | 'adult' = 'adult', state: 'active' | 'sleeping' = 'active'): BlobbiCompanion => parseModernBlobbiEvent(blobbiEvent('00000000f1', { name: 'Dotado', stage, state, visualGeneration: 'v3' }))!;

let urls = 0;
const revoked: string[] = [];

function composer(result: Partial<PolaroidResult> = {}) {
  return vi.fn<(input: PolaroidInput) => Promise<PolaroidResult>>(async () => ({ blob: new Blob(['png'], { type: 'image/png' }), width: 1080, height: 1350, skippedAccessories: 0, ...result }));
}

/** Let the redraw's rest pass and the picture arrive. */
async function develop() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  urls = 0;
  revoked.length = 0;
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => `blob:picture-${++urls}`), revokeObjectURL: vi.fn((url: string) => void revoked.push(url)) }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the Photo sheet', () => {
  it('develops a classic picture of the Blobbi, with its name, no caption and no date', async () => {
    const compose = composer();
    render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi()} compose={compose} />);
    expect(screen.getByTestId('polaroid-waiting')).toHaveTextContent('Developing');
    await develop();
    expect(compose).toHaveBeenCalledTimes(1);
    const input = compose.mock.calls[0][0];
    expect(input.frame).toBe('classic');
    expect(input.name).toBe('Dotado');
    expect(input.caption).toBe('');
    expect(input.date).toBeNull();
    expect(input.portrait).toMatchObject({ stage: 'adult', visualGeneration: 'v3', facing: 'front', expression: 'happy' });
    const preview = screen.getByTestId('polaroid-preview');
    expect(preview.tagName).toBe('IMG');
    expect(preview.getAttribute('src')).toBe('blob:picture-1');
    expect(preview.getAttribute('alt')).toBe('A classic Polaroid of Dotado');
    expect((screen.getByTestId('polaroid-date') as HTMLInputElement).checked).toBe(false);
  });

  it('a sleeper is photographed asleep; an egg with its shell as it is', async () => {
    const asleep = composer();
    const { unmount } = render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi('adult', 'sleeping')} compose={asleep} />);
    await develop();
    expect(asleep.mock.calls[0][0].portrait).toMatchObject({ eyesClosed: true });
    expect(asleep.mock.calls[0][0].portrait.expression).toBeUndefined();
    unmount();
    const egg = composer();
    render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi('egg')} eggCrack="medium" compose={egg} />);
    await develop();
    expect(egg.mock.calls[0][0].portrait).toMatchObject({ stage: 'egg', eggCrack: 'medium' });
  });

  it('the three frames are one choice; choosing one draws the picture again in it', async () => {
    const compose = composer();
    render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi()} compose={compose} />);
    await develop();
    const group = screen.getByRole('radiogroup', { name: 'Frame' });
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(3);
    expect(screen.getByTestId('polaroid-frame-classic').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('polaroid-frame-playful'));
    expect(screen.getByTestId('polaroid-frame-playful').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('polaroid-frame-classic').getAttribute('aria-checked')).toBe('false');
    // The last picture stays up while the new one develops
    expect(screen.getByTestId('polaroid-preview').getAttribute('src')).toBe('blob:picture-1');
    await develop();
    expect(compose.mock.calls[1][0].frame).toBe('playful');
    expect(screen.getByTestId('polaroid-preview').getAttribute('src')).toBe('blob:picture-2');
    expect(screen.getByTestId('polaroid-preview').getAttribute('alt')).toBe('A playful Polaroid of Dotado');
    expect(revoked).toEqual(['blob:picture-1']);
  });

  it('a caption is drawn once typing rests, cleaned and limited; the picture says it to a screen reader', async () => {
    const compose = composer();
    render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi()} compose={compose} />);
    await develop();
    const field = screen.getByLabelText(/Caption/) as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'our' } });
    fireEvent.change(field, { target: { value: 'our first' } });
    fireEvent.change(field, { target: { value: 'our first day ' } });
    expect(compose).toHaveBeenCalledTimes(1);
    await develop();
    expect(compose).toHaveBeenCalledTimes(2);
    expect(compose.mock.calls[1][0].caption).toBe('our first day');
    expect(screen.getByTestId('polaroid-preview').getAttribute('alt')).toBe('A classic Polaroid of Dotado, captioned “our first day”');
    expect(screen.getByTestId('polaroid-count')).toHaveTextContent('13 / 60');
    fireEvent.change(field, { target: { value: 'z'.repeat(500) } });
    expect(field.value).toHaveLength(60);
  });

  it('the date is off until asked for, and then it is today’s', async () => {
    const compose = composer();
    render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi()} compose={compose} now={() => new Date(2026, 10, 9)} />);
    await develop();
    expect(compose.mock.calls[0][0].date).toBeNull();
    fireEvent.click(screen.getByLabelText('Show today’s date'));
    await develop();
    expect(compose.mock.calls[1][0].date).toMatch(/2026/);
    expect(screen.getByTestId('polaroid-preview').getAttribute('alt')).toMatch(/, dated .*2026/);
  });

  it('passes on what it wears, and says when something could not be put in the picture', async () => {
    const compose = composer({ skippedAccessories: 1 });
    const hat = { id: 'hat', code: 'hat', slot: 'headwear', layer: 'front', layerRank: 4, xPercent: 50, yPercent: 20, scale: 1, rotationDeg: 0, flipX: false, imageUrl: 'https://cdn.example/hat.webp', sources: ['https://cdn.example/hat.webp'] } as const;
    render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi()} accessories={[hat]} compose={compose} />);
    await develop();
    expect(compose.mock.calls[0][0].accessories).toEqual([hat]);
    expect(screen.getByTestId('polaroid-skipped')).toHaveTextContent('One thing it wears could not be put in the picture.');
    expect(screen.getByTestId('polaroid-preview')).toBeInTheDocument();
  });

  it('the same accessories on a new render do not develop the picture again', async () => {
    const compose = composer();
    const hat = () => [{ id: 'hat', code: 'hat', slot: 'headwear' as const, layer: 'front' as const, layerRank: 4, xPercent: 50, yPercent: 20, scale: 1, rotationDeg: 0, flipX: false, imageUrl: 'https://cdn.example/hat.webp', sources: ['https://cdn.example/hat.webp'] }];
    const subject = blobbi();
    const { rerender } = render(<PolaroidSheet open onClose={() => {}} blobbi={subject} accessories={hat()} compose={compose} />);
    await develop();
    rerender(<PolaroidSheet open onClose={() => {}} blobbi={subject} accessories={hat()} compose={compose} />);
    await develop();
    expect(compose).toHaveBeenCalledTimes(1);
  });

  it('a picture that cannot be made says why, and offers nothing to save', async () => {
    const compose = vi.fn(async () => Promise.reject(new PhotoError('This browser cannot draw the picture.')));
    render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi()} compose={compose} />);
    await develop();
    expect(screen.getByTestId('polaroid-waiting')).toHaveTextContent('This browser cannot draw the picture.');
    expect(screen.queryByTestId('polaroid-preview')).toBeNull();
    expect(screen.getByTestId('polaroid-save')).toBeDisabled();
  });

  it('lets the picture go when it closes', async () => {
    const { unmount } = render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi()} compose={composer()} />);
    await develop();
    unmount();
    expect(revoked).toEqual(['blob:picture-1']);
  });
});

describe('taking the picture out', () => {
  it('without a share sheet there is one button, Save, and it downloads the picture shown', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('blobbi-dotado-polaroid.png');
    });
    render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi()} compose={composer()} />);
    await develop();
    expect(screen.queryByTestId('polaroid-share')).toBeNull();
    fireEvent.click(screen.getByTestId('polaroid-save'));
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('polaroid-status')).toHaveTextContent('Saved to your downloads.');
  });

  it('with a share sheet, Share hands it the picture as a PNG file named for the Blobbi', async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => undefined);
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { share, canShare: () => true }));
    render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi()} compose={composer()} />);
    await develop();
    await act(async () => {
      fireEvent.click(screen.getByTestId('polaroid-share'));
    });
    const data = share.mock.calls[0][0];
    expect(data.files).toHaveLength(1);
    expect(data.files![0].name).toBe('blobbi-dotado-polaroid.png');
    expect(data.files![0].type).toBe('image/png');
    expect(data.title).toBe('Dotado');
    expect(screen.getByTestId('polaroid-status')).toHaveTextContent('Shared.');
    // Save is still there beside it
    expect(screen.getByTestId('polaroid-save')).toBeEnabled();
  });

  it('closing the share sheet is not an error and saves nothing', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const share = vi.fn(async () => Promise.reject(Object.assign(new Error('closed'), { name: 'AbortError' })));
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { share, canShare: () => true }));
    render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi()} compose={composer()} />);
    await develop();
    await act(async () => {
      fireEvent.click(screen.getByTestId('polaroid-share'));
    });
    expect(click).not.toHaveBeenCalled();
    expect(screen.getByTestId('polaroid-status')).toBeEmptyDOMElement();
  });

  it('where saving fails, it points at the long press', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:picture-1') }));
    render(<PolaroidSheet open onClose={() => {}} blobbi={blobbi()} compose={composer()} />);
    await develop();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('blocked');
    });
    fireEvent.click(screen.getByTestId('polaroid-save'));
    expect(screen.getByTestId('polaroid-status')).toHaveTextContent('Press and hold the picture to save it.');
  });
});

describe('the way in', () => {
  it('is a named button with a camera', () => {
    const onOpen = vi.fn();
    render(<PhotoTile name="Dotado" onOpen={onOpen} />);
    const tile = screen.getByRole('button', { name: 'Photo: take a Polaroid of Dotado' });
    fireEvent.click(tile);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('mounts nothing until it is opened', () => {
    const { container } = render(<PolaroidDoor open={false} onClose={() => {}} blobbi={blobbi()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
