import type { AssemblyTree } from '../types/assembly';
import type { Figure, Gear } from '../types/component';
import type { GearMeshJoint, RevoluteJoint } from '../types/joint';
import { DEFAULT_KERF, DEFAULT_MATERIAL } from '../types/material';
import type { AutomatonTemplate, TemplateParamField, TemplateParams } from './types';
import { numParam, strParam } from './types';

const TEETH_IN: TemplateParamField = { key: 'teethIn', label: 'Input gear teeth', kind: 'number', min: 8, max: 20, step: 1, default: 12 };
const TEETH_OUT: TemplateParamField = { key: 'teethOut', label: 'Pinwheel gear teeth', kind: 'number', min: 16, max: 48, step: 1, default: 24 };
const BLADE_SIZE: TemplateParamField = { key: 'bladeSize', label: 'Blade size', kind: 'number', min: 20, max: 55, step: 1, default: 34, unit: 'mm' };
const SPEED: TemplateParamField = { key: 'speed', label: 'Speed', kind: 'number', min: 0.2, max: 3, step: 0.1, default: 1, unit: 'rad/s' };
const BLADE_COLOR: TemplateParamField = { key: 'bladeColor', label: 'Blade color', kind: 'color', default: '#f4a261' };

/**
 * The purest gear-train mechanism: no cam, no linkage, just an external
 * spur mesh - turning the crank at 1x visibly spins the pinwheel at the
 * geared-down ratio, a direct, legible demonstration of gear ratio. Also
 * the reference example for Figure.attachComponentId (see
 * types/component.ts): a decorative disc riding a Gear's own rotation
 * directly, since a gear has no second moving point to derive a facing
 * angle from the way a Linkage pin does.
 */
function build(params: TemplateParams): AssemblyTree {
  const material = DEFAULT_MATERIAL;
  const teethIn = numParam(params, TEETH_IN as TemplateParamField & { kind: 'number' });
  const teethOut = numParam(params, TEETH_OUT as TemplateParamField & { kind: 'number' });
  const bladeSize = numParam(params, BLADE_SIZE as TemplateParamField & { kind: 'number' });
  const speed = numParam(params, SPEED as TemplateParamField & { kind: 'number' });
  const bladeColor = strParam(params, BLADE_COLOR as TemplateParamField & { kind: 'color' });
  const module = 2;
  const centerDistance = (module * (teethIn + teethOut)) / 2;

  const jointA: RevoluteJoint = { id: 'joint-A', type: 'revolute', zIndex: 0, componentIds: ['gearIn'], position: { x: 0, y: 0 }, grounded: true };
  const jointB: RevoluteJoint = {
    id: 'joint-B',
    type: 'revolute',
    zIndex: 0,
    componentIds: ['gearOut'],
    position: { x: centerDistance, y: 0 },
    grounded: true,
  };
  const meshJoint: GearMeshJoint = {
    id: 'mesh-1',
    type: 'gear-mesh',
    zIndex: 0,
    componentIds: ['gearIn', 'gearOut'],
    driverId: 'gearIn',
    drivenId: 'gearOut',
    ratio: -teethIn / teethOut,
    phaseOffset: 0,
  };

  const gearIn: Gear = {
    id: 'gearIn',
    name: `Input Gear (Z${teethIn})`,
    kind: 'gear',
    zIndex: 0,
    material,
    fit: 'press-fit',
    color: '#e9c46a',
    pivotJointId: 'joint-A',
    isInputGear: true,
    params: { teeth: teethIn, module, pressureAngleDeg: 20, profileShift: 0, tipClearance: 0.25, boreDiameter: 5 },
  };
  const gearOut: Gear = {
    id: 'gearOut',
    name: `Pinwheel Gear (Z${teethOut})`,
    kind: 'gear',
    zIndex: 0,
    material,
    fit: 'press-fit',
    color: '#a8dadc',
    pivotJointId: 'joint-B',
    drivenByMeshJointId: 'mesh-1',
    params: { teeth: teethOut, module, pressureAngleDeg: 20, profileShift: 0, tipClearance: 0.25, boreDiameter: 5 },
  };
  const pinwheel: Figure = {
    id: 'pinwheelBlades',
    name: 'Pinwheel Blades',
    kind: 'figure',
    zIndex: 1,
    material,
    fit: 'press-fit',
    color: bladeColor,
    shape: 'pinwheel',
    attachComponentId: 'gearOut',
    localOffset: { x: 0, y: 0 },
    scale: bladeSize,
  };

  return {
    id: 'spinning-pinwheel',
    name: 'Spinning Pinwheel',
    groundJointIds: ['joint-A', 'joint-B'],
    components: { gearIn, gearOut, pinwheelBlades: pinwheel },
    joints: { [jointA.id]: jointA, [jointB.id]: jointB, [meshJoint.id]: meshJoint },
    driver: { theta: 0, omega: speed, isPlaying: true },
    materialDefaults: DEFAULT_MATERIAL,
    kerf: DEFAULT_KERF,
    canvasSize: { width: 200, height: 150 },
    stage: {
      widthMm: Math.max(160, centerDistance + 100),
      depthMm: 140,
      heightMm: 20,
      originMm: { x: centerDistance / 2, y: 0 },
      crankJointId: 'joint-A',
      crankHandleLengthMm: 28,
    },
  };
}

export const spinningPinwheelTemplate: AutomatonTemplate = {
  id: 'spinning-pinwheel',
  name: 'Spinning Pinwheel',
  description: 'The purest gear mechanism: a spur gear pair, no cam or linkage - turn the crank and watch the geared-down pinwheel spin.',
  icon: '🎡',
  mechanisms: ['spur gear train'],
  paramSchema: [TEETH_IN, TEETH_OUT, BLADE_SIZE, SPEED, BLADE_COLOR],
  build,
};
