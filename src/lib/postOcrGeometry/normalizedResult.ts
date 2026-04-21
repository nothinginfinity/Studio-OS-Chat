/**
 * App-level normalized OCR result model.
 *
 * This is the shape InfinityPaste uses internally.
 * It does NOT mirror the engine's StructuredBlock directly —
 * it is a stable app contract that the adapter maps into.
 */

export type NormalizedBlockType =
  | "heading"
  | "paragraph"
  | "list"
  | "list_item"
  | "table"
  | "code"
  | "quote"
  | "unknown";

export type ConfidenceLevel = "high" | "medium" | "low" | "unscored";

export interface NormalizedOcrBlock {
  /** Stable unique id within the result. */
  id: string;
  type: NormalizedBlockType;
  /** Plain text content. Tables and lists also populate this as a flattened string. */
  text: string;
  /** For heading blocks — h1/h2/h3 depth. */
  level?: number;
  /** For table blocks — row-major cell array. */
  rows?: string[][];
  /** For list blocks — ordered list items. */
  items?: string[];
  /** Page number (1-indexed). */
  page: number;
  /** Raw 0.0–1.0 score from the engine. */
  confidence: number;
  /** Bucketed confidence for UI display. */
  confidenceLevel: ConfidenceLevel;
  /** Present when the engine flagged uncertainty. */
  ambiguity?: {
    level: "low" | "medium" | "high";
    reasons: string[];
  };
  /** Whether this block should be shown with a low-confidence warning in UI. */
  flaggedForReview: boolean;
}

export interface NormalizedOcrResult {
  /** Unique id for this result — use for deduplication and caching. */
  id: string;
  /** ISO timestamp of when processing completed. */
  processedAt: string;
  /** Source document reference. */
  sourceId: string;
  sourceFilename?: string;
  /** Full markdown rendering of all blocks in reading order. */
  markdown: string;
  /** Plain text concatenation of all blocks. */
  text: string;
  blocks: NormalizedOcrBlock[];
  summary: {
    pageCount: number;
    blockCount: number;
    headingCount: number;
    listCount: number;
    tableCount: number;
    codeCount: number;
    flaggedCount: number;
    ambiguityCount: number;
  };
  /** Non-fatal warnings from the engine. */
  warnings: string[];
  /** Debug HTML overlay — only populated in dev/debug mode. */
  debugHtml?: string;
}
