import type { AssemblyTree } from '../types/assembly';
import type { Component, Linkage } from '../types/component';
import { isCam, isFollower, isGear, isLinkage } from '../types/component';
import type { Joint, PrismaticJoint } from '../types/joint';
import type { Point2D } from '../types/geometry';
import { add, angleOf, distance, normalizeAngle, perp, rotate, scale, sub } from '../types/geometry';
import { camProfileRadius, intersectCircles, pickNearest } from '../geometry/cam';
import { solveLinearSystem } from './linearAlgebra';

export interface SolveOptions {
  maxIterations?: number;
  /** mm-scale residual tolerance for convergence */
  tolerance?: number;
}

const DEFAULT_OPTIONS: Required<SolveOptions> = {
  maxIterations: 50,
  tolerance: 1e-6,
};

export interface SolveResult {
  /** World-space position of every joint id resolved this frame. */
  positions: Record<string, Point2D>;
  rotations: {
    linkages: Record<string, number>;
    gears: Record<string, number>;
    cams: Record<string, number>;
  };
  followerOutputs: Record<string, { displacement: number; position: Point2D }>;
  converged: boolean;
  iterations: number;
  maxResidual: number;
  /** joint/component ids implicated in a singularity or non-convergence, for red-highlighting. */
  singularities: string[];
}

type DistanceConstraint = { kind: 'distance'; a: string; b: string; length: number; sourceId: string };
type LineConstraint = { kind: 'line'; joint: string; anchor: Point2D; normal: Point2D; sourceId: string };
type Constraint = DistanceConstraint | LineConstraint;

/**
 * Solves the full assembly for a given driver angle theta.
 *
 * Architecture (mirrors how real automata are built, see README):
 *  1. The single input crank's pose is computed directly from theta
 *     (closed form - a driven revolute link has no ambiguity).
 *  2. Any gear/cam train keyed to that same shaft resolves its rotation
 *     analytically via mesh ratios (closed form - gears don't need
 *     iterative solving, just ratio composition).
 *  3. Cam followers resolve from their driving cam's rotation + profile
 *     (closed form for translating followers, circle-intersection for
 *     oscillating roller-arm followers).
 *  4. Whatever is left - the floating linkage network of bars/couplers -
 *     is solved jointly with Newton-Raphson over rigid-body distance
 *     constraints and slider line constraints (PMKS-style loop closure).
 *
 * Joints are the unknowns, not links: a pin shared by two links is a
 * single world-space point, so link rigidity constraints and joint
 * coincidence fall out of the same equation system for free.
 */
