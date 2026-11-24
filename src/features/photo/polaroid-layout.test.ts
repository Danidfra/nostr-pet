import { describe, expect, it } from 'vitest';
import {
  CAPTION_LINES,
  CAPTION_MAX,
  NAME_MAX,
  POLAROID_FRAMES,
  POLAROID_HEIGHT,
  POLAROID_WIDTH,
  TEXT_INSET,
  chinText,
  cleanCaption,
  displayName,
  fitLine,
  frameStyle,
  limitCaptionInput,
  parseFrame,
  photoDate,
  photoFilename,
  polaroidLayout,
  wrapCaption,
  type Measure,
  type Rect,
} from './polaroid-layout';

/** A font in which every character is ten wide. */
const TEN: Measure = (text) => Array.from(text).length * 10;
const inside = (inner: Rect, outer: Rect) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

describe('the layout', () => {
  const layout = polaroidLayout();

  it('is a 4:5 picture, large enough to share', () => {
    expect(layout.width).toBe(POLAROID_WIDTH);
    expect(layout.height).toBe(POLAROID_HEIGHT);
    expect(POLAROID_WIDTH / POLAROID_HEIGHT).toBeCloseTo(4 / 5);
    expect(POLAROID_WIDTH).toBeGreaterThanOrEqual(1080);
  });

  it('holds a square photo, the Blobbi inside it, and a chin under it for the words', () => {
    const paper = { x: 0, y: 0, width: layout.width, height: layout.height };
    expect(layout.photo.width).toBe(layout.photo.height);
    expect(inside(layout.photo, paper)).toBe(true);
    expect(layout.blobbi.width).toBe(layout.blobbi.height);
    expect(inside(layout.blobbi, layout.photo)).toBe(true);
    expect(layout.chin.y).toBe(layout.photo.y + layout.photo.height);
    expect(layout.chin.y + layout.chin.height).toBe(layout.height);
    expect(layout.chin.height).toBeGreaterThan(250);
  });
});

describe('the frames', () => {
  it('are three, and anything else is the classic one', () => {
    expect(POLAROID_FRAMES).toEqual(['classic', 'pastel', 'playful']);
    expect(parseFrame('pastel')).toBe('pastel');
    expect(parseFrame('glitter')).toBe('classic');
    expect(parseFrame(undefined)).toBe('classic');
  });

  it('classic is clean: white paper, no pattern, nothing stuck on it', () => {
    const classic = frameStyle('classic');
    expect(classic.decorations).toEqual([]);
    expect(classic.backdropPattern).toBe('none');
    expect(classic.paper[0]).toBe('#fffdf8');
  });

  it('pastel is subtle (dots and sparkles only); playful has stars, hearts and tape', () => {
    const kinds = (frame: 'pastel' | 'playful') => new Set(frameStyle(frame).decorations.map((d) => d.kind));
    expect([...kinds('pastel')].sort()).toEqual(['dot', 'sparkle']);
    expect(kinds('playful').has('star')).toBe(true);
    expect(kinds('playful').has('heart')).toBe(true);
    expect(kinds('playful').has('tape')).toBe(true);
    expect(frameStyle('playful').decorations.length).toBeGreaterThan(frameStyle('pastel').decorations.length);
  });

  it('no decoration is ever over the Blobbi or where the words are written', () => {
    const { blobbi, chin, width, height } = polaroidLayout();
    const words: Rect = { x: chin.x + TEXT_INSET, y: chin.y + 20, width: chin.width - TEXT_INSET * 2, height: chin.height - 20 };
    for (const frame of POLAROID_FRAMES) {
      for (const d of frameStyle(frame).decorations) {
        const reach = d.kind === 'tape' ? d.size / 2 : d.size * 1.2;
        const box: Rect = { x: d.x - reach, y: d.y - (d.kind === 'tape' ? d.size * 0.2 : reach), width: reach * 2, height: d.kind === 'tape' ? d.size * 0.4 : reach * 2 };
        const overlaps = (r: Rect) => box.x < r.x + r.width && box.x + box.width > r.x && box.y < r.y + r.height && box.y + box.height > r.y;
        expect(overlaps(blobbi), `${frame} ${d.kind} over the Blobbi`).toBe(false);
        expect(overlaps(words), `${frame} ${d.kind} over the words`).toBe(false);
        expect(d.x).toBeGreaterThan(0);
        expect(d.x).toBeLessThan(width);
        expect(d.y).toBeGreaterThan(0);
        expect(d.y).toBeLessThan(height);
      }
    }
  });

  it('every frame writes in the same ink, so the words read the same', () => {
    const inks = new Set(POLAROID_FRAMES.map((f) => frameStyle(f).ink));
    expect(inks.size).toBe(1);
  });
});

