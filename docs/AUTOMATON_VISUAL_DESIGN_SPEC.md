# Why the sandbox didn't read as an automaton, and the fix

The kinematics were correct (Grubler F=1, zero solver failures, real
mechanical coupling between gear/cam/linkage and every `Figure`). What was
wrong was the *rendering*: nothing in the 3D view made that coupling
legible, and the assembly looked like abstract shapes near some gears
rather than a self-operating toy. This document is the research behind
that diagnosis and the concrete redesign.

## 1. What research confirms an automaton actually is

- **Definition**: a self-operating mechanical device that, once set in
  motion (by a hand crank), performs a predetermined sequence of actions -
  a category dating back ~3000 years, with 17th-century France as the
  birthplace of the toy-automaton tradition.
- **The five mechanisms**: ~95% of automata are built from wheels/pulleys,
  gears, cams, and linkages - cranks convert circular motion to
  reciprocating motion; gears change speed/direction between shafts; cams
  convert rotation to a *programmed* rise-and-fall; linkages (levers,
  followers, pivoting arms) carry that motion out to a character, "as
  complex as a galloping horse or as simple as a figure waving an arm";
  pulleys/belts (friction-coupled, untoothed) transfer rotation between
  shafts, optionally crossed to reverse direction.
- **The critical construction detail this app was missing**: *"the
  cam-follower is connected to and part of a shaft known as the
  push-rod"* - the rod is not a separate connector between two independent
  things, the character is built ONTO that rod. In real wooden automata, a
  dowel passes through a bearing hole in the box top and the figure is
  glued or pinned directly onto its exposed end. There is no gap, no
  separate "decorative" layer floating near the mechanism - the visible
  moving part *is* the mechanism's own output link, shaped and painted to
  look like a neck, an arm, a wing.
- **The box matters**: classic automata (rabbit drummer, singing bird box,
  rabbit-in-hat) hide the gear/cam train inside an enclosed box or dome -
  a viewer sees the crank on the outside and the character on top; the
  works are invisible. That's *why* the character-on-a-rod reads as
  connected: it's the only moving thing you can see besides the crank
  itself, and your eye can trace crank -> box -> rod -> character with
  nothing else competing for attention.
- **Pulleys are a real, distinct mechanism this app never implemented** -
  a genuine gap independent of the rendering problem, called out
  explicitly by the user's own summary of core mechanics ("crank cams
  gears, pulleys and linkages").

Sources: [Automaton - Wikipedia](https://en.wikipedia.org/wiki/Automaton), [Mechanical toy - Wikipedia](https://en.wikipedia.org/wiki/Mechanical_toy), [Automaton | Britannica](https://www.britannica.com/technology/automaton), [All About Automata: Mechanical Magic - Quill & Pad](https://quillandpad.com/2020/07/19/all-about-automata-mechanical-magic-with-action-videos/), [How Wooden Automata Work - CraftBreathe](https://craftbreathe.com/blogs/news/how-wooden-automata-work), [Making Pulleys and Belts for Automata - Dug's Tips 9, Cabaret Mechanical Theatre](https://cabaret.co.uk/making-pulleys-and-belts-for-automata-dugs-tips-9/), [Automata: The Odd Magic of Living Machines - Art of Play](https://www.artofplay.com/blogs/stories/automatons-the-odd-magic-of-living-machines), [Rabbit Drummer Automaton](https://www.liveauctioneers.com/price-result/rabbit-drummer-automaton/)

## 2. Exactly what was wrong in this codebase

Auditing `src/sandbox/FigureMesh.tsx` and every `src/templates/*.ts`
against the above:

1. **Every `Figure` was deliberately floated at a higher `zIndex` than its
   driving joint**, on the stated rationale that "the performer should
   read as sitting above the hidden works." That reasoning was half
   right (the character SHOULD read as separate from the works) but the
   implementation was wrong: `zIndex` maps to real Z-axis separation in
   the 3D scene, and nothing hid the works, so the result was literally a
   red sphere floating in open space several units above a visible gear
   train, connected by a follower-rod capsule too thin and too similarly
   colored to read at a glance. The one real connecting part was
   rendered *worse* than the mechanism it was supposed to justify.
2. **The follower "rod" was a decorative afterthought**, not the actual
   push-rod concept from the research: a fixed 20mm stub, not sized or
   positioned to visibly span the gap between the box top and the figure.
3. **No box occlusion.** The spec's own Section 2.D calls the sandbox a
   *simulator* that needs the mechanism visible for validation - correct
   for engineering, but it was the *only* render mode. A finished-toy view
   (opaque box, hidden works, visible crank + character) never existed,
   so there was no way to see what the object is supposed to look like as
   an actual automaton rather than an exploded diagram.
4. **Figures were single primitives (a sphere, a leaf shape), not
   articulated multi-part characters** sitting on a body/base the way
   every real example (rabbit drummer, singing bird) is - reinforcing the
   "sticker floating nearby" read rather than "a toy figure."
5. **No pulley/belt mechanism at all** - a straightforward, named gap.

## 3. The fix

- **Two render modes, one toggle**: "Mechanism" (today's view - useful for
  validation, keep it) and "Finished Toy" (new - an opaque box top, only
  the crank and the character visible, exactly like a real automaton).
  `StageMesh` gets a solid top panel with a small bearing hole per rod in
  Toy mode; gears/cams/linkages are hidden (not just dimmed) in Toy mode.
- **Zero-gap mounting.** `Figure.localOffset` collapses to (0,0) for
  rod-mounted characters; the character's body is built to *start* at the
  drive joint, not floating `N` mm away from it. Any visible "neck" or
  "arm" between a joint and a head/hand is modeled as part of the
  figure's own geometry (a tapered rod segment), not empty space.
- **Multi-part figures.** Redesign the bird as body + neck + head + two
  flush-mounted wings + simple feet resting on the box top, instead of a
  bare sphere. This is the direct fix for "doesn't look like an
  automaton" - a viewer needs to recognize a bird, not a ball.
- **Add pulley/belt** as a genuine new mechanism
  (`createPulleyBelt` factory alongside the existing crank-slider/bell-
  crank/parallel-motion helpers, a `PulleyBelt` component + `belt-drive`
  joint type per `MECHANISM_TAXONOMY_SPEC.md`'s existing gap list), and
  use it in at least one template so it's demonstrated, not just modeled.
- **Wood/craft palette.** Swap the current flat sci-fi accent colors for
  warm wood-tone/painted-toy colors on the box and figures, closer to the
  actual material reference photos turned up in research.
