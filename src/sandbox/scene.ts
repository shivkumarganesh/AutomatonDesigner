import type { Point2D } from '../types/geometry';

/** mm -> Three.js scene units. Keeps the default 300x500mm canvas at a
 *  comfortable camera distance without every component needing its own
 *  scale math. */
export const MM_TO_UNITS = 1 / 10;

/** mm spacing between adjacent z-index planes (Section 2.D stacking),
 *  exaggerated in the 3D view so overlapping layers are visually legible
 *  even though the physical spacer rings are much thinner. */
export const Z_PLANE_SPACING_MM = 12;

export function toScenePosition(p: Point2D, zIndex: number): [number, number, number] {
  return [p.x * MM_TO_UNITS, p.y * MM_TO_UNITS, zIndex * Z_PLANE_SPACING_MM * MM_TO_UNITS];
}

export function mmToUnits(mm: number): number {
  return mm * MM_TO_UNITS;
}
