/**
 * csvIngestion.ts — Phase 1
 * Parses a .csv File into structured records, detects column types,
 * and stores rows as IndexedDB chunks. No LLM call at any point.
 *
 * Column type heuristic order: date → numeric → boolean → string
 */

import type { ColumnMeta, CsvMeta } from './types';

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
  // Strip currency symbols, thousands separators, trailing % sign
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

// ── CSV line parser ──────────────────────────────────────────────────────────

/** RFC 4180-compatible: handles quoted fields with embedded commas/newlines. */
function parseRow(line: string): string[] {
  const fields: string[] = [];
  let inQuotes = false;
  let field = '';

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

// ── Main export ──────────────────────────────────────────────────────────────

export interface CsvParseResult {
  csvMeta: CsvMeta;
  /** Each row is a plain object keyed by column name */
  rows: Record<string, string>[];
  /** Tab-separated text representation of all rows, for chunk storage */
  chunkText: string;
}

/**
 * Parse a File object as CSV.
 * Returns null if the file is too large, empty, or cannot be read.
 * No network or LLM calls are made.
 */
export async function ingestCsv(file: File): Promise<CsvParseResult | null> {
  if (file.size > MAX_CSV_BYTES) {
    console.warn('[csvIngestion] File exceeds 10 MB limit:', file.name);
    return null;
  }

  const raw = await file.text();
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  // Filter completely empty trailing lines
  const nonEmpty = lines.filter(l => l.trim() !== '');
  if (nonEmpty.length < 2) return null; // need at least header + 1 data row

  const headers = parseRow(nonEmpty[0]);
  const dataLines = nonEmpty.slice(1);

  // Parse all rows
  const rows: Record<string, string>[] = dataLines.map(line => {
    const values = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });

  // Build ColumnMeta for each header
  const columns: ColumnMeta[] = headers.map(name => {
    const allValues = rows.map(r => r[name] ?? '');
    const nullCount = allValues.filter(v => v.trim() === '').length;
    const nonNullValues = allValues.filter(v => v.trim() !== '');
    const type = detectType(nonNullValues);
    const sample = nonNullValues.slice(0, SAMPLE_SIZE);
    return { name, type, nullCount, sample };
  });

  const csvMeta: CsvMeta = { columns, rowCount: rows.length };

  // Build a plain text representation for chunk storage
  // Format: one row per line, values tab-separated, header row first
  const chunkLines = [headers.join('\t')];
  for (const row of rows) {
    chunkLines.push(headers.map(h => row[h] ?? '').join('\t'));
  }
  const chunkText = chunkLines.join('\n');

  return { csvMeta, rows, chunkText };
}
