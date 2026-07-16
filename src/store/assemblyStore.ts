import { create } from 'zustand';
import type { AssemblyTree, ValidationResult } from '../types/assembly';
import { solveAssembly, type SolveResult } from '../kinematics/solver';
import { computeGrueblerDof, validateGrueblerDof } from '../kinematics/gruebler';
import { detectPlanarCollisions } from '../kinematics/collision';
import { validateDriveDirections } from '../kinematics/directionCheck';
import { createDemoAssembly } from './demoAssembly';

function runValidation(assembly: AssemblyTree, solveResult: SolveResult): ValidationResult {
  const issues = [...validateGrueblerDof(assembly), ...validateDriveDirections(assembly)];

  const collisions = detectPlanarCollisions(assembly, solveResult);
  for (const collision of collisions) {
    issues.push({
      code: 'planar-collision',
      severity: 'error',
      message: `Planar collision on z-plane ${collision.zIndex}: "${assembly.components[collision.a]?.name}" overlaps "${assembly.components[collision.b]?.name}". Move one to a different z-index or add a spacer.`,
      targetIds: [collision.a, collision.b],
    });
  }

  if (!solveResult.converged) {
    issues.push({
      code: 'solver-no-convergence',
      severity: 'error',
      message: `Kinematic solver failed to converge (residual ${solveResult.maxResidual.toFixed(4)}mm after ${solveResult.iterations} iterations).`,
      targetIds: solveResult.singularities,
    });
  }
  if (solveResult.singularities.length > 0) {
    issues.push({
      code: 'solver-singularity',
      severity: 'error',
      message: `Singularity / lockup detected at ${solveResult.singularities.length} joint(s) - mechanism cannot reach this pose.`,
      targetIds: solveResult.singularities,
    });
  }

  const dof = computeGrueblerDof(assembly).dof;
  return { ok: issues.every((i) => i.severity !== 'error'), issues, dof };
}

interface AssemblyState {
  assembly: AssemblyTree;
  solveResult: SolveResult;
  validation: ValidationResult;

  setTheta: (theta: number) => void;
  stepTheta: (deltaSeconds: number) => void;
  togglePlaying: (playing?: boolean) => void;
  setOmega: (omega: number) => void;
  resetAssembly: () => void;
  loadAssembly: (assembly: AssemblyTree) => void;
  resolve: () => void;
}

function solveAndValidate(assembly: AssemblyTree, prevPositions?: Record<string, { x: number; y: number }>) {
  const solveResult = solveAssembly(assembly, assembly.driver.theta, prevPositions);
  const validation = runValidation(assembly, solveResult);
  return { solveResult, validation };
}

const initialAssembly = createDemoAssembly();
const initialSolve = solveAndValidate(initialAssembly);

export const useAssemblyStore = create<AssemblyState>((set, get) => ({
  assembly: initialAssembly,
  solveResult: initialSolve.solveResult,
  validation: initialSolve.validation,

  setTheta: (theta) => {
    const wrapped = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const assembly: AssemblyTree = { ...get().assembly, driver: { ...get().assembly.driver, theta: wrapped } };
    const { solveResult, validation } = solveAndValidate(assembly, get().solveResult.positions);
    set({ assembly, solveResult, validation });
  },

  stepTheta: (deltaSeconds) => {
    const { assembly } = get();
    if (!assembly.driver.isPlaying) return;
    get().setTheta(assembly.driver.theta + assembly.driver.omega * deltaSeconds);
  },

  togglePlaying: (playing) => {
    const { assembly } = get();
    set({ assembly: { ...assembly, driver: { ...assembly.driver, isPlaying: playing ?? !assembly.driver.isPlaying } } });
  },

  setOmega: (omega) => {
    const { assembly } = get();
    set({ assembly: { ...assembly, driver: { ...assembly.driver, omega } } });
  },

  resetAssembly: () => {
    const assembly = createDemoAssembly();
    const { solveResult, validation } = solveAndValidate(assembly);
    set({ assembly, solveResult, validation });
  },

  loadAssembly: (assembly) => {
    const { solveResult, validation } = solveAndValidate(assembly);
    set({ assembly, solveResult, validation });
  },

  resolve: () => {
    const { assembly } = get();
    const { solveResult, validation } = solveAndValidate(assembly, get().solveResult.positions);
    set({ solveResult, validation });
  },
}));
