import { describe, expect, it } from "vitest";
import { normalizeOcrResult } from "./normalize";
import type { PostOcrProcessedDocument } from "./types";

function makeDoc(overrides: Partial<PostOcrProcessedDocument> = {}): PostOcrProcessedDocument {
  return {
    markdown: "# Hello\n\nWorld",
    text: "Hello\n\nWorld",
    blocks: [
      {
        id: "block-1",
        type: "heading",
        text: "Hello",
        page: 1,
        confidence: 0.92,
      },
      {
        id: "block-2",
        type: "paragraph",
        text: "World",
        page: 1,
        confidence: 0.88,
      },
    ],
    summary: {
      pages: 1,
      blockCount: 2,
      headingCount: 1,
      listCount: 0,
      tableCount: 0,
      codeCount: 0,
      ambiguityCount: 0,
    },
    ...overrides,
  };
}

describe("normalizeOcrResult", () => {
  it("maps blocks to NormalizedOcrBlock shape", () => {
    const result = normalizeOcrResult(makeDoc(), { sourceId: "src-1" });
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0]?.type).toBe("heading");
    expect(result.blocks[0]?.confidenceLevel).toBe("high");
    expect(result.blocks[0]?.flaggedForReview).toBe(false);
  });

  it("flags blocks below confidence threshold", () => {
    const doc = makeDoc({
      blocks: [
        { id: "b1", type: "paragraph", text: "shaky", page: 1, confidence: 0.45 },
      ],
      summary: { pages: 1, blockCount: 1, headingCount: 0, listCount: 0, tableCount: 0, codeCount: 0, ambiguityCount: 0 },
    });
    const result = normalizeOcrResult(doc, { sourceId: "src-1" });
    expect(result.blocks[0]?.flaggedForReview).toBe(true);
    expect(result.blocks[0]?.confidenceLevel).toBe("low");
    expect(result.summary.flaggedCount).toBe(1);
  });

  it("flags high-ambiguity blocks for review even if confidence is ok", () => {
    const doc = makeDoc({
      blocks: [
        {
          id: "b1",
          type: "code",
          text: "return x;",
          page: 1,
          confidence: 0.72,
          ambiguity: { level: "high", reasons: ["mixed-content-overlap"] },
        },
      ],
      summary: { pages: 1, blockCount: 1, headingCount: 0, listCount: 0, tableCount: 0, codeCount: 1, ambiguityCount: 1 },
    });
    const result = normalizeOcrResult(doc, { sourceId: "src-1" });
    expect(result.blocks[0]?.flaggedForReview).toBe(true);
    expect(result.summary.ambiguityCount).toBe(1);
  });

  it("unknown engine block types map to 'unknown'", () => {
    const doc = makeDoc({
      blocks: [
        { id: "b1", type: "section_break", text: "", page: 1, confidence: 0.9 },
      ],
      summary: { pages: 1, blockCount: 1, headingCount: 0, listCount: 0, tableCount: 0, codeCount: 0, ambiguityCount: 0 },
    });
    const result = normalizeOcrResult(doc, { sourceId: "src-1" });
    expect(result.blocks[0]?.type).toBe("unknown");
  });

  it("result has id, processedAt, sourceId, markdown, text, summary, warnings", () => {
    const result = normalizeOcrResult(makeDoc(), { sourceId: "src-abc" });
    expect(typeof result.id).toBe("string");
    expect(typeof result.processedAt).toBe("string");
    expect(result.sourceId).toBe("src-abc");
    expect(typeof result.markdown).toBe("string");
    expect(typeof result.text).toBe("string");
    expect(typeof result.summary.blockCount).toBe("number");
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
