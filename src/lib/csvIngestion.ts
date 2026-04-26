/**
 * csvIngestion.ts — Phase 1 (patched A.3: BOM strip + multiline field support)
 * Parses a .csv File into structured records, detects column types,
 * and stores rows as IndexedDB chunks. No LLM call at any point.
 *
 * Column type heuristic order: date → numeric → boolean → string
 *
 * A.3 changes:
 *  1. Strip UTF-8 BOM (\uFEFF) from raw text before processing
 *  2. Re-join quoted multiline fields that were split by the \n splitter
 *
 * B-1 changes:
 *  3. ingestCsv() now calls inferChartSpecs and returns chartSpecs on the result
 *  4. selectTemplates() re-export alias for inferChartSpecs (roadmap API name)
 */

import type { ColumnMeta, CsvMeta, ChartSpec } from './types';
import { inferChartSpecs } from './chartTemplates';
import { uid } from './utils';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10 MB guard
const SAMPLE_SIZE = 5;                  // values to keep per column

// ── Type detection helpers ───────────────────────────────────────────────────

/** ISO 8601, MM/DD/YYYY, DD-MM-YYYY, YYYY-MM-DD, and bare year variants */
const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]*)?$/,   // ISO 8601
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,          // MM/DD/YYYY
  /^\d{1,2}-\d{1,2}-\d{2,4}$/,            // DD-MM-YYYY
  /^\d{4}$/,                               // bare year e.g. 2024
];

const BOOLEAN_VALUES = new Set(['true','false','yes','no','1','0','y','n']);

function looksLikeDate(value: string): boolean {
  return DATE_PATTERNS.some(p => p.test(value.trim())) && !isNaN(Date.parse(value.trim()));
}

function looksLikeNumeric(value: string): boolean {
  const cleaned = value.trim().replace(/^[\$£€¥]/, '').replace(/,/g, '').replace(/%$/, '');
  return cleaned !== '' && isFinite(Number(cleaned));
}

function looksLikeBoolean(value: string): boolean {
  return BOOLEAN_VALUES.has(value.trim().toLowerCase());
}

function detectType(nonNullValues: string[]): ColumnMeta['type'] {
  if (nonNullValues.length === 0) return 'string';
  if (nonNullValues.every(looksLikeDate))    return 'date';
  if (nonNullValues.every(looksLikeNumeric)) return 'number';
  if (nonNullValues.every(looksLikeBoolean)) return 'boolean';
  return 'string';
}

// ── CSV line re-joiner (A.3: multiline field support) ────────────────────────

export function rejoinMultilineFields(lines: string[]): string[] {
  const result: string[] = [];
  let buffer: string | null = null;

  for (const line of lines) {
    if (buffer === null) {
      const quoteCount = countUnescapedQuotes(line);
      if (quoteCount % 2 === 1) {
        buffer = line;
      } else {
        result.push(line);
      }
    } else {
      buffer = buffer + '\n' + line;
      const quoteCount = countUnescapedQuotes(buffer);
      if (quoteCount % 2 === 0) {
        result.push(buffer);
        buffer = null;
      }
    }
  }

  if (buffer !== null) {
    result.push(buffer);
  }

  return result;
}

function countUnescapedQuotes(s: string): number {
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '"') {
      i++; // skip backslash-escaped quote entirely
    } else if (s[i] === '"') {
      if (s[i + 1] === '"') {
        i++; // skip RFC 4180 doubled-quote escape pair
      } else {
        count++;
      }
    }
  }
  return count;
}

// ── CSV line parser ──────────────────────────────────────────────────────────

/**
 * RFC 4180-compatible parser with backslash-escape extension.
 * Handles:
 *   - quoted fields with embedded commas and newlines
 *   - RFC 4180 doubled-quote escaping: "" → "
 *   - backslash-escaped quote extension: \" → "
 */
