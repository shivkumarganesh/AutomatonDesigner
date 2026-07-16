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
 * The base/box every real automaton hides its mechanism inside, with a
 * hand crank poking out one side - the only two things a viewer of the
 * finished piece actually sees are this box (plus the Figures riding on
 * top of it) and the crank they turn. Purely presentational: it carries no
 * joints or DoF and never participates in the solver.
 */
export interface StageConfig {
  widthMm: number;
  depthMm: number;
  heightMm: number;
  /** Center of the base platform's footprint, mm, in mechanism XY space. */
  originMm: { x: number; y: number };
  /** The grounded joint the visible crank handle is drawn spinning from
   *  (normally the input crank's ground pivot). */
  crankJointId: string;
  crankHandleLengthMm: number;
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
  stage?: StageConfig;
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
  | 'unresolved-reference'
  | 'wrong-drive-direction';

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
