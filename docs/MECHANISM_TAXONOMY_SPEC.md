# Automaton Mechanism Taxonomy & Implementation Spec

Research pass on real automata mechanism vocabulary (the three requested
storefronts - aaturning.com, mechanical-toys.com, moyustore.com - are
blocked by this session's network egress policy and returned 403 at the
proxy gateway, confirmed via `/__agentproxy/status`; `WebFetch` was also
non-functional for every other domain attempted during this session
regardless of block status, so this is compiled from `WebSearch` result
summaries across ~10 queries, cross-checked against the primary references
already cited in the app's `README.md` and system prompt). Sources are
listed per section. This document is the gap analysis between what real
automata builders actually mean by "mechanism" and what
`src/types/component.ts` / `src/kinematics/solver.ts` currently model.

## 1. What the app already covers

| Mechanism | Status |
|---|---|
| Four-bar (crank-rocker / crank-slider family) | Implemented - `Linkage` + Newton-Raphson solver |
| Spur gear train (external mesh, fixed ratio) | Implemented - `Gear` + `GearMeshJoint` |
| Plate cam + translating follower | Implemented - `Cam` + `Follower` (`motion: 'translating'`) |
| Plate cam + oscillating roller-arm follower | Implemented - `Follower` (`motion: 'oscillating'`), circle-intersection solve |
| Compound/keyed shafts (gear+cam on one shaft) | Implemented - `fixed` joint, Grubler-merged |
| Prismatic (slider) joints | Implemented - `PrismaticJoint`, line constraint in solver |
| Decorative performer riding the mechanism | Implemented - `Figure` |

## 2. Mechanism catalog from research

### 2.1 Cam profiles

A cam is a rotating plate; a **follower** rides its edge and is converted
to linear or oscillating motion. Four canonical profile families recur
across every source consulted:

- **Eccentric (circular, off-center)** - simplest cam: a plain circle
  mounted off its rotation axis. Produces smooth sinusoidal rise/fall,
  continuous motion, no dwell. *Already implemented* as
  `'circular-eccentric'`.
- **Pear / lobed cam** - long dwell at the base circle, then a sharper
  rise-and-fall lobe. Produces "up, down, still, up, down, still" motion -
  the most common shape in paper/card automata specifically because the
  dwell gives a visible pause a viewer reads as intentional (a head that
  holds still, then nods). *Partially implemented*: our
  `'constant-rise-fall'` profile rises over the first half-turn and falls
  over the second with no dwell segment - it's the eccentric's smoother
  cousin, not a true pear cam. **Gap: no dwell segment.**
- **Snail / drop cam** - monotonic radius increase over most of the
  rotation (steady, slow rise) followed by a near-instant drop back to
  base radius. One-directional only (running it backward jams the
  follower against the drop edge). Classic "sudden fall" gag mechanism.
  **Gap: not implemented**, and unlike the other profiles this one has a
  *rotation-direction constraint* the validator doesn't currently check.
- **Heart cam (constant velocity)** - shaped so linear rise and linear
  fall both happen at *constant angular-to-linear rate*, used historically
  for bobbin winders where uniform thread speed matters. *Implemented* as
  `'heart'`, though the current implementation is a good approximation
  (piecewise-linear in the `unit` parametrization) rather than a
  derivative-matched true heart curve - acceptable for Phase 1/2, worth
  revisiting for Phase 3 export precision.
- **Custom/irregular** - hand-sculpted profiles (Jaquet-Droz's automata
  stack dozens of custom cams per character to sequence complex multi-part
  performances). *Implemented* as `'custom-samples'`.

Sources: [Cams & how they work - different shapes](https://docs.google.com/document/u/0/d/17GMr6VfPY90SWo7ZXlmrW84lmArEA0AeCZbxTL03SoA/mobilebasic), [STEM Project: Four Types of Cam Mechanisms and Followers](https://papercraftetc.blogspot.com/2023/08/a-stem-project-mechanical-shaft-with.html), [Cam Followers for Automata - Dug's Tips 16, Cabaret Mechanical Theatre](https://cabaret.co.uk/cam-followers-for-automata-dugs-tips-16/), [Paper Automata - HubPages](https://discover.hubpages.com/art/paper-automata-free-downloads-templates-fun-examples-and-mechanism-info)

### 2.2 Cam followers

Four follower-tip geometries recur, each changing how faithfully the
follower tracks sharp features in the profile:

- **Knife/point follower** - traces the profile exactly (including
  cusps) but wears fast and is rarely used in wood/card builds.
- **Flat follower** - contacts the cam along a flat face; effectively
  reads a slightly different ("offset") curve than the nominal profile
  because contact point migrates across the flat face as the cam turns.
- **Roller follower** - a small wheel; contacts along the profile's
  *offset curve* at a fixed distance (the roller radius) from the
  nominal profile, same principle Phase 3's kerf offset already models
  for gear teeth.
- **Curved follower** - a concave/convex face, used to force a specific
  dwell behavior even off a simple base cam.

*Implementation note*: our solver already treats every follower as an
idealized point/roller sample of `camProfileRadius(profile, phi)` plus
`rollerRadius` - i.e. we already model the **roller follower** case
correctly (the most common one in wood/laser automata). Flat and curved
followers would need actual profile-offset math (finding the tangent
contact point, not just the radial sample) - out of scope until there's a
concrete design that needs one.

Source: [Cam Followers for Automata - Dug's Tips 16](https://cabaret.co.uk/cam-followers-for-automata-dugs-tips-16/)

### 2.3 Crank / linkage family

- **Crank-rocker four-bar** - *implemented*, our demo assembly.
- **Crank-slider (slider-crank)** - a crank + coupler driving a block
  constrained to a straight rail (piston motion). *Data-model-ready but
  unused*: `PrismaticJoint` + the line-constraint solver already handle
  this exactly; the gap is purely that `demoAssembly.ts` has no worked
  example and there's no dedicated crank-slider factory helper.
- **Bell crank** - an L/V-shaped rigid link pivoted at its bend, turning
  a rotation or force applied on one arm into a *redirected* motion on the
  other arm (commonly perpendicular). This is just a `Linkage` with 3
  points (pivot + two arm ends) in our model - **already representable**,
  no new types needed, just a documented pattern.
- **Bell-crank + slotted disk** - a pin fixed to a rotating disk rides in
  a radial slot machined into the bell-crank's arm; as the disk turns, the
  slot sweeps the pin through an arc, oscillating the bell-crank. This is
  a **true pin-in-slot joint** (2-DoF higher pair like a cam, but the
  "cam" is a straight/curved slot rather than an edge profile). **Gap:
  not implemented** - would need a new `JointType: 'slot-follower'` and a
  slot-geometry field (similar shape to `CamProfile` but as a path rather
  than a radius function).
- **Pantograph** - a parallelogram linkage that reproduces a traced
  motion at a different scale at a second point. Not currently
  representable as a *convenience* pattern, but is mechanically nothing
  more than two overlapping `Linkage` four-bars sharing joints - already
  buildable by hand with existing types, just needs a factory helper if
  we want a one-click "add pantograph" button later.
- **Double-crank parallel-motion linkage** - two parallel cranks of equal
  length connected by a coupler bar keep the coupler's orientation fixed
  as it translates in a loop (this is the standard way automata
  synchronize **two wings/arms to move in mirrored unison** off a single
  input, rather than gluing separate Figures to unrelated joints the way
  our current bird demo does with its single wing). *Data-model-ready*:
  it's two ordinary `Linkage` four-bars sharing a driver - no new types
  needed, but worth a factory helper (`createParallelMotionPair`) since
  hand-wiring the shared-joint bookkeeping is fiddly.

Sources: [Bell-crank Lever with Slotted Disk Crank Mechanism - Firgelli](https://www.firgelliauto.com/blogs/mechanisms/bell-crank-lever-with-slotted-disk-crank), [Automata and Mechanical Toys - Rodney Peppe](https://www.amazon.com/Automata-Mechanical-Toys-Rodney-Peppe/dp/1861265107), [Parametric Study of a Single Crank-Slotted Dual Lever Mechanism for Flapping Actuation](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9680486/)

### 2.4 Gear-family mechanisms

- **External spur mesh** - *implemented*.
- **Rack and pinion** - converts rotary crank motion to linear
  reciprocating motion via a toothed bar instead of a second gear (used
  e.g. in Rob Ives' "Rack and Pinion Eagle" - a Geneva drive divides
  rotation, then a crank+Scotch-yoke stage converts that to reciprocating
  motion, then a final rack-and-pinion stage drives the visible output).
  Mechanically it's the same tooth-mesh math we already use for gears,
  just meshing against a straight involute rack instead of another
  circle. **Gap: not implemented** - needs a `Rack` component (a straight
  toothed bar riding a `PrismaticJoint`) and a mesh-ratio rule
  (`linear_velocity = angular_velocity * pitchRadius`) in the solver's
  closed-form gear-train pass.
- **Geneva drive (Maltese cross)** - a pin on the continuously-rotating
  driver wheel engages a radial slot on the driven wheel once per driver
  revolution, advancing the driven wheel by a fixed step (commonly 1/4,
  1/6, or 1/8 turn) and holding it locked the rest of the time via a
  blocking-disc/notch pair. This is the standard way automata get
  **intermittent** (stepped, not continuous) rotary motion from a
  continuous crank - e.g. a wheel of characters that "clicks" from one
  position to the next. **Gap: not implemented** - genuinely new
  kinematics (a driven body whose motion is *discontinuous* in theta, not
  a smooth function of the driver angle), needs its own solver stage
  rather than fitting the existing ratio-composition pass.
- **Ratchet + pawl** - a toothed wheel plus a spring-loaded pawl that
  allows rotation in one direction only. Used less as a motion generator
  and more as a *constraint*: preventing the input crank from being
  turned backward (which would otherwise jam a snail cam or desequence a
  Geneva mechanism), and for dividing a hand-cranked cycle into
  discrete steps. **Gap: not implemented** - this is a validation-layer
  concept (a directional constraint on `theta`) more than a new
  kinematic pair; lowest priority.

Sources: [Rack and Pinion Eagle Mechanism - Rob Ives](https://www.robives.com/blog/rack-and-pinion-eagle-mechanism/), [Geneva drive - Wikipedia](https://en.wikipedia.org/wiki/Geneva_drive), [How to Make a Ratchet Mechanism - Dug's Tips 11, Cabaret Mechanical Theatre](https://cabaret.co.uk/how-to-make-a-ratchet-mechanism-dugs-tips-11/)

### 2.5 Wobble / skew-disk mechanisms

A disk mounted at an angle (skewed) to its rotation axis traces a
wobbling, precessing motion as it spins - used for "walking" automata
where alternating legs need out-of-phase vertical lift. Genuinely 3D (the
wobble plane is tilted relative to the drive axis), which conflicts with
this app's deliberately-2.5D solver architecture (Section 2.D of the
original spec: linkages live on parallel *flat* z-planes, not tilted
ones). **Gap: not implemented, and probably shouldn't be** without a
larger architectural change - flagged here for completeness, not
recommended for the near-term roadmap.

Source: [Wobblebots Walk Without Motors or Electronics - Make:](https://makezine.com/article/home/fun-games/wobblebots/)

## 3. Data model additions this implies

```ts
// joint.ts
export type JointType =
  | 'revolute' | 'prismatic' | 'gear-mesh' | 'cam-follower' | 'fixed'
  | 'rack-mesh'      // NEW: pinion <-> straight rack, J2 higher pair
  | 'slot-follower'  // NEW: pin-in-slot (bell-crank + slotted disk), J2 higher pair
  | 'geneva-index';  // NEW: intermittent drive, J2 higher pair (own solver stage)

// component.ts
export interface Rack extends BaseComponentFields {
  kind: 'rack';
  toothParams: Pick<InvoluteGearParams, 'module' | 'pressureAngleDeg'>;
  /** the PrismaticJoint id this rack's translating point rides */
  slideJointId: string;
}

export interface SlottedDisk extends BaseComponentFields {
  kind: 'slotted-disk';
  pivotJointId: string;
  /** slot path in local coords, mm - straight radial slot is the common case */
  slotStart: Point2D;
  slotEnd: Point2D;
  isInputDisk?: boolean;
  drivenByMeshJointId?: string;
}

export interface GenevaWheel extends BaseComponentFields {
  kind: 'geneva-wheel';
  pivotJointId: string;
  numSlots: number;      // 1/numSlots turn per driver revolution
  driverPinRadius: number;
  drivenByJointId: string; // the continuously-rotating driver disk's pivot
}
```

Cam profile additions (no new component kind needed, just new
`CamProfileKind` variants in `geometry/cam.ts`):

```ts
export type CamProfileKind =
  | 'circular-eccentric' | 'constant-rise-fall' | 'heart' | 'custom-samples'
  | 'pear-dwell'   // NEW: explicit dwell-rise-dwell-fall-dwell segments
  | 'snail-drop';  // NEW: monotonic rise + near-instant drop, direction-constrained
```

`snail-drop` also implies a new `ValidationCode: 'wrong-drive-direction'` -
the validator needs to know the assembly's driver is only allowed to turn
one way, and flag it if `omega` (or a UI "reverse" control, once one
exists) would run it backward.

## 4. Solver architecture impact

The existing solver (`src/kinematics/solver.ts`) is a strictly *smooth*
function of theta: every stage (crank rotation, gear-ratio composition,
cam-profile sampling, Newton-Raphson linkage solve) is continuous and
differentiable in theta by construction. Two of the new mechanisms break
that assumption and need explicit new stages, not extensions of existing
ones:

- **Rack-and-pinion**: still closed-form and continuous, fits naturally
  as a new case in the existing gear-train relaxation pass (Step 2) -
  `rackPosition = rackPosition0 + pitchRadius * theta * direction`. Low
  effort.
- **Geneva drive**: genuinely discontinuous (locked most of the time,
  then steps). Needs its own stage between Step 2 (gear/cam train) and
  Step 3 (followers): given the driver pin's angle, determine whether
  it's currently inside the engagement arc and either hold the driven
  wheel's last indexed angle or interpolate it through the current step.
  Moderate effort, self-contained.
- **Slot-follower (bell-crank + slotted disk)**: needs a genuine 2D
  line-segment/point solve each frame (closest point on the rotating
  slot to the bell-crank's pivot-constrained arc) - conceptually similar
  to the existing oscillating-follower circle-intersection solve in Step 3,
  but against a rotating line segment instead of a static circle. Moderate
  effort, fits the existing "closed-form per-component" pattern.

None of these require touching the Newton-Raphson linkage network (Step 4)
- they're all upstream, closed-form (or piecewise closed-form) stages,
consistent with the existing architecture's separation of "things with an
analytic drive relationship" from "the floating linkage network that needs
iteration."

## 5. Suggested implementation order

1. **Crank-slider + bell-crank + parallel-motion factory helpers** -
   zero new types, pure `demoAssembly.ts`-style convenience functions
   plus worked examples. Immediately fixes the bird demo's single
   mismatched wing (replace with a proper parallel-motion pair so both
   wings move in sync off one input, the way real bird automata do).
2. **Pear-dwell and snail-drop cam profiles** - new `CamProfileKind`
   variants in `geometry/cam.ts` only, no solver changes. High value
   (these are the two most iconic automata cam shapes and the ones
   missing) for low effort.
3. **Rack and pinion** - new `Rack` component + one new closed-form case
   in the solver's Step 2. Self-contained.
4. **Geneva drive** - new `GenevaWheel` component + new solver stage.
5. **Slot-follower / slotted-disk bell crank** - new `SlottedDisk`
   component + new per-frame line-intersection solve.
6. **Ratchet direction constraint** - validation-only, no new kinematics;
   fold into `ValidationIssue` once there's a UI concept of "drive
   direction" to check it against.
7. **Wobble/skew-disk** - explicitly deferred; would require relaxing the
   2.5D planar-stacking assumption that the rest of the architecture
   (including the Phase 3 flat-pack exporter) depends on.

## 6. Open questions before implementing

- Do you want the parallel-motion wing fix (item 1) folded into the
  existing demo assembly now, or scoped as its own follow-up?
- Priority order: is the goal breadth (touch every mechanism family at
  least once) or depth (fully flesh out cams/linkages, which are what
  most simple wooden automata actually use, before touching Geneva/rack
  mechanisms which are comparatively rare in hobbyist automata)?
- Should mechanism authoring stay code-only (hand-written
  `AssemblyTree`s like `demoAssembly.ts`) for this phase, or does this
  research imply it's time to start the component-authoring UI the
  README's Phase 3/4 roadmap defers?
