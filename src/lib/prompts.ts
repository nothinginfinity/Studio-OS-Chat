/**
 * prompts.ts — Thin wrappers + transforms for the prompt asset layer.
 * All heavy lifting lives in db.ts; this module is the public API surface.
 */

import type { PromptAssetRecord, PromptHistoryItem } from "./types";
import {
  listAllUserPrompts,
  searchUserPrompts,
  promotePromptToAsset,
  listPromptAssets,
  listStarredPromptAssets,
  listPinnedPromptAssets,
  updatePromptAsset,
  putPromptRelation,
  listPromptRelationsForAsset,
} from "./db";

export {
  listAllUserPrompts,
  searchUserPrompts,
  promotePromptToAsset,
  listPromptAssets,
  listStarredPromptAssets,
  listPinnedPromptAssets,
  updatePromptAsset,
  putPromptRelation,
  listPromptRelationsForAsset,
};

/** Truncates prompt text to `max` chars with a trailing ellipsis. */
export function truncatePrompt(text: string, max = 180): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}\u2026`;
}

/**
 * Derives a short human-readable title from raw prompt text.
 * Takes the first sentence up to 72 chars.
 */
export function derivePromptTitle(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "Untitled prompt";
  const sentence = normalized.split(/[.!?\n]/)[0]?.trim() ?? normalized;
  return truncatePrompt(sentence, 72);
}

/** Returns a card-length snippet from a PromptHistoryItem or PromptAssetRecord. */
export function toPromptCardSnippet(
  item: PromptHistoryItem | PromptAssetRecord,
  max = 180
): string {
  const text = "promptText" in item ? item.promptText : "";
  return truncatePrompt(text, max);
}
