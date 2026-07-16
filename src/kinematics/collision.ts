import type { AssemblyTree } from '../types/assembly';
import type { Component } from '../types/component';
import { isCam, isFollower, isGear, isLinkage } from '../types/component';
import type { Point2D } from '../types/geometry';
import { distance } from '../types/geometry';
import type { SolveResult } from './solver';
import { computeGearGeometry } from '../geometry/involute';
import { camProfileRadius } from '../geometry/cam';

export interface CollisionShape {
  componentId: string;
  zIndex: number;
  /** Either a bounding circle or a capsule (line segment + radius). */
  kind: 'circle' | 'capsule';
  center: Point2D;
  radius: number;
  /** capsule only */
  a?: Point2D;
  b?: Point2D;
}

/** Builds a coarse bounding shape per component from the solved pose, for
 *  Section 2.D planar-collision checking (same z-plane material overlap). */
export function buildCollisionShapes(assembly: AssemblyTree, solve: SolveResult): CollisionShape[] {
  const shapes: CollisionShape[] = [];
  const PART_HALF_WIDTH = 6; // mm, approximate laser-cut bar stock width for capsule links

  for (const component of Object.values(assembly.components)) {
    shapes.push(...shapesFor(component, solve));
  }
  return shapes;

  function shapesFor(component: Component, solve: SolveResult): CollisionShape[] {
    if (isLinkage(component)) {
      const pts = component.points.map((p) => solve.positions[p.jointId]).filter((p): p is Point2D => !!p);
      if (pts.length < 2) return [];
      const shapes: CollisionShape[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        shapes.push({
          componentId: component.id,
          zIndex: component.zIndex,
          kind: 'capsule',
          a: pts[i],
          b: pts[i + 1],
          center: { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 },
          radius: PART_HALF_WIDTH,
        });
      }
      return shapes;
    }
    if (isGear(component)) {
      const center = solve.positions[component.pivotJointId];
      if (!center) return [];
      const geo = computeGearGeometry(component.params);
      return [{ componentId: component.id, zIndex: component.zIndex, kind: 'circle', center, radius: geo.tipDiameter / 2 }];
    }
    if (isCam(component)) {
      const center = solve.positions[component.pivotJointId];
      if (!center) return [];
      let maxR = component.profile.baseRadius;
      for (let i = 0; i < 36; i++) {
        maxR = Math.max(maxR, camProfileRadius(component.profile, (i / 36) * Math.PI * 2));
      }
      return [{ componentId: component.id, zIndex: component.zIndex, kind: 'circle', center, radius: maxR }];
    }
    if (isFollower(component)) {
      const out = solve.followerOutputs[component.id];
      if (!out) return [];
      return [{ componentId: component.id, zIndex: component.zIndex, kind: 'circle', center: out.position, radius: component.rollerRadius }];
    }
    return [];
  }
}

function closestPointOnSegment(p: Point2D, a: Point2D, b: Point2D): Point2D {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) return a;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function shapeDistance(s1: CollisionShape, s2: CollisionShape): number {
  if (s1.kind === 'circle' && s2.kind === 'circle') {
    return distance(s1.center, s2.center);
  }
  if (s1.kind === 'capsule' && s2.kind === 'capsule') {
    // Approximate segment-segment distance via closest-point sampling on
    // both segments (sufficient for coarse collision flags at this scale).
    const candidates = [
      distance(closestPointOnSegment(s1.a!, s2.a!, s2.b!), s1.a!),
      distance(closestPointOnSegment(s1.b!, s2.a!, s2.b!), s1.b!),
      distance(closestPointOnSegment(s2.a!, s1.a!, s1.b!), s2.a!),
      distance(closestPointOnSegment(s2.b!, s1.a!, s1.b!), s2.b!),
    ];
    return Math.min(...candidates);
  }
  // circle vs capsule
  const circle = s1.kind === 'circle' ? s1 : s2;
  const capsule = s1.kind === 'capsule' ? s1 : s2;
  const closest = closestPointOnSegment(circle.center, capsule.a!, capsule.b!);
  return distance(circle.center, closest);
}

export interface CollisionPair {
  a: string;
  b: string;
  zIndex: number;
}

/** Flags same-z-plane component pairs whose approximate geometry overlaps,
 *  skipping pairs that share a joint (expected to touch at the pin). */
export function detectPlanarCollisions(assembly: AssemblyTree, solve: SolveResult): CollisionPair[] {
  const shapes = buildCollisionShapes(assembly, solve);
  const sharedJointPairs = new Set<string>();
  for (const joint of Object.values(assembly.joints)) {
    for (let i = 0; i < joint.componentIds.length; i++) {
      for (let j = i + 1; j < joint.componentIds.length; j++) {
        sharedJointPairs.add(pairKey(joint.componentIds[i], joint.componentIds[j]));
      }
    }
  }

  const collisions: CollisionPair[] = [];
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const s1 = shapes[i];
      const s2 = shapes[j];
      if (s1.componentId === s2.componentId) continue;
      if (s1.zIndex !== s2.zIndex) continue;
      if (sharedJointPairs.has(pairKey(s1.componentId, s2.componentId))) continue;
      const d = shapeDistance(s1, s2);
      if (d < s1.radius + s2.radius) {
        collisions.push({ a: s1.componentId, b: s2.componentId, zIndex: s1.zIndex });
      }
    }
  }
  return collisions;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
