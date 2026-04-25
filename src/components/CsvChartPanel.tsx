/**
 * CsvChartPanel.tsx
 * Renders auto-generated template charts below the table in FileViewerModal.
 * Each ChartSpec is rendered into its own <canvas> by chartRenderer.ts.
 * All rendering is local — zero network calls.
 */

import React, { useEffect, useRef } from 'react';
import { ChartSpec } from '../lib/types';
import { renderChart } from '../lib/chartRenderer';
import { Chart } from 'chart.js';

interface Props {
  specs: ChartSpec[];
  rows: Record<string, string>[];
}

/**
 * A single chart tile. Creates a Chart.js instance on mount and destroys it on
 * unmount so there are no memory leaks when the modal closes.
 */
const ChartTile: React.FC<{ spec: ChartSpec; rows: Record<string, string>[] }> = ({
  spec,
  rows,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = renderChart(canvasRef.current, spec, rows);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // Re-render only when the spec id or rows length changes — not on every
    // render cycle — to avoid Chart.js flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id, rows.length]);

  return (
    <div className="csv-chart-tile">
      <div className="csv-chart-type-badge">{spec.type}</div>
      <div className="csv-chart-canvas-wrapper">
        <canvas ref={canvasRef} aria-label={spec.title} role="img" />
      </div>
      <p className="csv-chart-source-label">
        Auto-generated · <span className="csv-chart-source">{spec.source}</span>
      </p>
    </div>
  );
};

/**
 * CsvChartPanel renders all ChartSpec tiles for a given CSV file.
 * Returns null when there are no specs to show.
 */
export const CsvChartPanel: React.FC<Props> = ({ specs, rows }) => {
  if (specs.length === 0) return null;

  return (
    <section className="csv-chart-panel" aria-label="Auto-generated charts">
      <h3 className="csv-chart-panel-heading">
        Charts
        <span className="csv-chart-panel-badge">{specs.length}</span>
      </h3>
      <div className="csv-chart-grid">
        {specs.map(spec => (
          <ChartTile key={spec.id} spec={spec} rows={rows} />
        ))}
      </div>
    </section>
  );
};

export default CsvChartPanel;
