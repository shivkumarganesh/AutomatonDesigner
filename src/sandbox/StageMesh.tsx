import type { StageConfig } from '../types/assembly';
import type { Point2D } from '../types/geometry';
import { mmToUnits, toScenePosition } from './scene';

interface StageMeshProps {
  stage: StageConfig;
  crankPivot: Point2D;
  theta: number;
}

/**
 * The base every automaton hides its mechanism in, plus the hand crank a
 * viewer actually turns. Rendered translucent (rather than a fully opaque
 * enclosure) so the mechanism inside stays visible for the simulator's own
 * purpose - this is presentation only, it never participates in the solver.
 */
export function StageMesh({ stage, crankPivot, theta }: StageMeshProps) {
  const platformTopZ = -mmToUnits(10);
  const platformCenter = toScenePosition(stage.originMm, 0);

  const armLength = mmToUnits(stage.crankHandleLengthMm);
  const armDir: Point2D = { x: Math.cos(theta), y: Math.sin(theta) };
  const shaftPos = toScenePosition(crankPivot, 0);
  const armTip: [number, number, number] = [
    shaftPos[0] + armDir.x * armLength,
    shaftPos[1] + armDir.y * armLength,
    shaftPos[2],
  ];
  const armMid: [number, number, number] = [
    (shaftPos[0] + armTip[0]) / 2,
    (shaftPos[1] + armTip[1]) / 2,
    shaftPos[2],
  ];
  const armAngle = Math.atan2(armDir.y, armDir.x);

  return (
    <group>
      {/* base platform */}
      <mesh position={[platformCenter[0], platformCenter[1], platformTopZ - mmToUnits(stage.heightMm) / 2]} receiveShadow castShadow>
        <boxGeometry args={[mmToUnits(stage.widthMm), mmToUnits(stage.depthMm), mmToUnits(stage.heightMm)]} />
        <meshStandardMaterial color="#5b4636" roughness={0.85} transparent opacity={0.55} />
      </mesh>

      {/* crank arm */}
      <mesh position={armMid} rotation={[0, 0, armAngle]} castShadow>
        <boxGeometry args={[armLength, mmToUnits(4), mmToUnits(4)]} />
        <meshStandardMaterial color="#1d1d1d" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* crank knob (what you actually grip) */}
      <mesh position={armTip} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[mmToUnits(4), mmToUnits(4), mmToUnits(14), 16]} />
        <meshStandardMaterial color="#c1440e" roughness={0.5} />
      </mesh>
    </group>
  );
}
