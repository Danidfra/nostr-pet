/**
 * The food, as small papercraft objects: a handful of procedural models for
 * the official foods the home already knows (`official-catalog-snapshot.ts`),
 * built from a few primitives each, flat-coloured like the furniture, so an
 * apple on a dish is an apple from across the room and not a sticker.
 *
 * Each model says how it is eaten (`bites`): a list of cuts, each a cap
 * taken off the model's surface from a direction the camera can see (the
 * room is looked at from its open corner, +x +z), done with a clipping
 * plane per bite, so the apple shows white flesh where a bite was and the
 * burger its layers; a drink has no cuts and goes down in sips (the whole
 * shrinks). The scene keeps one plane per possible bite from the start and
 * moves it into place on each bite, so no shader is recompiled mid-meal.
 *
 * An item with no model here (a partner's produce) keeps the picture on the
 * plate (`prop-art.ts`). Nothing here knows about inventory: the model is
 * chosen by the official item's `d`, and the item stays the item.
 */
import * as THREE from 'three';

export type FoodModelKind = 'apple' | 'burger' | 'pizza' | 'cake' | 'sushi' | 'drink';

/** Which official foods have a model, by their `d`. */
export const FOOD_MODELS: Readonly<Record<string, FoodModelKind>> = {
  'blobbi:food:apple': 'apple',
  'blobbi:food:burger': 'burger',
  'blobbi:food:pizza': 'pizza',
  'blobbi:food:cake': 'cake',
  'blobbi:food:sushi': 'sushi',
  'blobbi:energy:drink': 'drink',
};

export function foodModelFor(itemId: string): FoodModelKind | null {
  return FOOD_MODELS[itemId] ?? null;
}

/** One bite: a cap taken off the surface in direction `u` (unit, model space), `reach` from the centre, `depth` deep. */
export interface BiteCut {
  u: THREE.Vector3;
  reach: number;
  depth: number;
}

export interface FoodModel {
  kind: FoodModelKind;
  root: THREE.Group;
  /** The root's scale at rest (`FOOD_SCALE`), for a food that shrinks sip by sip. */
  scale: number;
  /** How far it spreads from its centre on the plate (tiles), for the clearance a Blobbi keeps. */
  radius: number;
  /** Whether it sits on a plate. */
  plate: boolean;
  /** The cuts, in the order the bites are taken; empty for a food that shrinks instead. */
  bites: readonly BiteCut[];
  /** The materials the cuts apply to (clipped together). */
  materials: THREE.Material[];
  /** The crumbs' colour. */
  crumb: THREE.Color;
}

/** The room is looked at from its open corner: "front" is toward the camera, "across" is left–right on screen. */
const FRONT = new THREE.Vector3(1, 0, 1).normalize();
const ACROSS = new THREE.Vector3(1, 0, -1).normalize();
const UP = new THREE.Vector3(0, 1, 0);

function dir(...parts: [THREE.Vector3, number][]): THREE.Vector3 {
  const v = new THREE.Vector3();
  for (const [p, k] of parts) v.addScaledVector(p, k);
  return v.normalize();
}

function paper(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color().setStyle(color, THREE.SRGBColorSpace), roughness: 0.72, metalness: 0, side: THREE.DoubleSide, clipShadows: true, ...extra });
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** A wedge (a slice of something round) `radius` out from the point, `angle` wide, `height` tall, pointing along -FRONT (its tip toward the Blobbi behind the dish). */
function wedge(radius: number, angle: number, height: number, material: THREE.Material, y: number): THREE.Mesh {
  const g = new THREE.CylinderGeometry(radius, radius, height, 24, 1, false, Math.PI / 4 - angle / 2, angle);
  const m = mesh(g, material, 0, y, 0);
  // The cylinder's theta 0 is +z about y; turned so the slice's middle points toward the camera
  m.rotation.y = 0;
  return m;
}

