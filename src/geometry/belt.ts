import type { Point2D } from '../types/geometry';

export interface BeltTangents {
  top: [Point2D, Point2D];
  bottom: [Point2D, Point2D];
}

function tangentPoint(c: Point2D, r: number, u: Point2D, n: Point2D, phi: number, side: 1 | -1): Point2D {
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  return {
    x: c.x + r * (side * cosPhi * n.x + sinPhi * u.x),
    y: c.y + r * (side * cosPhi * n.y + sinPhi * u.y),
  };
}

/**
 * External (open, non-crossed) belt tangent lines between two pulleys - the
 * two straight runs a real belt takes between its rim contact points. Not
 * simple perpendicular offsets from the center line except when r1 === r2:
 * unequal pulleys tilt the tangent line by phi = asin((r1-r2)/d).
 */
export function computeBeltTangents(c1: Point2D, r1: number, c2: Point2D, r2: number): BeltTangents {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  const u: Point2D = { x: dx / d, y: dy / d };
  const n: Point2D = { x: -u.y, y: u.x };
  const phi = Math.asin((r1 - r2) / d);
  return {
    top: [tangentPoint(c1, r1, u, n, phi, 1), tangentPoint(c2, r2, u, n, phi, 1)],
    bottom: [tangentPoint(c1, r1, u, n, phi, -1), tangentPoint(c2, r2, u, n, phi, -1)],
  };
}
