import { useAssemblyStore } from '../store/assemblyStore';
import { computeGrueblerDof } from '../kinematics/gruebler';

export function ValidationPanel() {
  const assembly = useAssemblyStore((s) => s.assembly);
  const validation = useAssemblyStore((s) => s.validation);
  const solveResult = useAssemblyStore((s) => s.solveResult);
  const breakdown = computeGrueblerDof(assembly);

  return (
    <div className="validation-panel">
      <h2>Validation</h2>
      <div className={`dof-badge ${breakdown.dof === 1 ? 'ok' : 'error'}`}>
        F = 3({breakdown.links}-1) - 2({breakdown.j1}) - {breakdown.j2} = <strong>{breakdown.dof}</strong>
      </div>
      {validation.issues.length === 0 ? (
        <p className="status-ok">All checks passed - 1-DoF, no collisions, no singularities.</p>
      ) : (
        <ul className="issue-list">
          {validation.issues.map((issue, i) => (
            <li key={i} className={`issue issue-${issue.severity}`}>
              {issue.message}
            </li>
          ))}
        </ul>
      )}
      <p className="solver-stats">
        Solver: {validation.ok ? 'converged' : 'FAILED'} in {solveResult.iterations} iterations
        (residual {solveResult.maxResidual.toExponential(2)}mm)
      </p>
    </div>
  );
}
