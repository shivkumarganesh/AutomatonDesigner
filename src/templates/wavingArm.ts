import type { AssemblyTree } from '../types/assembly';
import type { Figure } from '../types/component';
import { DEFAULT_KERF, DEFAULT_MATERIAL } from '../types/material';
import { createCrankSlider } from '../kinematics/mechanismFactories';
import type { AutomatonTemplate, TemplateParamField, TemplateParams } from './types';
import { numParam, strParam } from './types';

const CRANK_RADIUS: TemplateParamField = { key: 'crankRadius', label: 'Crank radius', kind: 'number', min: 10, max: 30, step: 1, default: 18, unit: 'mm' };
const COUPLER_LENGTH: TemplateParamField = { key: 'couplerLength', label: 'Coupler length', kind: 'number', min: 30, max: 80, step: 1, default: 55, unit: 'mm' };
const HAND_SIZE: TemplateParamField = { key: 'handSize', label: 'Hand size', kind: 'number', min: 14, max: 30, step: 1, default: 20, unit: 'mm' };
const SPEED: TemplateParamField = { key: 'speed', label: 'Speed', kind: 'number', min: 0.2, max: 3, step: 0.1, default: 1, unit: 'rad/s' };
const HAND_COLOR: TemplateParamField = { key: 'handColor', label: 'Hand color', kind: 'color', default: '#e9c46a' };

/**
 * Showcases the crank-slider (slider-crank) family from
 * docs/MECHANISM_TAXONOMY_SPEC.md Section 2.3 - the classic piston
 * mechanism, built with kinematics/mechanismFactories.ts's
 * createCrankSlider rather than hand-wired, with an in-line slide axis
 * (through the crank pivot) so it can never dead-center regardless of the
 * radius/length params a user picks.
 */
function build(params: TemplateParams): AssemblyTree {
  const material = DEFAULT_MATERIAL;
  const crankRadius = numParam(params, CRANK_RADIUS as TemplateParamField & { kind: 'number' });
  const couplerLength = numParam(params, COUPLER_LENGTH as TemplateParamField & { kind: 'number' });
  const handSize = numParam(params, HAND_SIZE as TemplateParamField & { kind: 'number' });
  const speed = numParam(params, SPEED as TemplateParamField & { kind: 'number' });
  const handColor = strParam(params, HAND_COLOR as TemplateParamField & { kind: 'color' });

  const mechanism = createCrankSlider({
    idPrefix: 'arm',
    groundPivot: { x: 0, y: 0 },
    crankRadius,
    couplerLength,
    slideAxis: { x: 1, y: 0 },
    slideAnchor: { x: 0, y: 0 },
    zIndex: 0,
    material,
    fit: 'clearance',
  });

  const hand: Figure = {
    id: 'hand',
    name: 'Waving Hand',
    kind: 'figure',
    zIndex: 2,
    material,
    fit: 'press-fit',
    color: handColor,
    shape: 'disc',
    attachJointId: mechanism.sliderJointId,
    localOffset: { x: 0, y: 0 },
    scale: handSize,
    showConnectingRod: true,
  };

  return {
    id: 'waving-arm',
    name: 'Waving Arm',
    groundJointIds: mechanism.groundJointIds,
    components: { ...mechanism.components, hand },
    joints: mechanism.joints,
    driver: { theta: 0, omega: speed, isPlaying: true },
    materialDefaults: DEFAULT_MATERIAL,
    kerf: DEFAULT_KERF,
    canvasSize: { width: 220, height: 120 },
    stage: {
      widthMm: crankRadius + couplerLength + 100,
      depthMm: 120,
      heightMm: 20,
      originMm: { x: (crankRadius + couplerLength) / 2, y: 0 },
      crankJointId: mechanism.crankPivotJointId,
      crankHandleLengthMm: 26,
      enclosureTopZIndex: 0,
    },
  };
}

export const wavingArmTemplate: AutomatonTemplate = {
  id: 'waving-arm',
  name: 'Waving Arm',
  description: 'A crank-slider (piston) mechanism: the crank drives a coupler pushing a slider block back and forth in a straight line - a hand waves side to side.',
  icon: '👋',
  mechanisms: ['crank-slider'],
  paramSchema: [CRANK_RADIUS, COUPLER_LENGTH, HAND_SIZE, SPEED, HAND_COLOR],
  build,
};
