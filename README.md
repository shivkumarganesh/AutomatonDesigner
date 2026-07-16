# Automaton Designer

A browser-based CAD & simulator for kinetic sculptures (automata): pick a toy
from a gallery of parameterized mechanisms, customize it, watch it move in a
3D sandbox with live kinematic validation, and download laser-ready SVG
parts with kerf/press-fit offsets already applied.

This repo implements **Phase 1** (data models + kinematic solver),
**Phase 2** (React Three Fiber sandbox with live validation), a template
gallery + parameter picker UI (the "select what kind of automaton toy to
make" experience), and **Phase 3** (flat-pack SVG export). **Phase 4**
(generated assembly instructions) is the remaining roadmap item - see
[Roadmap](#roadmap-phase-4).

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

## The product loop

1. **Pick a toy** from the gallery (`src/ui/TemplateGallery.tsx`) - Pecking
   Bird, Nodding Head, Spinning Pinwheel, or Waving Arm, each exercising a
   different mechanism family (see `src/templates/`).
2. **Customize it** via the generated parameter form
   (`src/ui/TemplateParamsPanel.tsx`) - cam shape, sizes, gear teeth, colors,
   speed - which rebuilds the assembly live.
3. **Watch it validated** in the 3D sandbox - live Grubler DoF check, solver
   convergence, singularity/planar-collision flags, all in red if something's
   wrong.
4. **Download the parts** (`src/ui/ExportPanel.tsx`) - every component's
   laser-cuttable flat outline, nested onto a sheet, kerf and press-fit/
   clearance offsets already applied.

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
  decorative performer (bird head, wing, pinwheel blade, ...) riding a
  moving joint *or* a gear/cam's own rotation directly
  (`attachComponentId` - for a disc spinning coaxially with a gear, which
  has no second moving point to derive a facing angle from the way a
  Linkage pin does), inheriting that motion with zero added DoF. Real
  automata (per Cabaret Mechanical Theatre / Exploratorium's cardboard
  automata guides) are always a hidden cam/crank mechanism driving a
  visible performer on top - `Figure` is that visible layer.
- `assembly.ts` - `AssemblyTree`: the whole mechanism as components + joints
  + a single `DriverInput.theta`, plus `StageConfig` (the base/box the
  mechanism hides in and the hand-crank handle a viewer actually turns -
  presentation only, never touches the solver), plus `ValidationResult`
  types for the red flagging Phase 2 requires (Grubler failure, solver
  singularity/non convergence, planar collision, wrong drive direction).

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
`F = 3(N-1) - 2*J1 - J2` with two subtleties worth knowing:

- Two Components joined by a `fixed` joint (e.g. a gear and a cam keyed to
  the same shaft) are union-found into a single link before counting `N`,
  and `fixed` joints are excluded from the `J1` tally - a rigid weld isn't
  a kinematic pair, it's two Components representing what is mechanically
  one link.
- A single joint can pin *more* than two bodies at one shared point (e.g. a
  parallel-motion coupler attaching to an existing pin). A joint connecting
  `k` bodies at one point is `k-1` independent pin-pairs, not a flat 1, or
  the DoF count silently under-counts as soon as a third body joins an
  existing pin.

`src/kinematics/collision.ts` builds coarse bounding shapes (capsules for
bars, circles for gears/cams/followers) per component and flags any
same-`zIndex` pair that overlaps and doesn't share a joint (Section 2.D:
mechanisms are 2.5D, and parts sharing a z-plane must not collide).

`src/kinematics/mechanismFactories.ts` has reusable builders for the rest
of the crank-linkage family cataloged in `docs/MECHANISM_TAXONOMY_SPEC.md`
Section 2.3 - none need new data-model types, they're all buildable from
existing `Linkage`/`PrismaticJoint`/`RevoluteJoint` pieces, just fiddly to
hand-wire every time: `createCrankSlider` (piston mechanism, reuses the
existing prismatic line constraint), `createBellCrank` (a 3-point
Linkage), and `createParallelMotionPair` (a parallelogram four-bar that
mirrors an existing rocker's *exact* absolute angle onto a second rocker -
the real way automata sync two wings, used by the Pecking Bird template).

### Involute gear math (`src/geometry/involute.ts`)

Standard metric-module equations (`pitchDiameter = module * teeth`, base/tip/
root diameters from pressure angle + profile shift + tip clearance) plus a
sampled involute-curve tooth profile generator (`generateGearOutline`) used
for both the 3D sandbox render and the SVG exporter.

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

### Templates (`src/templates/`)

The piece that makes this an actual designer instead of one fixed demo:
each `AutomatonTemplate` is a parameterized `AssemblyTree` generator with a
declarative `paramSchema` (number sliders, selects, color pickers) the UI
renders automatically. `src/templates/index.ts` is the registry:

- **Pecking Bird** (`peckingBird.ts`) - crank-rocker four-bar sharing its
  shaft with a reduction gear pair, a cam pecks the head, both wings flap
  in exact sync via `createParallelMotionPair`. Exercises the widest
  mechanism variety.
- **Nodding Head** (`noddingHead.ts`) - the minimal case: one cam driven
  directly off the input shaft, read by a single oscillating follower.
- **Spinning Pinwheel** (`spinningPinwheel.ts`) - the purest gear-train
  case: no cam, no linkage, just an external spur mesh - and the reference
  example for `Figure.attachComponentId`.
- **Waving Arm** (`wavingArm.ts`) - showcases `createCrankSlider`, the
  classic piston mechanism, with an in-line slide axis so it can never
  dead-center regardless of the radius/length a user picks.

Every template is independently Grubler-valid (`F=1`) and swept-tested
across two full crank revolutions with zero solver failures or collisions.

### Zustand store (`src/store/assemblyStore.ts`)

Owns `templateId` + `params` + the built `AssemblyTree`, and re-solves +
re-validates on every `theta` change (each solve seeds Newton-Raphson from
the *previous* frame's joint positions for continuity/stability across the
animation sweep). `selectTemplate(id)` swaps templates (resets params to
defaults); `updateParam(key, value)` rebuilds the current template with one
param changed, preserving play/pause state across the rebuild.

### Sandbox (`src/sandbox/`)

`SandboxCanvas.tsx` sweeps `theta` every frame via `useFrame` while
`assembly.driver.isPlaying`, and renders each component kind
(`LinkageMesh`, `GearMesh`, `CamMesh`, `FollowerMesh`, `FigureMesh`) from
the solver's per-joint world positions, plus `StageMesh` for the base
platform and spinning hand-crank handle. The camera pose auto-fits each
template's `StageConfig` footprint (`computeCameraPose`), and the `Canvas`
remounts (`key={assembly.id}`) when the selected template changes, since
R3F's `camera` prop only ever applies on mount. `zIndex` maps to a
z-offset in scene units so stacked layers are visually legible - Figures
default to a higher `zIndex` than the mechanism they ride on, so the
performer reads as sitting above the (still-visible, for the simulator's
own sake) hidden works. `ValidationPanel.tsx` shows the live Grubler
breakdown and turns any component implicated in a solver singularity or
planar collision red (`highlighted` prop threaded through every mesh
component).

### Flat-pack SVG export (`src/export/`, `src/geometry/hull.ts`,
`src/geometry/roundedOutline.ts`)

