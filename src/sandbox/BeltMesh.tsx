import type { Point2D } from '../types/geometry';
import { computeBeltTangents } from '../geometry/belt';
import { mmToUnits, toScenePosition } from './scene';

interface BeltMeshProps {
  c1: Point2D;
  r1: number;
  c2: Point2D;
  r2: number;
  zIndex: number;
  color?: string;
}

/** The two straight belt runs between a pulley pair - see geometry/belt.ts. */
export function BeltMesh({ c1, r1, c2, r2, zIndex, color = '#3a3a3a' }: BeltMeshProps) {
  const { top, bottom } = computeBeltTangents(c1, r1, c2, r2);
  return (
    <>
      {[top, bottom].map((line, i) => {
        const [a, b] = line;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const mid: Point2D = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const pos = toScenePosition(mid, zIndex);
        return (
          <mesh key={i} position={[pos[0], pos[1], pos[2] + mmToUnits(2)]} rotation={[0, 0, angle]} castShadow>
            <boxGeometry args={[mmToUnits(length), mmToUnits(3), mmToUnits(1.5)]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        );
      })}
    </>
  );
}
