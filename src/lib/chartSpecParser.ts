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
 * Parses a raw JSON object into a ChartSpec, returning null if invalid.
 * The `id` field is always overwritten with a fresh uuid.
 */
function parseChartSpec(raw: unknown): ChartSpec | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (!isChartType(obj.type)) return null;
  if (typeof obj.title !== 'string' || !obj.title.trim()) return null;
  if (typeof obj.xKey !== 'string' || !obj.xKey.trim()) return null;
  const yKeys = Array.isArray(obj.yKeys)
    ? (obj.yKeys as unknown[]).filter((k): k is string => typeof k === 'string')
    : [];
  if (yKeys.length === 0) return null;

  return {
    id: crypto.randomUUID(),
    type: obj.type,
    title: obj.title.trim(),
    xKey: obj.xKey.trim(),
    yKeys,
    source: 'llm',
  };
}

/**
 * Extracts all valid ChartSpec objects from a single assistant message string.
 * Matches:  ```chartspec\n...\n```
 */
export function extractChartSpecs(content: string): ChartSpec[] {
  const FENCE_RE = /```chartspec\s*\n([\s\S]*?)```/gi;
  const results: ChartSpec[] = [];
  let match: RegExpExecArray | null;
  while ((match = FENCE_RE.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const spec = parseChartSpec(parsed);
      if (spec) results.push(spec);
    } catch {
      // malformed JSON — skip silently
    }
  }
  return results;
}