function apple(): FoodModel {
  const root = new THREE.Group();
  const r = 0.4;
  const skin = paper('#e24a40');
  const flesh = paper('#fbf2d8');
  const body = mesh(new THREE.SphereGeometry(r, 28, 20), skin, 0, r * 0.92, 0);
  body.scale.set(1, 0.92, 1);
  // The flesh, well inside the skin (no fighting at the surface), shown where a bite goes deeper than it
  const inner = mesh(new THREE.SphereGeometry(r * 0.88, 28, 20), flesh, 0, r * 0.92, 0);
  inner.scale.set(1, 0.92, 1);
  inner.castShadow = false;
  const stem = mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.2, 8), paper('#6b4a2b'), 0.02, r * 1.84, 0);
  stem.rotation.z = -0.25;
  const leaf = mesh(new THREE.SphereGeometry(0.1, 12, 8), paper('#5fb35a'), 0.14, r * 1.78, 0.02);
  leaf.scale.set(1.3, 0.3, 0.6);
  leaf.rotation.y = 0.6;
  root.add(body, inner, stem, leaf);
  const c = new THREE.Vector3(0, r * 0.92, 0);
  const cut = (u: THREE.Vector3, depth: number): BiteCut => ({ u, reach: r, depth });
  // Bites out of its sides and its top, so the red front stays an apple with chunks out of it until the last bite
  const bites = [cut(dir([ACROSS, 1], [UP, 0.35], [FRONT, 0.2]), 0.2), cut(dir([ACROSS, -1], [UP, 0.3], [FRONT, 0.25]), 0.2), cut(dir([UP, 1], [ACROSS, 0.7], [FRONT, 0.2]), 0.2), cut(dir([UP, 0.8], [ACROSS, -0.8], [FRONT, -0.2]), 0.2)];
  root.userData.centre = c;
  return { kind: 'apple', root, scale: 1, radius: r + 0.05, plate: true, bites, materials: [skin, flesh], crumb: new THREE.Color().setStyle('#fbf2d8', THREE.SRGBColorSpace) };
}

function burger(): FoodModel {
  const root = new THREE.Group();
  const bun = paper('#e2a35a');
  const patty = paper('#6e4027');
  const cheese = paper('#f3c13a');
  const lettuce = paper('#7cc95f');
  const tomato = paper('#d9453a');
  const r = 0.46;
  let y = 0;
  const layer = (geometry: THREE.BufferGeometry, material: THREE.Material, height: number, scaleY = 1) => {
    const m = mesh(geometry, material, 0, y + height / 2, 0);
    m.scale.y = scaleY;
    y += height;
    root.add(m);
    return m;
  };
  layer(new THREE.CylinderGeometry(r, r * 0.9, 0.13, 22), bun, 0.13);
  layer(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.09, 22), patty, 0.09);
  const slice = layer(new THREE.BoxGeometry(r * 1.9, 0.03, r * 1.9), cheese, 0.03);
  slice.rotation.y = Math.PI / 6;
  const leaf = layer(new THREE.CylinderGeometry(r * 1.08, r * 1.0, 0.05, 14), lettuce, 0.05);
  leaf.scale.set(1, 1, 0.94);
  layer(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.05, 22), tomato, 0.05);
  const top = mesh(new THREE.SphereGeometry(r, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), bun, 0, y, 0);
  top.scale.set(1, 0.62, 1);
  root.add(top);
  const height = y + r * 0.62;
  root.userData.centre = new THREE.Vector3(0, height / 2, 0);
  const cut = (u: THREE.Vector3, depth: number): BiteCut => ({ u, reach: r, depth });
  // Bites off the sides (its layers show in the cut), then the front; each a mouthful, never the whole stack
  const bites = [cut(dir([ACROSS, 1], [FRONT, 0.35]), 0.22), cut(dir([ACROSS, -1], [FRONT, 0.35]), 0.22), cut(dir([FRONT, 1], [UP, 0.3]), 0.26), cut(dir([FRONT, 1], [UP, 0.9]), 0.34)];
  return { kind: 'burger', root, scale: 1, radius: r * 1.1, plate: true, bites, materials: [bun, patty, cheese, lettuce, tomato], crumb: new THREE.Color().setStyle('#e2a35a', THREE.SRGBColorSpace) };
}

