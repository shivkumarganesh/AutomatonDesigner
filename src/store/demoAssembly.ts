import type { AssemblyTree } from '../types/assembly';
import type { Cam, Figure, Follower, Gear, Linkage } from '../types/component';
import type { CamFollowerJoint, FixedJoint, GearMeshJoint, PrismaticJoint, RevoluteJoint } from '../types/joint';
import { DEFAULT_KERF, DEFAULT_MATERIAL } from '../types/material';
import { createParallelMotionPair } from '../kinematics/mechanismFactories';

/**
 * A worked example exercising every Phase 1 component type in one 1-DoF
 * assembly, driven by a single crank:
 *
 *   input shaft (crank + keyed pinion gear)
 *     |-- crank pin -> coupler -> rocker            (Grashof crank-rocker four-bar)
 *     |    `-- rocker's outer pin also drives a parallelogram
 *     |        six-bar (createParallelMotionPair) mirroring its angle
 *     |        onto a second rocker, so both wing Figures flap in sync
 *     `-- pinion meshes 20:40 into a driven gear     (2:1 reduction)
 *          `-- a pear-dwell cam keyed to that shaft drives a translating
 *              follower (bird head bob: dwell, peck down, dwell, back up)
 *
 * See docs/MECHANISM_TAXONOMY_SPEC.md for the mechanism catalog this is
 * drawn from and the Grubler DoF math for the parallel-motion addition.
 */
