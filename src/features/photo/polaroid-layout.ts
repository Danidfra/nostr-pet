/**
 * The Polaroid, the pure part: where everything sits on the picture, what
 * each frame looks like, and what becomes of a caption. No canvas, no DOM:
 * `compose-polaroid.ts` draws exactly what this describes, so the picture
 * can be reasoned about (and tested) as numbers.
 *
 * One size for every frame: 1080 x 1350 (4:5), a square photo window over a
 * deep chin for the name, the caption and, when asked for, the date.
 */

export type PolaroidFrame = 'classic' | 'pastel' | 'playful';

export const POLAROID_FRAMES: readonly PolaroidFrame[] = ['classic', 'pastel', 'playful'];

export const FRAME_LABEL: Record<PolaroidFrame, string> = { classic: 'Classic', pastel: 'Pastel', playful: 'Playful' };

export const DEFAULT_FRAME: PolaroidFrame = 'classic';

export function parseFrame(value: unknown): PolaroidFrame {
  return value === 'classic' || value === 'pastel' || value === 'playful' ? value : DEFAULT_FRAME;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PolaroidLayout {
  width: number;
  height: number;
  /** The paper's corner radius. */
  radius: number;
  /** The square the Blobbi is photographed in. */
  photo: Rect;
  /** The Blobbi's square art box inside the photo (the kit's renderer box: accessories are placed against it). */
  blobbi: Rect;
  /** The band under the photo the words are written in. */
  chin: Rect;
}

export const POLAROID_WIDTH = 1080;
export const POLAROID_HEIGHT = 1350;

const MARGIN = 72;

/** Where everything sits. The same for every frame, so switching frames never moves the Blobbi. */
export function polaroidLayout(): PolaroidLayout {
  const side = POLAROID_WIDTH - MARGIN * 2;
  const photo: Rect = { x: MARGIN, y: MARGIN, width: side, height: side };
  // The art box: most of the window, a little low, so there is sky over the head and floor under the feet
  const box = Math.round(side * 0.76);
  const blobbi: Rect = { x: Math.round(photo.x + (side - box) / 2), y: Math.round(photo.y + (side - box) * 0.62), width: box, height: box };
  const chinTop = photo.y + photo.height;
  const chin: Rect = { x: MARGIN, y: chinTop, width: side, height: POLAROID_HEIGHT - chinTop };
  return { width: POLAROID_WIDTH, height: POLAROID_HEIGHT, radius: 28, photo, blobbi, chin };
}

/** A small drawn thing on a frame. Positions are the picture's pixels; `rotation` in radians. */
export interface Decoration {
  kind: 'star' | 'heart' | 'dot' | 'sparkle' | 'tape';
  x: number;
  y: number;
  size: number;
  rotation: number;
  color: string;
}

export interface FrameStyle {
  frame: PolaroidFrame;
  /** The paper: one colour, or a top-to-bottom gradient. */
  paper: readonly [string, string];
  /** The photo's backdrop: a top-to-bottom gradient. */
  backdrop: readonly [string, string];
  /** A soft pattern over the backdrop, or none. */
  backdropPattern: 'none' | 'dots' | 'rays';
  /** The colour of that pattern. */
  patternColor: string;
  /** The floor under the Blobbi: a soft band at the bottom of the photo. */
  floor: string;
  /** A thin line round the photo window. */
  photoEdge: string;
  ink: string;
  inkSoft: string;
  /** Things drawn on the paper (never over the Blobbi). */
  decorations: readonly Decoration[];
}

const INK = '#3b2f58';
const INK_SOFT = '#7a6f96';

/**
 * The three frames, in Blobbi's own colours: the app's violet (`#8b5cf6`),
 * its blush pink (`#fff5f7`) and warm paper. Every decoration is placed by
 * hand, on the paper round the photo or in the chin's corners, so the same
 * frame is the same picture every time and nothing ever covers the Blobbi
 * or the words.
 */
export function frameStyle(frame: PolaroidFrame): FrameStyle {
  const { photo, chin, width, height } = polaroidLayout();
  const right = photo.x + photo.width;
  const bottom = photo.y + photo.height;
  if (frame === 'pastel') {
    return {
      frame,
      paper: ['#f1e9ff', '#ffe6f0'],
      backdrop: ['#e3f1ff', '#fdeaf4'],
      backdropPattern: 'dots',
      patternColor: 'rgba(255, 255, 255, 0.6)',
      floor: 'rgba(255, 255, 255, 0.55)',
      photoEdge: 'rgba(139, 92, 246, 0.22)',
      ink: INK,
      inkSoft: INK_SOFT,
      decorations: [
        { kind: 'sparkle', x: photo.x - 34, y: photo.y + 120, size: 22, rotation: 0, color: '#c4b5fd' },
        { kind: 'dot', x: photo.x - 36, y: photo.y + 520, size: 9, rotation: 0, color: '#f9a8d4' },
        { kind: 'dot', x: right + 36, y: photo.y + 260, size: 9, rotation: 0, color: '#a5b4fc' },
        { kind: 'sparkle', x: right + 34, y: photo.y + 700, size: 20, rotation: 0.4, color: '#f9a8d4' },
        { kind: 'dot', x: chin.x + 26, y: height - 46, size: 8, rotation: 0, color: '#c4b5fd' },
        { kind: 'dot', x: chin.x + 56, y: height - 46, size: 8, rotation: 0, color: '#f9a8d4' },
        { kind: 'dot', x: chin.x + 86, y: height - 46, size: 8, rotation: 0, color: '#a5b4fc' },
        { kind: 'sparkle', x: right - 30, y: bottom + 52, size: 18, rotation: 0.2, color: '#c4b5fd' },
      ],
    };
  }
  if (frame === 'playful') {
    return {
      frame,
      paper: ['#fff8e6', '#ffeef5'],
      backdrop: ['#fff1c9', '#ffd9e8'],
      backdropPattern: 'rays',
      patternColor: 'rgba(255, 255, 255, 0.42)',
      floor: 'rgba(255, 255, 255, 0.5)',
      photoEdge: 'rgba(244, 114, 182, 0.35)',
      ink: INK,
      inkSoft: INK_SOFT,
      decorations: [
        // A strip of tape holding the photo, top centre
        { kind: 'tape', x: width / 2, y: photo.y - 12, size: 170, rotation: -0.05, color: 'rgba(196, 181, 253, 0.85)' },
        { kind: 'star', x: photo.x - 6, y: photo.y - 6, size: 44, rotation: -0.3, color: '#fbbf24' },
        { kind: 'heart', x: right + 4, y: photo.y + 10, size: 40, rotation: 0.3, color: '#fb7185' },
        { kind: 'star', x: right + 34, y: photo.y + 420, size: 24, rotation: 0.2, color: '#a78bfa' },
        { kind: 'heart', x: photo.x - 34, y: photo.y + 640, size: 24, rotation: -0.25, color: '#f472b6' },
        { kind: 'sparkle', x: photo.x - 34, y: photo.y + 300, size: 20, rotation: 0, color: '#fbbf24' },
        { kind: 'star', x: right - 4, y: bottom + 6, size: 52, rotation: 0.25, color: '#fbbf24' },
        { kind: 'heart', x: chin.x + 34, y: height - 56, size: 34, rotation: -0.2, color: '#fb7185' },
        { kind: 'sparkle', x: chin.x + 80, y: height - 34, size: 14, rotation: 0.3, color: '#a78bfa' },
        { kind: 'star', x: right - 36, y: height - 50, size: 30, rotation: -0.2, color: '#a78bfa' },
        { kind: 'dot', x: right - 86, y: height - 40, size: 8, rotation: 0, color: '#f472b6' },
      ],
    };
  }
  return {
    frame: 'classic',
    paper: ['#fffdf8', '#fbf7ee'],
    backdrop: ['#f4eefc', '#fff5f7'],
    backdropPattern: 'none',
    patternColor: 'transparent',
    floor: 'rgba(255, 255, 255, 0.6)',
    photoEdge: 'rgba(59, 47, 88, 0.1)',
    ink: INK,
    inkSoft: INK_SOFT,
    decorations: [],
  };
}

// ─── Words ───────────────────────────────────────────────────────────────────

/** The most a caption may hold, in characters as a person counts them. */
export const CAPTION_MAX = 60;
/** The most a name is drawn with; a longer one ends in an ellipsis. */
export const NAME_MAX = 24;
/** A caption never takes more than this many lines. */
export const CAPTION_LINES = 2;

const ELLIPSIS = '…';

/** Characters as a person counts them (an emoji is one), where the browser can tell; code points otherwise. */
function graphemes(text: string): string[] {
  const Segmenter = (Intl as { Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => { segment(input: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment);
  return Array.from(text);
}

/** Control characters and the line and paragraph separators: never drawn, each becomes a space. */
// eslint-disable-next-line no-control-regex
const UNPRINTABLE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]', 'g');

/**
 * A caption as it will be written: control characters and line breaks
 * become spaces, runs of space become one, the ends are trimmed, and it is
 * cut at `CAPTION_MAX` characters. It is only ever drawn as text on a
 * canvas, so nothing in it can be markup. Empty means no caption.
 */
export function cleanCaption(raw: string, max = CAPTION_MAX): string {
  const flat = raw.replace(UNPRINTABLE, ' ').replace(/\s+/g, ' ').trim();
  return graphemes(flat).slice(0, max).join('').trim();
}

/** The caption while it is being typed: the same rules, the end left alone so a space can be typed. */
export function limitCaptionInput(raw: string, max = CAPTION_MAX): string {
  const flat = raw.replace(UNPRINTABLE, ' ').replace(/\s+/g, ' ').replace(/^ /, '');
  return graphemes(flat).slice(0, max).join('');
}

/** A name as it is drawn: one line, never empty. */
export function displayName(raw: string | undefined): string {
  const name = cleanCaption(raw ?? '', 200);
  if (!name) return 'Blobbi';
  const parts = graphemes(name);
  return parts.length > NAME_MAX ? `${parts.slice(0, NAME_MAX - 1).join('').trimEnd()}${ELLIPSIS}` : name;
}

/** How wide a run of text is, in the picture's pixels. */
export type Measure = (text: string) => number;

/** A run cut until it fits a width with an ellipsis on its end. */
function withEllipsis(text: string, maxWidth: number, measure: Measure): string {
  const parts = graphemes(text);
  while (parts.length > 0 && measure(`${parts.join('').trimEnd()}${ELLIPSIS}`) > maxWidth) parts.pop();
  return parts.length ? `${parts.join('').trimEnd()}${ELLIPSIS}` : '';
}

/** Cut one run to fit a width, ending in an ellipsis when something was cut. */
export function fitLine(text: string, maxWidth: number, measure: Measure): string {
  return measure(text) <= maxWidth ? text : withEllipsis(text, maxWidth, measure);
}

/**
 * A caption wrapped into at most `maxLines` lines of `maxWidth`: broken at
 * spaces, a single word wider than a line broken inside itself, and
 * whatever does not fit ending the last line in an ellipsis.
 */
export function wrapCaption(text: string, maxWidth: number, measure: Measure, maxLines = CAPTION_LINES): string[] {
  const lines: string[] = [];
  let line = '';
  for (let word of text.split(' ').filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    // A word wider than a whole line: fill lines with as much of it as fits
    while (measure(word) > maxWidth) {
      const parts = graphemes(word);
      let take = parts.length - 1;
      while (take > 1 && measure(parts.slice(0, take).join('')) > maxWidth) take--;
      lines.push(parts.slice(0, Math.max(1, take)).join(''));
      word = parts.slice(Math.max(1, take)).join('');
    }
    line = word;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = withEllipsis(kept[maxLines - 1], maxWidth, measure);
  return kept;
}

/** The date as it is written on a photo, in the reader's own way of writing dates. */
export function photoDate(date: Date, locale?: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** A safe file name for the picture: the Blobbi's name, as plain letters. */
export function photoFilename(name: string | undefined): string {
  const slug = (name ?? '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug ? `blobbi-${slug}-polaroid.png` : 'blobbi-polaroid.png';
}

export interface ChinText {
  name: { text: string; size: number; baseline: number };
  caption: { lines: string[]; size: number; baselines: number[] };
  date: { text: string; size: number; baseline: number } | null;
}

export const NAME_SIZE = 68;
export const CAPTION_SIZE = 38;
export const DATE_SIZE = 28;
/** How far in from the photo's edges the words keep (room for a frame's corner stickers). */
export const TEXT_INSET = 110;

/**
 * The words in the chin: the name, the caption's lines under it, the date
 * last. Everything is centred; the block is set a little above the middle
 * of the chin, and the fewer the lines the more air it has.
 */
export function chinText(input: { name: string | undefined; caption: string; date: string | null }, measureAt: (size: number, weight: number) => Measure): ChinText {
  const { chin } = polaroidLayout();
  const maxWidth = chin.width - TEXT_INSET * 2;
  const name = fitLine(displayName(input.name), maxWidth, measureAt(NAME_SIZE, 700));
  const cleaned = cleanCaption(input.caption);
  const lines = cleaned ? wrapCaption(cleaned, maxWidth, measureAt(CAPTION_SIZE, 500)) : [];
  const captionGap = 50;
  const dateGap = 44;
  const blockHeight = NAME_SIZE + lines.length * captionGap + (input.date ? dateGap : 0);
  const top = chin.y + Math.max(24, (chin.height - 36 - blockHeight) / 2);
  const nameBaseline = Math.round(top + NAME_SIZE * 0.8);
  const baselines = lines.map((_, i) => nameBaseline + 14 + captionGap * (i + 1) - 6);
  const lastBaseline = baselines.length ? baselines[baselines.length - 1] : nameBaseline + 8;
  return {
    name: { text: name, size: NAME_SIZE, baseline: nameBaseline },
    caption: { lines, size: CAPTION_SIZE, baselines },
    date: input.date ? { text: input.date, size: DATE_SIZE, baseline: lastBaseline + dateGap } : null,
  };
}
