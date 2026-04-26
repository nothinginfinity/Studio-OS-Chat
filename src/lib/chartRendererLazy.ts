/**
 * chartRendererLazy.ts — Phase 5 A-2
 *
 * Tree-shakeable Chart.js registration.
 *
 * BEFORE (full bundle import, ~60 KB gzip):
 *   import Chart from 'chart.js/auto';
 *
 * AFTER (named ESM imports, registers only what we use, ~35–40 KB gzip):
 *   import { Chart, registerables, ... } from 'chart.js';
 *
 * We register only the four controller types actually used by CsvChartPanel
 * (Bar, Line, Pie, Scatter) plus the required Scale, Tooltip, Legend plugins.
 * This saves an estimated ~20–25 KB gzip on the initial bundle.
 *
 * Usage in CsvChartPanel.tsx:
 *   import { getRegisteredChart } from '../lib/chartRendererLazy';
 *   const Chart = await getRegisteredChart();
 *   const chart = new Chart(canvas, config);
 */

import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  PieController,
  ArcElement,
  ScatterController,
  CategoryScale,
  LinearScale,
  TimeScale,
  Filler,
  Legend,
  Tooltip,
  Title,
} from "chart.js";
import "chartjs-adapter-date-fns";

// Register only what we use — NOT Chart.register(...registerables)
Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  PieController,
  ArcElement,
  ScatterController,
  CategoryScale,
  LinearScale,
  TimeScale,
  Filler,
  Legend,
  Tooltip,
  Title
);

/**
 * Returns the Chart constructor with all required controllers registered.
 * Import via this function so tree-shaking is preserved.
 */
export function getRegisteredChart(): typeof Chart {
  return Chart;
}

export { Chart };
