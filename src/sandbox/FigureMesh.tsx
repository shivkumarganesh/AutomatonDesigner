import { useMemo } from 'react';
import * as THREE from 'three';
import type { Figure } from '../types/component';
import type { Point2D } from '../types/geometry';
import { add, angleOf, rotate, sub } from '../types/geometry';
import { mmToUnits, toScenePosition } from './scene';

interface FigureMeshProps {
  figure: Figure;
  positions: Record<string, Point2D>;
  highlighted?: boolean;
}

/**
 * Renders the one part of the design that actually makes it "an automaton"
 * rather than a bare mechanism: a decorative performer glued to whichever
 * joint is driving it, inheriting that joint's already-solved motion.
 */
export function FigureMesh({ figure, positions, highlighted }: FigureMeshProps) {
  const attach = positions[figure.attachJointId];
  const orientationTarget = figure.orientationJointId ? positions[figure.orientationJointId] : undefined;

  const wingOutline = useMemo(() => buildWingOutline(figure.scale), [figure.scale]);
  const wingGeometry = useMemo(() => {
    if (figure.shape !== 'wing') return null;
    const shape = new THREE.Shape();
    wingOutline.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
    shape.closePath();
    const depth = mmToUnits(figure.material.thickness);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    return geo;
  }, [wingOutline, figure.shape, figure.material.thickness]);

  if (!attach) return null;

  const angle = orientationTarget ? angleOf(sub(orientationTarget, attach)) : 0;
  const world = add(attach, rotate(figure.localOffset, angle));
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

  const r = mmToUnits(figure.scale);
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[r, 16, 12]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
}

/** A simple leaf/teardrop wing silhouette, root at the origin pointing +X,
 *  in local mm before extrusion - deliberately a flat laser-cuttable shape
 *  like the rest of the mechanism, not a modeled feather. */
function buildWingOutline(scale: number): Point2D[] {
  const len = scale;
  const w = scale * 0.55;
  const pts: Point2D[] = [];
  const segments = 16;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = t * len;
    const envelope = Math.sin(Math.PI * t) ** 0.6;
    const y = w * envelope * (1 - t * 0.3);
    pts.push({ x: mmToUnits(x), y: mmToUnits(y) });
  }
  for (let i = segments; i >= 0; i--) {
    const t = i / segments;
    const x = t * len;
    const envelope = Math.sin(Math.PI * t) ** 0.6;
    const y = -w * 0.5 * envelope * (1 - t * 0.3);
    pts.push({ x: mmToUnits(x), y: mmToUnits(y) });
  }
  return pts;
}
