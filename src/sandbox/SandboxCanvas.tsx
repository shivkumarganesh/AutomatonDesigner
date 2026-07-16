import { Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Grid, OrbitControls } from '@react-three/drei';
import { useAssemblyStore } from '../store/assemblyStore';
import { isCam, isFigure, isFollower, isGear, isLinkage } from '../types/component';
import { GearMesh } from './GearMesh';
import { CamMesh } from './CamMesh';
import { LinkageMesh } from './LinkageMesh';
import { FollowerMesh } from './FollowerMesh';
import { FigureMesh } from './FigureMesh';
import { StageMesh } from './StageMesh';
import { BeltMesh } from './BeltMesh';
import { toScenePosition, mmToUnits, Z_PLANE_SPACING_MM } from './scene';

function AnimationDriver() {
  const stepTheta = useAssemblyStore((s) => s.stepTheta);
  useFrame((_, delta) => stepTheta(delta));
  return null;
}

function GroundPivots() {
  const assembly = useAssemblyStore((s) => s.assembly);
  const viewMode = useAssemblyStore((s) => s.viewMode);
  if (viewMode === 'toy') return null;
  return (
    <>
      {assembly.groundJointIds.map((id) => {
        const joint = assembly.joints[id];
        if (!joint || !('position' in joint)) return null;
        return (
          <mesh key={id} position={toScenePosition(joint.position, joint.zIndex)} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[mmToUnits(2), mmToUnits(2), mmToUnits(30), 12]} />
            <meshStandardMaterial color="#111111" />
          </mesh>
        );
      })}
    </>
  );
}

/** Small dark pivot pins at every revolute/prismatic joint (grounded or
 *  not) in toy view - makes each handoff between parts (crank pin to
 *  coupler, coupler to slider, etc) read as a deliberate articulation
 *  point instead of two shapes that merely happen to touch. */
function JointPins() {
  const assembly = useAssemblyStore((s) => s.assembly);
  const solveResult = useAssemblyStore((s) => s.solveResult);
  const viewMode = useAssemblyStore((s) => s.viewMode);
  if (viewMode !== 'toy') return null;
  return (
    <>
      {Object.values(assembly.joints).map((joint) => {
        if (joint.type !== 'revolute' && joint.type !== 'prismatic') return null;
        const pos = solveResult.positions[joint.id];
        if (!pos) return null;
        return (
          <mesh key={joint.id} position={toScenePosition(pos, joint.zIndex)} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[mmToUnits(2.2), mmToUnits(2.2), mmToUnits(6), 12]} />
            <meshStandardMaterial color="#241c14" metalness={0.4} roughness={0.5} />
          </mesh>
        );
      })}
    </>
  );
}

function AssemblyContents() {
  const assembly = useAssemblyStore((s) => s.assembly);
  const solveResult = useAssemblyStore((s) => s.solveResult);
  const validation = useAssemblyStore((s) => s.validation);

  const highlightedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const issue of validation.issues) {
      if (issue.severity !== 'error') continue;
      for (const id of issue.targetIds) ids.add(id);
    }
    return ids;
  }, [validation.issues]);

  return (
    <>
      {Object.values(assembly.components).map((component) => {
        // The drive train stays visible in both views now - real automaton
        // boxes (see AUTOMATON_VISUAL_DESIGN_SPEC.md reference photos) are
        // open-frame, showing off the gears/cams, not sealed enclosures.
        if (isLinkage(component)) {
          return (
            <LinkageMesh
              key={component.id}
              linkage={component}
              positions={solveResult.positions}
              highlighted={highlightedIds.has(component.id)}
            />
          );
        }
        if (isGear(component)) {
          const pivot = solveResult.positions[component.pivotJointId];
          if (!pivot) return null;
          return (
            <GearMesh
              key={component.id}
              gear={component}
              pivot={pivot}
              rotation={solveResult.rotations.gears[component.id] ?? 0}
              highlighted={highlightedIds.has(component.id)}
            />
          );
        }
        if (isCam(component)) {
          const pivot = solveResult.positions[component.pivotJointId];
          if (!pivot) return null;
          return (
            <CamMesh
              key={component.id}
              cam={component}
              pivot={pivot}
              rotation={solveResult.rotations.cams[component.id] ?? 0}
              highlighted={highlightedIds.has(component.id)}
            />
          );
        }
        if (isFollower(component)) {
          const out = solveResult.followerOutputs[component.id];
          if (!out) return null;
          return (
            <FollowerMesh
              key={component.id}
              follower={component}
              position={out.position}
              highlighted={highlightedIds.has(component.id)}
            />
          );
        }
        if (isFigure(component)) {
          return (
            <FigureMesh
              key={component.id}
              figure={component}
              assembly={assembly}
              solveResult={solveResult}
              highlighted={highlightedIds.has(component.id)}
            />
          );
        }
        return null;
      })}
    </>
  );
}

