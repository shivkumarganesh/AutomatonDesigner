import { useMemo } from 'react';
import * as THREE from 'three';
import type { Gear } from '../types/component';
import { generateGearOutline } from '../geometry/involute';
import { mmToUnits, toScenePosition, Z_PLANE_SPACING_MM } from './scene';
import type { Point2D } from '../types/geometry';

interface GearMeshProps {
  gear: Gear;
  pivot: Point2D;
  rotation: number;
  highlighted?: boolean;
}

export function GearMesh({ gear, pivot, rotation, highlighted }: GearMeshProps) {
  const isPulley = gear.visualStyle === 'pulley';
  const pitchRadiusMm = (gear.params.module * gear.params.teeth) / 2;

  const outline = useMemo(
    () => (isPulley ? null : generateGearOutline(gear.params, { samplesPerFlank: 6 })),
    [isPulley, gear.params],
  );

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    if (isPulley) {
      shape.absarc(0, 0, pitchRadiusMm * mmToUnits(1), 0, Math.PI * 2, false);
    } else if (outline) {
      outline.forEach((p, i) => (i === 0 ? shape.moveTo(p.x * mmToUnits(1), p.y * mmToUnits(1)) : shape.lineTo(p.x * mmToUnits(1), p.y * mmToUnits(1))));
      shape.closePath();
    }

    const boreRadius = mmToUnits(gear.params.boreDiameter / 2);
    const bore = new THREE.Path();
    bore.absarc(0, 0, boreRadius, 0, Math.PI * 2, false);
    shape.holes.push(bore);

    const depth = mmToUnits(gear.params.faceWidth ?? gear.material.thickness);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: isPulley ? 48 : 1 });
    geo.center();
    return geo;
  }, [isPulley, outline, pitchRadiusMm, gear.params.boreDiameter, gear.params.faceWidth, gear.material.thickness]);

  const position = toScenePosition(pivot, gear.zIndex);
  const faceDepth = mmToUnits(gear.params.faceWidth ?? gear.material.thickness);

  return (
    <group position={position} rotation={[0, 0, rotation]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={highlighted ? '#ff2222' : gear.color ?? '#e9c46a'}
          emissive={highlighted ? '#660000' : '#000000'}
          metalness={0.1}
          roughness={0.6}
        />
      </mesh>
      {isPulley && (
        <>
          {/* rim groove the belt rides in */}
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <torusGeometry args={[pitchRadiusMm * mmToUnits(1), mmToUnits(1.2), 8, 32]} />
            <meshStandardMaterial color="#2b2b2b" roughness={0.9} />
          </mesh>
          {/* radial spoke marker - a perfectly smooth disc gives no visual
              cue that it's turning, so paint one so rotation actually reads */}
          <mesh position={[0, 0, faceDepth / 2 + mmToUnits(0.6)]}>
            <boxGeometry args={[pitchRadiusMm * mmToUnits(1) * 0.9, mmToUnits(3), mmToUnits(1)]} />
            <meshStandardMaterial color="#2b2b2b" roughness={0.9} />
          </mesh>
        </>
      )}
    </group>
  );
}

export const GEAR_PLANE_SPACING = Z_PLANE_SPACING_MM;
