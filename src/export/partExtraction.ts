import type { AssemblyTree } from '../types/assembly';
import type { Component } from '../types/component';
import { isCam, isFigure, isFollower, isGear, isLinkage } from '../types/component';
import type { KerfConfig } from '../types/material';
import { resolveOffset } from '../types/material';
import type { Point2D } from '../types/geometry';
import { add, normalize, scale } from '../types/geometry';
import { buildRoundedHullPath, circlePath } from '../geometry/roundedOutline';
import { generateGearOutline } from '../geometry/involute';
import { camProfileRadius } from '../geometry/cam';
import { buildWingOutline } from '../geometry/figureShapes';

/** Half-width of a laser-cut linkage bar, mm - matches the same constant
 *  LinkageMesh/collision.ts use for the 3D render and collision capsules,
 *  so the exported part is the same size as what the sandbox validated. */
const BAR_HALF_WIDTH_MM = 6;
/** Default pin/dowel hole radius, mm (a 5mm dowel). */
const PIN_HOLE_RADIUS_MM = 2.5;

export interface PartHole {
  cx: number;
  cy: number;
  r: number;
}

export interface PartOutline {
  componentId: string;
  name: string;
  zIndex: number;
  /** SVG path 'd' for the outer silhouette, in the part's own local mm frame. */
  outerPath: string;
  holes: PartHole[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

function effectiveKerf(component: Component, assembly: AssemblyTree): KerfConfig {
  const override = component.material.kerf;
  return override ? { ...assembly.kerf, ...override } : assembly.kerf;
}

function bboxOf(points: Point2D[], pad: number): PartOutline['bbox'] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs) - pad, minY: Math.min(...ys) - pad, maxX: Math.max(...xs) + pad, maxY: Math.max(...ys) + pad };
}

/**
 * Extracts a component's static, unposed flat-pattern outline for laser
 * cutting - always the part's own reference geometry, independent of
 * whatever pose the sandbox is currently animating. Returns null for
 * components with no cuttable 2D representation (none currently, but kept
 * as an escape hatch for future component kinds).
 */
export function extractPartOutline(component: Component, assembly: AssemblyTree): PartOutline | null {
  const kerf = effectiveKerf(component, assembly);

  if (isLinkage(component)) {
    const points = component.points.map((p) => p.local);
    if (points.length === 0) return null;
    const radius = BAR_HALF_WIDTH_MM + resolveOffset(component.fit, 'outer', kerf);
    const outerPath = buildRoundedHullPath(points, radius);
    const holeRadius = PIN_HOLE_RADIUS_MM + resolveOffset(component.fit, 'inner', kerf);
    const holes = points.map((p) => ({ cx: p.x, cy: p.y, r: holeRadius }));
    return {
      componentId: component.id,
      name: component.name,
      zIndex: component.zIndex,
      outerPath,
      holes,
      bbox: bboxOf(points, radius),
    };
  }

  if (isGear(component)) {
    const outline = generateGearOutline(component.params, { samplesPerFlank: 6 });
    const offset = resolveOffset(component.fit, 'outer', kerf);
    const grown = outline.map((p) => add(p, scale(normalize(p), offset)));
    const boreRadius = component.params.boreDiameter / 2 + resolveOffset(component.fit, 'inner', kerf);
    return {
      componentId: component.id,
      name: component.name,
      zIndex: component.zIndex,
      outerPath: polylinePath(grown),
      holes: [{ cx: 0, cy: 0, r: boreRadius }],
      bbox: bboxOf(grown, 0),
    };
  }

  if (isCam(component)) {
    const samples = 96;
    const outline: Point2D[] = [];
    for (let i = 0; i < samples; i++) {
      const phi = (i / samples) * Math.PI * 2;
      const r = camProfileRadius(component.profile, phi);
      outline.push({ x: r * Math.cos(phi), y: r * Math.sin(phi) });
    }
    const offset = resolveOffset(component.fit, 'outer', kerf);
    const grown = outline.map((p) => add(p, scale(normalize(p), offset)));
    const boreRadius = 4 + resolveOffset(component.fit, 'inner', kerf);
    return {
      componentId: component.id,
      name: component.name,
      zIndex: component.zIndex,
      outerPath: polylinePath(grown),
      holes: [{ cx: 0, cy: 0, r: boreRadius }],
      bbox: bboxOf(grown, 0),
    };
  }

  if (isFollower(component)) {
    const radius = component.rollerRadius + resolveOffset(component.fit, 'outer', kerf);
    const rodEnd: Point2D = { x: 0, y: 20 };
    const outerPath = buildRoundedHullPath([{ x: 0, y: 0 }, rodEnd], radius);
    return {
      componentId: component.id,
      name: component.name,
      zIndex: component.zIndex,
      outerPath,
      holes: [],
      bbox: bboxOf([{ x: 0, y: 0 }, rodEnd], radius),
    };
  }

  if (isFigure(component)) {
    if (component.shape === 'wing' || component.shape === 'pinwheel') {
      // A 'pinwheel' Figure renders as several rotated copies of this same
      // blade in the 3D sandbox (see FigureMesh.tsx) - exported once here
      // as a single cuttable blade; the assembly guide (Phase 4) is where
      // "cut N of these" gets called out, not the part sheet itself.
      const outline = buildWingOutline(component.scale);
      return {
        componentId: component.id,
        name: component.name,
        zIndex: component.zIndex,
        outerPath: polylinePath(outline),
        holes: [],
        bbox: bboxOf(outline, 0),
      };
    }
    // bird-head/sphere/disc: a plain circle silhouette is a reasonable
    // flat-pattern stand-in for a modeled 3D shape.
    const r = component.scale;
    return {
      componentId: component.id,
      name: component.name,
      zIndex: component.zIndex,
      outerPath: circlePath({ x: 0, y: 0 }, r),
      holes: [],
      bbox: { minX: -r, minY: -r, maxX: r, maxY: r },
    };
  }

  return null;
}

function polylinePath(points: Point2D[]): string {
  if (points.length === 0) return '';
  return `M ${points.map((p) => `${round(p.x)},${round(p.y)}`).join(' L ')} Z`;
}

function round(n: number): string {
  return Number(n.toFixed(3)).toString();
}

export function extractAllParts(assembly: AssemblyTree): PartOutline[] {
  return Object.values(assembly.components)
    .map((c) => extractPartOutline(c, assembly))
    .filter((p): p is PartOutline => p !== null);
}
