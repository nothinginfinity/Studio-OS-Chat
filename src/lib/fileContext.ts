/**
 * fileContext.ts — Task 4.1
 *
 * Builds a compact, LLM-ready context string from a FileRecord's csvMeta
 * and a stratified row sample (beginning + middle + end, not naive first-N).
 *
 * The returned string is designed to be prepended to the LLM system or user
 * message when a chat session has an attachedFileId pointing to a CSV file.
 */

import type { FileRecord, ColumnMeta } from './types';

// ---------------------------------------------------------------------------
// Stratified sampler
// ---------------------------------------------------------------------------

/**
 * Pick `n` rows distributed across beginning, middle, and end of `rows`.
 * Distribution: ~40% beginning, ~20% middle, ~40% end (minimum 1 each band
 * when n >= 3). When `rows.length <= n` all rows are returned as-is.
 */
export function stratifiedSample(
  rows: Record<string, string>[],
  n: number,
): Record<string, string>[] {
  if (rows.length <= n) return rows;
  if (n <= 0) return [];

  const total = rows.length;

  // Band sizes
  const nBegin = Math.max(1, Math.round(n * 0.4));
  const nEnd   = Math.max(1, Math.round(n * 0.4));
  const nMid   = Math.max(0, n - nBegin - nEnd);

  const result: Record<string, string>[] = [];

  // Beginning
  for (let i = 0; i < nBegin; i++) {
    result.push(rows[i]);
  }

  // Middle
  if (nMid > 0) {
    const midStart = Math.floor((total - nMid) / 2);
    for (let i = 0; i < nMid; i++) {
      result.push(rows[midStart + i]);
    }
  }

  // End
  const endStart = total - nEnd;
  for (let i = 0; i < nEnd; i++) {
    result.push(rows[endStart + i]);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Markdown table renderer
// ---------------------------------------------------------------------------

function mdTable(
  columns: ColumnMeta[],
  rows: Record<string, string>[],
): string {
  const headers = columns.map((c) => c.name);

  const escape = (v: string): string =>
    (v ?? '').toString().replace(/\|/g, '\\|').replace(/\n/g, ' ');

  const header    = `| ${headers.map(escape).join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((row) => `| ${headers.map((h) => escape(row[h] ?? '')).join(' | ')} |`)
    .join('\n');

  return [header, separator, body].join('\n');
}

// ---------------------------------------------------------------------------
// Schema section renderer
// ---------------------------------------------------------------------------

function schemaSection(columns: ColumnMeta[], rowCount: number): string {
  const lines: string[] = [
    `**Schema** (${columns.length} columns, ${rowCount.toLocaleString()} rows total)`,
    '',
    '| Column | Type | Nulls |',
    '| --- | --- | --- |',
    ...columns.map(
      (c) => `| ${c.name} | ${c.type} | ${c.nullCount} |`,
    ),
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BuildFileContextOptions {
  /** Total rows to include in the sample (default: 30). */
  maxRows?: number;
}

/**
 * Build a context string from `file.csvMeta` and a stratified row sample.
 *
 * @param file    - The FileRecord (must have csvMeta populated).
 * @param rows    - Full parsed rows from the CSV (Record<columnName, value>[]).
 * @param options - Optional overrides (e.g. maxRows).
 * @returns A markdown-formatted string ready to prepend to a system/user message.
 */
export function buildFileContext(
  file: FileRecord,
  rows: Record<string, string>[],
  options: BuildFileContextOptions = {},
): string {
  const maxRows = options.maxRows ?? 30;

  if (!file.csvMeta) {
    // Graceful fallback for non-CSV files or missing meta
    return `**File:** ${file.name}\n\n_No CSV metadata available._`;
  }

  const { columns, rowCount } = file.csvMeta;
  const sample = stratifiedSample(rows, maxRows);

  const parts: string[] = [
    `## CSV File Context: ${file.name}`,
    '',
    schemaSection(columns, rowCount),
    '',
    `**Data Sample** (${sample.length} rows — stratified: beginning / middle / end)`,
    '',
    mdTable(columns, sample),
  ];

  return parts.join('\n');
}
