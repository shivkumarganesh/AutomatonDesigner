import type { AssemblyTree } from '../types/assembly';
import type { Cam, CamProfileKind, Figure, Follower } from '../types/component';
import type { CamFollowerJoint, RevoluteJoint } from '../types/joint';
import { DEFAULT_KERF, DEFAULT_MATERIAL } from '../types/material';
import type { AutomatonTemplate, TemplateParamField, TemplateParams } from './types';
import { numParam, strParam } from './types';

const CAM_PROFILE: TemplateParamField = {
  key: 'camProfile',
  label: 'Cam profile',
  kind: 'select',
  default: 'constant-rise-fall',
  options: [
    { value: 'constant-rise-fall', label: 'Smooth rise/fall' },
    { value: 'pear-dwell', label: 'Pear (dwell + nod)' },
    { value: 'heart', label: 'Heart (constant velocity)' },
  ],
};
const ARM_LENGTH: TemplateParamField = { key: 'armLength', label: 'Neck arm length', kind: 'number', min: 35, max: 65, step: 1, default: 50, unit: 'mm' };
const LIFT: TemplateParamField = { key: 'lift', label: 'Nod depth', kind: 'number', min: 4, max: 16, step: 1, default: 10, unit: 'mm' };
const HEAD_SIZE: TemplateParamField = { key: 'headSize', label: 'Head size', kind: 'number', min: 10, max: 24, step: 1, default: 16, unit: 'mm' };
const SPEED: TemplateParamField = { key: 'speed', label: 'Speed', kind: 'number', min: 0.2, max: 3, step: 0.1, default: 1, unit: 'rad/s' };
const HEAD_COLOR: TemplateParamField = { key: 'headColor', label: 'Head color', kind: 'color', default: '#588157' };

/**
 * The simplest possible automaton mechanism: a single cam driven directly
 * off the input shaft (no gear train), read by an oscillating roller-arm
 * follower - the cam-follower circle-intersection solve in
 * kinematics/solver.ts step 3 IS the whole mechanism here. Good minimal
 * reference for the cam-follower family in docs/MECHANISM_TAXONOMY_SPEC.md.
 */
function build(params: TemplateParams): AssemblyTree {
  const material = DEFAULT_MATERIAL;
  const camProfile = strParam(params, CAM_PROFILE as TemplateParamField & { kind: 'select' }) as CamProfileKind;
  const armLength = numParam(params, ARM_LENGTH as TemplateParamField & { kind: 'number' });
  const lift = numParam(params, LIFT as TemplateParamField & { kind: 'number' });
  const headSize = numParam(params, HEAD_SIZE as TemplateParamField & { kind: 'number' });
  const speed = numParam(params, SPEED as TemplateParamField & { kind: 'number' });
  const headColor = strParam(params, HEAD_COLOR as TemplateParamField & { kind: 'color' });

  const jointCam: RevoluteJoint = { id: 'joint-cam', type: 'revolute', zIndex: 0, componentIds: ['cam1'], position: { x: 0, y: 0 }, grounded: true };
  const jointArm: RevoluteJoint = { id: 'joint-arm', type: 'revolute', zIndex: 0, componentIds: ['follower1'], position: { x: 60, y: 0 }, grounded: true };
  const camFollowerJoint: CamFollowerJoint = {
    id: 'contact-cam1-follower1',
    type: 'cam-follower',
    zIndex: 0,
    componentIds: ['cam1', 'follower1'],
    camId: 'cam1',
    followerId: 'follower1',
  };

  const cam1: Cam = {
    id: 'cam1',
    name: 'Neck Cam',
    kind: 'cam',
    zIndex: 0,
    material,
    fit: 'press-fit',
    color: '#8d99ae',
    pivotJointId: 'joint-cam',
    isInputCam: true,
    rotationOffset: 0,
    profile: { kind: camProfile, baseRadius: 15, lift },
  };
  const follower: Follower = {
    id: 'follower1',
    name: 'Neck Arm',
    kind: 'follower',
    zIndex: 0,
    material,
    fit: 'clearance',
    color: '#6d597a',
    motion: 'oscillating',
    camId: 'cam1',
    pivotJointId: 'joint-arm',
    armLength,
    rollerRadius: 3,
    outputJointId: 'head-out',
  };
  const head: Figure = {
    id: 'head',
    name: 'Head',
    kind: 'figure',
    zIndex: 2,
    material,
    fit: 'press-fit',
    color: headColor,
    shape: 'bird-head',
    attachJointId: 'head-out',
    orientationJointId: 'joint-arm',
    localOffset: { x: 0, y: 0 },
    scale: headSize,
  };

  return {
    id: 'nodding-head',
    name: 'Nodding Head',
    groundJointIds: ['joint-cam', 'joint-arm'],
    components: { cam1, follower1: follower, head },
    joints: { [jointCam.id]: jointCam, [jointArm.id]: jointArm, [camFollowerJoint.id]: camFollowerJoint },
    driver: { theta: 0, omega: speed, isPlaying: true },
    materialDefaults: DEFAULT_MATERIAL,
    kerf: DEFAULT_KERF,
    canvasSize: { width: 200, height: 200 },
    stage: {
      widthMm: 160,
      depthMm: 140,
      heightMm: 20,
      originMm: { x: 30, y: 0 },
      crankJointId: 'joint-cam',
      crankHandleLengthMm: 28,
    },
  };
}

export const noddingHeadTemplate: AutomatonTemplate = {
  id: 'nodding-head',
  name: 'Nodding Head',
  description: 'The simplest automaton: one cam read directly by an oscillating roller-arm follower - a head nods on the arm as the crank turns.',
  icon: '🙂',
  mechanisms: ['cam + oscillating follower'],
  paramSchema: [CAM_PROFILE, ARM_LENGTH, LIFT, HEAD_SIZE, SPEED, HEAD_COLOR],
  build,
};
