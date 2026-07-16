import type { Point2D } from './geometry';

/**
 * Joint taxonomy used by both the kinematic solver and Grubler's
 * equation (Spec Section 2.B):
 *
 *   F = 3(N - 1) - 2*J1 - J2
 *
 *  - J1 (lower pairs, 1 DoF each): 'revolute' (pin) and 'prismatic' (slider)
 *  - J2 (higher pairs, 2 DoF each): 'gear-mesh' and 'cam-follower'
 *  - 'fixed' anchors a point to the ground frame and does not consume a
 *    DoF budget entry itself - it is how a link becomes part of link #1
 *    (the frame) rather than a free body. Grounded revolute/prismatic
 *    joints ARE still counted as J1 pairs between the link and the frame.
 */
export type JointType = 'revolute' | 'prismatic' | 'gear-mesh' | 'cam-follower' | 'fixed';

export function jointDofWeight(type: JointType): 1 | 2 {
  switch (type) {
    case 'revolute':
    case 'prismatic':
    case 'fixed':
      return 1;
    case 'gear-mesh':
    case 'cam-follower':
      return 2;
  }
}

export function isLowerPair(type: JointType): boolean {
  return type === 'revolute' || type === 'prismatic' || type === 'fixed';
}

export function isHigherPair(type: JointType): boolean {
  return type === 'gear-mesh' || type === 'cam-follower';
}

export interface BaseJoint {
  id: string;
  type: JointType;
  /** z-plane this joint's pin/contact occupies (Section 2.D stacking). */
  zIndex: number;
  /** Component id(s) this joint connects. Ground-anchored joints have length 1. */
  componentIds: string[];
}

/** A pin joint connecting two rigid bodies (or one body to ground) at a point. */
export interface RevoluteJoint extends BaseJoint {
  type: 'revolute';
  /** Position in world space when grounded; otherwise the initial/reference pose position. */
  position: Point2D;
  grounded: boolean;
}

/** A sliding joint constraining a point to translate along a fixed axis. */
export interface PrismaticJoint extends BaseJoint {
  type: 'prismatic';
  /** A point the slide axis passes through. */
  anchor: Point2D;
  /** Unit vector giving the direction of allowed translation. */
  axis: Point2D;
  grounded: boolean;
}

/** Fixes a link rigidly to the ground frame (zero relative DoF). */
export interface FixedJoint extends BaseJoint {
  type: 'fixed';
  position: Point2D;
}

/** A meshing pair between two gears (or a gear and a rack). Higher pair, 2-DoF. */
export interface GearMeshJoint extends BaseJoint {
  type: 'gear-mesh';
  /** driving gear/rack component id */
  driverId: string;
  /** driven gear/rack component id */
  drivenId: string;
  /** signed ratio driven_theta = driver_theta * ratio (negative = external mesh reverses direction) */
  ratio: number;
  /** angular (or, for a rack, linear) phase offset applied to the driven member, radians or mm */
  phaseOffset: number;
}

/** A cam-to-follower contact pair. Higher pair, 2-DoF. */
export interface CamFollowerJoint extends BaseJoint {
  type: 'cam-follower';
  camId: string;
  followerId: string;
}

export type Joint = RevoluteJoint | PrismaticJoint | FixedJoint | GearMeshJoint | CamFollowerJoint;
