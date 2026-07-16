/**
 * Fundamental 2D geometry primitives shared across the kinematic solver,
 * the flat-pack exporter, and the R3F sandbox renderer.
 *
 * The kinematic domain is intentionally planar (2D). The 3D sandbox lifts
 * every point onto its component's `zIndex` plane at render time only -
 * the solver itself never reasons in three dimensions (see Section 2.D:
 * mechanisms are 2.5D, not 3D).
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

/** A single point on a rigid body's own local reference frame. */
export interface LocalPoint2D {
  x: number;
  y: number;
}

export const ORIGIN: Readonly<Point2D> = Object.freeze({ x: 0, y: 0 });

export function add(a: Point2D, b: Point2D): Point2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point2D, b: Point2D): Point2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Point2D, s: number): Point2D {
  return { x: a.x * s, y: a.y * s };
}

export function dot(a: Point2D, b: Point2D): number {
  return a.x * b.x + a.y * b.y;
}

export function cross(a: Point2D, b: Point2D): number {
  return a.x * b.y - a.y * b.x;
}

export function length(a: Point2D): number {
  return Math.hypot(a.x, a.y);
}

export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function normalize(a: Point2D): Point2D {
  const len = length(a);
  if (len < 1e-12) return { x: 0, y: 0 };
  return { x: a.x / len, y: a.y / len };
}

export function rotate(a: Point2D, theta: number): Point2D {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** Perpendicular (90ccw) of a 2D vector - used for slider axis normals. */
export function perp(a: Point2D): Point2D {
  return { x: -a.y, y: a.x };
}

export function pointOnCircle(center: Point2D, radius: number, theta: number): Point2D {
  return { x: center.x + radius * Math.cos(theta), y: center.y + radius * Math.sin(theta) };
}

export function angleOf(v: Point2D): number {
  return Math.atan2(v.y, v.x);
}

/** Normalizes an angle to (-PI, PI]. */
export function normalizeAngle(theta: number): number {
  let t = theta % (2 * Math.PI);
  if (t <= -Math.PI) t += 2 * Math.PI;
  if (t > Math.PI) t -= 2 * Math.PI;
  return t;
}

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;
