import type { Follower } from '../types/component';
import type { Point2D } from '../types/geometry';
import { angleOf } from '../types/geometry';
import { mmToUnits, toScenePosition } from './scene';

interface FollowerMeshProps {
  follower: Follower;
  position: Point2D;
  highlighted?: boolean;
}

export function FollowerMesh({ follower, position, highlighted }: FollowerMeshProps) {
  const color = highlighted ? '#ff2222' : follower.color ?? '#6d597a';
  const thickness = mmToUnits(follower.material.thickness);
  const axisAngle = follower.axis ? angleOf(follower.axis) : 0;

  return (
    <group>
      <mesh position={toScenePosition(position, follower.zIndex)} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[mmToUnits(follower.rollerRadius), mmToUnits(follower.rollerRadius), thickness * 1.2, 20]} />
        <meshStandardMaterial color={color} emissive={highlighted ? '#660000' : '#000000'} metalness={0.2} roughness={0.5} />
      </mesh>
      {follower.axisAnchor && (
        <mesh
          position={toScenePosition(
            { x: (position.x + follower.axisAnchor.x) / 2, y: (position.y + follower.axisAnchor.y) / 2 },
            follower.zIndex,
          )}
          rotation={[0, 0, axisAngle]}
        >
          <boxGeometry
            args={[
              mmToUnits(Math.hypot(position.x - follower.axisAnchor.x, position.y - follower.axisAnchor.y)),
              mmToUnits(4),
              thickness,
            ]}
          />
          <meshStandardMaterial color={color} opacity={0.5} transparent />
        </mesh>
      )}
    </group>
  );
}
