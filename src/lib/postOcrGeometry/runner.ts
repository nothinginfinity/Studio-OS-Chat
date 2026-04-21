import type {
  PostOcrDocument,
  PostOcrProcessedDocument,
  PostOcrRunner,
} from "./types";

function countByType(blocks: PostOcrProcessedDocument["blocks"], type: string): number {
  return blocks.filter((block) => block.type === type).length;
}

function countAmbiguous(blocks: PostOcrProcessedDocument["blocks"]): number {
  return blocks.filter((block) => block.ambiguity !== undefined).length;
}

/**
 * Placeholder deterministic runner boundary for post-ocr geometry processing.
 *
 * This intentionally does not depend on app internals.
 * In the next integration commit, wire this to the real engine adapter.
 */
export class DefaultPostOcrRunner implements PostOcrRunner {
  async process(doc: PostOcrDocument): Promise<PostOcrProcessedDocument> {
    const rawText =
      typeof doc.rawPayload === "string"
        ? doc.rawPayload
        : JSON.stringify(doc.rawPayload, null, 2);

    const result: PostOcrProcessedDocument = {
      markdown: rawText,
      text: rawText,
      blocks: [
        {
          id: `${doc.id}-raw`,
          type: "raw",
          text: rawText,
          page: 1,
          confidence: 0,
          flags: ["integration-boundary-placeholder"],
        },
      ],
      debug: {
        warnings: [
          "DefaultPostOcrRunner is a placeholder. Wire the geometry engine in the next integration commit.",
        ],
        ambiguousBlocks: [],
      },
      summary: {
        pages: 1,
        blockCount: 1,
        headingCount: 0,
        listCount: 0,
        tableCount: 0,
        codeCount: 0,
        ambiguityCount: 0,
      },
    };

    result.summary.headingCount = countByType(result.blocks, "heading");
    result.summary.listCount = countByType(result.blocks, "list");
    result.summary.tableCount = countByType(result.blocks, "table");
    result.summary.codeCount = countByType(result.blocks, "code");
    result.summary.ambiguityCount = countAmbiguous(result.blocks);

    return result;
  }
}
