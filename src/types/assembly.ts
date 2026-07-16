import type { Component } from './component';
import type { Joint } from './joint';
import type { KerfConfig, MaterialSpec } from './material';
import { DEFAULT_KERF, DEFAULT_MATERIAL } from './material';

/** The single 1-DoF input driving the entire assembly (Section 2.B). */
export interface DriverInput {
  /** Master crank angle, radians, in [0, 2*PI). */
  theta: number;
  /** Angular velocity for sandbox playback, rad/s. */
  omega: number;
  /** Playback state for the Phase 2 sandbox sweep. */
  isPlaying: boolean;
}

export interface CanvasSize {
  /** mm */
  width: number;
  /** mm */
  height: number;
}

/**
 * The full assembly state tree. Link #1 in Grubler's equation is always
 * the ground frame, represented implicitly by `groundJointIds` rather than
 * as its own Component - every joint whose id appears here is treated as
 * fixed in world space by the solver.
 */
export interface AssemblyTree {
  id: string;
  name: string;
  groundJointIds: string[];
  components: Record<string, Component>;
  joints: Record<string, Joint>;
  driver: DriverInput;
  materialDefaults: MaterialSpec;
  kerf: KerfConfig;
  canvasSize: CanvasSize;
}

export function createEmptyAssembly(name = 'Untitled Automaton'): AssemblyTree {
  return {
    id: crypto.randomUUID(),
    name,
    groundJointIds: [],
    components: {},
    joints: {},
    driver: { theta: 0, omega: 1, isPlaying: false },
    materialDefaults: DEFAULT_MATERIAL,
    kerf: DEFAULT_KERF,
    canvasSize: { width: 300, height: 500 },
  };
}

// ---------------------------------------------------------------------------
// Validation (Phase 2 requires red-highlighting these failure classes).
// ---------------------------------------------------------------------------

export type ValidationSeverity = 'error' | 'warning';

export type ValidationCode =
  | 'gruebler-dof'
  | 'solver-singularity'
  | 'solver-no-convergence'
  | 'planar-collision'
  | 'unresolved-reference';

export interface ValidationIssue {
  code: ValidationCode;
  severity: ValidationSeverity;
  message: string;
  /** component/joint ids implicated, for UI highlighting */
  targetIds: string[];
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  dof: number;
}
