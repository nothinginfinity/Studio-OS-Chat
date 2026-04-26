/**
 * A-4: Cached, cursor-paginated wrapper around searchLocalIndex.
 * - LRU cache: last 5 query+limit combinations
 * - Cursor pagination: callers receive { results, nextCursor }
 * - Cache is invalidated on every indexFile() call via invalidateSearchCache()
 */
import { LRUCache } from "./lruCache";

export interface SearchResult {
  id: string;
  score: number;
  text?: string;
  [key: string]: unknown;
}

export interface PagedSearchResult {
  results: SearchResult[];
  nextCursor: string | undefined;
}

export interface SearchOptions {
  limit?: number;
  cursor?: string;
}

type CacheKey = string;

const CACHE_CAPACITY = 5;
const cache = new LRUCache<CacheKey, SearchResult[]>(CACHE_CAPACITY);

function makeCacheKey(query: string, limit: number): CacheKey {
  return `${query}::${limit}`;
}

/** Call this from indexFile() to invalidate stale search results. */
export function invalidateSearchCache(): void {
  cache.invalidate();
}

/**
 * Searches corpus with LRU caching and cursor-based pagination.
 */
export async function searchWithCache(
  corpus: { id: string; text: string }[],
  query: string,
  options: SearchOptions = {}
): Promise<PagedSearchResult> {
  const limit = options.limit ?? 20;
  const startIndex = options.cursor ? parseInt(options.cursor, 10) : 0;
  const cacheKey = makeCacheKey(query, limit);

  let allResults = cache.get(cacheKey);

  if (!allResults) {
    const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    allResults = corpus
      .map((doc) => {
        const text = doc.text.toLowerCase();
        const matchCount = queryTokens.filter((t) => text.includes(t)).length;
        const score = queryTokens.length > 0 ? matchCount / queryTokens.length : 0;
        return { id: doc.id, score, text: doc.text };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    cache.set(cacheKey, allResults);
  }

  const page = allResults.slice(startIndex, startIndex + limit);
  const nextStart = startIndex + limit;
  const nextCursor = nextStart < allResults.length ? String(nextStart) : undefined;

  return { results: page, nextCursor };
}