function pizza(): FoodModel {
  const root = new THREE.Group();
  const crust = paper('#e0b36b');
  const sauce = paper('#d6442f');
  const cheeseMat = paper('#f6d05c');
  const pepperoni = paper('#b23a2a');
  const R = 0.8;
  const angle = Math.PI / 3.2;
  const base = wedge(R, angle, 0.05, crust, 0.025);
  const top = wedge(R * 0.92, angle * 0.92, 0.03, cheeseMat, 0.065);
  const red = wedge(R * 0.95, angle * 0.95, 0.02, sauce, 0.055);
  root.add(base, red, top);
  // The crust's rim: a short arc of torus along the outer edge
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.96, 0.045, 8, 20, angle), crust);
  rim.rotation.x = Math.PI / 2;
  rim.rotation.z = Math.PI / 4 - angle / 2;
  rim.position.y = 0.06;
  rim.castShadow = true;
  root.add(rim);
  // Pepperoni, three, along the slice
  for (const [k, side] of [[0.72, 0.1], [0.5, -0.12], [0.3, 0.04]] as const) {
    const p = new THREE.Vector3().addScaledVector(FRONT, k * R).addScaledVector(ACROSS, side);
    root.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12), pepperoni, p.x, 0.09, p.z));
  }
  root.userData.centre = new THREE.Vector3().addScaledVector(FRONT, R * 0.45).setY(0.05);
  // Eaten from the tip (toward the Blobbi) to the crust: each bite is a cut across the slice, farther along
  const cut = (reach: number): BiteCut => ({ u: FRONT.clone().negate(), reach, depth: 0.001 });
  const bites = [cut(R * 0.05), cut(-R * 0.2), cut(-R * 0.45), cut(-R * 0.7)];
  return { kind: 'pizza', root, scale: 1, radius: R * 0.6, plate: true, bites, materials: [crust, sauce, cheeseMat, pepperoni], crumb: new THREE.Color().setStyle('#e0b36b', THREE.SRGBColorSpace) };
}

function cake(): FoodModel {
  const root = new THREE.Group();
  const sponge = paper('#f3d58a');
  const cream = paper('#fff6ea');
  const icing = paper('#f08aa6');
  const cherry = paper('#c62b3f');
  const R = 0.7;
  const angle = Math.PI / 4;
  let y = 0;
  const layer = (material: THREE.Material, h: number, scale = 1) => {
    root.add(wedge(R * scale, angle * scale, h, material, y + h / 2));
    y += h;
  };
  layer(sponge, 0.16);
  layer(cream, 0.05, 0.98);
  layer(sponge, 0.16);
  layer(icing, 0.07, 1.02);
  const topCentre = new THREE.Vector3().addScaledVector(FRONT, R * 0.55);
  root.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), cherry, topCentre.x, y + 0.07, topCentre.z));
  root.userData.centre = new THREE.Vector3().addScaledVector(FRONT, R * 0.45).setY(y / 2);
  const cut = (reach: number): BiteCut => ({ u: FRONT.clone().negate(), reach, depth: 0.001 });
  const bites = [cut(R * 0.05), cut(-R * 0.22), cut(-R * 0.45), cut(-R * 0.68)];
  return { kind: 'cake', root, scale: 1, radius: R * 0.6, plate: true, bites, materials: [sponge, cream, icing, cherry], crumb: new THREE.Color().setStyle('#f3d58a', THREE.SRGBColorSpace) };
}

