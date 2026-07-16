import { useMemo } from 'react';
import * as THREE from 'three';
import type { Figure } from '../types/component';
import type { AssemblyTree } from '../types/assembly';
import type { Point2D } from '../types/geometry';
import { add, angleOf, rotate, sub } from '../types/geometry';
import type { SolveResult } from '../kinematics/solver';
import { buildWingOutline } from '../geometry/figureShapes';
import { mmToUnits, toScenePosition } from './scene';

interface FigureMeshProps {
  figure: Figure;
  assembly: AssemblyTree;
  solveResult: SolveResult;
  highlighted?: boolean;
}

/**
 * Renders the one part of the design that actually makes it "an automaton"
 * rather than a bare mechanism: a decorative performer glued to whichever
 * joint (or, for a spinning disc/pinwheel, gear/cam) is driving it,
 * inheriting that component's already-solved motion.
 */
export function FigureMesh({ figure, assembly, solveResult, highlighted }: FigureMeshProps) {
  const pose = resolveFigurePose(figure, assembly, solveResult);

  const wingOutline = useMemo(() => buildWingOutline(figure.scale), [figure.scale]);
  const wingGeometry = useMemo(() => {
    if (figure.shape !== 'wing' && figure.shape !== 'pinwheel') return null;
    const shape = new THREE.Shape();
    wingOutline.forEach((p, i) => {
      const sx = mmToUnits(p.x);
      const sy = mmToUnits(p.y);
      return i === 0 ? shape.moveTo(sx, sy) : shape.lineTo(sx, sy);
    });
    shape.closePath();
    const depth = mmToUnits(figure.material.thickness);
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
  }, [wingOutline, figure.shape, figure.material.thickness]);

  if (!pose) return null;
  const { world, angle } = pose;

  const position = toScenePosition(world, figure.zIndex);
  const color = highlighted ? '#ff2222' : figure.color ?? '#e07a5f';

  if (figure.shape === 'bird-head') {
    const r = mmToUnits(figure.scale);
    return (
      <group position={position} rotation={[0, 0, angle]}>
        <mesh castShadow>
          <sphereGeometry args={[r, 20, 16]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        <mesh position={[r * 0.9, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <coneGeometry args={[r * 0.35, r * 0.9, 12]} />
          <meshStandardMaterial color="#f2cc8f" roughness={0.6} />
        </mesh>
        <mesh position={[r * 0.4, r * 0.55, r * 0.55]}>
          <sphereGeometry args={[r * 0.15, 8, 8]} />
          <meshStandardMaterial color="#1d1d1d" />
        </mesh>
      </group>
    );
  }

  if (figure.shape === 'wing' && wingGeometry) {
    return (
      <mesh position={position} rotation={[0, 0, angle]} geometry={wingGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  if (figure.shape === 'disc') {
    const r = mmToUnits(figure.scale);
    return (
      <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[r, r, mmToUnits(figure.material.thickness), 24]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    );
  }

  if (figure.shape === 'pinwheel' && wingGeometry) {
    const bladeCount = 4;
    const hubRadius = mmToUnits(figure.scale * 0.12);
    return (
      <group position={position} rotation={[0, 0, angle]}>
        {Array.from({ length: bladeCount }, (_, i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / bladeCount]} geometry={wingGeometry} castShadow receiveShadow>
            <meshStandardMaterial color={color} roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[hubRadius, hubRadius, mmToUnits(figure.material.thickness) * 1.3, 16]} />
          <meshStandardMaterial color="#1d1d1d" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
    );
  }

  const r = mmToUnits(figure.scale);
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[r, 16, 12]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
}

interface FigurePose {
  world: Point2D;
  angle: number;
}

/**
 * Two mutually-exclusive attachment modes: ride a Linkage/Follower joint's
 * position (+ optional second joint for a facing angle), or ride a
 * Gear/Cam's own solved rotation directly - the latter has no second
 * moving point to derive an angle from the way a shared pin does.
 */
function resolveFigurePose(figure: Figure, assembly: AssemblyTree, solveResult: SolveResult): FigurePose | null {
  if (figure.attachComponentId) {
    const component = assembly.components[figure.attachComponentId];
    if (!component || (component.kind !== 'gear' && component.kind !== 'cam')) return null;
    const pivot = solveResult.positions[component.pivotJointId];
    const angle = component.kind === 'gear' ? solveResult.rotations.gears[component.id] : solveResult.rotations.cams[component.id];
    if (!pivot || angle === undefined) return null;
    return { world: add(pivot, rotate(figure.localOffset, angle)), angle };
  }

  if (figure.attachJointId) {
    const attach = solveResult.positions[figure.attachJointId];
    if (!attach) return null;
    const orientationTarget = figure.orientationJointId ? solveResult.positions[figure.orientationJointId] : undefined;
    const angle = orientationTarget ? angleOf(sub(orientationTarget, attach)) : 0;
    return { world: add(attach, rotate(figure.localOffset, angle)), angle };
  }

  return null;
}
