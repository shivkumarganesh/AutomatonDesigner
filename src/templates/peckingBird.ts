import type { AssemblyTree } from '../types/assembly';
import type { Cam, CamProfileKind, Figure, Follower, Gear, Linkage } from '../types/component';
import type { CamFollowerJoint, FixedJoint, GearMeshJoint, PrismaticJoint, RevoluteJoint } from '../types/joint';
import { DEFAULT_KERF, DEFAULT_MATERIAL } from '../types/material';
import { createParallelMotionPair } from '../kinematics/mechanismFactories';
import type { AutomatonTemplate, TemplateParamField, TemplateParams } from './types';
import { numParam, strParam } from './types';

const CAM_PROFILE: TemplateParamField = {
  key: 'camProfile',
  label: 'Cam profile',
  kind: 'select',
  default: 'pear-dwell',
  options: [
    { value: 'pear-dwell', label: 'Pear (dwell + peck)' },
    { value: 'snail-drop', label: 'Snail (creep + drop)' },
    { value: 'constant-rise-fall', label: 'Smooth rise/fall' },
    { value: 'heart', label: 'Heart (constant velocity)' },
  ],
};
const LIFT: TemplateParamField = { key: 'lift', label: 'Peck depth', kind: 'number', min: 4, max: 20, step: 1, default: 10, unit: 'mm' };
const TEETH_OUT: TemplateParamField = { key: 'teethOut', label: 'Driven gear teeth', kind: 'number', min: 20, max: 60, step: 2, default: 40 };
const WING_SPAN: TemplateParamField = { key: 'wingSpan', label: 'Wing span', kind: 'number', min: 24, max: 70, step: 2, default: 42, unit: 'mm' };
const SPEED: TemplateParamField = { key: 'speed', label: 'Speed', kind: 'number', min: 0.2, max: 3, step: 0.1, default: 1, unit: 'rad/s' };
const BODY_COLOR: TemplateParamField = { key: 'bodyColor', label: 'Body color', kind: 'color', default: '#e76f51' };
const WING_COLOR: TemplateParamField = { key: 'wingColor', label: 'Wing color', kind: 'color', default: '#3d5a80' };

/**
 * Crank-rocker four-bar sharing its input shaft with a reduction gear pair
 * that drives a cam + translating follower - the bird head pecks, and the
 * rocker's motion mirrors onto a second rocker via createParallelMotionPair
 * so both wings flap in exact sync. See docs/MECHANISM_TAXONOMY_SPEC.md.
 */
