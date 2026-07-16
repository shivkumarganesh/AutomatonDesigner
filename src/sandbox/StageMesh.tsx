import type { StageConfig, ViewMode } from '../types/assembly';
import type { Point2D } from '../types/geometry';
import { mmToUnits, toScenePosition, Z_PLANE_SPACING_MM } from './scene';

interface StageMeshProps {
  stage: StageConfig;
  crankPivot: Point2D;
  theta: number;
  viewMode: ViewMode;
}

/**
 * The base every automaton hides its mechanism in, plus the hand crank a
 * viewer actually turns. In 'mechanism' view the box is just a translucent
 * base platform so the drive train stays visible for validation; in 'toy'
 * view it's a proper opaque enclosure (base + top panel) hiding everything
 * at or below `enclosureTopZIndex`, so only the crank and the performer(s)
 * riding above it are visible - what a finished automaton actually looks
 * like. Presentation only, never participates in the solver.
 */
export function StageMesh({ stage, crankPivot, theta, viewMode }: StageMeshProps) {
  const platformTopZ = -mmToUnits(10);
  const platformCenter = toScenePosition(stage.originMm, 0);

  const isToy = viewMode === 'toy';
  const boxColor = '#8a6642';
  const enclosureTopZ = (stage.enclosureTopZIndex + 0.5) * Z_PLANE_SPACING_MM * mmToUnits(1);
  const wallHeight = enclosureTopZ - platformTopZ;

  const armLength = mmToUnits(stage.crankHandleLengthMm);
  const armDir: Point2D = { x: Math.cos(theta), y: Math.sin(theta) };
  const shaftPosRaw = toScenePosition(crankPivot, 0);
  // The crank shaft's axle physically pokes through the box wall to the
  // outside where the handle lives - in 'toy' view, render it popped out in
  // front of the occlusion panel instead of at its true (hidden) zIndex
  // depth, or it would vanish behind the box like the rest of the drive
  // train instead of reading as the one part a viewer actually touches.
  const shaftPos: [number, number, number] = isToy
    ? [shaftPosRaw[0], shaftPosRaw[1], enclosureTopZ + mmToUnits(12)]
    : shaftPosRaw;
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
        <meshStandardMaterial color={boxColor} roughness={0.85} transparent={!isToy} opacity={isToy ? 1 : 0.55} />
      </mesh>

      {isToy && (
        <>
          {/* side walls - close the box so the drive train reads as hidden, not just topped */}
          <mesh position={[platformCenter[0], platformCenter[1] - mmToUnits(stage.depthMm) / 2, platformTopZ + wallHeight / 2]} receiveShadow castShadow>
            <boxGeometry args={[mmToUnits(stage.widthMm), mmToUnits(2), wallHeight]} />
            <meshStandardMaterial color={boxColor} roughness={0.85} />
          </mesh>
          <mesh position={[platformCenter[0], platformCenter[1] + mmToUnits(stage.depthMm) / 2, platformTopZ + wallHeight / 2]} receiveShadow castShadow>
            <boxGeometry args={[mmToUnits(stage.widthMm), mmToUnits(2), wallHeight]} />
            <meshStandardMaterial color={boxColor} roughness={0.85} />
          </mesh>
          <mesh position={[platformCenter[0] + mmToUnits(stage.widthMm) / 2, platformCenter[1], platformTopZ + wallHeight / 2]} receiveShadow castShadow>
            <boxGeometry args={[mmToUnits(2), mmToUnits(stage.depthMm), wallHeight]} />
            <meshStandardMaterial color={boxColor} roughness={0.85} />
          </mesh>
          {/* crank-side wall is left open so the shaft/handle reads as
              exiting the box rather than clipping through a solid panel */}

          {/* top panel - the main occlusion: hides every gear/cam/linkage
              at or below enclosureTopZIndex from the primary viewing angle */}
          <mesh position={[platformCenter[0], platformCenter[1], enclosureTopZ]} receiveShadow castShadow>
            <boxGeometry args={[mmToUnits(stage.widthMm), mmToUnits(stage.depthMm), mmToUnits(3)]} />
            <meshStandardMaterial color={boxColor} roughness={0.8} />
          </mesh>
        </>
      )}

      {/* axle stub - sells the "shaft pokes through the box wall" read */}
      {isToy && (
        <mesh
          position={[shaftPos[0], shaftPos[1], enclosureTopZ + mmToUnits(6)]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[mmToUnits(3), mmToUnits(3), mmToUnits(12), 12]} />
          <meshStandardMaterial color="#1d1d1d" metalness={0.5} roughness={0.4} />
        </mesh>
      )}

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
