# Automaton Designer

A browser-based CAD & simulator for kinetic sculptures (automata): design cams,
linkages, gears, and sliders as a single 1-degree-of-freedom mechanism, watch
it move in a 3D sandbox, and (in later phases) export laser-ready flat-pack
SVG/DXF files with an assembly guide.

This repo currently implements **Phase 1 (data models + kinematic solver)**
and **Phase 2 (React Three Fiber sandbox with live validation)**. Phases 3
(nesting/export) and 4 (assembly instructions) are scaffolded architecturally
below but not yet implemented - see [Roadmap](#roadmap-phases-3-4).

See `docs/MECHANISM_TAXONOMY_SPEC.md` for the automata mechanism research
(cam shapes, crank/linkage family, gear-family mechanisms) this app's
mechanism coverage is being built out against, and a gap analysis of
what's implemented vs. still missing (rack-and-pinion, Geneva drive,
slotted-disk bell crank).

## Stack

- **React 19** + TypeScript, Vite build
- **Zustand** for the assembly state tree (`src/store/assemblyStore.ts`)
- **React Three Fiber / drei / three.js** for the 3D sandbox (`src/sandbox/`)
- Hand-rolled planar kinematics + involute gear math (no physics engine
  dependency - see [Kinematic solver](#kinematic-solver))

## Running it

```bash
npm install
npm run dev      # dev server
npm run build    # typecheck + production build
npm run lint      # oxlint
```

## Architecture

### Data model (`src/types/`)

- `geometry.ts` - 2D vector math primitives shared by everything.
- `material.ts` - sheet thickness + kerf/clearance calibration (Section 2.A
  of the spec): `resolveOffset(fit, edge, kerf)` decides whether a profile
  boundary grows or shrinks for press-fit vs. clearance parts.
- `joint.ts` - the five joint kinds the solver and Grubler's equation both
  key off: `revolute`, `prismatic` (Grubler J1, 1-DoF lower pairs), `fixed`
  (rigidly welds two Components into one kinematic link), `gear-mesh` and
  `cam-follower` (Grubler J2, 2-DoF higher pairs).
- `component.ts` - `Linkage` (rigid bar/plate with N pinned points),
  `Gear` (involute spur gear params), `Cam` (radial profile), `Follower`
  (translating or oscillating cam follower), and `Figure` - the part that
  actually makes something an *automaton* rather than a bare mechanism: a
  decorative performer (bird head, wing, ...) glued to a moving joint,
  inheriting its solved position/orientation with zero added DoF. Real
  automata (per Cabaret Mechanical Theatre / Exploratorium's cardboard
  automata guides) are always a hidden cam/crank mechanism driving a
  visible performer on top - `Figure` is that visible layer.
- `assembly.ts` - `AssemblyTree`: the whole mechanism as components + joints
  + a single `DriverInput.theta`, plus `StageConfig` (the base/box the
  mechanism hides in and the hand-crank handle a viewer actually turns -
  presentation only, never touches the solver), plus `ValidationResult`
  types for the red flagging Phase 2 requires (Grubler failure, solver
  singularity/non convergence, planar collision).

### Kinematic solver (`src/kinematics/solver.ts`)

The solver mirrors how real automata are actually built - a single crank
drives a shaft, which may carry a gear train and/or cams, which in turn
drive followers and floating linkages:

1. **Input crank** (`Linkage.isInputCrank`): pose is a closed-form rotation
   by `theta` about its ground pivot - no ambiguity, no iteration.
2. **Gear/cam train**: rotation ratios compose in closed form
   (`driven = driver * meshRatio + phaseOffset`), relaxed over a few passes
   so multi-stage trains resolve regardless of declaration order.
3. **Cam followers**: translating followers resolve directly from the cam
   profile; oscillating (roller-arm) followers resolve via circle-circle
   intersection between "reach from cam center" and "arm length from its own
   ground pivot," which is also where a real geometric lockup (arm too short
   to reach the cam) is detected and flagged.
4. **Floating linkage network**: whatever is left (couplers, rockers,
   slider blocks) is solved jointly with **Newton-Raphson over rigid-body
   distance constraints**, PMKS-style. Joints - not links - are the unknowns:
   a pin shared by two links is a single world-space point, so link
   rigidity and joint coincidence fall out of the same equation system for
   free. Prismatic joints add a line constraint. Redundant/ternary-link
   constraint rows are handled via Gauss-Newton normal equations, so
   over-triangulated bodies don't produce a singular Jacobian.

`src/kinematics/gruebler.ts` implements Grubler's criterion
`F = 3(N-1) - 2*J1 - J2` with one subtlety worth knowing: two Components
joined by a `fixed` joint (e.g. a gear and a cam keyed to the same shaft)
are union-found into a single link before counting `N`, and `fixed` joints
are excluded from the `J1` tally - a rigid weld isn't a kinematic pair, it's
two Components representing what is mechanically one link.

`src/kinematics/collision.ts` builds coarse bounding shapes (capsules for
bars, circles for gears/cams/followers) per component and flags any
same-`zIndex` pair that overlaps and doesn't share a joint (Section 2.D:
mechanisms are 2.5D, and parts sharing a z-plane must not collide).

