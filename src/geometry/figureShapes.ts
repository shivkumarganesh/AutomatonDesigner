import type { Point2D } from '../types/geometry';

/**
 * Local-mm outline generators for decorative Figure shapes, shared between
 * the 3D sandbox renderer (sandbox/FigureMesh.tsx) and the flat-pack SVG
 * exporter (export/svgExport.ts) so both draw the exact same silhouette.
 */

/** A simple leaf/teardrop wing silhouette, root at the origin pointing +X -
 *  deliberately a flat laser-cuttable shape like the rest of the
 *  mechanism, not a modeled feather. Reused for pinwheel blades. */
export function buildWingOutline(scale: number): Point2D[] {
  const len = scale;
  const w = scale * 0.55;
  const pts: Point2D[] = [];
  const segments = 16;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = t * len;
    const envelope = Math.sin(Math.PI * t) ** 0.6;
    const y = w * envelope * (1 - t * 0.3);
    pts.push({ x, y });
  }
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const x = t * len;
    const envelope = Math.sin(Math.PI * t) ** 0.6;
    const y = -w * 0.5 * envelope * (1 - t * 0.3);
    pts.push({ x, y });
  }
  return pts;
}

/**
 * A flat bird-head silhouette (head + beak + comb as one laser-cuttable
 * outline, centered at the head's own pivot) - a smoothly bulging circle
 * with a sharp radial beak spike toward +X and a smaller comb spike near
 * the top, instead of a separate sphere/cone/dot assembled only in 3D.
 * Real cutout automata build a head like this as one painted flat piece;
 * the 3D preview must extrude this exact outline or the part a builder
 * would actually cut stops matching what they see on screen.
 */
export function buildBirdHeadOutline(scale: number): Point2D[] {
  const r = scale;
  const segments = 48;
  const beakSpread = 0.45;
  const combCenter = (100 * Math.PI) / 180;
  const combSpread = 0.35;
  const pts: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    let radius = r;
    const beakBump = Math.max(0, Math.cos(a) - Math.cos(beakSpread)) / (1 - Math.cos(beakSpread));
    radius += r * 0.9 * beakBump ** 2.2;
    const angDiff = Math.atan2(Math.sin(a - combCenter), Math.cos(a - combCenter));
    const combBump = Math.max(0, Math.cos(angDiff) - Math.cos(combSpread)) / (1 - Math.cos(combSpread));
    radius += r * 0.35 * combBump ** 3;
    pts.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
  }
  return pts;
}

/** A flat, squashed egg-shaped body silhouette - wider than tall, centered
 *  at the body's own mount point. */
export function buildBirdBodyOutline(scale: number): Point2D[] {
  const rx = scale * 1.15;
  const ry = scale * 0.9;
  const segments = 32;
  const pts: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: rx * Math.cos(a), y: ry * Math.sin(a) });
  }
  return pts;
}

/** A small flat oval foot silhouette. */
export function buildFootOutline(scale: number): Point2D[] {
  const rx = scale * 1.1;
  const ry = scale * 0.85;
  const segments = 20;
  const pts: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({ x: rx * Math.cos(a), y: ry * Math.sin(a) });
  }
  return pts;
}
