import type { AssemblyTree } from '../types/assembly';
import type { Cam, Follower, Gear, Linkage } from '../types/component';
import type { CamFollowerJoint, FixedJoint, GearMeshJoint, PrismaticJoint, RevoluteJoint } from '../types/joint';
import { DEFAULT_KERF, DEFAULT_MATERIAL } from '../types/material';

/**
 * A worked example exercising every Phase 1 component type in one 1-DoF
 * assembly, driven by a single crank:
 *
 *   input shaft (crank + keyed pinion gear)
 *     |-- crank pin -> coupler -> rocker         (Grashof crank-rocker four-bar)
 *     `-- pinion meshes 20:40 into a driven gear  (2:1 reduction)
 *          `-- a cam keyed to that same shaft drives a translating follower
 *
 * Grubler check: 4 independent links (crank+pinion, coupler, rocker,
 * gear+cam) + ground, 5 lower pairs (2 ground pivots, 2 coupler pins, 1
 * cam-follower... see below) - the exact breakdown is asserted in
 * gruebler.test-worthy comments inline, and surfaced live in the sandbox
 * validation panel.
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
    componentIds: ['coupler', 'rocker'],
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
    profile: { kind: 'constant-rise-fall', baseRadius: 15, lift: 10 },
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
  };

  const assembly: AssemblyTree = {
    id: 'demo-assembly',
    name: 'Demo: Crank-Rocker + Geared Cam',
    groundJointIds: ['joint-A', 'joint-D', 'joint-G2'],
    components: {
      crank,
      coupler,
      rocker,
      gearIn,
      gearOut,
      cam1,
      follower1: follower,
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
    },
    driver: { theta: 0, omega: 1, isPlaying: true },
    materialDefaults: DEFAULT_MATERIAL,
    kerf: DEFAULT_KERF,
    canvasSize: { width: 300, height: 500 },
  };

  return assembly;
}
