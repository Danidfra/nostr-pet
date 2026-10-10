/**
 * Simple Nostr Objects, the part the room needs without three.js.
 *
 * Ditto models its official Blobbi furniture as SNO v2 payloads (Cyberspace
 * DECK-0003: an integer lattice of vertices with sub-unit ticks, a palette,
 * one colour index per vertex and run-length face colours) and renders them
 * through the same parser it uses for objects people publish on the network
 * (kind 33331). Standalone's M1 room renders only the bundled official
 * models, so this module is the small, trusted-input half of that pipeline:
 * the parsed shape the three.js builder consumes (`SnoObject`, `SnoNode`)
 * and the conversion from a builder payload to it. It accepts no untrusted
 * data; fetching and validating network objects (the full §1.9 parser,
 * palette references, placed parts) is a later milestone.
 *
 * Kept free of three.js so the furniture catalog can be read eagerly while
 * the renderer loads on demand.
 */

import type { SnoPayload } from './sno-builder';

/** sRGB, each channel 0..1. */
export type Rgb = [number, number, number];

export type SnoMode = 'solid' | 'points' | 'lines';

/** Sub-unit steps per model unit (§1.2). */
export const TICKS_PER_UNIT = 120;

/** A placed sub-object (§1.10). Official models place none; kept so the builder matches Ditto's. */
export interface SnoPart {
  /** Origin, in the parent's ticks. */
  offset: [number, number, number];
  /** Whole degrees about the parent's X, then Y, then Z. */
  rotation: [number, number, number];
  /** Power-of-two scale step. */
  step: number;
}

export interface SnoObject {
  name: string;
  unit: number;
  mode: SnoMode;
  /** Vertex positions in ticks, flat `[x, y, z, …]`, Y up, +Z toward the viewer. */
  positions: number[];
  /** One colour per vertex, resolved against the palette. */
  colors: Rgb[];
  faces: [number, number, number][];
  /** One palette index per face, expanded from its run-length form. */
  faceColorIndices?: number[];
  palette: Rgb[];
}

/** An object with the objects it places, resolved. */
export interface SnoNode {
  object: SnoObject;
  parts: SnoPlacement[];
}

/** A placement; without a `node` it's drawn as a placeholder (§1.10). */
export interface SnoPlacement {
  part: SnoPart;
  node?: SnoNode;
}

/** Palette entries are 0..255 in the payload (§1.3a) and 0..1 for the renderer. */
function paletteToRgb(palette: SnoPayload['palette']): Rgb[] {
  return palette.map(([r, g, b]) => [r / 255, g / 255, b / 255]);
}

/** Face colours as published (§1.4a): `-N` repeats the previous entry N more times. */
export function expandFaceColors(facecolors: readonly number[], faceCount: number): number[] {
  const out: number[] = [];
  for (const entry of facecolors) {
    if (entry < 0) {
      const last = out[out.length - 1];
      if (last === undefined) throw new Error('facecolors start with a run');
      for (let i = 0; i < -entry; i++) out.push(last);
    } else {
      out.push(entry);
    }
    if (out.length > faceCount) throw new Error('facecolors exceed faces');
  }
  if (out.length !== faceCount) throw new Error('facecolors do not match faces');
  return out;
}

/**
 * A builder payload as the object the three.js builder draws. The payload is
 * this app's own data (`official-models.ts`), so the checks here are
 * assertions about the builder, not validation of input.
 */
export function snoObjectFromPayload(payload: SnoPayload): SnoObject {
  const vertexCount = payload.vertices.length;
  if (payload.colors.length !== vertexCount || payload.ticks.length !== vertexCount) throw new Error(`${payload.name}: colors or ticks do not match vertices`);
  const palette = paletteToRgb(payload.palette);
  const positions = new Array<number>(vertexCount * 3);
  for (let i = 0; i < vertexCount; i++) {
    const vertex = payload.vertices[i];
    const tick = payload.ticks[i];
    for (let a = 0; a < 3; a++) positions[i * 3 + a] = vertex[a] * TICKS_PER_UNIT + tick[a];
  }
  for (const face of payload.faces) {
    for (const v of face) if (v < 0 || v >= vertexCount) throw new Error(`${payload.name}: face index out of range`);
  }
  const colors: Rgb[] = payload.colors.map((index) => {
    const color = palette[index];
    if (!color) throw new Error(`${payload.name}: color index out of range`);
    return color;
  });
  return {
    name: payload.name,
    unit: payload.unit,
    mode: payload.mode,
    positions,
    colors,
    faces: payload.faces.map(([a, b, c]) => [a, b, c]),
    faceColorIndices: expandFaceColors(payload.facecolors, payload.faces.length),
    palette,
  };
}

/** An official model as a one-node tree (it places nothing). */
export function snoNodeFromPayload(payload: SnoPayload): SnoNode {
  return { object: snoObjectFromPayload(payload), parts: [] };
}