function build(params: TemplateParams): AssemblyTree {
  const material = DEFAULT_MATERIAL;
  const teethIn = 20;
  const teethOut = numParam(params, TEETH_OUT as TemplateParamField & { kind: 'number' });
  const module = 2;
  const centerDistance = (module * (teethIn + teethOut)) / 2;
  const lift = numParam(params, LIFT as TemplateParamField & { kind: 'number' });
  const camProfile = strParam(params, CAM_PROFILE as TemplateParamField & { kind: 'select' }) as CamProfileKind;
  const wingSpan = numParam(params, WING_SPAN as TemplateParamField & { kind: 'number' });
  const speed = numParam(params, SPEED as TemplateParamField & { kind: 'number' });
  const bodyColor = strParam(params, BODY_COLOR as TemplateParamField & { kind: 'color' });
  const wingColor = strParam(params, WING_COLOR as TemplateParamField & { kind: 'color' });

  // The gear/cam/follower subsystem hangs off the crank's own shaft
  // (joint-A) at an angle rather than straight down, so it lands close to
  // the crank-rocker's wing cluster around joint-D instead of off on its
  // own - real automata keep every driven part clustered under one
  // compact character, not spread across the whole sheet the way a purely
  // engineering-driven layout would.
  const gearTiltRad = (50 * Math.PI) / 180;
  const gearOutPos = { x: centerDistance * Math.sin(gearTiltRad), y: -centerDistance * Math.cos(gearTiltRad) };

  const jointA: RevoluteJoint = { id: 'joint-A', type: 'revolute', zIndex: 0, componentIds: ['crank'], position: { x: 0, y: 0 }, grounded: true };
  const jointB: RevoluteJoint = { id: 'joint-B', type: 'revolute', zIndex: 0, componentIds: ['crank', 'coupler'], position: { x: 20, y: 0 }, grounded: false };
  const jointC: RevoluteJoint = {
    id: 'joint-C',
    type: 'revolute',
    zIndex: 0,
    componentIds: ['coupler', 'rocker', 'wing2-coupler'],
    position: { x: 67.32, y: 44.56 },
    grounded: false,
  };
  const jointD: RevoluteJoint = { id: 'joint-D', type: 'revolute', zIndex: 0, componentIds: ['rocker'], position: { x: 90, y: 0 }, grounded: true };
  const jointG2: RevoluteJoint = {
    id: 'joint-G2',
    type: 'revolute',
    zIndex: 1,
    componentIds: ['gearOut'],
    position: gearOutPos,
    grounded: true,
  };
  const fixedGearInToCrank: FixedJoint = { id: 'fixed-gearIn-crank', type: 'fixed', zIndex: 1, componentIds: ['crank', 'gearIn'], position: { x: 0, y: 0 } };
  const fixedCamToGearOut: FixedJoint = {
    id: 'fixed-cam-gearOut',
    type: 'fixed',
    zIndex: 1,
    componentIds: ['gearOut', 'cam1'],
    position: gearOutPos,
  };
  const meshJoint1: GearMeshJoint = {
    id: 'mesh-1',
    type: 'gear-mesh',
    zIndex: 1,
    componentIds: ['gearIn', 'gearOut'],
    driverId: 'gearIn',
    drivenId: 'gearOut',
    ratio: -teethIn / teethOut,
    phaseOffset: 0,
  };
  const followerSlider: PrismaticJoint = {
    id: 'slider-follower1',
    type: 'prismatic',
    zIndex: 2,
    componentIds: ['follower1'],
    anchor: gearOutPos,
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
    name: `Pinion (Z${teethIn})`,
    kind: 'gear',
    zIndex: 1,
    material,
    fit: 'press-fit',
    color: '#e9c46a',
    pivotJointId: 'joint-A',
    isInputGear: true,
    params: { teeth: teethIn, module, pressureAngleDeg: 20, profileShift: 0, tipClearance: 0.25, boreDiameter: 5 },
  };
  const gearOut: Gear = {
    id: 'gearOut',
    name: `Driven Gear (Z${teethOut})`,
    kind: 'gear',
    zIndex: 1,
    material,
    fit: 'press-fit',
    color: '#f4a261',
    pivotJointId: 'joint-G2',
    drivenByMeshJointId: 'mesh-1',
    params: { teeth: teethOut, module, pressureAngleDeg: 20, profileShift: 0, tipClearance: 0.25, boreDiameter: 5 },
  };
  const cam1: Cam = {
    id: 'cam1',
    name: 'Lift Cam',
    kind: 'cam',
    zIndex: 2,
    material,
    fit: 'press-fit',
    color: '#8b5e34',
    pivotJointId: 'joint-G2',
    drivenByMeshJointId: 'mesh-1',
    rotationOffset: 0,
    profile: { kind: camProfile, baseRadius: 15, lift, dropFraction: 0.08, requiredDirection: camProfile === 'snail-drop' ? 1 : undefined },
  };
  const follower: Follower = {
    id: 'follower1',
    name: 'Follower Rod',
    kind: 'follower',
    zIndex: 2,
    material,
    fit: 'clearance',
    color: '#a1623c',
    motion: 'translating',
    camId: 'cam1',
    axis: { x: 0, y: 1 },
    axisAnchor: gearOutPos,
    rollerRadius: 3,
    outputJointId: 'follower1-out',
  };

  // The performer, built the way the research (docs/AUTOMATON_VISUAL_DESIGN_SPEC.md)
  // says a real automaton actually is: a mostly-static body sitting on the
  // box, with only the parts the mechanism truly drives in motion, each
  // mounted with zero gap onto its own drive joint and a visible painted
  // dowel (`showConnectingRod`) bridging the box top to that part - not a
  // decorative shape floating unexplained near the gears.
  const enclosureTopZIndex = 2;
  const bodyZIndex = enclosureTopZIndex + 1;
  const neckBaseX = gearOutPos.x;
  const neckBaseY = gearOutPos.y + 8; // just below the follower's minimum reach

  const birdBody: Figure = {
    id: 'birdBody',
    name: 'Body',
    kind: 'figure',
    zIndex: bodyZIndex,
    material,
    fit: 'press-fit',
    color: bodyColor,
    shape: 'bird-body',
    staticPosition: { x: neckBaseX, y: neckBaseY },
    localOffset: { x: 0, y: 0 },
    scale: 26,
  };
  const leftFoot: Figure = {
    id: 'leftFoot',
    name: 'Left Foot',
    kind: 'figure',
    zIndex: bodyZIndex,
    material,
    fit: 'press-fit',
    color: '#f2cc8f',
    shape: 'foot',
    staticPosition: { x: neckBaseX - 12, y: neckBaseY - 22 },
    localOffset: { x: 0, y: 0 },
    scale: 7,
  };
  const rightFoot: Figure = {
    id: 'rightFoot',
    name: 'Right Foot',
    kind: 'figure',
    zIndex: bodyZIndex,
    material,
    fit: 'press-fit',
    color: '#f2cc8f',
    shape: 'foot',
    staticPosition: { x: neckBaseX + 12, y: neckBaseY - 22 },
    localOffset: { x: 0, y: 0 },
    scale: 7,
  };
  const birdHead: Figure = {
    id: 'birdHead',
    name: 'Bird Head',
    kind: 'figure',
    zIndex: bodyZIndex + 1,
    material,
    fit: 'press-fit',
    color: bodyColor,
    shape: 'bird-head',
    attachJointId: 'follower1-out',
    localOffset: { x: 0, y: 8 },
    scale: 18,
    showConnectingRod: true,
  };
  const wing: Figure = {
    id: 'wing1',
    name: 'Left Wing',
    kind: 'figure',
    zIndex: bodyZIndex,
    material,
    fit: 'press-fit',
    color: wingColor,
    shape: 'wing',
    attachJointId: 'joint-D',
    orientationJointId: 'joint-C',
    localOffset: { x: 0, y: 0 },
    scale: wingSpan,
    showConnectingRod: true,
  };

  const wing2Mechanism = createParallelMotionPair({
    idPrefix: 'wing2',
    referencePivot: jointD.position,
    referenceOuterJointId: 'joint-C',
    referenceOuterPosition: jointC.position,
    armLength: 50,
    // Stacked above joint-D (rather than far off to the side) so both
    // wing pivots cluster tightly, closer to where the body actually is.
    newPivot: { x: 90, y: 55 },
    zIndex: 0,
    material,
    fit: 'clearance',
  });
  const wing2: Figure = {
    id: 'wing2',
    name: 'Right Wing',
    kind: 'figure',
    zIndex: bodyZIndex,
    material,
    fit: 'press-fit',
    color: wingColor,
    shape: 'wing',
    attachJointId: wing2Mechanism.pivotJointId,
    orientationJointId: wing2Mechanism.outputJointId,
    localOffset: { x: 0, y: 0 },
    scale: wingSpan,
    showConnectingRod: true,
  };

  return {
    id: 'pecking-bird',
    name: 'Pecking Bird, Wings in Sync',
    groundJointIds: ['joint-A', 'joint-D', 'joint-G2', ...wing2Mechanism.groundJointIds],
    components: {
      crank,
      coupler,
      rocker,
      gearIn,
      gearOut,
      cam1,
      follower1: follower,
      birdBody,
      leftFoot,
      rightFoot,
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
    driver: { theta: 0, omega: speed, isPlaying: true },
    materialDefaults: DEFAULT_MATERIAL,
    kerf: DEFAULT_KERF,
    canvasSize: { width: 300, height: 500 },
    stage: {
      widthMm: 220,
      depthMm: 210,
      heightMm: 20,
      originMm: { x: 50, y: 10 },
      crankJointId: 'joint-A',
      crankHandleLengthMm: 32,
      enclosureTopZIndex,
    },
  };
}

export const peckingBirdTemplate: AutomatonTemplate = {
  id: 'pecking-bird',
  name: 'Pecking Bird',
  description: 'A crank-rocker four-bar shares its shaft with a reduction gear pair; a cam pecks the head, both wings flap in exact sync via a parallel-motion linkage.',
  icon: '🐦',
  mechanisms: ['crank-rocker four-bar', 'gear train', 'cam + follower', 'parallel-motion pair'],
  paramSchema: [CAM_PROFILE, LIFT, TEETH_OUT, WING_SPAN, SPEED, BODY_COLOR, WING_COLOR],
  build,
};
