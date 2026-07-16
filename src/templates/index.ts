import type { AutomatonTemplate } from './types';
import { peckingBirdTemplate } from './peckingBird';
import { noddingHeadTemplate } from './noddingHead';
import { spinningPinwheelTemplate } from './spinningPinwheel';
import { wavingArmTemplate } from './wavingArm';

export * from './types';

export const TEMPLATES: AutomatonTemplate[] = [peckingBirdTemplate, noddingHeadTemplate, spinningPinwheelTemplate, wavingArmTemplate];

export function getTemplate(id: string): AutomatonTemplate {
  const found = TEMPLATES.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown automaton template: ${id}`);
  return found;
}

export const DEFAULT_TEMPLATE_ID = peckingBirdTemplate.id;
