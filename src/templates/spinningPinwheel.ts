import type { AssemblyTree } from '../types/assembly';
import type { Figure, Gear } from '../types/component';
import type { GearMeshJoint, RevoluteJoint } from '../types/joint';
import { DEFAULT_KERF, DEFAULT_MATERIAL } from '../types/material';
import type { AutomatonTemplate, TemplateParamField, TemplateParams } from './types';
import { numParam, strParam } from './types';

const TEETH_IN: TemplateParamField = { key: 'teethIn', label: 'Input pulley size', kind: 'number', min: 8, max: 20, step: 1, default: 12 };
const TEETH_OUT: TemplateParamField = { key: 'teethOut', label: 'Pinwheel pulley size', kind: 'number', min: 16, max: 48, step: 1, default: 24 };
const BLADE_SIZE: TemplateParamField = { key: 'bladeSize', label: 'Blade size', kind: 'number', min: 20, max: 55, step: 1, default: 34, unit: 'mm' };
const SPEED: TemplateParamField = { key: 'speed', label: 'Speed', kind: 'number', min: 0.2, max: 3, step: 0.1, default: 1, unit: 'rad/s' };
const BLADE_COLOR: TemplateParamField = { key: 'bladeColor', label: 'Blade color', kind: 'color', default: '#f4a261' };

/**
 * The belt-drive family, the one automaton mechanism otherwise missing from
 * this app alongside crank-rocker/gear-train/cam-follower/parallel-motion:
 * two pulleys (Gears with visualStyle: 'pulley', see types/component.ts)
 * linked by a gear-mesh joint carrying a *positive* ratio - a belt keeps
 * both pulleys turning the same direction, unlike an external spur mesh
 * which reverses it - and a drawn belt loop instead of two teeth meshing at
 * a pitch point. Mechanically identical to the old gear pair for the
 * solver/Grubler count; only the ratio sign and the rendering differ. Also
 * the reference example for Figure.attachComponentId (see
 * types/component.ts): a decorative disc riding a Gear's own rotation
 * directly, since a gear/pulley has no second moving point to derive a
 * facing angle from the way a Linkage pin does.
 */
function build(params: TemplateParams): AssemblyTree {
  const material = DEFAULT_MATERIAL;
  const teethIn = numParam(params, TEETH_IN as TemplateParamField & { kind: 'number' });
  const teethOut = numParam(params, TEETH_OUT as TemplateParamField & { kind: 'number' });
  const bladeSize = numParam(params, BLADE_SIZE as TemplateParamField & { kind: 'number' });
  const speed = numParam(params, SPEED as TemplateParamField & { kind: 'number' });
  const bladeColor = strParam(params, BLADE_COLOR as TemplateParamField & { kind: 'color' });
  const module = 2;
  const radiusIn = (module * teethIn) / 2;
  const radiusOut = (module * teethOut) / 2;
  // Unlike a gear pair (which must sit at exactly r1+r2 to mesh), pulleys
  // never touch - the belt bridges the gap, so there's a real span to draw.
  const beltGap = 55;
  const centerDistance = radiusIn + radiusOut + beltGap;

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
    // Positive: a belt (unlike an external gear mesh) keeps both pulleys
    // turning the same direction.
    ratio: teethIn / teethOut,
    phaseOffset: 0,
  };

  const gearIn: Gear = {
    id: 'gearIn',
    name: `Input Pulley (r${radiusIn}mm)`,
    kind: 'gear',
    zIndex: 0,
    material,
    fit: 'press-fit',
    color: '#e9c46a',
    pivotJointId: 'joint-A',
    isInputGear: true,
    visualStyle: 'pulley',
    params: { teeth: teethIn, module, pressureAngleDeg: 20, profileShift: 0, tipClearance: 0.25, boreDiameter: 5 },
  };
  const gearOut: Gear = {
    id: 'gearOut',
    name: `Pinwheel Pulley (r${radiusOut}mm)`,
    kind: 'gear',
    zIndex: 0,
    material,
    fit: 'press-fit',
    color: '#d4a373',
    pivotJointId: 'joint-B',
    drivenByMeshJointId: 'mesh-1',
    visualStyle: 'pulley',
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
      enclosureTopZIndex: 0,
    },
  };
}

export const spinningPinwheelTemplate: AutomatonTemplate = {
  id: 'spinning-pinwheel',
  name: 'Spinning Pinwheel',
  description: 'A belt-drive pulley pair, no cam or linkage - turn the crank and watch the geared-down pinwheel spin, coupled by a real belt loop instead of meshing teeth.',
  icon: '🎡',
  mechanisms: ['pulley + belt drive'],
  paramSchema: [TEETH_IN, TEETH_OUT, BLADE_SIZE, SPEED, BLADE_COLOR],
  build,
};
