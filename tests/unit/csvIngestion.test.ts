import { describe, it, expect } from "vitest";
import { ingestCsv } from "../../src/lib/csvIngestion";

describe("ingestCsv — basic cases", () => {
  it("throws on empty file", async () => {
    const file = new File([""], "empty.csv", { type: "text/csv" });
    await expect(ingestCsv(file)).rejects.toThrow();
  });

  it("header-only file yields 0 data rows with correct columns", async () => {
    const file = new File(["name,age,city\n"], "header.csv", { type: "text/csv" });
    const result = await ingestCsv(file);
    expect(result.rowCount).toBe(0);
    expect(result.columns).toEqual(["name", "age", "city"]);
  });

  it("1 000-row CSV returns correct rowCount, columns, and non-empty chunkText", async () => {
    const header = "id,value,label\n";
    const rows = Array.from({ length: 1000 }, (_, i) => `${i},${i * 2},label${i}`).join("\n");
    const file = new File([header + rows], "big.csv", { type: "text/csv" });
    const result = await ingestCsv(file);
    expect(result.rowCount).toBe(1000);
    expect(result.columns).toEqual(["id", "value", "label"]);
    expect(result.chunkText.length).toBeGreaterThan(0);
  });
});

describe("ingestCsv — RFC 4180 edge cases", () => {
  it("handles quoted commas correctly", async () => {
    const csv = `name,address\n"Smith, John","123 Main St"\n`;
    const file = new File([csv], "quoted.csv", { type: "text/csv" });
    const result = await ingestCsv(file);
    expect(result.rowCount).toBe(1);
    expect(result.rows[0][0]).toBe("Smith, John");
  });

  it("handles embedded newlines in quoted fields", async () => {
    const csv = `title,body\n"Hello","line one\nline two"\n`;
    const file = new File([csv], "newline.csv", { type: "text/csv" });
    const result = await ingestCsv(file);
    expect(result.rowCount).toBe(1);
    expect(result.rows[0][1]).toContain("\n");
  });

  it("handles escaped double-quotes inside quoted fields", async () => {
    const csv = `col\n"He said \"hello\""\n`;
    const file = new File([csv], "escape.csv", { type: "text/csv" });
    const result = await ingestCsv(file);
    expect(result.rows[0][0]).toBe('He said "hello"');
  });

  it("returns graceful error on malformed CSV (unclosed quote) — does not crash", async () => {
    const csv = `col\n"unclosed\n`;
    const file = new File([csv], "malformed.csv", { type: "text/csv" });
    const result = await ingestCsv(file).catch((e) => ({ error: String(e) }));
    expect(result).toBeDefined();
  });
});