export function createDemoAssembly(): AssemblyTree {
  const material = DEFAULT_MATERIAL;

  const jointA: RevoluteJoint = {
    id: 'joint-A',
    type: 'revolute',
    zIndex: 0,
    componentIds: ['crank'],
    position: { x: 0, y: 0 },
    grounded: true,
  };
  const jointB: RevoluteJoint = {
    id: 'joint-B',
    type: 'revolute',
    zIndex: 0,
    componentIds: ['crank', 'coupler'],
    position: { x: 20, y: 0 },
    grounded: false,
  };
  const jointC: RevoluteJoint = {
    id: 'joint-C',
    type: 'revolute',
    zIndex: 0,
    // 'wing2-coupler' (added below via createParallelMotionPair) also
    // pins here - 3 bodies sharing one point is 2 independent pin-pairs,
    // not 1, which is why gruebler.ts weights J1 by (bodyCount - 1).
    componentIds: ['coupler', 'rocker', 'wing2-coupler'],
    position: { x: 67.32, y: 44.56 },
    grounded: false,
  };
  const jointD: RevoluteJoint = {
    id: 'joint-D',
    type: 'revolute',
    zIndex: 0,
    componentIds: ['rocker'],
    position: { x: 90, y: 0 },
    grounded: true,
  };
  const jointG2: RevoluteJoint = {
    id: 'joint-G2',
    type: 'revolute',
    zIndex: 1,
    componentIds: ['gearOut'],
    position: { x: 0, y: -60 },
    grounded: true,
  };
  const fixedGearInToCrank: FixedJoint = {
    id: 'fixed-gearIn-crank',
    type: 'fixed',
    zIndex: 1,
    componentIds: ['crank', 'gearIn'],
    position: { x: 0, y: 0 },
  };
  const fixedCamToGearOut: FixedJoint = {
    id: 'fixed-cam-gearOut',
    type: 'fixed',
    zIndex: 1,
    componentIds: ['gearOut', 'cam1'],
    position: { x: 0, y: -60 },
  };
  const meshJoint1: GearMeshJoint = {
    id: 'mesh-1',
    type: 'gear-mesh',
    zIndex: 1,
    componentIds: ['gearIn', 'gearOut'],
    driverId: 'gearIn',
    drivenId: 'gearOut',
    ratio: -20 / 40,
    phaseOffset: 0,
  };

  // The follower rod's 3 planar DoF are removed by exactly two pairs: a
  // grounded prismatic joint (the rail it slides in, J1, -2 DoF) and the
  // cam-follower contact itself (J2, -1 DoF) - see Grubler check below.
  const followerSlider: PrismaticJoint = {
    id: 'slider-follower1',
    type: 'prismatic',
    zIndex: 2,
    componentIds: ['follower1'],
    anchor: { x: 0, y: -60 },
    axis: { x: 0, y: 1 },
    grounded: true,
  };
  const camFollowerJoint: CamFollowerJoint = {
    id: 'contact-cam1-follower1',
    type: 'cam-follower',
    zIndex: 2,
    componentIds: ['cam1', 'follower1'],
    camId: 'cam1',
    followerId: 'follower1',
  };

  const crank: Linkage = {
    id: 'crank',
    name: 'Input Crank',
    kind: 'linkage',
    zIndex: 0,
    material,
    fit: 'press-fit',
    color: '#e63946',
    isInputCrank: true,
    crankRadius: 20,
    groundPivotJointId: 'joint-A',
    points: [
      { jointId: 'joint-A', local: { x: 0, y: 0 } },
      { jointId: 'joint-B', local: { x: 20, y: 0 } },
    ],
  };

  const coupler: Linkage = {
    id: 'coupler',
    name: 'Coupler',
    kind: 'linkage',
    zIndex: 0,
    material,
    fit: 'clearance',
    color: '#457b9d',
    points: [
      { jointId: 'joint-B', local: { x: 0, y: 0 } },
      { jointId: 'joint-C', local: { x: 65, y: 0 } },
    ],
  };

  const rocker: Linkage = {
    id: 'rocker',
    name: 'Rocker',
    kind: 'linkage',
    zIndex: 0,
    material,
    fit: 'clearance',
    color: '#2a9d8f',
    points: [
      { jointId: 'joint-D', local: { x: 0, y: 0 } },
      { jointId: 'joint-C', local: { x: 50, y: 0 } },
    ],
  };

  const gearIn: Gear = {
    id: 'gearIn',
    name: 'Pinion (Z20)',
    kind: 'gear',
    zIndex: 1,
    material,
    fit: 'press-fit',
    color: '#e9c46a',
    pivotJointId: 'joint-A',
    isInputGear: true,
    params: { teeth: 20, module: 2, pressureAngleDeg: 20, profileShift: 0, tipClearance: 0.25, boreDiameter: 5 },
  };

  const gearOut: Gear = {
    id: 'gearOut',
    name: 'Driven Gear (Z40)',
    kind: 'gear',
    zIndex: 1,
    material,
    fit: 'press-fit',
    color: '#f4a261',
    pivotJointId: 'joint-G2',
    drivenByMeshJointId: 'mesh-1',
    params: { teeth: 40, module: 2, pressureAngleDeg: 20, profileShift: 0, tipClearance: 0.25, boreDiameter: 5 },
  };

  const cam1: Cam = {
    id: 'cam1',
    name: 'Lift Cam',
    kind: 'cam',
    zIndex: 2,
    material,
    fit: 'press-fit',
    color: '#8d99ae',
    pivotJointId: 'joint-G2',
    drivenByMeshJointId: 'mesh-1',
    rotationOffset: 0,
    // Dwell-rise-dwell-fall-dwell: the head holds still, pecks down,
    // holds at the bottom, then rises back - a real pause a viewer reads
    // as intentional, not the smoother dwell-less rise/fall of
    // 'constant-rise-fall'. See MECHANISM_TAXONOMY_SPEC.md Section 2.1.
    profile: { kind: 'pear-dwell', baseRadius: 15, lift: 10 },
  };

  const follower: Follower = {
    id: 'follower1',
    name: 'Follower Rod',
    kind: 'follower',
    zIndex: 2,
    material,
    fit: 'clearance',
    color: '#6d597a',
    motion: 'translating',
    camId: 'cam1',
    axis: { x: 0, y: 1 },
    axisAnchor: { x: 0, y: -60 },
    rollerRadius: 3,
    // Exposes the roller-center as a plain lookup key in the solver's
    // position map (see solveAssembly step 3) so the bird head Figure below
    // can ride on it - it isn't a real Joint, nothing else references it.
    outputJointId: 'follower1-out',
  };

  // The performer: what actually makes this an *automaton* rather than a
  // bare mechanism (see README) - a bird head that bobs on the follower rod
  // (pecking motion) and a wing hinged at the rocker's fixed pivot, swept by
  // the rocker's own oscillation. Neither adds DoF: see gruebler.ts / the
  // 'figure' exclusion there.
  const birdHead: Figure = {
    id: 'birdHead',
    name: 'Bird Head',
    kind: 'figure',
    // A z-plane above everything else it rides near (cam=2, gearOut=1) so
    // the performer visibly floats in front of the mechanism that drives
    // it, the way a finished automaton's figure sits above its hidden works.
    zIndex: 4,
    material,
    fit: 'press-fit',
    color: '#e76f51',
    shape: 'bird-head',
    attachJointId: 'follower1-out',
    localOffset: { x: 0, y: 24 },
    scale: 18,
  };

  const wing: Figure = {
    id: 'wing1',
    name: 'Left Wing',
    kind: 'figure',
    zIndex: 4,
    material,
    fit: 'press-fit',
    color: '#3d5a80',
    shape: 'wing',
    attachJointId: 'joint-D',
    orientationJointId: 'joint-C',
    localOffset: { x: 0, y: 0 },
    scale: 42,
  };

  // Both wings flap in exact sync: rather than a second Figure faking it
  // off the same joint-C angle, this mirrors the rocker's actual motion
  // through a genuine parallelogram four-bar (ground link = new coupler
  // length, both rockers = 50mm) - see MECHANISM_TAXONOMY_SPEC.md 2.3 and
  // kinematics/mechanismFactories.ts.
  const wing2Mechanism = createParallelMotionPair({
    idPrefix: 'wing2',
    referencePivot: jointD.position,
    referenceOuterJointId: 'joint-C',
    referenceOuterPosition: jointC.position,
    armLength: 50,
    newPivot: { x: 150, y: 0 },
    zIndex: 0,
    material,
    fit: 'clearance',
  });

  const wing2: Figure = {
    id: 'wing2',
    name: 'Right Wing',
    kind: 'figure',
    zIndex: 4,
    material,
    fit: 'press-fit',
    color: '#3d5a80',
    shape: 'wing',
    attachJointId: wing2Mechanism.pivotJointId,
    orientationJointId: wing2Mechanism.outputJointId,
    localOffset: { x: 0, y: 0 },
    scale: 42,
  };

  const assembly: AssemblyTree = {
    id: 'demo-assembly',
    name: 'Demo: Pecking Bird Automaton, Wings in Sync',
    groundJointIds: ['joint-A', 'joint-D', 'joint-G2', ...wing2Mechanism.groundJointIds],
    components: {
      crank,
      coupler,
      rocker,
      gearIn,
      gearOut,
      cam1,
      follower1: follower,
      birdHead,
      wing1: wing,
      wing2,
      ...wing2Mechanism.components,
    },
    joints: {
      [jointA.id]: jointA,
      [jointB.id]: jointB,
      [jointC.id]: jointC,
      [jointD.id]: jointD,
      [jointG2.id]: jointG2,
      [fixedGearInToCrank.id]: fixedGearInToCrank,
      [fixedCamToGearOut.id]: fixedCamToGearOut,
      [meshJoint1.id]: meshJoint1,
      [followerSlider.id]: followerSlider,
      [camFollowerJoint.id]: camFollowerJoint,
      ...wing2Mechanism.joints,
    },
    driver: { theta: 0, omega: 1, isPlaying: true },
    materialDefaults: DEFAULT_MATERIAL,
    kerf: DEFAULT_KERF,
    canvasSize: { width: 300, height: 500 },
    stage: {
      widthMm: 260,
      depthMm: 220,
      heightMm: 20,
      originMm: { x: 40, y: -25 },
      crankJointId: 'joint-A',
      crankHandleLengthMm: 32,
    },
  };

  return assembly;
}
