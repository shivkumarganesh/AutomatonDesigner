import type { AssemblyTree } from '../types/assembly';
import { extractAllParts, type PartOutline } from './partExtraction';

export interface NestedPart extends PartOutline {
  /** Translation applied to the part's local coordinates to place it on the sheet. */
  offset: { x: number; y: number };
}

/**
 * Simple deterministic shelf/row packing: place parts left to right, wrap
 * to a new row when the sheet width is exceeded. Not a bin-packing
 * optimizer (Phase 3's "nesting algorithm" could be much denser), but it's
 * correct - no overlaps - and legible, which matters more for a first
 * cuttable export than packing density.
 */
export function nestParts(parts: PartOutline[], sheetWidthMm: number, marginMm = 5): NestedPart[] {
  let cursorX = marginMm;
  let cursorY = marginMm;
  let rowHeight = 0;
  const nested: NestedPart[] = [];

  for (const part of parts) {
    const w = part.bbox.maxX - part.bbox.minX;
    const h = part.bbox.maxY - part.bbox.minY;
    if (cursorX > marginMm && cursorX + w + marginMm > sheetWidthMm) {
      cursorX = marginMm;
      cursorY += rowHeight + marginMm;
      rowHeight = 0;
    }
    nested.push({ ...part, offset: { x: cursorX - part.bbox.minX, y: cursorY - part.bbox.minY } });
    cursorX += w + marginMm;
    rowHeight = Math.max(rowHeight, h);
  }

  return nested;
}

export interface SvgExportResult {
  svg: string;
  partCount: number;
  sheetWidthMm: number;
  sheetHeightMm: number;
}

/**
 * Renders the assembly's parts as a laser-ready flat-pack SVG: red
 * (#FF0000) cut outlines/holes per Section 3 of the spec, blue (#0000FF)
 * part-id labels for assembly-guide correlation (Phase 4). Units are mm,
 * matched 1:1 to SVG user units via the viewBox, so the file opens at
 * true physical size in any vector editor or laser-cutter driver.
 */
export function generateSvgDocument(assembly: AssemblyTree): SvgExportResult {
  const parts = extractAllParts(assembly);
  const nested = nestParts(parts, assembly.canvasSize.width);

  const usedHeight = nested.reduce((max, p) => Math.max(max, p.offset.y + (p.bbox.maxY - p.bbox.minY)), 0) + 10;
  const sheetHeightMm = Math.max(assembly.canvasSize.height, usedHeight);
  const sheetWidthMm = assembly.canvasSize.width;

  const groups = nested
    .map((part) => {
      const holePaths = part.holes.map((h) => circleD(h.cx, h.cy, h.r)).join(' ');
      const labelX = (part.bbox.minX + part.bbox.maxX) / 2;
      const labelY = part.bbox.maxY + 3;
      return [
        `<g transform="translate(${fmt(part.offset.x)},${fmt(part.offset.y)})">`,
        `<path d="${part.outerPath} ${holePaths}" fill="none" stroke="#FF0000" stroke-width="0.15" fill-rule="evenodd"/>`,
        `<text x="${fmt(labelX)}" y="${fmt(labelY)}" font-size="3" fill="#0000FF" text-anchor="middle">${escapeXml(part.name)}</text>`,
        `</g>`,
      ].join('');
    })
    .join('\n');

  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidthMm}mm" height="${sheetHeightMm}mm" viewBox="0 0 ${sheetWidthMm} ${sheetHeightMm}">`,
    `<rect x="0" y="0" width="${sheetWidthMm}" height="${sheetHeightMm}" fill="#ffffff"/>`,
    groups,
    `</svg>`,
  ].join('\n');

  return { svg, partCount: nested.length, sheetWidthMm, sheetHeightMm };
}

function circleD(cx: number, cy: number, r: number): string {
  const left = cx - r;
  const right = cx + r;
  return `M ${fmt(left)},${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(right)},${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(left)},${fmt(cy)} Z`;
}

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
