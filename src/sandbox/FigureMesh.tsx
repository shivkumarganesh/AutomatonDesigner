import { useMemo } from 'react';
import * as THREE from 'three';
import type { Figure } from '../types/component';
import { isFollower } from '../types/component';
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
 * Renders the part of the design that actually makes it "an automaton"
 * rather than a bare mechanism: a performer riding whichever joint (or,
 * for a spinning disc/pinwheel, gear/cam) is driving it, inheriting that
 * component's already-solved motion - or, for static body/base parts, a
 * fixed decoration the mechanism doesn't move at all (most of a real
 * automaton figure is static; only the driven parts move).
 *
 * When `showConnectingRod` is set, a painted-dowel rod is drawn from the
 * driving joint's own z-plane up to this figure - the real automaton
 * detail this app was missing (see AUTOMATON_VISUAL_DESIGN_SPEC.md): the
 * rod is not a separate, barely-visible connector, it's rendered as
 * clearly as the figure itself so the mechanical connection reads at a
 * glance.
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
  const { world, angle, driveZIndex, driveWorld } = pose;

  const position = toScenePosition(world, figure.zIndex);
  const color = highlighted ? '#ff2222' : figure.color ?? '#e07a5f';
  const rod =
    figure.showConnectingRod && driveZIndex !== undefined && driveWorld
      ? buildConnectingRod(toScenePosition(driveWorld, driveZIndex), position)
      : null;

  return (
    <>
      {rod && (
        <mesh position={rod.center} quaternion={rod.quaternion} castShadow>
          <cylinderGeometry args={[rod.radius, rod.radius, rod.length, 12]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
      )}
      <FigureBody figure={figure} position={position} angle={angle} color={color} wingGeometry={wingGeometry} />
    </>
  );
}

function FigureBody({
  figure,
  position,
  angle,
  color,
  wingGeometry,
}: {
  figure: Figure;
  position: [number, number, number];
  angle: number;
  color: string;
  wingGeometry: THREE.ExtrudeGeometry | null;
}) {
  if (figure.shape === 'bird-head') {
    const r = mmToUnits(figure.scale);
    return (
      <group position={position} rotation={[0, 0, angle]}>
        <mesh scale={[1.08, 0.95, 1]} castShadow>
          <sphereGeometry args={[r, 20, 16]} />
          <meshStandardMaterial color={color} roughness={0.65} />
        </mesh>
        <mesh position={[r * 0.9, 0, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
          <coneGeometry args={[r * 0.35, r * 0.9, 12]} />
          <meshStandardMaterial color="#f2cc8f" roughness={0.6} />
        </mesh>
        {/* comb - a small carved crest, the detail every reference bird
            head has and a bare sphere-and-beak doesn't */}
        <mesh position={[r * 0.1, r * 0.85, 0]} rotation={[0, 0, -0.2]} castShadow>
          <coneGeometry args={[r * 0.22, r * 0.5, 8]} />
          <meshStandardMaterial color="#c1440e" roughness={0.6} />
        </mesh>
        <mesh position={[r * 0.4, r * 0.55, r * 0.55]}>
          <sphereGeometry args={[r * 0.15, 8, 8]} />
          <meshStandardMaterial color="#1d1d1d" />
        </mesh>
      </group>
    );
  }

  if (figure.shape === 'bird-body') {
    const r = mmToUnits(figure.scale);
    return (
      <mesh position={position} rotation={[0, 0, angle]} scale={[1.15, 1, 0.9]} castShadow receiveShadow>
        <sphereGeometry args={[r, 24, 18]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
    );
  }

  if (figure.shape === 'foot') {
    const r = mmToUnits(figure.scale);
    return (
      <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[r, r * 1.2, r * 0.6, 10]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
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
    // A rounded, slightly domed puck reads as a carved wooden hand/paddle;
    // a flat-edged cylinder reads as a mechanical washer.
    return (
      <mesh position={position} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.55]} castShadow>
        <sphereGeometry args={[r, 24, 16]} />
        <meshStandardMaterial color={color} roughness={0.65} />
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
  /** The driving joint/component's own zIndex, for the connecting rod. */
  driveZIndex?: number;
  /** The driving joint/component's own (unelevated) world position, for
   *  the connecting rod's start point. */
  driveWorld?: Point2D;
}

/**
 * Three mutually-exclusive attachment modes: ride a Linkage/Follower
 * joint's position (+ optional second joint for a facing angle), ride a
 * Gear/Cam's own solved rotation directly (no second moving point to
 * derive an angle from the way a shared pin does), or sit at a fixed
 * world position for a static (non-driven) decorative part. In the first
 * two modes, `elevationMm` (see types/component.ts) is applied last, as a
 * fixed unrotated world-Y lift - independent of the local-frame offset
 * that rotates with the joint's own motion.
 */
function resolveFigurePose(figure: Figure, assembly: AssemblyTree, solveResult: SolveResult): FigurePose | null {
  if (figure.staticPosition) {
    return { world: figure.staticPosition, angle: 0 };
  }

  const elevation: Point2D = { x: 0, y: figure.elevationMm ?? 0 };

  if (figure.attachComponentId) {
    const component = assembly.components[figure.attachComponentId];
    if (!component || (component.kind !== 'gear' && component.kind !== 'cam')) return null;
    const pivot = solveResult.positions[component.pivotJointId];
    const angle = component.kind === 'gear' ? solveResult.rotations.gears[component.id] : solveResult.rotations.cams[component.id];
    if (!pivot || angle === undefined) return null;
    const world = add(add(pivot, rotate(figure.localOffset, angle)), elevation);
    return { world, angle, driveZIndex: component.zIndex, driveWorld: pivot };
  }

  if (figure.attachJointId) {
    const attach = solveResult.positions[figure.attachJointId];
    if (!attach) return null;
    const orientationTarget = figure.orientationJointId ? solveResult.positions[figure.orientationJointId] : undefined;
    const angle = orientationTarget ? angleOf(sub(orientationTarget, attach)) : 0;
    // A Follower's `outputJointId` (e.g. a cam-follower's roller-center pin)
    // is a synthetic id that only ever appears as a key in solveResult -
    // it's never registered in assembly.joints, so it has no zIndex of its
    // own there. Fall back to the driving Follower component's zIndex, or
    // the connecting rod silently never renders (driveZIndex stays
    // undefined) no matter what showConnectingRod says.
    const driveZIndex =
      assembly.joints[figure.attachJointId]?.zIndex ??
      Object.values(assembly.components).find((c) => isFollower(c) && c.outputJointId === figure.attachJointId)?.zIndex;
    const world = add(add(attach, rotate(figure.localOffset, angle)), elevation);
    return { world, angle, driveZIndex, driveWorld: attach };
  }

  return null;
}

/** A dowel spanning from the driving joint/component's actual solved scene
 *  position to wherever this figure ends up (after local offset and
 *  elevation) - the visible push-rod, oriented along whatever direction
 *  that gap actually runs in 3D (usually mostly +Y now that figures carry
 *  real elevation, occasionally also spanning a zIndex layer change). */
function buildConnectingRod(a: [number, number, number], b: [number, number, number]) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const delta = end.clone().sub(start);
  const length = delta.length();
  const center = start.clone().add(end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  return {
    center: center.toArray() as [number, number, number],
    quaternion,
    length: Math.max(length, mmToUnits(1)),
    radius: mmToUnits(2.5),
  };
}
