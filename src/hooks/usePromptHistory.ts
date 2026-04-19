import { useState, useEffect, useCallback, useMemo } from "react";
import {
  listAllUserPrompts,
  type PromptEntry,
} from "../lib/prompts";

export type SortOrder = "newest" | "oldest";

export interface UsePromptHistoryResult {
  prompts: PromptEntry[];
  loading: boolean;
  query: string;
  setQuery: (q: string) => void;
  sortOrder: SortOrder;
  setSortOrder: (o: SortOrder) => void;
  refresh: () => void;
}

export function usePromptHistory(active: boolean): UsePromptHistoryResult {
  const [allPrompts, setAllPrompts] = useState<PromptEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const results = await listAllUserPrompts();
      setAllPrompts(results);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load once when the panel becomes active
  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const filtered = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const base =
      tokens.length === 0
        ? allPrompts
        : allPrompts.filter((p) =>
            tokens.every((tok) => p.content.toLowerCase().includes(tok))
          );
    return sortOrder === "newest" ? [...base] : [...base].reverse();
  }, [allPrompts, query, sortOrder]);

  return {
    prompts: filtered,
    loading,
    query,
    setQuery,
    sortOrder,
    setSortOrder,
    refresh: load,
  };
}
