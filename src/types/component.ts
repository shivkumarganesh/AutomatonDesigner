import type { Point2D } from './geometry';
import type { MaterialSpec, FitType } from './material';

export type ComponentKind = 'linkage' | 'gear' | 'cam' | 'follower' | 'figure';

interface BaseComponentFields {
  id: string;
  name: string;
  kind: ComponentKind;
  /** Z-plane index for 2.5D stacking (Section 2.D). Parts sharing a zIndex
   *  must not overlap in 2D or the validator flags a planar collision. */
  zIndex: number;
  material: MaterialSpec;
  /** press-fit (keyed to its axle) vs clearance (spins freely on a pin) -
   *  drives the kerf offset sign used by the exporter (Section 2.A). */
  fit: FitType;
  color?: string;
  locked?: boolean;
}

// ---------------------------------------------------------------------------
// Linkage - a rigid bar/plate carrying 2+ pin joints (Grubler J1 lower pairs).
// ---------------------------------------------------------------------------

export interface LinkageJointRef {
  jointId: string;
  /** Coordinates in the link's own local/body reference frame, mm.
   *  Distances between these points are the rigidity constraints the
   *  solver enforces (see kinematics/solver.ts). */
  local: Point2D;
}

export interface Linkage extends BaseComponentFields {
  kind: 'linkage';
  points: LinkageJointRef[];
  /** True if this link IS the master input crank, driven directly by theta. */
  isInputCrank?: boolean;
  /** Required when isInputCrank: distance from ground pivot to crank pin, mm. */
  crankRadius?: number;
  /** Required when isInputCrank: the grounded revolute joint id it rotates about. */
  groundPivotJointId?: string;
  /** Populated each solver pass: world-space position of every joint on this link. */
  solved?: {
    points: Record<string, Point2D>;
    /** body rotation relative to its initial reference pose, radians */
    rotation: number;
  };
}

// ---------------------------------------------------------------------------
// Gear - involute spur gear (Section 2.C).
// ---------------------------------------------------------------------------

export interface InvoluteGearParams {
  /** Number of teeth, Z. */
  teeth: number;
  /** Module, mm (pitch diameter / teeth). */
  module: number;
  /** Pressure angle, degrees. Default 20. */
  pressureAngleDeg: number;
  /** Profile shift coefficient, x. */
  profileShift: number;
  /** Tip clearance coefficient, c*. Default 0.25. */
  tipClearance: number;
  /** Shaft bore diameter, mm. */
  boreDiameter: number;
  /** Extrusion depth for 3D preview, mm. Defaults to material thickness. */
  faceWidth?: number;
}

export const DEFAULT_INVOLUTE_PARAMS: InvoluteGearParams = {
  teeth: 20,
  module: 2,
  pressureAngleDeg: 20,
  profileShift: 0,
  tipClearance: 0.25,
  boreDiameter: 5,
};

export interface Gear extends BaseComponentFields {
  kind: 'gear';
  params: InvoluteGearParams;
  /** The grounded revolute joint this gear spins about. */
  pivotJointId: string;
  /** If set, this gear is the *driven* member of a gear-mesh joint upstream. */
  drivenByMeshJointId?: string;
  /** True for the single gear directly keyed to the master input shaft. */
  isInputGear?: boolean;
  solved?: { rotation: number };
}

// ---------------------------------------------------------------------------
// Cam - plate cam with an arbitrary radial profile.
// ---------------------------------------------------------------------------

export type CamProfileKind = 'circular-eccentric' | 'constant-rise-fall' | 'heart' | 'custom-samples';

export interface CamProfile {
  kind: CamProfileKind;
  /** Base (minimum) radius, mm. */
  baseRadius: number;
  /** Eccentric offset for 'circular-eccentric', mm. */
  eccentricity?: number;
  /** Peak additional lift above baseRadius, mm, for generated profiles. */
  lift?: number;
  /** Explicit radius samples (mm) evenly spaced over [0, 2*PI), for 'custom-samples'. */
  samples?: number[];
}

export interface Cam extends BaseComponentFields {
  kind: 'cam';
  profile: CamProfile;
  /** The grounded revolute joint this cam spins about. */
  pivotJointId: string;
  /** If set, this cam's shaft is stepped down through a gear-mesh joint. */
  drivenByMeshJointId?: string;
  /** True if this cam is keyed directly to the master input shaft. */
  isInputCam?: boolean;
  /** Phase offset applied on top of the driving rotation, radians. */
  rotationOffset: number;
  solved?: { rotation: number };
}

// ---------------------------------------------------------------------------
// Follower - reads a cam's profile and outputs translation or oscillation.
// ---------------------------------------------------------------------------

export type FollowerMotionKind = 'translating' | 'oscillating';

export interface Follower extends BaseComponentFields {
  kind: 'follower';
  motion: FollowerMotionKind;
  camId: string;
  rollerRadius: number;
  /** translating followers: unit direction of travel */
  axis?: Point2D;
  /** translating followers: a fixed point the slide axis passes through */
  axisAnchor?: Point2D;
  /** oscillating followers: grounded pivot the arm swings about */
  pivotJointId?: string;
  /** oscillating followers: arm length from pivot to roller center, mm */
  armLength?: number;
  /** Optional joint id exposing this follower's roller-center as a pin so
   *  downstream Linkages can key off the follower's motion (e.g. a cam
   *  driving a rocker through a follower rod). */
  outputJointId?: string;
  solved?: { displacement: number; position: Point2D; rotation?: number };
}

// ---------------------------------------------------------------------------
// Figure - the whole point of an automaton: a decorative performer (bird,
// animal, character part) rigidly glued to a moving joint so it inherits
// that joint's solved motion. This is what separates an "automaton" from a
// bare test rig - per Cabaret Mechanical Theatre / Exploratorium references,
// every automaton is a hidden mechanism driving a visible performer on top.
//
// A Figure adds zero DoF of its own (it's glued on, like a fixed joint would
// be) so it is intentionally excluded from Grubler's N count and from
// planar-collision checking - see kinematics/gruebler.ts and
// kinematics/collision.ts.
// ---------------------------------------------------------------------------

export type FigureShapeKind = 'bird-head' | 'wing' | 'sphere' | 'disc';

export interface Figure extends BaseComponentFields {
  kind: 'figure';
  shape: FigureShapeKind;
  /** The joint whose solved world position this figure rides on every frame. */
  attachJointId: string;
  /** A second joint used to derive a facing/rotation angle (e.g. the far end
   *  of the link the figure is glued to), so the figure visibly orients
   *  itself with the mechanism instead of staying axis-aligned. */
  orientationJointId?: string;
  /** Offset from the attach joint in the figure's own local frame, mm. */
  localOffset: Point2D;
  /** Overall size, mm. */
  scale: number;
}

export type Component = Linkage | Gear | Cam | Follower | Figure;

export function isLinkage(c: Component): c is Linkage {
  return c.kind === 'linkage';
}
export function isGear(c: Component): c is Gear {
  return c.kind === 'gear';
}
export function isCam(c: Component): c is Cam {
  return c.kind === 'cam';
}
export function isFollower(c: Component): c is Follower {
  return c.kind === 'follower';
}
export function isFigure(c: Component): c is Figure {
  return c.kind === 'figure';
}
