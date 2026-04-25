/**
 * InlineCsvChart.tsx
 * Renders a single LLM-emitted ChartSpec inline inside a chat message bubble.
 * Reuses renderChart() from chartRenderer.ts. Destroys the Chart instance on unmount.
 */
import { useEffect, useRef } from 'react';
import type { ChartSpec } from '../lib/types';
import { renderChart } from '../lib/chartRenderer';
import { Chart } from 'chart.js';

interface Props {
  spec: ChartSpec;
  rows: Record<string, string>[];
}

export function InlineCsvChart({ spec, rows }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || rows.length === 0) return;
    chartRef.current = renderChart(canvasRef.current, spec, rows);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id, rows.length]);

  return (
    <div className="inline-chart-tile" role="img" aria-label={spec.title}>
      <div className="inline-chart-header">
        <span className="inline-chart-title">{spec.title}</span>
        <span className="inline-chart-badge">{spec.type} · LLM</span>
      </div>
      <div className="csv-chart-canvas-wrapper">
        <canvas ref={canvasRef} aria-label={spec.title} />
      </div>
    </div>
  );
}
