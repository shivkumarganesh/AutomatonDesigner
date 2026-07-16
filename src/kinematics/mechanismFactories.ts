import type { Component, Linkage } from '../types/component';
import type { Joint, PrismaticJoint, RevoluteJoint } from '../types/joint';
import type { Point2D } from '../types/geometry';
import { add, distance, sub } from '../types/geometry';
import type { FitType, MaterialSpec } from '../types/material';

/**
 * Reusable builders for the crank-linkage family cataloged in
 * docs/MECHANISM_TAXONOMY_SPEC.md Section 2.3. None of these need new
 * data-model types - a crank-slider is just a Linkage + PrismaticJoint the
 * solver already handles, a bell crank is just a 3-point Linkage, and a
 * parallel-motion pair is two ordinary Linkages sharing an existing pin.
 * These functions exist purely to make the fiddly shared-joint bookkeeping
 * a one-call operation instead of hand-wiring it every time (the way
 * store/demoAssembly.ts originally did for its single mismatched wing).
 *
 * Each returns a fragment to merge into an AssemblyTree:
 *   assembly.components = { ...assembly.components, ...fragment.components }
 *   assembly.joints = { ...assembly.joints, ...fragment.joints }
 *   assembly.groundJointIds.push(...fragment.groundJointIds)
 */

export interface MechanismFragment {
  components: Record<string, Component>;
  joints: Record<string, Joint>;
  groundJointIds: string[];
}

// ---------------------------------------------------------------------------
// Crank-slider: crank -> coupler -> slider block riding a straight rail.
// The classic piston mechanism. Uses the *existing* PrismaticJoint line
// constraint - no new solver code needed.
// ---------------------------------------------------------------------------

export interface CrankSliderOptions {
  idPrefix: string;
  groundPivot: Point2D;
  crankRadius: number;
  couplerLength: number;
  /** Unit vector giving the slider rail's direction. */
  slideAxis: Point2D;
  /** A point the slide rail passes through. For a lockup-free crank-slider,
   *  pick this so the rail passes through (or very near) `groundPivot` -
   *  an offset rail can dead-center if `crankRadius` is too close to
   *  `couplerLength` relative to the offset. */
  slideAnchor: Point2D;
  zIndex?: number;
  material: MaterialSpec;
  fit?: FitType;
}

export interface CrankSliderResult extends MechanismFragment {
  crankPivotJointId: string;
  crankPinJointId: string;
  sliderJointId: string;
}

