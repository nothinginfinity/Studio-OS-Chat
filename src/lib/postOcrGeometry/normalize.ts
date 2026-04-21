import { nanoid } from "nanoid";
import type { PostOcrBlock, PostOcrProcessedDocument } from "./types";
import type {
  ConfidenceLevel,
  NormalizedBlockType,
  NormalizedOcrBlock,
  NormalizedOcrResult,
} from "./normalizedResult";

const REVIEW_THRESHOLD = 0.6;

function toConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return "high";
  if (score >= 0.65) return "medium";
  if (score > 0) return "low";
  return "unscored";
}

function toNormalizedType(raw: string): NormalizedBlockType {
  const allowed: NormalizedBlockType[] = [
    "heading",
    "paragraph",
    "list",
    "list_item",
    "table",
    "code",
    "quote",
  ];
  return (allowed as string[]).includes(raw)
    ? (raw as NormalizedBlockType)
    : "unknown";
}

function normalizeBlock(block: PostOcrBlock): NormalizedOcrBlock {
  const confidence = block.confidence ?? 0;
  const confidenceLevel = toConfidenceLevel(confidence);
  const flaggedForReview =
    confidence < REVIEW_THRESHOLD || block.ambiguity?.level === "high";

  return {
    id: block.id,
    type: toNormalizedType(block.type),
    text: block.text ?? "",
    ...(block.level !== undefined ? { level: block.level } : {}),
    ...(block.rows !== undefined ? { rows: block.rows } : {}),
    page: block.page,
    confidence,
    confidenceLevel,
    ...(block.ambiguity ? { ambiguity: block.ambiguity } : {}),
    flaggedForReview,
  };
}

export function normalizeOcrResult(
  doc: PostOcrProcessedDocument,
  opts: {
    sourceId: string;
    sourceFilename?: string;
    resultId?: string;
    includeDebugHtml?: boolean;
  }
): NormalizedOcrResult {
  const blocks = doc.blocks.map(normalizeBlock);

  const flaggedCount = blocks.filter((b) => b.flaggedForReview).length;
  const ambiguityCount = blocks.filter((b) => b.ambiguity !== undefined).length;

  return {
    id: opts.resultId ?? nanoid(),
    processedAt: new Date().toISOString(),
    sourceId: opts.sourceId,
    ...(opts.sourceFilename ? { sourceFilename: opts.sourceFilename } : {}),
    markdown: doc.markdown,
    text: doc.text,
    blocks,
    summary: {
      pageCount: doc.summary.pages,
      blockCount: doc.summary.blockCount,
      headingCount: doc.summary.headingCount,
      listCount: doc.summary.listCount,
      tableCount: doc.summary.tableCount,
      codeCount: doc.summary.codeCount,
      flaggedCount,
      ambiguityCount,
    },
    warnings: doc.debug?.warnings ?? [],
    ...(opts.includeDebugHtml && doc.debug?.html
      ? { debugHtml: doc.debug.html }
      : {}),
  };
}
