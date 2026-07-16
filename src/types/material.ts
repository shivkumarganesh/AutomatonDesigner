/**
 * Material & kerf calibration (Spec Section 2.A).
 *
 * Every exportable part references a MaterialSpec. The exporter (Phase 3)
 * uses `sheetThickness` to size axle bores / spacer rings, and `kerf` +
 * `fit` to decide which direction to offset a profile:
 *
 *  - press-fit (tabs/gear bores fixed to an axle): inner geometry shrinks
 *    by kerf/2, outer geometry grows by kerf/2, so the *cut* line still
 *    lands on the nominal edge once the laser removes `kerf` of material.
 *  - clearance (idlers / linkages spinning freely on a pin): same kerf
 *    correction PLUS an additional running clearance margin so the part
 *    doesn't bind on the pin.
 */

export type FitType = 'press-fit' | 'clearance';

export interface KerfConfig {
  /** Laser beam width offset, mm. Half is removed from each side of a cut line. */
  kerf: number;
  /** Extra radial clearance added on top of kerf for free-running fits, mm. */
  clearance: number;
  /** Whether outer/press-fit edges should get a 45 degree lead-in chamfer. */
  chamferEnabled: boolean;
  /** Chamfer depth, mm (only used when chamferEnabled). */
  chamferDepth: number;
}

export const DEFAULT_KERF: KerfConfig = {
  kerf: 0.15,
  clearance: 0.15,
  chamferEnabled: true,
  chamferDepth: 1.0,
};

export interface MaterialSpec {
  id: string;
  name: string;
  /** Sheet thickness, mm. Default 1/8" plywood/acrylic. */
  thickness: number;
  /** Per-material kerf override; falls back to project default when absent. */
  kerf?: Partial<KerfConfig>;
}

export const DEFAULT_MATERIAL: MaterialSpec = {
  id: 'material-default',
  name: '1/8in Plywood',
  thickness: 3.175,
};

/**
 * Resolves the effective offset (mm) to apply to a profile boundary.
 * Positive = grow the polygon outward, negative = shrink it inward.
 *
 * @param fit press-fit (axle bores, gear hubs) vs clearance (idler holes, pin joints)
 * @param edge whether this ring/loop is the *outer* silhouette of the part
 *             or an *inner* cutout (a hole)
 */
export function resolveOffset(
  fit: FitType,
  edge: 'outer' | 'inner',
  cfg: KerfConfig = DEFAULT_KERF,
): number {
  const half = cfg.kerf / 2;
  const sign = edge === 'outer' ? 1 : -1;
  const clearance = fit === 'clearance' ? cfg.clearance : 0;
  // Outer edges grow by half-kerf so the finished (post-cut) part measures
  // nominal size; inner (hole) edges shrink by half-kerf for the same reason.
  // Clearance fits additionally enlarge holes / shrink shafts so they spin freely.
  return sign * half + (edge === 'inner' ? -clearance : 0) + (edge === 'outer' && fit === 'clearance' ? -clearance : 0);
}