export function createCrankSlider(opts: CrankSliderOptions): CrankSliderResult {
  const { idPrefix, zIndex = 0, material, fit = 'clearance' } = opts;
  const crankPivotJointId = `${idPrefix}-pivot`;
  const crankPinJointId = `${idPrefix}-pin`;
  const sliderJointId = `${idPrefix}-slider`;

  const pivotJoint: RevoluteJoint = {
    id: crankPivotJointId,
    type: 'revolute',
    zIndex,
    componentIds: [`${idPrefix}-crank`],
    position: opts.groundPivot,
    grounded: true,
  };
  const pinJoint: RevoluteJoint = {
    id: crankPinJointId,
    type: 'revolute',
    zIndex,
    componentIds: [`${idPrefix}-crank`, `${idPrefix}-coupler`],
    position: add(opts.groundPivot, { x: opts.crankRadius, y: 0 }),
    grounded: false,
  };
  const sliderJoint: PrismaticJoint = {
    id: sliderJointId,
    type: 'prismatic',
    zIndex,
    componentIds: [`${idPrefix}-coupler`, `${idPrefix}-slider`],
    anchor: opts.slideAnchor,
    axis: opts.slideAxis,
    grounded: true,
  };

  const crank: Linkage = {
    id: `${idPrefix}-crank`,
    name: `${idPrefix} crank`,
    kind: 'linkage',
    zIndex,
    material,
    fit: 'press-fit',
    isInputCrank: true,
    crankRadius: opts.crankRadius,
    groundPivotJointId: crankPivotJointId,
    points: [
      { jointId: crankPivotJointId, local: { x: 0, y: 0 } },
      { jointId: crankPinJointId, local: { x: opts.crankRadius, y: 0 } },
    ],
  };
  const coupler: Linkage = {
    id: `${idPrefix}-coupler`,
    name: `${idPrefix} coupler`,
    kind: 'linkage',
    zIndex,
    material,
    fit,
    points: [
      { jointId: crankPinJointId, local: { x: 0, y: 0 } },
      { jointId: sliderJointId, local: { x: opts.couplerLength, y: 0 } },
    ],
  };
  const slider: Linkage = {
    id: `${idPrefix}-slider`,
    name: `${idPrefix} slider block`,
    kind: 'linkage',
    zIndex,
    material,
    fit,
    // A single-point rigid body: nothing to triangulate (no internal
    // shape), it's purely a point constrained to the rail by sliderJoint.
    points: [{ jointId: sliderJointId, local: { x: 0, y: 0 } }],
  };

  return {
    components: { [crank.id]: crank, [coupler.id]: coupler, [slider.id]: slider },
    joints: { [pivotJoint.id]: pivotJoint, [pinJoint.id]: pinJoint, [sliderJoint.id]: sliderJoint },
    groundJointIds: [crankPivotJointId],
    crankPivotJointId,
    crankPinJointId,
    sliderJointId,
  };
}

// ---------------------------------------------------------------------------
// Bell crank: an L/V-shaped rigid link pivoted at its bend, redirecting
// motion applied on one arm to the other. Just a 3-point Linkage - this
// helper exists so the arm-angle geometry doesn't have to be hand-derived
// every time.
// ---------------------------------------------------------------------------

export interface BellCrankOptions {
  idPrefix: string;
  pivot: Point2D;
  armALength: number;
  armBLength: number;
  /** Angle between the two arms, degrees (0 = straight lever, not a bell crank). */
  armAngleDeg: number;
  zIndex?: number;
  material: MaterialSpec;
  fit?: FitType;
}

export interface BellCrankResult extends MechanismFragment {
  pivotJointId: string;
  armAJointId: string;
  armBJointId: string;
}

export function createBellCrank(opts: BellCrankOptions): BellCrankResult {
  const { idPrefix, zIndex = 0, material, fit = 'clearance' } = opts;
  const pivotJointId = `${idPrefix}-pivot`;
  const armAJointId = `${idPrefix}-armA`;
  const armBJointId = `${idPrefix}-armB`;
  const rad = (opts.armAngleDeg * Math.PI) / 180;

  const pivotJoint: RevoluteJoint = {
    id: pivotJointId,
    type: 'revolute',
    zIndex,
    componentIds: [`${idPrefix}-bellcrank`],
    position: opts.pivot,
    grounded: true,
  };
  const armAJoint: RevoluteJoint = {
    id: armAJointId,
    type: 'revolute',
    zIndex,
    componentIds: [`${idPrefix}-bellcrank`],
    position: add(opts.pivot, { x: opts.armALength, y: 0 }),
    grounded: false,
  };
  const armBJoint: RevoluteJoint = {
    id: armBJointId,
    type: 'revolute',
    zIndex,
    componentIds: [`${idPrefix}-bellcrank`],
    position: add(opts.pivot, { x: opts.armBLength * Math.cos(rad), y: opts.armBLength * Math.sin(rad) }),
    grounded: false,
  };

  const bellCrank: Linkage = {
    id: `${idPrefix}-bellcrank`,
    name: `${idPrefix} bell crank`,
    kind: 'linkage',
    zIndex,
    material,
    fit,
    points: [
      { jointId: pivotJointId, local: { x: 0, y: 0 } },
      { jointId: armAJointId, local: { x: opts.armALength, y: 0 } },
      { jointId: armBJointId, local: { x: opts.armBLength * Math.cos(rad), y: opts.armBLength * Math.sin(rad) } },
    ],
  };

  return {
    components: { [bellCrank.id]: bellCrank },
    joints: { [pivotJoint.id]: pivotJoint, [armAJoint.id]: armAJoint, [armBJoint.id]: armBJoint },
    groundJointIds: [pivotJointId],
    pivotJointId,
    armAJointId,
    armBJointId,
  };
}

