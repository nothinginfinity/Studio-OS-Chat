import { describe, expect, it } from "vitest";
import { runGeometryEngine } from "./engineAdapter";

const BASE_DOC = {
  id: "doc-1",
  sourceType: "ocr-tsv" as const,
  provider: "tesseract" as const,
  rawPayload: "hello world",
  createdAt: Date.now(),
};

describe("runGeometryEngine (placeholder mode)", () => {
  it("returns a PostOcrProcessedDocument shape", async () => {
    const result = await runGeometryEngine(BASE_DOC);
    expect(typeof result.markdown).toBe("string");
    expect(typeof result.text).toBe("string");
    expect(Array.isArray(result.blocks)).toBe(true);
    expect(typeof result.summary.blockCount).toBe("number");
  });

  it("passes rawPayload through as text in placeholder mode", async () => {
    const result = await runGeometryEngine(BASE_DOC);
    expect(result.text).toContain("hello world");
  });

  it("includes a placeholder warning in debug", async () => {
    const result = await runGeometryEngine(BASE_DOC);
    expect(result.debug?.warnings?.some((w) => w.includes("not installed"))).toBe(true);
  });

  it("result block has engine-adapter-placeholder flag", async () => {
    const result = await runGeometryEngine(BASE_DOC);
    expect(result.blocks[0]?.flags).toContain("engine-adapter-placeholder");
  });

  it("handles object rawPayload without throwing", async () => {
    const result = await runGeometryEngine({
      ...BASE_DOC,
      rawPayload: { lines: [], words: [] },
    });
    expect(typeof result.text).toBe("string");
    expect(result.blocks.length).toBeGreaterThan(0);
  });
});
