/**
 * chartSpecParser.ts
 * Scans LLM assistant message content for fenced ```chartspec blocks,
 * parses and validates each against ChartSpec, assigns a uuid id.
 * Pure function — no side effects, no network calls.
 */

import type { ChartSpec, ChartType } from './types';

const CHART_TYPES: readonly ChartType[] = ['line', 'bar', 'pie', 'scatter'];

function isChartType(v: unknown): v is ChartType {
  return typeof v === 'string' && (CHART_TYPES as string[]).includes(v);
}

/**
 * Describes a single failed ```chartspec parse so the UI can show
 * a friendly error card instead of silently dropping the block.
 */
export interface ParseError {
  /** Zero-based index of the fenced block in the message (for React keys). */
  blockIndex: number;
  /** Human-readable reason: JSON syntax failure or schema validation message. */
  reason: string;
  /** The raw text content of the fenced block that failed. */
  rawContent: string;
}

/**
 * Parses a raw JSON object into a ChartSpec, returning null + reason if invalid.
 * The `id` field is always overwritten with a fresh uuid.
 */
function parseChartSpec(
  raw: unknown,
): { spec: ChartSpec } | { error: string } {
  if (typeof raw !== 'object' || raw === null)
    return { error: 'Expected a JSON object at the top level.' };
  const obj = raw as Record<string, unknown>;
  if (!isChartType(obj.type))
    return { error: `"type" must be one of: ${CHART_TYPES.join(', ')}. Got: ${JSON.stringify(obj.type)}.` };
  if (typeof obj.title !== 'string' || !obj.title.trim())
    return { error: '"title" must be a non-empty string.' };
  if (typeof obj.xKey !== 'string' || !obj.xKey.trim())
    return { error: '"xKey" must be a non-empty string.' };
  const yKeys = Array.isArray(obj.yKeys)
    ? (obj.yKeys as unknown[]).filter((k): k is string => typeof k === 'string')
    : [];
  if (yKeys.length === 0)
    return { error: '"yKeys" must be a non-empty array of strings.' };

  return {
    spec: {
      id: crypto.randomUUID(),
      type: obj.type,
      title: obj.title.trim(),
      xKey: obj.xKey.trim(),
      yKeys,
      source: 'llm',
    },
  };
}

/**
 * Result of scanning a single assistant message for chartspec blocks.
 */
export interface ChartSpecResults {
  specs: ChartSpec[];
  errors: ParseError[];
}

/**
 * Extracts all valid ChartSpec objects from a single assistant message string,
 * AND collects structured errors for every block that failed to parse.
 * Use this in UI components so parse failures surface as friendly error cards.
 *
 * Matches:  ```chartspec\n...\n```
 */
export function extractChartSpecResults(content: string): ChartSpecResults {
  const FENCE_RE = /```chartspec\s*\n([\s\S]*?)```/gi;
  const specs: ChartSpec[] = [];
  const errors: ParseError[] = [];
  let match: RegExpExecArray | null;
  let blockIndex = 0;

  while ((match = FENCE_RE.exec(content)) !== null) {
    const rawContent = match[1];
    try {
      const parsed = JSON.parse(rawContent);
      const result = parseChartSpec(parsed);
      if ('spec' in result) {
        specs.push(result.spec);
      } else {
        errors.push({ blockIndex, reason: result.error, rawContent });
      }
    } catch (e) {
      const msg = e instanceof SyntaxError ? e.message : 'Invalid JSON.';
      errors.push({ blockIndex, reason: `JSON parse error: ${msg}`, rawContent });
    }
    blockIndex++;
  }

  return { specs, errors };
}

/**
 * Backwards-compatible convenience wrapper — returns only the valid specs.
 * Prefer extractChartSpecResults() in UI code so errors can be surfaced.
 */
export function extractChartSpecs(content: string): ChartSpec[] {
  return extractChartSpecResults(content).specs;
}