// ---------------------------------------------------------------------------
// Parallel-motion pair: mirrors an existing rocker's motion onto a second,
// equal-length rocker via a parallelogram four-bar (ground link = coupler
// length, both rockers equal length), so the new rocker's absolute angle
// exactly tracks the reference rocker's at every instant - the standard way
// automata synchronize two wings/arms off one input. See Section 2.3.
// ---------------------------------------------------------------------------

export interface ParallelMotionPairOptions {
  idPrefix: string;
  /** The existing reference rocker's grounded pivot. */
  referencePivot: Point2D;
  /** The existing joint id at the reference rocker's outer (driven) end -
   *  the new coupler attaches here directly, no new joint is created for
   *  it. Caller must add this factory's id to that joint's own
   *  `componentIds` afterward so Grubler's count stays accurate. */
  referenceOuterJointId: string;
  referenceOuterPosition: Point2D;
  /** Must equal the reference rocker's own pivot-to-tip length. */
  armLength: number;
  /** Where to ground the new, mirrored rocker. */
  newPivot: Point2D;
  zIndex?: number;
  material: MaterialSpec;
  fit?: FitType;
}

export interface ParallelMotionPairResult extends MechanismFragment {
  pivotJointId: string;
  /** Same absolute angle as the reference rocker at every instant. */
  outputJointId: string;
}

export function createParallelMotionPair(opts: ParallelMotionPairOptions): ParallelMotionPairResult {
  const { idPrefix, zIndex = 0, material, fit = 'clearance' } = opts;
  const pivotJointId = `${idPrefix}-pivot`;
  const outputJointId = `${idPrefix}-tip`;

  const armVector = sub(opts.referenceOuterPosition, opts.referencePivot);
  const outputPosition = add(opts.newPivot, armVector);
  const groundLinkLength = distance(opts.referencePivot, opts.newPivot);

  const pivotJoint: RevoluteJoint = {
    id: pivotJointId,
    type: 'revolute',
    zIndex,
    componentIds: [`${idPrefix}-rocker`],
    position: opts.newPivot,
    grounded: true,
  };
  const outputJoint: RevoluteJoint = {
    id: outputJointId,
    type: 'revolute',
    zIndex,
    componentIds: [`${idPrefix}-rocker`, `${idPrefix}-coupler`],
    position: outputPosition,
    grounded: false,
  };

  const rocker: Linkage = {
    id: `${idPrefix}-rocker`,
    name: `${idPrefix} rocker`,
    kind: 'linkage',
    zIndex,
    material,
    fit,
    points: [
      { jointId: pivotJointId, local: { x: 0, y: 0 } },
      { jointId: outputJointId, local: { x: opts.armLength, y: 0 } },
    ],
  };
  const coupler: Linkage = {
    id: `${idPrefix}-coupler`,
    name: `${idPrefix} coupler`,
    kind: 'linkage',
    zIndex,
    material,
    fit,
    points: [
      { jointId: opts.referenceOuterJointId, local: { x: 0, y: 0 } },
      { jointId: outputJointId, local: { x: groundLinkLength, y: 0 } },
    ],
  };

  return {
    components: { [rocker.id]: rocker, [coupler.id]: coupler },
    joints: { [pivotJoint.id]: pivotJoint, [outputJoint.id]: outputJoint },
    groundJointIds: [pivotJointId],
    pivotJointId,
    outputJointId,
  };
}