export function parseRow(line: string): string[] {
  const fields: string[] = [];
  let inQuotes = false;
  let field = '';

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '\\' && line[i + 1] === '"') {
        // Backslash-escaped quote inside quoted field: \" → "
        field += '"';
        i++;
      } else if (ch === '"' && line[i + 1] === '"') {
        // RFC 4180 doubled-quote: "" → "
        field += '"';
        i++;
      } else if (ch === '"') {
        // Closing quote
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(field);
        field = '';
      } else {
        field += ch;
      }
    }
  }
  fields.push(field);
  return fields;
}

// ── selectTemplates alias (roadmap API name) ─────────────────────────────────

export function selectTemplates(
  csvMeta: CsvMeta,
  rows: Record<string, string>[] = [],
  fileId = uid(),
): ChartSpec[] {
  return inferChartSpecs(fileId, csvMeta, rows);
}

// ── Result shape (tests expect flat properties) ──────────────────────────────

export interface CsvParseResult {
  /** Convenience shorthand — same as csvMeta.rowCount */
  rowCount: number;
  /** Convenience shorthand — column names from csvMeta */
  columns: string[];
  /** Each row as an array of string values (positional, matches columns order) */
  rows: string[][];
  /** Tab-separated text representation of all rows, for chunk storage */
  chunkText: string;
  /** Full CsvMeta (column types, nullCount, samples) */
  csvMeta: CsvMeta;
  /** B-1: Auto-generated template ChartSpecs */
  chartSpecs: ChartSpec[];
  /** Stable fileId used to generate chart spec ids */
  fileId: string;
}

// ── File text reader — works in both browser and jsdom ───────────────────────

function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ── Main export ──────────────────────────────────────────────────────────────

export async function ingestCsv(file: File): Promise<CsvParseResult> {
  if (file.size === 0) {
    throw new Error('[csvIngestion] Empty file: ' + file.name);
  }
  if (file.size > MAX_CSV_BYTES) {
    throw new Error('[csvIngestion] File exceeds 10 MB limit: ' + file.name);
  }

  let raw = await readFileAsText(file);

  // A.3 fix 1: Strip UTF-8 BOM if present
  if (raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.slice(1);
  }

  // Normalise line endings
  const normalised = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const splitLines = normalised.split('\n');

  // A.3 fix 2: Re-join lines that are continuations of multiline quoted fields
  const lines = rejoinMultilineFields(splitLines);

  // Filter completely empty trailing lines
  const nonEmpty = lines.filter(l => l.trim() !== '');

  if (nonEmpty.length === 0) {
    throw new Error('[csvIngestion] Empty file after parsing: ' + file.name);
  }

  const headers = parseRow(nonEmpty[0]);
  // header-only file is valid — 0 data rows
  const dataLines = nonEmpty.slice(1);

  // Parse all rows as arrays (positional)
  const rows: string[][] = dataLines.map(line => {
    const values = parseRow(line);
    while (values.length < headers.length) values.push('');
    return values.slice(0, headers.length);
  });

  // Build row objects for ColumnMeta / chartSpecs
  const rowObjects: Record<string, string>[] = rows.map(values => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });

  // Build ColumnMeta for each header
  const columnMetas: ColumnMeta[] = headers.map(name => {
    const allValues = rowObjects.map(r => r[name] ?? '');
    const nullCount = allValues.filter(v => v.trim() === '').length;
    const nonNullValues = allValues.filter(v => v.trim() !== '');
    const type = detectType(nonNullValues);
    const sample = nonNullValues.slice(0, SAMPLE_SIZE);
    return { name, type, nullCount, sample };
  });

  const csvMeta: CsvMeta = { columns: columnMetas, rowCount: rows.length };

  // Build a plain text representation for chunk storage
  const chunkLines = [headers.join('\t')];
  for (const row of rowObjects) {
    chunkLines.push(headers.map(h => row[h] ?? '').join('\t'));
  }
  const chunkText = chunkLines.join('\n');

  // B-1: Generate template chart specs
  const fileId = uid();
  const chartSpecs = inferChartSpecs(fileId, csvMeta, rowObjects);

  return {
    rowCount: rows.length,
    columns: headers,
    rows,
    chunkText,
    csvMeta,
    chartSpecs,
    fileId,
  };
}
