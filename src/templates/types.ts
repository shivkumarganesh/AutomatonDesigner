import type { AssemblyTree } from '../types/assembly';

/**
 * The piece that was missing before this file existed: a person picking
 * "what kind of automaton toy" they want, rather than reading TypeScript.
 * Each template is a parameterized generator - `build(params)` returns a
 * fresh, independently-valid AssemblyTree (its own Grubler check, its own
 * solver run), the same way store/demoAssembly.ts used to hand-write one
 * fixed assembly.
 */

export type TemplateParamField =
  | {
      key: string;
      label: string;
      kind: 'number';
      min: number;
      max: number;
      step: number;
      default: number;
      unit?: string;
    }
  | {
      key: string;
      label: string;
      kind: 'select';
      options: { value: string; label: string }[];
      default: string;
    }
  | {
      key: string;
      label: string;
      kind: 'color';
      default: string;
    };

export type TemplateParams = Record<string, number | string>;

export interface AutomatonTemplate {
  id: string;
  name: string;
  description: string;
  /** Single emoji shown on the gallery card - no image asset pipeline yet. */
  icon: string;
  /** Which mechanism families this exercises, shown as tags in the gallery. */
  mechanisms: string[];
  paramSchema: TemplateParamField[];
  build: (params: TemplateParams) => AssemblyTree;
}

export function defaultParamsOf(template: AutomatonTemplate): TemplateParams {
  const params: TemplateParams = {};
  for (const field of template.paramSchema) params[field.key] = field.default;
  return params;
}

/** Reads a numeric param with its schema default as fallback (defends
 *  against a stale params object missing a field after a template change). */
export function numParam(params: TemplateParams, field: TemplateParamField & { kind: 'number' }): number {
  const v = params[field.key];
  return typeof v === 'number' ? v : field.default;
}

export function strParam(params: TemplateParams, field: TemplateParamField & { kind: 'select' | 'color' }): string {
  const v = params[field.key];
  return typeof v === 'string' ? v : field.default;
}
