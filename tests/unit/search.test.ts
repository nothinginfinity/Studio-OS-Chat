import { describe, it, expect } from "vitest";
import { searchLocalIndex } from "../../src/lib/search";

const CORPUS = [
  { id: "1", text: "The quick brown fox jumps over the lazy dog" },
  { id: "2", text: "Pack my box with five dozen liquor jugs" },
  { id: "3", text: "How vexingly quick daft zebras jump" },
  { id: "4", text: "The five boxing wizards jump quickly" },
  { id: "5", text: "Sphinx of black quartz judge my vow" },
];

describe("searchLocalIndex — scoring", () => {
  it("exact match returns score of 1.0", async () => {
    const results = await searchLocalIndex(CORPUS, "quick brown fox");
    const top = results[0];
    expect(top.score).toBeCloseTo(1.0, 1);
  });

  it("partial match returns score > 0 and <= 1", async () => {
    const results = await searchLocalIndex(CORPUS, "quick");
    const top = results[0];
    expect(top.score).toBeGreaterThan(0);
    expect(top.score).toBeLessThanOrEqual(1);
  });

  it("no match returns empty results array", async () => {
    const results = await searchLocalIndex(CORPUS, "xyzzy_no_match_token");
    expect(results).toHaveLength(0);
  });

  it("query with 0 results does not throw", async () => {
    await expect(searchLocalIndex(CORPUS, "zzznomatch999")).resolves.toBeDefined();
  });
});

describe("searchLocalIndex — pagination", () => {
  it("cursor-based pagination: second page returns different results than first", async () => {
    const page1 = await searchLocalIndex(CORPUS, "jump", { limit: 2 });
    expect(page1.results.length).toBeLessThanOrEqual(2);
    const nextCursor = page1.nextCursor;
    if (nextCursor) {
      const page2 = await searchLocalIndex(CORPUS, "jump", { limit: 2, cursor: nextCursor });
      const ids1 = page1.results.map((r: any) => r.id);
      const ids2 = page2.results.map((r: any) => r.id);
      ids2.forEach((id: string) => expect(ids1).not.toContain(id));
    }
  });

  it("cursor advances correctly — no duplicate results across pages", async () => {
    const allIds: string[] = [];
    let cursor: string | undefined = undefined;
    let iterations = 0;
    do {
      const page: any = await searchLocalIndex(CORPUS, "the", { limit: 2, cursor });
      page.results.forEach((r: any) => {
        expect(allIds).not.toContain(r.id);
        allIds.push(r.id);
      });
      cursor = page.nextCursor;
      iterations++;
    } while (cursor && iterations < 10);
    expect(allIds.length).toBeGreaterThan(0);
  });
});
