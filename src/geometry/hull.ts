import type { Point2D } from '../types/geometry';
import { cross, sub } from '../types/geometry';

/**
 * Andrew's monotone chain convex hull, O(n log n). Returns hull points in
 * counter-clockwise order with no repeated start/end point. Collinear
 * points on an edge are dropped (strict turns only), and duplicate/near-
 * duplicate input points collapse naturally since they can't produce a
 * strict turn.
 */
export function convexHull(points: Point2D[]): Point2D[] {
  const pts = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (pts.length <= 2) return pts;

  const cross2 = (o: Point2D, a: Point2D, b: Point2D) => cross(sub(a, o), sub(b, o));

  const lower: Point2D[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross2(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }

  const upper: Point2D[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross2(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}
