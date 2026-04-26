/**
 * pdfIngestion.ts — v2 · Phase 5 B-1
 *
 * PDF ingestion pipeline with:
 *   - Batched async generator: yields progress events as each page-group is indexed
 *   - AbortSignal support: caller can cancel mid-flight
 *   - 100 MB file size guard
 *   - Per-batch IDB writes (50 chunks at a time) to avoid blocking the main thread
 */

import { uid } from "./utils";
import { extractPdfText, isPdfFile } from "./fileParsers";
import { chunkText, tokenize } from "./fileIndex";
import { putFile, putChunks, putTerms } from "./db";
import type { FileRecord, ChunkRecord, TermRecord } from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Reject PDFs larger than 100 MB */
export const PDF_MAX_BYTES = 100 * 1024 * 1024;

/** Number of chunks written to IDB per batch (keeps main thread responsive) */
export const PDF_CHUNK_BATCH_SIZE = 50;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PDFIngestionResult {
  markdown: string;
  fileRecord: FileRecord;
  pageCount: number;
  wordCount: number;
  sourceName: string;
}

export interface PDFIngestionProgress {
  phase: "extracting" | "chunking" | "indexing" | "done";
  /** 0–1 fraction complete for the current phase */
  fraction: number;
  chunksWritten: number;
  totalChunks: number;
}

export type PDFProgressCallback = (p: PDFIngestionProgress) => void;

// ── Markdown normalisation ────────────────────────────────────────────────────

function pdfTextToMarkdown(rawText: string, sourceName: string): string {
  const displayName = sourceName.replace(/\.pdf$/i, "");
  const header = `# ${displayName}\n\n`;
  const pages = rawText.split("\f").map((p) => p.trim()).filter(Boolean);
  if (pages.length === 0) return header + "_No extractable text found in this PDF._";
  if (pages.length === 1) return header + pages[0];
  return header + pages.map((page, i) => `## Page ${i + 1}\n\n${page}`).join("\n\n");
}

// ── Internal helpers ──────────────────────────────────────────────────────────

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

/** Yield to the event loop once so the UI can update between batches. */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ── Batched async generator ───────────────────────────────────────────────────

/**
 * Streaming PDF ingestion generator.
 *
 * Usage:
 *   for await (const progress of ingestPdfStreaming(file, rootId, signal)) {
 *     updateUI(progress);
 *   }
 *
 * Yields progress events and writes to IDB in batches.
 * Resolves the FileRecord at the final "done" event (progress.fileRecord).
 */
export async function* ingestPdfStreaming(
  pdfFile: File,
  rootId: string,
  signal?: AbortSignal,
  onProgress?: PDFProgressCallback
): AsyncGenerator<PDFIngestionProgress & { fileRecord?: FileRecord }> {
  // Guard: type
  if (!isPdfFile(pdfFile.name)) return;

  // Guard: size
  if (pdfFile.size > PDF_MAX_BYTES) {
    throw new Error(
      `PDF too large: ${(pdfFile.size / 1024 / 1024).toFixed(1)} MB (max 100 MB)`
    );
  }

  signal?.throwIfAborted();

  // Phase 1: extract text
  yield { phase: "extracting", fraction: 0, chunksWritten: 0, totalChunks: 0 };
  onProgress?.({ phase: "extracting", fraction: 0, chunksWritten: 0, totalChunks: 0 });

  const rawText = await extractPdfText(pdfFile);
  if (rawText === null) throw new Error("PDF text extraction failed (encrypted or image-only PDF?)");

  signal?.throwIfAborted();

  yield { phase: "extracting", fraction: 1, chunksWritten: 0, totalChunks: 0 };

  // Phase 2: normalise to markdown
  const markdown = pdfTextToMarkdown(rawText, pdfFile.name);

  // Phase 3: build FileRecord and write to IDB
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
  signal?.throwIfAborted();

  // Phase 4: chunk + index in batches
  const rawChunks = chunkText(markdown, ".md");
  const totalChunks = rawChunks.length;

  yield { phase: "chunking", fraction: 0, chunksWritten: 0, totalChunks };

  let chunksWritten = 0;

  for (let batchStart = 0; batchStart < rawChunks.length; batchStart += PDF_CHUNK_BATCH_SIZE) {
    signal?.throwIfAborted();

    const batchEnd = Math.min(batchStart + PDF_CHUNK_BATCH_SIZE, rawChunks.length);
    const chunkRecords: ChunkRecord[] = [];
    const termRecords: TermRecord[] = [];

    for (let i = batchStart; i < batchEnd; i++) {
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
    await yieldToMain();

    chunksWritten += chunkRecords.length;
    const fraction = chunksWritten / totalChunks;

    const progress: PDFIngestionProgress = { phase: "indexing", fraction, chunksWritten, totalChunks };
    onProgress?.(progress);
    yield progress;
  }

  const doneProgress = { phase: "done" as const, fraction: 1, chunksWritten, totalChunks, fileRecord };
  onProgress?.({ phase: "done", fraction: 1, chunksWritten, totalChunks });
  yield doneProgress;
}

/**
 * Convenience wrapper — awaits the full generator and returns the result.
 * Use ingestPdfStreaming() directly if you need progress events.
 */
export async function ingestPdfAsMarkdown(
  pdfFile: File,
  rootId: string,
  signal?: AbortSignal,
  onProgress?: PDFProgressCallback
): Promise<PDFIngestionResult | null> {
  if (!isPdfFile(pdfFile.name)) return null;

  let lastResult: (PDFIngestionProgress & { fileRecord?: FileRecord }) | null = null;
  try {
    for await (const progress of ingestPdfStreaming(pdfFile, rootId, signal, onProgress)) {
      lastResult = progress;
    }
  } catch (e) {
    console.warn("[pdfIngestion] ingestPdfAsMarkdown failed:", e);
    return null;
  }

  if (!lastResult?.fileRecord) return null;

  const rawText = await extractPdfText(pdfFile) ?? "";
  return {
    markdown: pdfTextToMarkdown(rawText, pdfFile.name),
    fileRecord: lastResult.fileRecord,
    pageCount: rawText.split("\f").filter((p) => p.trim()).length,
    wordCount: rawText.split(/\s+/).filter(Boolean).length,
    sourceName: pdfFile.name,
  };
}
