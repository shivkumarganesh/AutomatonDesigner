import type { Point2D } from '../types/geometry';
import { add, normalize, scale, sub } from '../types/geometry';
import { convexHull } from './hull';

/**
 * Builds the *exact* rounded outline of a set of pin points inflated by a
 * uniform radius - the Minkowski sum of the points' convex hull with a
 * disk. This is what a real laser-cut bar/plate looks like: the hull of
 * its pin centers, stroked out to the bar's half-width (plus kerf/fit
 * offset folded into the same radius, since dilating twice by r1 then r2
 * is identical to dilating once by r1+r2). Straight offset edges + true
 * circular arcs at every vertex - no faceted polyline approximation, and
 * it reduces exactly to the familiar two-point "capsule" shape when there
 * are only 2 pins.
 */
export function buildRoundedHullPath(points: Point2D[], radius: number): string {
  if (points.length === 0) return '';
  const hull = convexHull(points);
  const r = Math.max(radius, 0.05); // defends against a degenerate/negative net offset

  if (hull.length === 1) return circlePath(hull[0], r);

  const n = hull.length;
  const normals: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % n];
    const dir = normalize(sub(b, a));
    // Outward normal for a CCW polygon: rotate the edge direction -90deg.
    normals.push({ x: dir.y, y: -dir.x });
  }

  let d = '';
  for (let i = 0; i < n; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % n];
    const nrm = normals[i];
    const segStart = add(a, scale(nrm, r));
    const segEnd = add(b, scale(nrm, r));
    d += i === 0 ? `M ${fmt(segStart)} ` : `L ${fmt(segStart)} `;
    d += `L ${fmt(segEnd)} `;

    const nextNrm = normals[(i + 1) % n];
    const arcEnd = add(b, scale(nextNrm, r));
    d += `A ${fmtNum(r)} ${fmtNum(r)} 0 0 1 ${fmt(arcEnd)} `;
  }
  return `${d}Z`;
}

/** A full circle as two SVG arcs (a single 360deg arc command is degenerate/undefined). */
export function circlePath(center: Point2D, radius: number): string {
  const r = Math.max(radius, 0.02);
  const left = { x: center.x - r, y: center.y };
  const right = { x: center.x + r, y: center.y };
  return `M ${fmt(left)} A ${fmtNum(r)} ${fmtNum(r)} 0 1 1 ${fmt(right)} A ${fmtNum(r)} ${fmtNum(r)} 0 1 1 ${fmt(left)} Z`;
}

export function polygonPath(points: Point2D[]): string {
  if (points.length === 0) return '';
  return `M ${points.map(fmt).join(' L ')} Z`;
}

function fmt(p: Point2D): string {
  return `${fmtNum(p.x)},${fmtNum(p.y)}`;
}

function fmtNum(n: number): string {
  return Number(n.toFixed(3)).toString();
}
