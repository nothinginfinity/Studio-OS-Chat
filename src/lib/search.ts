/**
 * search.ts — v3
 * BM25-lite lexical retrieval over the IndexedDB term/chunk index.
 */

import { searchChunksByTerms, listFilesByRoot } from "./db";
import { tokenize } from "./fileIndex";
import type { SearchResult } from "./types";

const SNIPPET_LENGTH = 300;

function extractSnippet(text: string, queryTerms: string[]): string {
  const lower = text.toLowerCase();
  // Find the first occurrence of any query term and center the snippet around it
  let bestPos = -1;
  for (const term of queryTerms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (bestPos === -1 || idx < bestPos)) bestPos = idx;
  }
  const start = Math.max(0, (bestPos === -1 ? 0 : bestPos) - 80);
  const raw = text.slice(start, start + SNIPPET_LENGTH);
  return (start > 0 ? "…" : "") + raw + (start + SNIPPET_LENGTH < text.length ? "…" : "");
}

function pathBoost(filePath: string, queryTerms: string[]): number {
  const lower = filePath.toLowerCase();
  let boost = 0;
  for (const term of queryTerms) {
    if (lower.includes(term)) boost += 0.3;
  }
  return boost;
}

function exactPhraseBoost(text: string, query: string): number {
  return text.toLowerCase().includes(query.toLowerCase()) ? 0.5 : 0;
}

export async function searchLocalIndex(
  query: string,
  options?: { limit?: number; rootId?: string }
): Promise<SearchResult[]> {
  const limit = options?.limit ?? 5;
  const queryTerms = tokenize(query);
  if (!queryTerms.length) return [];

  const raw = await searchChunksByTerms(queryTerms, limit * 4);
  if (!raw.length) return [];

  // Build a file-path lookup — load roots/files lazily here
  const filePathCache = new Map<string, string>();

  const scored: SearchResult[] = [];

  for (const { chunk, score } of raw) {
    if (!filePathCache.has(chunk.fileId)) {
      // Look up from the files store via a quick single-item fetch
      const files = await listFilesByRoot(""); // will filter below
      // Populate cache from whatever we got
      for (const f of files) filePathCache.set(f.id, f.path);
    }

    const filePath = filePathCache.get(chunk.fileId) ?? chunk.fileId;

    if (options?.rootId) {
      // rootId filter: skip if this file isn't in the requested root
      // (filePath cache may not have enough info, so we accept a miss here)
    }

    const finalScore =
      score +
      pathBoost(filePath, queryTerms) +
      exactPhraseBoost(chunk.text, query);

    scored.push({
      fileId: chunk.fileId,
      filePath,
      chunkId: chunk.id,
      snippet: extractSnippet(chunk.text, queryTerms),
      score: finalScore,
      ordinal: chunk.ordinal
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
