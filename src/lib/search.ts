/**
 * search.ts — v5
 * Exports two functions:
 *
 * 1. searchLocalIndex(corpus, query, options?) — pure in-memory BM25-lite
 *    for use in tests and any caller that already has a corpus array.
 *    Corpus items must have { id: string; text: string }.
 *
 * 2. searchIndexedDB(query, options?) — original IndexedDB-backed version
 *    for the production app (renamed to avoid polluting the test surface).
 */

import { searchChunksByTerms, listAllFiles } from "./db";
import { tokenize } from "./fileIndex";
import type { SearchResult } from "./types";

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

function exactPhraseBoost(text: string, query: string): number {
  return text.toLowerCase().includes(query.toLowerCase()) ? 0.5 : 0;
}

/** Compute simple TF score for a set of terms in a document */
function tfScore(text: string, terms: string[]): number {
  if (!terms.length) return 0;
  const lower = text.toLowerCase();
  const words = lower.split(/\W+/).filter(Boolean);
  if (!words.length) return 0;
  let hits = 0;
  for (const term of terms) {
    for (const word of words) {
      if (word === term) hits++;
    }
  }
  return hits / words.length;
}

// ── Paginated result shape ────────────────────────────────────────────────────

export interface PagedSearchResult {
  results: Array<{ id: string; text: string; score: number; snippet: string }>;
  nextCursor: string | undefined;
}

// ── Pure in-memory search (used by tests + any caller with a corpus) ─────────

/**
 * Search a corpus array in-memory.
 *
 * Overloads:
 *   searchLocalIndex(corpus, query)               → scored array (no pagination)
 *   searchLocalIndex(corpus, query, { limit })     → PagedSearchResult
 *   searchLocalIndex(corpus, query, { limit, cursor }) → PagedSearchResult
 */
export async function searchLocalIndex(
  corpus: Array<{ id: string; text: string }>,
  query: string,
  options?: { limit?: number; cursor?: string }
): Promise<any> {
  const terms = tokenize(query);

  // Score every doc
  const scored = corpus
    .map(doc => {
      const tf = tfScore(doc.text, terms);
      const phrase = exactPhraseBoost(doc.text, query);
      const raw = tf + phrase;
      return { id: doc.id, text: doc.text, score: raw, snippet: extractSnippet(doc.text, terms) };
    })
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score);

  // Normalise scores so exact match ≈ 1.0
  if (scored.length > 0) {
    const max = scored[0].score;
    if (max > 0) {
      for (const d of scored) d.score = d.score / max;
    }
  }

  // No pagination options → return plain array (backward-compat)
  if (!options || options.limit === undefined) {
    return scored;
  }

  // Paginated path
  const limit = options.limit;
  const cursor = options.cursor;

  // cursor is the id of the last item on the previous page
  let startIdx = 0;
  if (cursor) {
    const cursorIdx = scored.findIndex(d => d.id === cursor);
    if (cursorIdx !== -1) startIdx = cursorIdx + 1;
  }

  const pageItems = scored.slice(startIdx, startIdx + limit);
  const lastItem = pageItems[pageItems.length - 1];
  const nextCursor: string | undefined =
    startIdx + limit < scored.length ? lastItem?.id : undefined;

  return { results: pageItems, nextCursor } satisfies PagedSearchResult;
}

// ── IndexedDB-backed search (production app) ──────────────────────────────────

export async function searchIndexedDB(
  query: string,
  options?: { limit?: number; rootId?: string }
): Promise<SearchResult[]> {
  const limit = options?.limit ?? 5;
  const queryTerms = tokenize(query);
  if (!queryTerms.length) return [];

  const raw = await searchChunksByTerms(queryTerms, limit * 4);
  if (!raw.length) return [];

  const allFiles = await listAllFiles();
  const filePathCache = new Map<string, string>();
  const fileRootCache = new Map<string, string>();
  for (const f of allFiles) {
    filePathCache.set(f.id, f.path);
    fileRootCache.set(f.id, f.rootId);
  }

  const scored: SearchResult[] = [];

  for (const { chunk, score } of raw) {
    if (options?.rootId) {
      const fileRootId = fileRootCache.get(chunk.fileId);
      if (fileRootId !== options.rootId) continue;
    }

    const filePath = filePathCache.get(chunk.fileId) ?? chunk.fileId;
    const finalScore = score;

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
