/**
 * pdfIngestion.ts — v1
 *
 * PDF ingestion pipeline: mirrors the OCR pipeline in ocr.ts but for PDF files.
 *
 * Flow:
 *   1. Extract text from every page via PDF.js (extractPdfText from fileParsers.ts)
 *   2. Convert to lightweight markdown (heading + page sections)
 *   3. Write a FileRecord with sourceType: "pdf" to IndexedDB
 *   4. Chunk and index into chunks + terms stores
 *
 * The unified ingestion contract:
 *   isTextFile  → readSupportedFile()    → indexFile() in fileIndex.ts
 *   isPdfFile   → ingestPdfAsMarkdown()  → this file
 *   isImageFile → ingestImageAsMarkdown() → ocr.ts
 *
 * All three paths produce indexed FileRecords — the model always searches text.
 */

import { uid } from "./utils";
import { extractPdfText, isPdfFile } from "./fileParsers";
import { chunkText, tokenize } from "./fileIndex";
import { putFile, putChunks, putTerms } from "./db";
import type { FileRecord, ChunkRecord, TermRecord } from "./types";

// ── Markdown normalisation ───────────────────────────────────────────────────────

/**
 * Converts raw PDF text (pages joined with \f) into markdown.
 * Each page becomes an H2 section. Short/empty pages are skipped.
 */
function pdfTextToMarkdown(rawText: string, sourceName: string): string {
  const displayName = sourceName.replace(/\.pdf$/i, "");
  const header = `# ${displayName}\n\n`;

  const pages = rawText.split("\f").map((p) => p.trim()).filter(Boolean);

  if (pages.length === 0) return header + "_No extractable text found in this PDF._";

  if (pages.length === 1) {
    // Single-page or short PDF — no need for section headers
    return header + pages[0];
  }

  return (
    header +
    pages
      .map((page, i) => `## Page ${i + 1}\n\n${page}`)
      .join("\n\n")
  );
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function computeTf(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  const total = tokens.length || 1;
  const tf = new Map<string, number>();
  for (const [term, count] of counts) tf.set(term, count / total);
  return tf;
}

function simpleHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (Math.imul(h, 0x01000193) >>> 0);
  }
  return h.toString(16);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface PDFIngestionResult {
  /** Markdown produced from the PDF */
  markdown: string;
  /** The FileRecord written to IndexedDB */
  fileRecord: FileRecord;
  /** Number of pages extracted */
  pageCount: number;
  /** Total word count across all pages */
  wordCount: number;
  /** Original PDF file name */
  sourceName: string;
}

/**
 * Full ingestion pipeline for a PDF File object:
 *   1. Extract text via PDF.js
 *   2. Normalise to markdown with per-page H2 sections
 *   3. Store a FileRecord with sourceType: "pdf"
 *   4. Chunk and index into chunks + terms
 *
 * Returns null if the file is not a PDF, too large, or text extraction fails.
 *
 * @param pdfFile  The PDF File object
 * @param rootId   The FileRootRecord id this should belong to
 */
export async function ingestPdfAsMarkdown(
  pdfFile: File,
  rootId: string
): Promise<PDFIngestionResult | null> {
  if (!isPdfFile(pdfFile.name)) return null;

  // 1. Extract text
  const rawText = await extractPdfText(pdfFile);
  if (rawText === null) {
    console.warn("[pdfIngestion] extractPdfText returned null for", pdfFile.name);
    return null;
  }

  // 2. Normalise to markdown
  const markdown = pdfTextToMarkdown(rawText, pdfFile.name);

  // 3. Build FileRecord
  const now = Date.now();
  const companionName = pdfFile.name.replace(/\.pdf$/i, "") + ".md";
  const fileId = uid();

  const pageCount = rawText.split("\f").filter((p) => p.trim()).length;
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;

  const fileRecord: FileRecord = {
    id: fileId,
    rootId,
    path: companionName,
    name: companionName,
    ext: ".md",
    size: new TextEncoder().encode(markdown).byteLength,
    modifiedAt: now,
    contentHash: simpleHash(markdown),
    indexedAt: now,
    ingestedAt: now,
    sourceType: "pdf",
  };

  await putFile(fileRecord);

  // 4. Chunk and index
  const rawChunks = chunkText(markdown, ".md");
  const chunkRecords: ChunkRecord[] = [];
  const termRecords: TermRecord[] = [];

  for (let i = 0; i < rawChunks.length; i++) {
    const chunkStr = rawChunks[i];
    const chunkId = uid();
    const tokens = tokenize(chunkStr);
    const tf = computeTf(tokens);

    chunkRecords.push({
      id: chunkId,
      fileId,
      ordinal: i,
      text: chunkStr,
      textLower: chunkStr.toLowerCase(),
      tokenCount: tokens.length,
    });

    for (const [term, tfScore] of tf) {
      termRecords.push({ term, chunkId, tf: tfScore });
    }
  }

  await putChunks(chunkRecords);
  await putTerms(termRecords);

  return { markdown, fileRecord, pageCount, wordCount, sourceName: pdfFile.name };
}
