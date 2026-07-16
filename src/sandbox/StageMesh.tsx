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
 * The base every real automaton stands on. Reference photos (dowel-cam
 * birds, cranked cats, sailboats-in-a-box) are unanimous: it's an
 * *open-frame* box - a thin top lid, a thin bottom floor, four corner
 * posts, open front and sides - not a sealed enclosure. The mechanism is
 * proudly visible through the frame; only the top lid separates the
 * gears/cams from the performer riding on top of it. 'mechanism' view
 * drops the frame for a translucent base platform, better suited to
 * reading joint/collision highlights for validation. Presentation only,
 * never participates in the solver.
 */
export function StageMesh({ stage, crankPivot, theta, viewMode }: StageMeshProps) {
  const isToy = viewMode === 'toy';
  const woodColor = '#d9b98a';
  const postColor = '#b98f56';

  const baseZ = -mmToUnits(6);
  const enclosureTopZ = (stage.enclosureTopZIndex + 0.5) * Z_PLANE_SPACING_MM * mmToUnits(1);
  const depthZ = enclosureTopZ - baseZ;
  const midZ = (baseZ + enclosureTopZ) / 2;

  const center = toScenePosition(stage.originMm, 0);
  const cx = center[0];
  const cy = center[1];
  const xHalf = mmToUnits(stage.widthMm) / 2;
  const yHalf = mmToUnits(stage.depthMm) / 2;
  const lidThickness = mmToUnits(4);
  const postThickness = mmToUnits(5);

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

  const corners: [number, number][] = [
    [cx - xHalf, baseZ],
    [cx + xHalf, baseZ],
    [cx - xHalf, enclosureTopZ],
    [cx + xHalf, enclosureTopZ],
  ];

  return (
    <group>
      {isToy ? (
        <>
          {/* bottom floor + top lid - thin horizontal shelves the corner
              posts hang between; the performer stands on the lid, the
              mechanism lives visibly in the open gap beneath it */}
          <mesh position={[cx, cy - yHalf, midZ]} receiveShadow castShadow>
            <boxGeometry args={[xHalf * 2, lidThickness, depthZ]} />
            <meshStandardMaterial color={woodColor} roughness={0.8} />
          </mesh>
          <mesh position={[cx, cy + yHalf, midZ]} receiveShadow castShadow>
            <boxGeometry args={[xHalf * 2, lidThickness, depthZ]} />
            <meshStandardMaterial color={woodColor} roughness={0.8} />
          </mesh>
          {corners.map(([px, pz], i) => (
            <mesh key={i} position={[px, cy, pz]} receiveShadow castShadow>
              <boxGeometry args={[postThickness, yHalf * 2, postThickness]} />
              <meshStandardMaterial color={postColor} roughness={0.8} />
            </mesh>
          ))}
          {/* through-tenon pegs at every post/lid junction - the joinery
              detail every reference box shows (pegs or notches poking past
              the corner) that a bare mitred frame doesn't have */}
          {corners.map(([px, pz], i) => (
            <group key={`tenon-${i}`}>
              <mesh position={[px, cy - yHalf - lidThickness / 2 - mmToUnits(1), pz]} castShadow>
                <boxGeometry args={[postThickness * 0.6, mmToUnits(2), postThickness * 0.6]} />
                <meshStandardMaterial color={postColor} roughness={0.8} />
              </mesh>
              <mesh position={[px, cy + yHalf + lidThickness / 2 + mmToUnits(1), pz]} castShadow>
                <boxGeometry args={[postThickness * 0.6, mmToUnits(2), postThickness * 0.6]} />
                <meshStandardMaterial color={postColor} roughness={0.8} />
              </mesh>
            </group>
          ))}
        </>
      ) : (
        <mesh position={[cx, cy, midZ]} receiveShadow castShadow>
          <boxGeometry args={[xHalf * 2, yHalf * 2, mmToUnits(2)]} />
          <meshStandardMaterial color={woodColor} roughness={0.85} transparent opacity={0.35} />
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
