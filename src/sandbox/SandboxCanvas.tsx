import { Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { useAssemblyStore } from '../store/assemblyStore';
import { isCam, isFigure, isFollower, isGear, isLinkage } from '../types/component';
import { GearMesh } from './GearMesh';
import { CamMesh } from './CamMesh';
import { LinkageMesh } from './LinkageMesh';
import { FollowerMesh } from './FollowerMesh';
import { FigureMesh } from './FigureMesh';
import { StageMesh } from './StageMesh';
import { toScenePosition, mmToUnits } from './scene';

function AnimationDriver() {
  const stepTheta = useAssemblyStore((s) => s.stepTheta);
  useFrame((_, delta) => stepTheta(delta));
  return null;
}

function GroundPivots() {
  const assembly = useAssemblyStore((s) => s.assembly);
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

function Stage() {
  const stage = useAssemblyStore((s) => s.assembly.stage);
  const theta = useAssemblyStore((s) => s.assembly.driver.theta);
  const crankPivot = useAssemblyStore((s) => (stage ? s.solveResult.positions[stage.crankJointId] : undefined));
  if (!stage || !crankPivot) return null;
  return <StageMesh stage={stage} crankPivot={crankPivot} theta={theta} />;
}

/** Auto-fits an initial camera pose to the current template's stage
 *  footprint - templates range from a 160mm nodding head to a 260mm+
 *  bird, so a single fixed camera pose only ever suits one of them. */
function computeCameraPose(assembly: ReturnType<typeof useAssemblyStore.getState>['assembly']) {
  const stage = assembly.stage;
  const originUnits = stage ? { x: mmToUnits(stage.originMm.x), y: mmToUnits(stage.originMm.y) } : { x: 0, y: 0 };
  const sizeUnits = stage ? mmToUnits(Math.max(stage.widthMm, stage.depthMm)) : 30;
  const target: [number, number, number] = [originUnits.x, originUnits.y - sizeUnits * 0.05, sizeUnits * 0.1];
  const dist = sizeUnits * 1.65;
  const position: [number, number, number] = [originUnits.x - sizeUnits * 0.08, originUnits.y - dist * 0.85, dist * 0.55];
  return { position, target };
}

export function SandboxCanvas() {
  const assembly = useAssemblyStore((s) => s.assembly);
  const { position, target } = computeCameraPose(assembly);

  return (
    // Keying on assembly.id remounts the Canvas (and its initial camera
    // pose) whenever the selected template changes, since R3F's camera
    // prop only ever applies once, on mount.
    <Canvas key={assembly.id} shadows camera={{ position, fov: 42, up: [0, 0, 1] }}>
      <color attach="background" args={['#12141a']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, -10, 20]} intensity={1.1} castShadow />
      <Suspense fallback={null}>
        <AnimationDriver />
        <GroundPivots />
        <Stage />
        <AssemblyContents />
      </Suspense>
      <Grid
        args={[80, 80]}
        cellSize={1}
        cellColor="#2a2d36"
        sectionSize={5}
        sectionColor="#3d4150"
        fadeDistance={60}
        rotation={[Math.PI / 2, 0, 0]}
      />
      <OrbitControls makeDefault target={target} />
    </Canvas>
  );
}
