import type { AssemblyTree, ValidationIssue } from '../types/assembly';
import { isHigherPair } from '../types/joint';

export interface GrueblerBreakdown {
  /** N: total links, including the grounded frame as link #1. */
  links: number;
  /** J1: lower pairs (revolute, prismatic) - 1 DoF each. */
  j1: number;
  /** J2: higher pairs (gear-mesh, cam-follower) - 2 DoF each. */
  j2: number;
  /** F = 3(N - 1) - 2*J1 - J2 */
  dof: number;
}

/**
 * Applies Grubler's criterion for planar mechanisms (Section 2.B):
 *
 *   F = 3(N - 1) - 2*J1 - J2
 *
 * A 'fixed' joint welds two components into a single kinematic link with
 * zero relative freedom (e.g. a gear and a cam keyed to the same shaft) -
 * it is not a J1 lower pair in Grubler's sense, it is two Components
 * representing what is mechanically ONE link. This function union-finds
 * fixed-joint-connected components together before counting N, and
 * excludes 'fixed' joints from the J1 tally, which is what makes a
 * compound shaft (gear + cam glued together) count correctly.
 */
export function computeGrueblerDof(assembly: AssemblyTree): GrueblerBreakdown {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id);
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // Figures (decorative performers glued to a moving joint - the bird/wing/
  // etc. an automaton actually shows) add zero DoF of their own, same as
  // being welded on: they're excluded from the link count entirely rather
  // than merged in, since they don't carry their own set of pin points.
  const kinematicIds = Object.entries(assembly.components)
    .filter(([, c]) => c.kind !== 'figure')
    .map(([id]) => id);

  for (const id of kinematicIds) find(id);
  for (const joint of Object.values(assembly.joints)) {
    if (joint.type === 'fixed' && joint.componentIds.length === 2) {
      const [a, b] = joint.componentIds;
      if (assembly.components[a]?.kind !== 'figure' && assembly.components[b]?.kind !== 'figure') {
        union(a, b);
      }
    }
  }

  const distinctLinks = new Set(kinematicIds.map((id) => find(id)));
  const links = 1 + distinctLinks.size;

  let j1 = 0;
  let j2 = 0;
  for (const joint of Object.values(assembly.joints)) {
    if (joint.type === 'revolute' || joint.type === 'prismatic') {
      // A joint pinning k bodies together at one shared point is k-1
      // independent pin-pairs, not one - two bodies sharing a pin is the
      // normal case (weight 1), but a third body pinned at that same
      // point (e.g. a parallel-motion coupler sharing an existing pin)
      // removes another 2 DoF on top of that, same as if it were its own
      // separate joint. Grounded joints have an implicit extra body (the
      // frame) not listed in componentIds, so it isn't subtracted there.
      const bodyCount = joint.componentIds.length + (joint.grounded ? 1 : 0);
      j1 += Math.max(1, bodyCount - 1);
    } else if (isHigherPair(joint.type)) {
      j2 += 1;
    }
  }

  const dof = 3 * (links - 1) - 2 * j1 - j2;
  return { links, j1, j2, dof };
}

export function validateGrueblerDof(assembly: AssemblyTree): ValidationIssue[] {
  const breakdown = computeGrueblerDof(assembly);
  if (breakdown.dof === 1) return [];

  const detail = `N=${breakdown.links}, J1=${breakdown.j1}, J2=${breakdown.j2} => F=${breakdown.dof}`;
  if (breakdown.dof < 1) {
    return [
      {
        code: 'gruebler-dof',
        severity: 'error',
        message: `Assembly is over-constrained (locked structure). ${detail}. Remove a redundant joint or link.`,
        targetIds: [],
      },
    ];
  }
  return [
    {
      code: 'gruebler-dof',
      severity: 'error',
      message: `Assembly is under-constrained (F=${breakdown.dof} > 1, needs ${breakdown.dof} independent inputs). ${detail}. A single crank cannot fully drive this mechanism.`,
      targetIds: [],
    },
  ];
}
