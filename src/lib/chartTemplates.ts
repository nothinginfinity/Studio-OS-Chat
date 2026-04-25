/**
 * chartTemplates.ts
 * Analyses a CsvMeta and returns 0–3 ChartSpec objects using pure local logic.
 * Zero network calls. Zero LLM cost. All charts are marked source: 'template'.
 */

import { ColumnMeta, CsvMeta, ChartSpec, ChartType } from './types';

/** Fraction of rows a single category may occupy before pie is suppressed (monopoly guard). */
const PIE_MONOPOLY_THRESHOLD = 0.8;

/** Max unique categories allowed for a pie chart. */
const PIE_MAX_CATEGORIES = 8;

/**
 * Generates a stable deterministic id for a chart spec so the same CSV always
 * produces the same id and IndexedDB upserts are idempotent.
 */
function makeId(fileId: string, index: number): string {
  return `chart-tpl-${fileId}-${index}`;
}

/**
 * Checks whether a string column has a monopoly category that would make a pie
 * chart misleading.
 * @param col   The string ColumnMeta to evaluate
 * @param rows  All data rows from the CSV
 */
function hasPieMonopoly(col: ColumnMeta, rows: Record<string, string>[]): boolean {
  if (rows.length === 0) return true;
  const freq: Record<string, number> = {};
  for (const row of rows) {
    const v = (row[col.name] ?? '').trim();
    if (v !== '') freq[v] = (freq[v] ?? 0) + 1;
  }
  const counts = Object.values(freq);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return true;
  const max = Math.max(...counts);
  return max / total > PIE_MONOPOLY_THRESHOLD;
}

/**
 * Returns up to 3 ChartSpec objects inferred from the given CsvMeta.
 * Pass the raw rows only if pie monopoly detection is needed (optional).
 */
export function inferChartSpecs(
  fileId: string,
  meta: CsvMeta,
  rows: Record<string, string>[] = [],
): ChartSpec[] {
  const specs: ChartSpec[] = [];
  const cols = meta.columns;

  const dateCols   = cols.filter(c => c.type === 'date');
  const numberCols = cols.filter(c => c.type === 'number');
  const stringCols = cols.filter(c => c.type === 'string');

  // ── Rule 1: date + number → line chart ────────────────────────────────────
  if (dateCols.length >= 1 && numberCols.length >= 1) {
    const xKey  = dateCols[0].name;
    // Up to 3 y-series to avoid visual clutter
    const yKeys = numberCols.slice(0, 3).map(c => c.name);
    specs.push({
      id:     makeId(fileId, specs.length),
      type:   'line' as ChartType,
      title:  `${yKeys[0]} over ${xKey}`,
      xKey,
      yKeys,
      source: 'template',
    });
  }

  // ── Rule 2: string + number → bar chart ───────────────────────────────────
  if (stringCols.length >= 1 && numberCols.length >= 1) {
    const xKey  = stringCols[0].name;
    const yKeys = [numberCols[0].name];
    specs.push({
      id:     makeId(fileId, specs.length),
      type:   'bar' as ChartType,
      title:  `${yKeys[0]} by ${xKey}`,
      xKey,
      yKeys,
      source: 'template',
    });
  }

  // ── Rule 3: string + number → pie (if ≤8 categories, no monopoly) ─────────
  // Only add pie when we haven't already emitted a bar for the same xKey,
  // or when there is a second string column suitable for categorisation.
  if (stringCols.length >= 1 && numberCols.length >= 1 && specs.length < 3) {
    // Try each string column until we find one that passes the pie guard.
    for (const strCol of stringCols) {
      const uniqueValues = new Set(
        rows.map(r => (r[strCol.name] ?? '').trim()).filter(Boolean),
      );
      const uniqueCount = rows.length > 0 ? uniqueValues.size : strCol.sample.length;
      if (
        uniqueCount > 0 &&
        uniqueCount <= PIE_MAX_CATEGORIES &&
        !hasPieMonopoly(strCol, rows)
      ) {
        const xKey  = strCol.name;
        const yKeys = [numberCols[0].name];
        // Skip if we already have a bar with the exact same xKey+yKey
        const duplicate = specs.some(
          s => s.type === 'bar' && s.xKey === xKey && s.yKeys[0] === yKeys[0],
        );
        if (!duplicate) {
          specs.push({
            id:     makeId(fileId, specs.length),
            type:   'pie' as ChartType,
            title:  `${yKeys[0]} share by ${xKey}`,
            xKey,
            yKeys,
            source: 'template',
          });
        }
        break;
      }
    }
  }

  // ── Rule 4: two number columns → scatter ──────────────────────────────────
  if (numberCols.length >= 2 && specs.length < 3) {
    const xKey  = numberCols[0].name;
    const yKeys = [numberCols[1].name];
    specs.push({
      id:     makeId(fileId, specs.length),
      type:   'scatter' as ChartType,
      title:  `${yKeys[0]} vs ${xKey}`,
      xKey,
      yKeys,
      source: 'template',
    });
  }

  return specs.slice(0, 3);
}
