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
  const outline = useMemo(() => generateGearOutline(gear.params, { samplesPerFlank: 6 }), [gear.params]);

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    outline.forEach((p, i) => (i === 0 ? shape.moveTo(p.x * mmToUnits(1), p.y * mmToUnits(1)) : shape.lineTo(p.x * mmToUnits(1), p.y * mmToUnits(1))));
    shape.closePath();

    const boreRadius = mmToUnits(gear.params.boreDiameter / 2);
    const bore = new THREE.Path();
    bore.absarc(0, 0, boreRadius, 0, Math.PI * 2, false);
    shape.holes.push(bore);

    const depth = mmToUnits(gear.params.faceWidth ?? gear.material.thickness);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    geo.center();
    return geo;
  }, [outline, gear.params.boreDiameter, gear.params.faceWidth, gear.material.thickness]);

  const position = toScenePosition(pivot, gear.zIndex);

  return (
    <mesh position={position} rotation={[0, 0, rotation]} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={highlighted ? '#ff2222' : gear.color ?? '#e9c46a'}
        emissive={highlighted ? '#660000' : '#000000'}
        metalness={0.1}
        roughness={0.6}
      />
    </mesh>
  );
}

export const GEAR_PLANE_SPACING = Z_PLANE_SPACING_MM;
