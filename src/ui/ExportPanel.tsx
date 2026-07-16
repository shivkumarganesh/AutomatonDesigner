import { useState } from 'react';
import { useAssemblyStore } from '../store/assemblyStore';
import { generateSvgDocument } from '../export/svgExport';

/**
 * The other half of "select a toy, then get parts for it": walks the
 * current assembly's components into laser-ready SVG geometry (see
 * export/partExtraction.ts + export/svgExport.ts) and offers it as a
 * download - red cut lines, blue part-id labels, kerf/fit already
 * applied, sized to true mm via the SVG viewBox.
 */
export function ExportPanel() {
  const assembly = useAssemblyStore((s) => s.assembly);
  const [lastResult, setLastResult] = useState<{ partCount: number; sheetWidthMm: number; sheetHeightMm: number } | null>(null);

  const handleExport = () => {
    const result = generateSvgDocument(assembly);
    setLastResult(result);

    const blob = new Blob([result.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assembly.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-parts.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="export-panel">
      <h2>Export Parts</h2>
      <p className="hint">
        Every component's flat-cut outline, kerf and press-fit/clearance offsets already applied - red cut lines, blue part
        labels, true mm scale via the SVG viewBox.
      </p>
      <div className="control-row">
        <button onClick={handleExport}>Download SVG</button>
      </div>
      {lastResult && (
        <p className="solver-stats">
          {lastResult.partCount} parts nested on a {lastResult.sheetWidthMm}&times;{lastResult.sheetHeightMm}mm sheet.
        </p>
      )}
    </div>
  );
}