function sushi(): FoodModel {
  const root = new THREE.Group();
  const rice = paper('#fbf8f0');
  const fish = paper('#f2865f');
  const nori = paper('#2e3b2f');
  const piece = (offset: number) => {
    const at = new THREE.Vector3().addScaledVector(ACROSS, offset);
    const base = mesh(new THREE.BoxGeometry(0.46, 0.18, 0.26), rice, at.x, 0.09, at.z);
    base.rotation.y = Math.PI / 4;
    const top = mesh(new THREE.BoxGeometry(0.52, 0.09, 0.3), fish, at.x, 0.22, at.z);
    top.rotation.y = Math.PI / 4;
    top.rotation.z = 0.06;
    const band = mesh(new THREE.BoxGeometry(0.1, 0.3, 0.32), nori, at.x, 0.15, at.z);
    band.rotation.y = Math.PI / 4;
    root.add(base, top, band);
  };
  piece(0.32);
  piece(-0.32);
  root.userData.centre = new THREE.Vector3(0, 0.14, 0);
  // Four bites: the two pieces, half at a time, from the outside in
  const cut = (side: 1 | -1, reach: number): BiteCut => ({ u: ACROSS.clone().multiplyScalar(side), reach, depth: 0.001 });
  const bites = [cut(1, 0.32), cut(-1, 0.32), cut(1, 0.05), cut(-1, 0.05)];
  return { kind: 'sushi', root, scale: 1, radius: 0.65, plate: true, bites, materials: [rice, fish, nori], crumb: new THREE.Color().setStyle('#fbf8f0', THREE.SRGBColorSpace) };
}

function drink(): FoodModel {
  const root = new THREE.Group();
  const can = paper('#4f8fd8');
  const lid = paper('#cfd6de', { roughness: 0.4 });
  const label = paper('#f6d04a');
  const body = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 20), can, 0, 0.31, 0);
  const top = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.05, 20), lid, 0, 0.645, 0);
  const tab = mesh(new THREE.BoxGeometry(0.09, 0.015, 0.05), lid, 0.03, 0.675, 0);
  // A lightning bolt's worth of label, facing the camera
  const bolt = mesh(new THREE.BoxGeometry(0.1, 0.22, 0.02), label, 0, 0.33, 0);
  bolt.position.addScaledVector(FRONT, 0.195);
  bolt.rotation.y = Math.PI / 4;
  bolt.rotation.z = 0.35;
  root.add(body, top, tab, bolt);
  root.userData.centre = new THREE.Vector3(0, 0.33, 0);
  return { kind: 'drink', root, scale: 1, radius: 0.3, plate: false, bites: [], materials: [can, lid, label], crumb: new THREE.Color().setStyle('#4f8fd8', THREE.SRGBColorSpace) };
}

/** The models are drawn at a plain size and shown this much bigger: a meal a phone can read beside a three-tile Blobbi. */
export const FOOD_SCALE = 1.35;

export function buildFoodModel(kind: FoodModelKind): FoodModel {
  const model = (() => {
    switch (kind) {
      case 'apple': return apple();
      case 'burger': return burger();
      case 'pizza': return pizza();
      case 'cake': return cake();
      case 'sushi': return sushi();
      case 'drink': return drink();
    }
  })();
  // Everything the scene measures against the model (its reach, its bites, its centre) is in the shown size
  model.root.scale.setScalar(FOOD_SCALE);
  model.scale = FOOD_SCALE;
  model.radius *= FOOD_SCALE;
  const centre = model.root.userData.centre as THREE.Vector3 | undefined;
  if (centre) centre.multiplyScalar(FOOD_SCALE);
  return { ...model, bites: model.bites.map((b) => ({ u: b.u, reach: b.reach * FOOD_SCALE, depth: b.depth * FOOD_SCALE })) };
}

/** Free a built model's geometries and materials. */
export function disposeFoodModel(model: FoodModel) {
  model.root.traverse((child) => {
    const m = child as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
  for (const material of model.materials) material.dispose();
}
