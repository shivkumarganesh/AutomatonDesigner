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
