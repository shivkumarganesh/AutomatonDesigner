import type { Linkage } from '../types/component';
import type { Point2D } from '../types/geometry';
import { angleOf, distance, sub } from '../types/geometry';
import { mmToUnits, toScenePosition } from './scene';

interface LinkageMeshProps {
  linkage: Linkage;
  positions: Record<string, Point2D>;
  highlighted?: boolean;
}

const BAR_WIDTH_MM = 12;
const PIN_RADIUS_MM = 3;

export function LinkageMesh({ linkage, positions, highlighted }: LinkageMeshProps) {
  const pts = linkage.points.map((p) => positions[p.jointId]).filter((p): p is Point2D => !!p);
  if (pts.length < 2) return null;

  const color = highlighted ? '#ff2222' : linkage.color ?? '#457b9d';
  const emissive = highlighted ? '#660000' : '#000000';
  const thickness = mmToUnits(linkage.material.thickness);

  return (
    <group>
      {pts.slice(0, -1).map((p0, i) => {
        const p1 = pts[i + 1];
        const mid: Point2D = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const len = distance(p0, p1);
        const angle = angleOf(sub(p1, p0));
        return (
          <mesh key={i} position={toScenePosition(mid, linkage.zIndex)} rotation={[0, 0, angle]} castShadow receiveShadow>
            <boxGeometry args={[mmToUnits(len), mmToUnits(BAR_WIDTH_MM), thickness]} />
            <meshStandardMaterial color={color} emissive={emissive} metalness={0.1} roughness={0.7} />
          </mesh>
        );
      })}
      {pts.map((p, i) => (
        <mesh key={`pin-${i}`} position={toScenePosition(p, linkage.zIndex)} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[mmToUnits(PIN_RADIUS_MM), mmToUnits(PIN_RADIUS_MM), thickness * 1.5, 16]} />
          <meshStandardMaterial color="#1d1d1d" metalness={0.6} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}
