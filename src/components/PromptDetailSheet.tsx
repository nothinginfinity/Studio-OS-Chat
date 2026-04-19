/**
 * PromptDetailSheet — re-exports PromptHistorySheet under the canonical name
 * used by the next-spec (Chats long-press rollout).
 *
 * PromptHistorySheet contains the full expanded detail + search + action sheet
 * composition and should remain the implementation file. This module exists
 * so future imports can use the spec-aligned name without a rename.
 */
export { PromptHistorySheet as PromptDetailSheet } from "./PromptHistorySheet";
export type { } from "./PromptHistorySheet";
