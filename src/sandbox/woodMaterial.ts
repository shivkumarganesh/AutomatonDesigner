import * as THREE from 'three';

/**
 * Procedural wood-grain texture: a canvas with subtle bezier grain streaks
 * and a few darker knots painted over a flat base color, cached per color
 * so repeated calls (many box panels, many gears) don't regenerate canvases
 * every render. A flat MeshStandardMaterial color reads as painted plastic;
 * this is the cheapest way to make a procedurally-rendered box read as
 * actual sheet material instead. Falls back to a flat-color material where
 * canvas isn't available.
 */
const woodTextureCache = new Map<string, THREE.CanvasTexture | null>();

function buildWoodTexture(hex: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 60; i++) {
    const y = Math.random() * 256;
    ctx.strokeStyle = `rgba(58, 32, 8, ${(0.03 + Math.random() * 0.06).toFixed(3)})`;
    ctx.lineWidth = 0.6 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y + Math.random() * 10 - 5, 176, y + Math.random() * 10 - 5, 256, y + Math.random() * 7 - 3.5);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = 'rgba(58, 32, 8, 0.06)';
    ctx.beginPath();
    ctx.ellipse(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 5, 1.5 + Math.random() * 2.5, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function woodTexture(hex: string): THREE.CanvasTexture | null {
  if (!woodTextureCache.has(hex)) {
    woodTextureCache.set(hex, buildWoodTexture(hex));
  }
  return woodTextureCache.get(hex) ?? null;
}

export interface WoodMaterialProps {
  color: string;
  roughness?: number;
  repeat?: [number, number];
}

/** Props for a <meshStandardMaterial> that renders `color` with procedural
 *  grain when a canvas texture is available, or falls back to flat color. */
export function woodMaterialProps({ color, roughness = 0.8, repeat }: WoodMaterialProps) {
  const tex = woodTexture(color);
  if (!tex) return { color, roughness, metalness: 0.03 };
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  return { color: '#ffffff', map: tex, roughness, metalness: 0.03 };
}
