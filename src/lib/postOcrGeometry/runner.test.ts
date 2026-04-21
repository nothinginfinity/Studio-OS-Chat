import { describe, expect, it } from "vitest";
import { DefaultPostOcrRunner } from "./runner";

describe("DefaultPostOcrRunner", () => {
  it("returns a placeholder processed document", async () => {
    const runner = new DefaultPostOcrRunner();

    const result = await runner.process({
      id: "doc-1",
      sourceType: "ocr-tsv",
      provider: "tesseract",
      rawPayload: "hello world",
      createdAt: Date.now(),
    });

    expect(result.markdown).toContain("hello world");
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.type).toBe("raw");
  });
});
