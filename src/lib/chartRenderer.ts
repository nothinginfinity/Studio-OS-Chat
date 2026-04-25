/**
 * chartRenderer.ts
 * Renders a ChartSpec onto an HTML <canvas> element using Chart.js (CDN-free,
 * bundled as a dev dependency). All rendering is synchronous and client-side.
 * No network calls are made.
 */

import {
  Chart,
  LineController, BarController, PieController, ScatterController,
  CategoryScale, LinearScale, TimeScale,
  PointElement, LineElement, BarElement, ArcElement,
  Tooltip, Legend,
  ChartConfiguration,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { ChartSpec } from './types';

// Register only the components we use to keep the bundle small.
Chart.register(
  LineController, BarController, PieController, ScatterController,
  CategoryScale, LinearScale, TimeScale,
  PointElement, LineElement, BarElement, ArcElement,
  Tooltip, Legend,
);

/** A small accessible colour palette (8 colours, WCAG AA contrast on white). */
const PALETTE = [
  '#4C72B0', '#DD8452', '#55A868', '#C44E52',
  '#8172B3', '#937860', '#DA8BC3', '#8C8C8C',
];

function colour(i: number): string {
  return PALETTE[i % PALETTE.length];
}

export interface RenderOptions {
  /** Width in CSS pixels (canvas will be drawn at 2× for retina). Default 640. */
  width?: number;
  /** Height in CSS pixels. Default 320. */
  height?: number;
}

/**
 * Renders `spec` onto `canvas` using the provided `rows` data.
 * Destroys any previous Chart instance attached to the canvas.
 *
 * @param canvas  The <canvas> element to draw into.
 * @param spec    The ChartSpec describing chart type, keys, title.
 * @param rows    All CSV rows as Record<string, string>.
 * @param opts    Optional width/height overrides.
 * @returns       The Chart instance (caller can call .destroy() when unmounting).
 */
export function renderChart(
  canvas: HTMLCanvasElement,
  spec: ChartSpec,
  rows: Record<string, string>[],
  opts: RenderOptions = {},
): Chart {
  // Destroy any existing chart on this canvas to avoid Chart.js warnings.
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();

  const { width = 640, height = 320 } = opts;
  canvas.width  = width  * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  canvas.style.width  = `${width}px`;
  canvas.style.height = `${height}px`;

  const config = buildConfig(spec, rows);
  return new Chart(canvas, config);
}

// ── Config builders ───────────────────────────────────────────────────────────

function buildConfig(
  spec: ChartSpec,
  rows: Record<string, string>[],
): ChartConfiguration {
  switch (spec.type) {
    case 'line':    return buildLineConfig(spec, rows);
    case 'bar':     return buildBarConfig(spec, rows);
    case 'pie':     return buildPieConfig(spec, rows);
    case 'scatter': return buildScatterConfig(spec, rows);
  }
}

function buildLineConfig(
  spec: ChartSpec,
  rows: Record<string, string>[],
): ChartConfiguration<'line'> {
  const labels = rows.map(r => r[spec.xKey] ?? '');
  const datasets = spec.yKeys.map((key, i) => ({
    label: key,
    data: rows.map(r => {
      const v = parseFloat((r[key] ?? '').replace(/[$,]/g, ''));
      return isNaN(v) ? null : v;
    }),
    borderColor:     colour(i),
    backgroundColor: colour(i) + '33',
    tension: 0.3,
    spanGaps: true,
  }));
  return {
    type: 'line',
    data: { labels, datasets },
    options: baseOptions(spec.title),
  };
}

function buildBarConfig(
  spec: ChartSpec,
  rows: Record<string, string>[],
): ChartConfiguration<'bar'> {
  // Aggregate: sum yKey per category in xKey.
  const agg: Record<string, number> = {};
  for (const row of rows) {
    const cat = (row[spec.xKey] ?? '').trim() || '(blank)';
    const val = parseFloat((row[spec.yKeys[0]] ?? '').replace(/[$,]/g, ''));
    if (!isNaN(val)) agg[cat] = (agg[cat] ?? 0) + val;
  }
  const labels  = Object.keys(agg);
  const data    = Object.values(agg);
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label:           spec.yKeys[0],
        data,
        backgroundColor: labels.map((_, i) => colour(i)),
      }],
    },
    options: baseOptions(spec.title),
  };
}

function buildPieConfig(
  spec: ChartSpec,
  rows: Record<string, string>[],
): ChartConfiguration<'pie'> {
  const agg: Record<string, number> = {};
  for (const row of rows) {
    const cat = (row[spec.xKey] ?? '').trim() || '(blank)';
    const val = parseFloat((row[spec.yKeys[0]] ?? '').replace(/[$,]/g, ''));
    if (!isNaN(val)) agg[cat] = (agg[cat] ?? 0) + val;
  }
  const labels  = Object.keys(agg);
  const data    = Object.values(agg);
  return {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map((_, i) => colour(i)),
      }],
    },
    options: {
      plugins: {
        title:  { display: true, text: spec.title },
        legend: { position: 'right' },
      },
      responsive: true,
      maintainAspectRatio: false,
    },
  };
}

function buildScatterConfig(
  spec: ChartSpec,
  rows: Record<string, string>[],
): ChartConfiguration<'scatter'> {
  const data = rows
    .map(r => ({
      x: parseFloat((r[spec.xKey]        ?? '').replace(/[$,]/g, '')),
      y: parseFloat((r[spec.yKeys[0]]    ?? '').replace(/[$,]/g, '')),
    }))
    .filter(p => !isNaN(p.x) && !isNaN(p.y));
  return {
    type: 'scatter',
    data: {
      datasets: [{
        label:           `${spec.yKeys[0]} vs ${spec.xKey}`,
        data,
        backgroundColor: colour(0),
      }],
    },
    options: {
      ...baseOptions(spec.title),
      scales: {
        x: { title: { display: true, text: spec.xKey } },
        y: { title: { display: true, text: spec.yKeys[0] } },
      },
    } as ChartConfiguration<'scatter'>['options'],
  };
}

function baseOptions(title: string): ChartConfiguration['options'] {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title:  { display: true, text: title },
      legend: { position: 'top' },
    },
  };
}
