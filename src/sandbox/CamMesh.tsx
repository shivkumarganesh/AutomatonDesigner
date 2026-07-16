import { useMemo } from 'react';
import * as THREE from 'three';
import type { Cam } from '../types/component';
import { camProfileRadius } from '../geometry/cam';
import { mmToUnits, toScenePosition } from './scene';
import type { Point2D } from '../types/geometry';

interface CamMeshProps {
  cam: Cam;
  pivot: Point2D;
  rotation: number;
  highlighted?: boolean;
}

const SAMPLES = 96;

export function CamMesh({ cam, pivot, rotation, highlighted }: CamMeshProps) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    for (let i = 0; i <= SAMPLES; i++) {
      const phi = (i / SAMPLES) * Math.PI * 2;
      const r = mmToUnits(camProfileRadius(cam.profile, phi));
      const x = r * Math.cos(phi);
      const y = r * Math.sin(phi);
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();

    const boreRadius = mmToUnits(4);
    const bore = new THREE.Path();
    bore.absarc(0, 0, boreRadius, 0, Math.PI * 2, false);
    shape.holes.push(bore);

    const depth = mmToUnits(cam.material.thickness);
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    geo.center();
    return geo;
  }, [cam.profile, cam.material.thickness]);

  const position = toScenePosition(pivot, cam.zIndex);

  return (
    <mesh position={position} rotation={[0, 0, rotation]} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={highlighted ? '#ff2222' : cam.color ?? '#8d99ae'} emissive={highlighted ? '#660000' : '#000000'} metalness={0.1} roughness={0.6} />
    </mesh>
  );
}
