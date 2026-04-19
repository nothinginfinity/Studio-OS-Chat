/**
 * search.ts — v4
 * BM25-lite lexical retrieval over the IndexedDB term/chunk index.
 * Fixed: file path cache now built upfront via listAllFiles()
 * instead of the broken listFilesByRoot("") call.
 */

import { searchChunksByTerms, listAllFiles } from "./db";
import { tokenize } from "./fileIndex";
import type { SearchResult, FileRecord } from "./types";

const SNIPPET_LENGTH = 300;

function extractSnippet(text: string, queryTerms: string[]): string {
  const lower = text.toLowerCase();
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

  // Build path cache ONCE upfront — fixes the listFilesByRoot("") bug
  const allFiles = await listAllFiles();
  const filePathCache = new Map<string, string>();
  const fileRootCache = new Map<string, string>();
  for (const f of allFiles) {
    filePathCache.set(f.id, f.path);
    fileRootCache.set(f.id, f.rootId);
  }

  const scored: SearchResult[] = [];

  for (const { chunk, score } of raw) {
    // Apply rootId filter properly now that we have real file records
    if (options?.rootId) {
      const fileRootId = fileRootCache.get(chunk.fileId);
      if (fileRootId !== options.rootId) continue;
    }

    const filePath = filePathCache.get(chunk.fileId) ?? chunk.fileId;
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