One subtlety the Grubler counter has to get right: a single joint can pin
*more* than two bodies at one shared point (e.g. a parallel-motion coupler
attaching to an existing pin - see below). A joint connecting `k` bodies at
one point is `k-1` independent pin-pairs, not a flat 1, or the DoF count
silently under-counts as soon as a third body joins an existing pin.

`src/kinematics/mechanismFactories.ts` has reusable builders for the rest
of the crank-linkage family cataloged in `docs/MECHANISM_TAXONOMY_SPEC.md`
Section 2.3 - none need new data-model types, they're all buildable from
existing `Linkage`/`PrismaticJoint`/`RevoluteJoint` pieces, just fiddly to
hand-wire every time: `createCrankSlider` (piston mechanism, reuses the
existing prismatic line constraint), `createBellCrank` (a 3-point
Linkage), and `createParallelMotionPair` (a parallelogram four-bar that
mirrors an existing rocker's *exact* absolute angle onto a second rocker -
the real way automata sync two wings, used by the demo assembly below).

### Involute gear math (`src/geometry/involute.ts`)

Standard metric-module equations (`pitchDiameter = module * teeth`, base/tip/
root diameters from pressure angle + profile shift + tip clearance) plus a
sampled involute-curve tooth profile generator (`generateGearOutline`) used
for both the 3D sandbox render and, ultimately, the Phase 3 exporter.

### Cam profiles (`src/geometry/cam.ts`)

`camProfileRadius(profile, phi)` covers the shapes cataloged in
`MECHANISM_TAXONOMY_SPEC.md` Section 2.1: `'circular-eccentric'` (smooth,
no dwell), `'constant-rise-fall'` and `'heart'` (dwell-less rise/fall,
`heart` piecewise-linear for constant follower velocity),
`'pear-dwell'` (explicit dwell-rise-dwell-fall-dwell, the classic
paper/card-automata shape), `'snail-drop'` (steady creeping rise + a
near-instant drop, one-directional only), and `'custom-samples'`. Only
`'snail-drop'` is direction-sensitive - `CamProfile.requiredDirection` is
checked against the driver's actual composed rotation direction (through
whatever gear train sits upstream) by
`src/kinematics/directionCheck.ts`, surfaced as a `'wrong-drive-direction'`
validation warning rather than an error, since running it backward doesn't
break the solver, it just isn't what the cam was designed for.

### Zustand store (`src/store/assemblyStore.ts`)

Owns the `AssemblyTree`, re-solves + re-validates on every `theta` change
(each solve seeds Newton-Raphson from the *previous* frame's joint positions
for continuity/stability across the animation sweep), and exposes
play/pause/scrub actions consumed by `src/sandbox/ControlPanel.tsx`.

`src/store/demoAssembly.ts` is a worked example exercising every component
kind in one valid 1-DoF assembly, built as an actual bird automaton rather
than a bare test rig: a Grashof crank-rocker four-bar sharing its input
shaft with a 20:40 reduction gear pair, which carries a `'pear-dwell'` cam
(dwell - rise - dwell - fall - dwell, not the smoother dwell-less
`'constant-rise-fall'`) driving a translating follower - a bird-head
`Figure` pecks on that follower. The rocker's outer pin also drives a
`createParallelMotionPair` six-bar mirroring its exact angle onto a second
rocker, so a `Figure` wing on *each* rocker flaps in perfect sync off the
one input - not two Figures faking synchrony off the same joint. It's a
good reference for wiring up a new mechanism by hand before there's a
component-authoring UI.

### Sandbox (`src/sandbox/`)

`SandboxCanvas.tsx` sweeps `theta` every frame via `useFrame` while
`assembly.driver.isPlaying`, and renders each component kind
(`LinkageMesh`, `GearMesh`, `CamMesh`, `FollowerMesh`, `FigureMesh`) from
the solver's per-joint world positions, plus `StageMesh` for the base
platform and spinning hand-crank handle. `zIndex` maps to a z-offset in
scene units so stacked layers are visually legible - Figures default to a
higher `zIndex` than the mechanism they ride on, so the performer reads as
sitting above the (still-visible, for the simulator's own sake) hidden
works. `ValidationPanel.tsx` shows the live Grubler breakdown and turns any
component implicated in a solver singularity or planar collision red
(`highlighted` prop threaded through every mesh component).

## Roadmap: Phases 3-4

Not yet implemented, but the data model is already shaped for them:

- **Phase 3 (nesting/export)**: walk `AssemblyTree`, extract each
  component's 2D face, refit `generateGearOutline`/`camProfileRadius`
  sample points into exact arcs/Beziers, apply `resolveOffset` per
  `fit`/`material.kerf`, then nest onto `canvasSize` with red/blue
  cut/engrave layers.
- **Phase 4 (assembly instructions)**: walk the `fixed`/`gear-mesh`/
  `cam-follower` joint graph to group components into sub-assemblies
  (frame, drive shaft, follower linkages), emitting an ordered JSON step
  list that calls out spacers (from `zIndex` deltas) and glue vs. friction
  fit (from `fit`).