`partExtraction.ts` extracts every component's **static reference-pose**
outline (never the live animated pose - a cuttable part is one fixed
shape) with kerf/fit offsets applied via `resolveOffset`:

- **Linkages**: the *exact* rounded outline of the link's pin points -
  `roundedOutline.ts` computes the convex hull of the local pin
  coordinates (`hull.ts`, Andrew's monotone chain) and inflates it by the
  bar half-width plus the kerf offset via a true Minkowski sum with a
  disk (straight offset edges + real circular arcs at every vertex, no
  faceted polyline approximation - dilating by r1 then r2 is identical to
  dilating once by r1+r2, so the bar-width shaping and the kerf growth
  fold into one radius). This is exactly the "no faceted polyline
  approximation" requirement from the spec, and it reduces exactly to the
  familiar two-point capsule shape when a link only has 2 pins.
- **Gears/cams**: the sampled involute/profile outline grown radially by
  the kerf offset, plus a bore hole.
- **Followers**: a rounded rod stub + roller radius.
- **Figures**: `'wing'`/`'pinwheel'` reuse the same outline
  (`geometry/figureShapes.ts`) the 3D renderer draws (a pinwheel Figure
  renders several rotated copies in 3D but exports as one cuttable
  blade - "cut N of these" is an assembly-guide concern, not the part
  sheet's); other shapes export as a plain circle.

`svgExport.ts` nests parts with simple deterministic shelf/row packing
(`nestParts` - not a bin-packing optimizer, but correct: no overlaps) onto
the assembly's `canvasSize`, then renders a single SVG: red (`#FF0000`)
cut outlines/holes per Section 3 of the spec, blue (`#0000FF`) part-id
labels for Phase 4 assembly-guide correlation, sized to true mm via the
viewBox. `src/ui/ExportPanel.tsx` wires this to a one-click download.

## Roadmap: Phase 4

Not yet implemented, but the data model is already shaped for it: walk the
`fixed`/`gear-mesh`/`cam-follower` joint graph to group components into
sub-assemblies (frame, drive shaft, follower linkages), emitting an
ordered JSON step list that calls out spacers (from `zIndex` deltas) and
glue vs. friction fit (from `fit`) - and, per the `Figure.attachComponentId`
note above, how many copies of a multi-instance decorative part to cut.
