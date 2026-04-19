import { useState, useEffect, useCallback } from "react";
import {
  promotePromptToAsset,
  updatePromptAsset,
  listStarredPromptAssets,
  listPinnedPromptAssets,
  searchUserPrompts,
} from "../lib/prompts";
import type { PromptAssetRecord, PromptHistoryItem, PromotePromptInput } from "../lib/types";

export interface UsePromptAssetsResult {
  starred: PromptAssetRecord[];
  pinned: PromptAssetRecord[];
  searchResults: PromptHistoryItem[];
  searching: boolean;
  loading: boolean;
  promote: (input: PromotePromptInput) => Promise<PromptAssetRecord>;
  star: (id: string, starred: boolean) => Promise<void>;
  pin: (id: string, pinned: boolean) => Promise<void>;
  search: (query: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePromptAssets(active: boolean): UsePromptAssetsResult {
  const [starred, setStarred] = useState<PromptAssetRecord[]>([]);
  const [pinned, setPinned] = useState<PromptAssetRecord[]>([]);
  const [searchResults, setSearchResults] = useState<PromptHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        listStarredPromptAssets(),
        listPinnedPromptAssets(),
      ]);
      setStarred(s);
      setPinned(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  const promote = useCallback(
    async (input: PromotePromptInput): Promise<PromptAssetRecord> => {
      const asset = await promotePromptToAsset(input);
      await refresh();
      return asset;
    },
    [refresh]
  );

  const star = useCallback(
    async (id: string, isStarred: boolean) => {
      await updatePromptAsset(id, { starred: isStarred });
      await refresh();
    },
    [refresh]
  );

  const pin = useCallback(
    async (id: string, isPinned: boolean) => {
      await updatePromptAsset(id, { pinned: isPinned });
      await refresh();
    },
    [refresh]
  );

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchUserPrompts(query);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  }, []);

  return {
    starred,
    pinned,
    searchResults,
    searching,
    loading,
    promote,
    star,
    pin,
    search,
    refresh,
  };
}