export function solveAssembly(
  assembly: AssemblyTree,
  thetaOverride?: number,
  prevPositions?: Record<string, Point2D>,
  options: SolveOptions = {},
): SolveResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const theta = thetaOverride ?? assembly.driver.theta;

  const positions: Record<string, Point2D> = {};
  const rotations = { linkages: {} as Record<string, number>, gears: {} as Record<string, number>, cams: {} as Record<string, number> };
  const followerOutputs: SolveResult['followerOutputs'] = {};
  const singularities: string[] = [];

  // --- Step 0: seed grounded joint positions -------------------------------
  for (const jointId of assembly.groundJointIds) {
    const joint = assembly.joints[jointId];
    if (!joint) continue;
    if (joint.type === 'revolute' || joint.type === 'fixed') {
      positions[jointId] = joint.position;
    }
  }

  const components = Object.values(assembly.components);

  // --- Step 1: input crank (closed form) ------------------------------------
  const crank = components.find((c): c is Linkage => isLinkage(c) && !!c.isInputCrank);
  if (crank && crank.groundPivotJointId) {
    const pivotRef = crank.points.find((p) => p.jointId === crank.groundPivotJointId);
    const pivotJoint = assembly.joints[crank.groundPivotJointId];
    const pivotWorld =
      positions[crank.groundPivotJointId] ??
      (pivotJoint && 'position' in pivotJoint ? pivotJoint.position : { x: 0, y: 0 });
    positions[crank.groundPivotJointId] = pivotWorld;
    const pivotLocal = pivotRef?.local ?? { x: 0, y: 0 };
    for (const ref of crank.points) {
      const world = add(pivotWorld, rotate(sub(ref.local, pivotLocal), theta));
      positions[ref.jointId] = world;
    }
    rotations.linkages[crank.id] = theta;
  }

  // --- Step 2: gear + cam train (closed form ratio composition) ------------
  const rotationById: Record<string, number> = {};
  if (crank) rotationById[crank.id] = theta;

  for (const gear of components.filter(isGear)) {
    if (gear.isInputGear) rotationById[gear.id] = theta;
  }
  for (const cam of components.filter(isCam)) {
    if (cam.isInputCam) rotationById[cam.id] = normalizeAngle(theta + cam.rotationOffset);
  }

  // Resolve the mesh/cam-drive chain with a few passes - automaton gear
  // trains are shallow (rarely more than 3-4 stages), so a fixed number of
  // relaxation passes converges the whole dependency graph without needing
  // a full topological sort.
  for (let pass = 0; pass < components.length + 1; pass++) {
    for (const gear of components.filter(isGear)) {
      if (rotationById[gear.id] !== undefined) continue;
      if (!gear.drivenByMeshJointId) continue;
      const mesh = assembly.joints[gear.drivenByMeshJointId];
      if (!mesh || mesh.type !== 'gear-mesh') continue;
      const driverRotation = rotationById[mesh.driverId];
      if (driverRotation === undefined) continue;
      rotationById[gear.id] = normalizeAngle(driverRotation * mesh.ratio + mesh.phaseOffset);
    }
    for (const cam of components.filter(isCam)) {
      if (rotationById[cam.id] !== undefined) continue;
      if (!cam.drivenByMeshJointId) continue;
      const mesh = assembly.joints[cam.drivenByMeshJointId];
      if (!mesh || mesh.type !== 'gear-mesh') continue;
      const driverRotation = rotationById[mesh.driverId];
      if (driverRotation === undefined) continue;
      rotationById[cam.id] = normalizeAngle(driverRotation * mesh.ratio + mesh.phaseOffset + cam.rotationOffset);
    }
  }
  for (const gear of components.filter(isGear)) {
    rotations.gears[gear.id] = rotationById[gear.id] ?? 0;
  }
  for (const cam of components.filter(isCam)) {
    rotations.cams[cam.id] = rotationById[cam.id] ?? 0;
    if (positions[cam.pivotJointId] === undefined) {
      const j = assembly.joints[cam.pivotJointId];
      if (j && (j.type === 'revolute' || j.type === 'fixed')) positions[cam.pivotJointId] = j.position;
    }
  }

  // --- Step 3: cam followers (closed form / circle intersection) -----------
  for (const follower of components.filter(isFollower)) {
    const cam = assembly.components[follower.camId];
    if (!cam || !isCam(cam)) continue;
    const camRotation = rotations.cams[cam.id] ?? 0;
    const camPivot = positions[cam.pivotJointId] ?? { x: 0, y: 0 };

    if (follower.motion === 'translating' && follower.axis && follower.axisAnchor) {
      const worldAxisAngle = angleOf(follower.axis);
      const phi = worldAxisAngle - camRotation;
      const radius = camProfileRadius(cam.profile, phi);
      const reach = radius + follower.rollerRadius;
      const position = add(follower.axisAnchor, scale(follower.axis, reach));
      followerOutputs[follower.id] = { displacement: reach, position };
      if (follower.outputJointId) positions[follower.outputJointId] = position;
      continue;
    }

    if (follower.motion === 'oscillating' && follower.pivotJointId && follower.armLength) {
      const pivotJoint = assembly.joints[follower.pivotJointId];
      const followerPivot =
        positions[follower.pivotJointId] ?? (pivotJoint && 'position' in pivotJoint ? pivotJoint.position : { x: 0, y: 0 });
      positions[follower.pivotJointId] = followerPivot;
      const worldAxisAngle = angleOf(sub(followerPivot, camPivot));
      const phi = worldAxisAngle - camRotation;
      const radius = camProfileRadius(cam.profile, phi);
      const reach = radius + follower.rollerRadius;
      const prev = prevPositions?.[follower.outputJointId ?? follower.id];
      const { points, degenerate } = intersectCircles(camPivot, reach, followerPivot, follower.armLength);
      if (degenerate || !points) {
        singularities.push(follower.id);
        // Best-effort: clamp roller to the point on the pivot-pivot line
        // closest to satisfying both radii, so the UI still has something
        // sane to render while flagging the failure in red.
        const dir = normalizeVec(sub(followerPivot, camPivot));
        const fallback = add(camPivot, scale(dir, reach));
        followerOutputs[follower.id] = { displacement: reach, position: fallback };
        if (follower.outputJointId) positions[follower.outputJointId] = fallback;
        continue;
      }
      const chosen = pickNearest(points, prev);
      followerOutputs[follower.id] = { displacement: reach, position: chosen };
      if (follower.outputJointId) positions[follower.outputJointId] = chosen;
    }
  }

  // --- Step 4: floating linkage network (Newton-Raphson) --------------------
  const floatingLinkages = components.filter((c): c is Linkage => isLinkage(c) && c.id !== crank?.id);
  const constraints = buildConstraints(floatingLinkages, assembly.joints);

  const unknownIds = collectUnknownJointIds(floatingLinkages, assembly.joints, positions);
  for (const id of unknownIds) {
    if (positions[id]) continue;
    positions[id] = prevPositions?.[id] ?? initialGuess(id, floatingLinkages, positions, assembly.joints);
  }

  const nrResult = unknownIds.length > 0 ? newtonRaphsonSolve(unknownIds, positions, constraints, opts) : { converged: true, iterations: 0, maxResidual: 0, failedAt: [] as string[] };

  singularities.push(...nrResult.failedAt);

  // --- Step 5: derive link rotations for rendering --------------------------
  for (const link of floatingLinkages) {
    if (link.points.length < 2) continue;
    const [p0, p1] = link.points;
    const worldA = positions[p0.jointId];
    const worldB = positions[p1.jointId];
    if (!worldA || !worldB) continue;
    const localAngle = angleOf(sub(p1.local, p0.local));
    const worldAngle = angleOf(sub(worldB, worldA));
    rotations.linkages[link.id] = normalizeAngle(worldAngle - localAngle);
  }

  return {
    positions,
    rotations,
    followerOutputs,
    converged: nrResult.converged,
    iterations: nrResult.iterations,
    maxResidual: nrResult.maxResidual,
    singularities,
  };
}