function GearBelts() {
  const assembly = useAssemblyStore((s) => s.assembly);
  const solveResult = useAssemblyStore((s) => s.solveResult);
  return (
    <>
      {Object.values(assembly.joints).map((joint) => {
        if (joint.type !== 'gear-mesh') return null;
        const driver = assembly.components[joint.driverId];
        const driven = assembly.components[joint.drivenId];
        if (!driver || !driven || !isGear(driver) || !isGear(driven)) return null;
        if (driver.visualStyle !== 'pulley' || driven.visualStyle !== 'pulley') return null;
        const c1 = solveResult.positions[driver.pivotJointId];
        const c2 = solveResult.positions[driven.pivotJointId];
        if (!c1 || !c2) return null;
        const r1 = (driver.params.module * driver.params.teeth) / 2;
        const r2 = (driven.params.module * driven.params.teeth) / 2;
        return <BeltMesh key={joint.id} c1={c1} r1={r1} c2={c2} r2={r2} zIndex={joint.zIndex} />;
      })}
    </>
  );
}

function Stage() {
  const stage = useAssemblyStore((s) => s.assembly.stage);
  const theta = useAssemblyStore((s) => s.assembly.driver.theta);
  const crankPivot = useAssemblyStore((s) => (stage ? s.solveResult.positions[stage.crankJointId] : undefined));
  const viewMode = useAssemblyStore((s) => s.viewMode);
  if (!stage || !crankPivot) return null;
  return <StageMesh stage={stage} crankPivot={crankPivot} theta={theta} viewMode={viewMode} />;
}

/**
 * Auto-fits an initial camera pose to the current template's stage
 * footprint - templates range from a 160mm nodding head to a 260mm+
 * bird, so a single fixed camera pose only ever suits one of them.
 *
 * The mechanism's own (x, y) plane is drawn the way you'd sketch a
 * mechanism on paper - y already points "up" (a rocker's outer pin sits at
 * a higher y than its ground pivot, a follower's travel axis is (0, 1),
 * etc). zIndex maps to world Z as *depth*, not height (Section 2.D
 * stacking - a spacer-ring layer sits behind/in front of its neighbor, not
 * above it). So the camera needs a standard Y-up, look-along-Z framing -
 * front-on, like how every real automaton reference photo is shot - not
 * the old top-down floor-plan view, which flattened a bird's up/down peck
 * into a horizontal front/back slide that never read as "pecking."
 */
function computeCameraPose(assembly: ReturnType<typeof useAssemblyStore.getState>['assembly']) {
  const stage = assembly.stage;
  const originUnits = stage ? { x: mmToUnits(stage.originMm.x), y: mmToUnits(stage.originMm.y) } : { x: 0, y: 0 };
  const sizeUnits = stage ? mmToUnits(Math.max(stage.widthMm, stage.depthMm)) : 30;
  // Halfway between the drive train (hidden below enclosureTopZIndex) and
  // where Figures typically sit (a couple of planes above it).
  const midZIndex = stage ? stage.enclosureTopZIndex + 1 : 1;
  const targetZ = midZIndex * Z_PLANE_SPACING_MM * mmToUnits(1);
  const target: [number, number, number] = [originUnits.x, originUnits.y, targetZ];
  const dist = sizeUnits * 1.55;
  // Off-axis just enough to read the box as 3D, not so much that a Figure
  // sitting well forward in Z (toward camera, ahead of a shallow box) skews
  // sideways in screen space relative to the box behind it - a parallax
  // artifact that reads as "the figure floated off the box."
  const position: [number, number, number] = [originUnits.x + sizeUnits * 0.12, originUnits.y + sizeUnits * 0.08, targetZ + dist];
  return { position, target, floorY: originUnits.y - sizeUnits * 0.55, gridSize: sizeUnits * 3 };
}

export function SandboxCanvas() {
  const assembly = useAssemblyStore((s) => s.assembly);
  const { position, target, floorY, gridSize } = computeCameraPose(assembly);

  return (
    // Keying on assembly.id remounts the Canvas (and its initial camera
    // pose) whenever the selected template changes, since R3F's camera
    // prop only ever applies once, on mount.
    <Canvas key={assembly.id} shadows camera={{ position, fov: 42 }}>
      <color attach="background" args={['#12141a']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 20]} intensity={1.1} castShadow />
      <Suspense fallback={null}>
        <AnimationDriver />
        <GroundPivots />
        <Stage />
        <AssemblyContents />
        <GearBelts />
        <JointPins />
      </Suspense>
      <Grid
        args={[gridSize, gridSize]}
        position={[target[0], floorY, target[2]]}
        cellSize={1}
        cellColor="#2a2d36"
        sectionSize={5}
        sectionColor="#3d4150"
        fadeDistance={gridSize * 1.5}
      />
      {/* Soft grounded shadow under the box - a flat-lit CG object with no
          contact shadow reads as floating/fake no matter how good its
          materials are; this is the cheapest fix with the biggest payoff. */}
      <ContactShadows
        position={[target[0], floorY + 0.01, target[2]]}
        opacity={0.55}
        scale={gridSize}
        blur={2.4}
        far={gridSize * 0.4}
      />
      <OrbitControls makeDefault target={target} />
    </Canvas>
  );
}
