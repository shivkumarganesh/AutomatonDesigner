import type { AssemblyTree, ValidationIssue } from '../types/assembly';
import { isCam } from '../types/component';

/**
 * Composes the signed gear-train ratio between the master crank shaft and
 * a given component, by walking its `drivenByMeshJointId` chain back to
 * the shaft (a component with `isInputGear`/`isInputCam` set, or the
 * driver itself). Returns 1 if the component IS driven directly off the
 * master shaft, or if the chain can't be resolved (fail open - direction
 * mismatches are a design hint, not a solver-breaking condition).
 */
function effectiveDriveRatio(assembly: AssemblyTree, componentId: string, depth = 0): number {
  if (depth > 8) return 1; // guard against a malformed/cyclic mesh graph
  const component = assembly.components[componentId];
  if (!component) return 1;
  if (component.kind === 'gear' && component.isInputGear) return 1;
  if (component.kind === 'cam' && component.isInputCam) return 1;

  const meshJointId = component.kind === 'gear' || component.kind === 'cam' ? component.drivenByMeshJointId : undefined;
  if (!meshJointId) return 1;
  const mesh = assembly.joints[meshJointId];
  if (!mesh || mesh.type !== 'gear-mesh') return 1;
  return mesh.ratio * effectiveDriveRatio(assembly, mesh.driverId, depth + 1);
}

/**
 * Flags any 'snail-drop' cam whose required rotation direction doesn't
 * match how the current driver actually turns it, composed through
 * whatever gear train (if any) sits between the master crank and that
 * cam's shaft - see CamProfile.requiredDirection.
 */
export function validateDriveDirections(assembly: AssemblyTree): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const omegaSign = Math.sign(assembly.driver.omega);
  if (omegaSign === 0) return issues;

  for (const component of Object.values(assembly.components)) {
    if (!isCam(component)) continue;
    const required = component.profile.requiredDirection;
    if (component.profile.kind !== 'snail-drop' || !required) continue;

    const ratioSign = Math.sign(effectiveDriveRatio(assembly, component.id)) || 1;
    const actual = omegaSign * ratioSign;
    if (actual !== required) {
      issues.push({
        code: 'wrong-drive-direction',
        severity: 'warning',
        message: `"${component.name}" is a snail-drop cam meant to run ${required > 0 ? 'forward' : 'in reverse'}, but the current drive direction turns it the other way - the follower will ride up the drop edge instead of the rise.`,
        targetIds: [component.id],
      });
    }
  }

  return issues;
}
