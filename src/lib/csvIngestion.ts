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

// ── CSV line re-joiner (A.3: multiline field support) ────────────────────────

/**
 * Takes the array of raw lines (after CRLF normalisation) and re-joins any
 * lines that are continuations of a quoted field spanning multiple lines.
 *
 * A continuation is detected by counting unescaped double-quote characters:
 * if the running total is odd after a line ends, the next line is a
 * continuation of the current field.
 */
export function rejoinMultilineFields(lines: string[]): string[] {
  const result: string[] = [];
  let buffer: string | null = null;

  for (const line of lines) {
    if (buffer === null) {
      // Count quotes in this line
      const quoteCount = countUnescapedQuotes(line);
      if (quoteCount % 2 === 1) {
        // Odd number of quotes → field continues on next line
        buffer = line;
      } else {
        result.push(line);
      }
    } else {
      // We are inside a multiline field — append with the newline that was stripped
      buffer = buffer + '\n' + line;
      const quoteCount = countUnescapedQuotes(buffer);
      if (quoteCount % 2 === 0) {
        // Even quote count → field is now closed
        result.push(buffer);
        buffer = null;
      }
      // else: still open, keep accumulating
    }
  }

  // If file ends mid-field, push whatever we have
  if (buffer !== null) {
    result.push(buffer);
  }

  return result;
}

/**
 * Count double-quote characters in a string, skipping escaped pairs ("").
 */
function countUnescapedQuotes(s: string): number {
  let count = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '"') {
      if (s[i + 1] === '"') {
        i++; // skip escape pair
      } else {
        count++;
      }
    }
  }
  return count;
}

// ── CSV line parser ──────────────────────────────────────────────────────────

/** RFC 4180-compatible: handles quoted fields with embedded commas/newlines. */
export function parseRow(line: string): string[] {
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
 *
 * A.3: strips UTF-8 BOM, re-joins multiline quoted fields before line split.
 */
export async function ingestCsv(file: File): Promise<CsvParseResult | null> {
  if (file.size > MAX_CSV_BYTES) {
    console.warn('[csvIngestion] File exceeds 10 MB limit:', file.name);
    return null;
  }

  let raw = await file.text();

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
