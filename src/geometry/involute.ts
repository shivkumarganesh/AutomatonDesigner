import type { InvoluteGearParams } from '../types/component';
import type { Point2D } from '../types/geometry';
import { DEG2RAD, rotate } from '../types/geometry';

/**
 * Involute gear mathematics (Section 2.C). These are the standard
 * metric-module equations; this module produces the *geometric* tooth
 * profile used for rendering (sandbox + flat-pack preview). Phase 3's
 * exporter is responsible for refitting the sampled involute polyline
 * into exact Bezier/arc segments for the laser-cut SVG/DXF output - the
 * math here is what that refit will be checked against.
 */

export interface GearGeometry {
  /** Pitch diameter, d = m*Z, mm. */
  pitchDiameter: number;
  /** Base circle diameter, mm. */
  baseDiameter: number;
  /** Addendum (tip) circle diameter, mm. */
  tipDiameter: number;
  /** Dedendum (root) circle diameter, mm. */
  rootDiameter: number;
  /** Circular tooth thickness at the pitch circle, mm. */
  toothThicknessAtPitch: number;
  /** Angular pitch between teeth, radians. */
  angularPitch: number;
}

/** inv(alpha) = tan(alpha) - alpha, the involute function. */
export function involuteFunction(alphaRad: number): number {
  return Math.tan(alphaRad) - alphaRad;
}

export function computeGearGeometry(params: InvoluteGearParams): GearGeometry {
  const { teeth: Z, module: m, pressureAngleDeg, profileShift: x, tipClearance: cStar } = params;
  const alpha = pressureAngleDeg * DEG2RAD;

  const pitchDiameter = m * Z;
  const baseDiameter = pitchDiameter * Math.cos(alpha);
  const addendum = m * (1 + x);
  const dedendum = m * (1 + cStar - x);
  const tipDiameter = pitchDiameter + 2 * addendum;
  const rootDiameter = pitchDiameter - 2 * dedendum;
  const toothThicknessAtPitch = m * (Math.PI / 2 + 2 * x * Math.tan(alpha));
  const angularPitch = (2 * Math.PI) / Z;

  return { pitchDiameter, baseDiameter, tipDiameter, rootDiameter, toothThicknessAtPitch, angularPitch };
}

/**
 * Parametrizes the involute curve unwound from a base circle of radius
 * `rb`, by roll angle t: the classic
 *   x(t) = rb*(cos t + t sin t),  y(t) = rb*(sin t - t cos t)
 * construction, with radius(t) = rb*sqrt(1+t^2).
 */
export function involutePoint(rb: number, t: number): Point2D {
  return {
    x: rb * (Math.cos(t) + t * Math.sin(t)),
    y: rb * (Math.sin(t) - t * Math.cos(t)),
  };
}

/** Roll angle at which the involute unwound from `rb` reaches radius `r`. */
export function rollAngleAtRadius(rb: number, r: number): number {
  const ratio = r / rb;
  return Math.sqrt(Math.max(0, ratio * ratio - 1));
}

export interface ToothProfileOptions {
  /** Number of sample points per involute flank. */
  samplesPerFlank?: number;
}

/**
 * Builds a single tooth's outer profile (root -> flank -> tip arc -> flank
 * -> root), centered on the +X axis, in local gear coordinates. Points are
 * returned in angular order suitable for direct consumption by the
 * full-gear generator below.
 */
export function generateToothProfile(params: InvoluteGearParams, opts: ToothProfileOptions = {}): Point2D[] {
  const samples = opts.samplesPerFlank ?? 12;
  const geo = computeGearGeometry(params);
  const rb = geo.baseDiameter / 2;
  const ra = geo.tipDiameter / 2;
  const rf = geo.rootDiameter / 2;
  const rp = geo.pitchDiameter / 2;

  // Half tooth angle at the pitch circle, from tooth thickness.
  const halfToothAngleAtPitch = geo.toothThicknessAtPitch / 2 / rp;
  const alpha = params.pressureAngleDeg * DEG2RAD;

  // Standard construction: the angular position of the involute point at
  // radius r, measured from the tooth centerline, is
  //   theta(r) = halfToothAngleAtPitch + inv(alpha) - inv(alpha_r)
  // where alpha_r = acos(rb/r) is the pressure angle at radius r. Below the
  // base circle the flank is undercut to a radial line down to the root.
  const flankStartR = Math.max(rf, rb);
  const tMax = rollAngleAtRadius(rb, ra);
  const tStart = rollAngleAtRadius(rb, flankStartR);

  const rightFlank: Point2D[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = tStart + ((tMax - tStart) * i) / samples;
    const r = rb * Math.sqrt(1 + t * t);
    const alphaR = Math.acos(Math.min(1, rb / r));
    const theta = halfToothAngleAtPitch + involuteFunction(alpha) - involuteFunction(alphaR);
    const p = involutePoint(rb, t);
    const baseAngle = Math.atan2(p.y, p.x);
    // rotate the involute point so it lands at angular offset -theta from
    // the tooth centerline (the clockwise/right-hand flank)
    rightFlank.push(rotate(p, theta - baseAngle));
  }

  if (rf < rb) {
    // Undercut: drop a radial point from the base circle down to the root
    // circle at the same angle, so the tooth base closes cleanly.
    const angleRoot = Math.atan2(rightFlank[0].y, rightFlank[0].x);
    rightFlank.unshift({ x: rf * Math.cos(angleRoot), y: rf * Math.sin(angleRoot) });
  }

  const leftFlank: Point2D[] = rightFlank.map((p) => ({ x: p.x, y: -p.y })).reverse();

  return [...leftFlank, ...rightFlank];
}

/**
 * Generates the full closed-loop outer profile of an involute spur gear
 * (all Z teeth), sampled as a dense polyline in local gear coordinates
 * (rotation axis at origin). Suitable for direct Canvas/Three.js rendering;
 * Phase 3 refits this into exact arcs/Beziers for vector export.
 */
export function generateGearOutline(params: InvoluteGearParams, opts: ToothProfileOptions = {}): Point2D[] {
  const geo = computeGearGeometry(params);
  const tooth = generateToothProfile(params, opts);
  const points: Point2D[] = [];

  for (let i = 0; i < params.teeth; i++) {
    const angle = i * geo.angularPitch;
    for (const p of tooth) points.push(rotate(p, angle));
  }

  return points;
}
