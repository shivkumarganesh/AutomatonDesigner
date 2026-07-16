/**
 * Minimal dense linear algebra needed by the Newton-Raphson constraint
 * solver. Assemblies in this app have small unknown counts (a handful of
 * floating joints per mechanism), so a hand-rolled Gaussian elimination
 * with partial pivoting is simpler and more transparent than pulling in a
 * numerical dependency.
 */

/** Solves A*x = b for x via Gaussian elimination with partial pivoting.
 *  Returns null if A is (numerically) singular. Mutates neither input. */
export function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Build augmented matrix
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivot: find row with largest absolute value in this column
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r][col]);
      if (v > maxAbs) {
        maxAbs = v;
        pivotRow = r;
      }
    }
    if (maxAbs < 1e-12) return null; // singular Jacobian - solver hit a singularity/lockup

    if (pivotRow !== col) {
      [M[col], M[pivotRow]] = [M[pivotRow], M[col]];
    }

    const pivotVal = M[col][col];
    for (let r = col + 1; r < n; r++) {
      const factor = M[r][col] / pivotVal;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) {
        M[r][c] -= factor * M[col][c];
      }
    }
  }

  // Back substitution
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = M[r][n];
    for (let c = r + 1; c < n; c++) sum -= M[r][c] * x[c];
    const diag = M[r][r];
    if (Math.abs(diag) < 1e-12) return null;
    x[r] = sum / diag;
  }
  return x;
}