function normalizeVec(v: Point2D): Point2D {
  const len = distance({ x: 0, y: 0 }, v);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/** Triangulated-fan rigidity constraints per link: 2N-3 pairwise distance
 *  constraints for N points, which minimally (and non-redundantly) pins a
 *  rigid body's shape without over-constraining the Jacobian. */
function buildConstraints(linkages: Linkage[], joints: Record<string, Joint>): Constraint[] {
  const constraints: Constraint[] = [];

  for (const link of linkages) {
    const pts = link.points;
    if (pts.length < 2) continue;
    const dist0 = ptDist(pts[0].local, pts[1].local);
    constraints.push({ kind: 'distance', a: pts[0].jointId, b: pts[1].jointId, length: dist0, sourceId: link.id });
    for (let i = 2; i < pts.length; i++) {
      constraints.push({ kind: 'distance', a: pts[i].jointId, b: pts[0].jointId, length: ptDist(pts[i].local, pts[0].local), sourceId: link.id });
      constraints.push({ kind: 'distance', a: pts[i].jointId, b: pts[1].jointId, length: ptDist(pts[i].local, pts[1].local), sourceId: link.id });
    }
  }

  for (const joint of Object.values(joints)) {
    if (joint.type !== 'prismatic') continue;
    const p = joint as PrismaticJoint;
    constraints.push({ kind: 'line', joint: p.id, anchor: p.anchor, normal: perp(p.axis), sourceId: p.id });
  }

  return constraints;
}

function ptDist(a: Point2D, b: Point2D): number {
  return distance(a, b);
}

function collectUnknownJointIds(
  linkages: Linkage[],
  joints: Record<string, Joint>,
  known: Record<string, Point2D>,
): string[] {
  const ids = new Set<string>();
  for (const link of linkages) {
    for (const p of link.points) {
      if (!known[p.jointId]) ids.add(p.jointId);
    }
  }
  for (const joint of Object.values(joints)) {
    if (joint.type === 'prismatic' && !known[joint.id]) ids.add(joint.id);
  }
  return Array.from(ids);
}

/**
 * A slider's slide-axis line generally crosses a driving pin's reach circle
 * at *two* points (the classic crank-slider ambiguity); with no better seed,
 * Newton-Raphson just falls into whichever root sits closer to the initial
 * guess, which used to be the axis anchor itself - a coin flip that, once
 * settled on the first solve, persists every frame after via prevPositions
 * continuity. Prefer projecting from a linkage-mate whose position is
 * already known, offset by this joint's *local* geometry relative to that
 * mate: a zeroth-order guess (assumes near-zero relative rotation) that
 * lands on the branch the mechanism's local coordinates were actually
 * authored against, instead of leaving the branch to chance.
 */
function initialGuess(jointId: string, linkages: Linkage[], positions: Record<string, Point2D>, joints: Record<string, Joint>): Point2D {
  for (const link of linkages) {
    const target = link.points.find((p) => p.jointId === jointId);
    if (!target) continue;
    for (const mate of link.points) {
      if (mate.jointId === jointId) continue;
      const mateWorld = positions[mate.jointId];
      if (!mateWorld) continue;
      return add(mateWorld, sub(target.local, mate.local));
    }
  }
  const joint = joints[jointId];
  if (joint && 'position' in joint && joint.position) return joint.position;
  if (joint && joint.type === 'prismatic') return joint.anchor;
  return { x: 0, y: 0 };
}

interface NewtonRaphsonResult {
  converged: boolean;
  iterations: number;
  maxResidual: number;
  failedAt: string[];
}

/**
 * Newton-Raphson solve for the joint positions in `unknownIds`, mutating
 * `positions` in place with the converged (or best-effort) result.
 */
function newtonRaphsonSolve(
  unknownIds: string[],
  positions: Record<string, Point2D>,
  constraints: Constraint[],
  opts: Required<SolveOptions>,
): NewtonRaphsonResult {
  const n = unknownIds.length;
  const index = new Map<string, number>();
  unknownIds.forEach((id, i) => index.set(id, i));

  let maxResidual = Infinity;
  let iterations = 0;
  let converged = false;

  for (iterations = 0; iterations < opts.maxIterations; iterations++) {
    const dim = 2 * n;
    const J: number[][] = Array.from({ length: constraints.length }, () => new Array(dim).fill(0));
    const g: number[] = new Array(constraints.length).fill(0);

    constraints.forEach((c, row) => {
      if (c.kind === 'distance') {
        const Pa = positions[c.a];
        const Pb = positions[c.b];
        if (!Pa || !Pb) return;
        const dx = Pa.x - Pb.x;
        const dy = Pa.y - Pb.y;
        g[row] = dx * dx + dy * dy - c.length * c.length;
        const ia = index.get(c.a);
        const ib = index.get(c.b);
        if (ia !== undefined) {
          J[row][2 * ia] += 2 * dx;
          J[row][2 * ia + 1] += 2 * dy;
        }
        if (ib !== undefined) {
          J[row][2 * ib] += -2 * dx;
          J[row][2 * ib + 1] += -2 * dy;
        }
      } else {
        const P = positions[c.joint];
        if (!P) return;
        const dx = P.x - c.anchor.x;
        const dy = P.y - c.anchor.y;
        g[row] = dx * c.normal.x + dy * c.normal.y;
        const ip = index.get(c.joint);
        if (ip !== undefined) {
          J[row][2 * ip] += c.normal.x;
          J[row][2 * ip + 1] += c.normal.y;
        }
      }
    });

    maxResidual = g.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    if (maxResidual < opts.tolerance) {
      converged = true;
      break;
    }

    // Normal equations (J^T J) dx = -J^T g - handles non-square systems
    // (redundant/over-determined constraint rows are common with
    // triangulated ternary links) via a least-squares Gauss-Newton step.
    const JT = transpose(J);
    const JTJ = matMul(JT, J);
    const negJTg = matVecMul(JT, g).map((v) => -v);

    // Small Tikhonov regularization keeps the normal-equations matrix
    // invertible even when a constraint row is momentarily degenerate
    // (e.g. a link passing through a straight/singular configuration).
    for (let i = 0; i < dim; i++) JTJ[i][i] += 1e-9;

    const dx = solveLinearSystem(JTJ, negJTg);
    if (!dx) {
      return { converged: false, iterations, maxResidual, failedAt: unknownIds.slice() };
    }

    for (let i = 0; i < n; i++) {
      const id = unknownIds[i];
      positions[id] = { x: positions[id].x + dx[2 * i], y: positions[id].y + dx[2 * i + 1] };
    }
  }

  return { converged, iterations, maxResidual, failedAt: converged ? [] : unknownIds.slice() };
}

function transpose(M: number[][]): number[][] {
  if (M.length === 0) return [];
  const rows = M.length;
  const cols = M[0].length;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) T[c][r] = M[r][c];
  return T;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const inner = B.length;
  const cols = inner > 0 ? B[0].length : 0;
  const R: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < inner; k++) {
      const a = A[r][k];
      if (a === 0) continue;
      for (let c = 0; c < cols; c++) R[r][c] += a * B[k][c];
    }
  }
  return R;
}

function matVecMul(A: number[][], v: number[]): number[] {
  return A.map((row) => row.reduce((sum, a, i) => sum + a * v[i], 0));
}

export type { Component };