describe('a caption', () => {
  it('is trimmed, flattened to one run of text, and empty when there is nothing', () => {
    expect(cleanCaption('  hello   there \n friend\t ')).toBe('hello there friend');
    expect(cleanCaption('   ')).toBe('');
    expect(cleanCaption('a\u0000b c\u0007')).toBe('a b c');
  });

  it('is cut at the limit, counting an emoji as one character', () => {
    expect(Array.from(cleanCaption('x'.repeat(200)))).toHaveLength(CAPTION_MAX);
    const hearts = cleanCaption('💜'.repeat(100));
    expect(Array.from(hearts)).toHaveLength(CAPTION_MAX);
    expect(cleanCaption('👩‍👩‍👧‍👦'.repeat(3), 2)).toBe('👩‍👩‍👧‍👦👩‍👩‍👧‍👦');
  });

  it('stays text: markup is only ever characters', () => {
    expect(cleanCaption('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
  });

  it('while typing, a trailing space is kept so the next word can be typed', () => {
    expect(limitCaptionInput('hello ')).toBe('hello ');
    expect(limitCaptionInput('  hello')).toBe('hello');
    expect(limitCaptionInput('a\nb')).toBe('a b');
    expect(Array.from(limitCaptionInput('y'.repeat(99)))).toHaveLength(CAPTION_MAX);
  });

  it('wraps at spaces into at most two lines', () => {
    expect(wrapCaption('one two three', 80, TEN)).toEqual(['one two', 'three']);
    expect(wrapCaption('short', 80, TEN)).toEqual(['short']);
    expect(wrapCaption('', 80, TEN)).toEqual([]);
  });

  it('ends in an ellipsis when it does not fit, and never overflows a line', () => {
    const lines = wrapCaption('alpha beta gamma delta epsilon zeta', 100, TEN);
    expect(lines).toHaveLength(CAPTION_LINES);
    expect(lines[1].endsWith('…')).toBe(true);
    for (const line of lines) expect(TEN(line)).toBeLessThanOrEqual(100);
  });

  it('breaks a word longer than a line inside itself', () => {
    const lines = wrapCaption('abcdefghijklmnopqrstuvwxyz', 100, TEN);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('abcdefghij');
    expect(lines[1].endsWith('…')).toBe(true);
    for (const line of lines) expect(TEN(line)).toBeLessThanOrEqual(100);
    expect(wrapCaption('abcdefghijkl', 100, TEN)).toEqual(['abcdefghij', 'kl']);
  });

  it('a line is cut to a width with an ellipsis, or left alone when it fits', () => {
    expect(fitLine('hello', 100, TEN)).toBe('hello');
    expect(fitLine('hello world again', 100, TEN)).toBe('hello wor…');
    expect(fitLine('hello', 0, TEN)).toBe('');
  });
});

describe('the name', () => {
  it('is never empty and never longer than a line', () => {
    expect(displayName(undefined)).toBe('Blobbi');
    expect(displayName('   ')).toBe('Blobbi');
    expect(displayName('Dotado')).toBe('Dotado');
    const long = displayName('N'.repeat(80));
    expect(Array.from(long)).toHaveLength(NAME_MAX);
    expect(long.endsWith('…')).toBe(true);
  });

  it('names the file in plain letters', () => {
    expect(photoFilename('Dotado')).toBe('blobbi-dotado-polaroid.png');
    expect(photoFilename('Mr. Blob / the 2nd!')).toBe('blobbi-mr-blob-the-2nd-polaroid.png');
    expect(photoFilename('../../etc/passwd')).toBe('blobbi-etcpasswd-polaroid.png');
    expect(photoFilename('💜')).toBe('blobbi-polaroid.png');
    expect(photoFilename(undefined)).toBe('blobbi-polaroid.png');
  });
});

describe('the words in the chin', () => {
  const at = () => TEN;
  const { chin, height } = polaroidLayout();

  it('the name alone: no caption lines, no date', () => {
    const words = chinText({ name: 'Dotado', caption: '', date: null }, at);
    expect(words.name.text).toBe('Dotado');
    expect(words.caption.lines).toEqual([]);
    expect(words.date).toBeNull();
    expect(words.name.baseline).toBeGreaterThan(chin.y);
    expect(words.name.baseline).toBeLessThan(height);
  });

  it('name, then caption, then date, each lower than the last and all on the paper', () => {
    const words = chinText({ name: 'Dotado', caption: 'x'.repeat(60), date: 'Nov 9, 2026' }, () => (text) => Array.from(text).length * 22);
    expect(words.caption.lines.length).toBe(2);
    const order = [words.name.baseline, ...words.caption.baselines, words.date!.baseline];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(new Set(order).size).toBe(order.length);
    expect(words.date!.baseline).toBeLessThan(height - 16);
    expect(words.date!.text).toBe('Nov 9, 2026');
  });

  it('the date is only there when asked for', () => {
    expect(chinText({ name: 'A', caption: 'hi', date: null }, at).date).toBeNull();
    expect(chinText({ name: 'A', caption: 'hi', date: 'today' }, at).date?.text).toBe('today');
  });

  it('writes the date the reader’s way', () => {
    expect(photoDate(new Date(2026, 10, 9), 'en-US')).toBe('Nov 9, 2026');
    expect(photoDate(new Date(2026, 10, 9), 'pt-BR')).toMatch(/9 de nov\.? de 2026/);
  });
});
