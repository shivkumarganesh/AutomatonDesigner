import { Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { useAssemblyStore } from '../store/assemblyStore';
import { isCam, isFollower, isGear, isLinkage } from '../types/component';
import { GearMesh } from './GearMesh';
import { CamMesh } from './CamMesh';
import { LinkageMesh } from './LinkageMesh';
import { FollowerMesh } from './FollowerMesh';
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
        return null;
      })}
    </>
  );
}

export function SandboxCanvas() {
  return (
    <Canvas shadows camera={{ position: [0, -20, 24], fov: 45, up: [0, 0, 1] }}>
      <color attach="background" args={['#12141a']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, -10, 20]} intensity={1.1} castShadow />
      <Suspense fallback={null}>
        <AnimationDriver />
        <GroundPivots />
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
      <OrbitControls makeDefault target={[3, 0, 0]} />
    </Canvas>
  );
}
