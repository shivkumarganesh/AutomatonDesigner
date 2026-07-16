import type { CamProfile } from '../types/component';
import type { Point2D } from '../types/geometry';
import { distance, normalizeAngle } from '../types/geometry';

const TWO_PI = Math.PI * 2;

/**
 * Evaluates a cam's radial profile at a local angle phi (radians, any
 * range - normalized internally). All profile kinds resolve to a radius
 * in mm measured from the cam's rotation axis.
 */
export function camProfileRadius(profile: CamProfile, phi: number): number {
  const t = normalizeAngle(phi);
  const unit = (t + Math.PI) / TWO_PI; // 0..1

  switch (profile.kind) {
    case 'circular-eccentric': {
      // A plain circular disc mounted off-axis by `eccentricity`: the
      // radial distance from the true rotation center traces a simple
      // sinusoid of one cycle per revolution.
      const e = profile.eccentricity ?? 0;
      return profile.baseRadius + e * Math.cos(t);
    }
    case 'constant-rise-fall': {
      // Symmetric rise over the first half turn, dwell, fall over the
      // second half - a standard beginner cam profile for automata.
      const lift = profile.lift ?? profile.baseRadius * 0.5;
      if (unit < 0.5) {
        // smoothstep rise 0..1 over first half
        const u = unit / 0.5;
        return profile.baseRadius + lift * smoothstep(u);
      }
      const u = (unit - 0.5) / 0.5;
      return profile.baseRadius + lift * (1 - smoothstep(u));
    }
    case 'heart': {
      // Classic constant-velocity "heart cam": linear rise then linear
      // fall, producing uniform linear follower speed each half-turn.
      const lift = profile.lift ?? profile.baseRadius * 0.6;
      const u = unit < 0.5 ? unit / 0.5 : (1 - unit) / 0.5;
      return profile.baseRadius + lift * u;
    }
    case 'custom-samples': {
      const samples = profile.samples ?? [];
      if (samples.length === 0) return profile.baseRadius;
      const n = samples.length;
      const fpos = ((t + Math.PI) / TWO_PI) * n;
      const i0 = Math.floor(fpos) % n;
      const i1 = (i0 + 1) % n;
      const frac = fpos - Math.floor(fpos);
      return samples[i0] * (1 - frac) + samples[i1] * frac;
    }
  }
}

function smoothstep(u: number): number {
  const c = Math.max(0, Math.min(1, u));
  return c * c * (3 - 2 * c);
}

export interface CircleIntersectionResult {
  points: [Point2D, Point2D] | null;
  /** true when the circles do not intersect (mechanism cannot reach this
   *  pose - a physical lockup / singularity). */
  degenerate: boolean;
}

/**
 * Classic two-circle intersection, used to resolve an oscillating cam
 * follower's roller center: one circle is centered on the cam axis with
 * radius = profile radius + roller radius, the other is centered on the
 * follower's ground pivot with radius = arm length.
 */
export function intersectCircles(c1: Point2D, r1: number, c2: Point2D, r2: number): CircleIntersectionResult {
  const d = distance(c1, c2);
  if (d < 1e-9 || d > r1 + r2 || d < Math.abs(r1 - r2)) {
    return { points: null, degenerate: true };
  }
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const hSq = r1 * r1 - a * a;
  const h = Math.sqrt(Math.max(0, hSq));
  const xm = c1.x + (a * (c2.x - c1.x)) / d;
  const ym = c1.y + (a * (c2.y - c1.y)) / d;
  const rx = -(c2.y - c1.y) * (h / d);
  const ry = (c2.x - c1.x) * (h / d);
  return {
    points: [
      { x: xm + rx, y: ym + ry },
      { x: xm - rx, y: ym - ry },
    ],
    degenerate: false,
  };
}

/** Picks whichever of two candidate points is nearer to a reference (used
 *  to keep the follower on a continuous branch between animation frames). */
export function pickNearest(candidates: [Point2D, Point2D], reference: Point2D | undefined): Point2D {
  if (!reference) return candidates[0];
  const d0 = distance(candidates[0], reference);
  const d1 = distance(candidates[1], reference);
  return d0 <= d1 ? candidates[0] : candidates[1];
}
