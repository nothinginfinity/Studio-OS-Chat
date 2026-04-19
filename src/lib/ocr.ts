/**
 * ocr.ts — v1
 *
 * OCR ingestion pipeline using Tesseract.js (WASM, runs fully in-browser).
 *
 * Design principle: OCR is NOT a chat tool — it is an ingestion pipeline.
 * An image goes in once; a markdown FileRecord comes out and is indexed into
 * the existing chunks/terms stores. Future searches hit the text index, not
 * the image.
 *
 * Modes:
 *   screenshot — UI text, labels, short lines. PSM 6 (uniform block of text).
 *   document   — photographed pages, multi-paragraph prose. PSM 3 (auto).
 *   code       — monospace screenshots; output wrapped in fenced code blocks. PSM 6.
 *   receipt    — structured fields (amounts, dates, vendors). PSM 4 (single column).
 *
 * Output: a markdown string ready to store as a companion .md FileRecord.
 */

import { uid } from "./utils";
import { chunkText } from "./fileIndex";
import { putFile, putChunks, putTerms } from "./db";
import { tokenize } from "./fileIndex";
import type { FileRecord, ChunkRecord, TermRecord, OCRMode } from "./types";

// ── Tesseract.js lazy loader ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TesseractStatic = any;

let _tesseract: TesseractStatic | null = null;

async function getTesseract(): Promise<TesseractStatic> {
  if (_tesseract) return _tesseract;
  // Dynamic import from esm.sh — no bundler config needed
  const mod = await import(
    /* @vite-ignore */
    "https://esm.sh/tesseract.js@5"
  );
  _tesseract = mod.default ?? mod;
  return _tesseract;
}

// ── Mode → Tesseract PSM mapping ───────────────────────────────────────────────

// Tesseract Page Segmentation Modes
const PSM = {
  AUTO:           3,
  SINGLE_COLUMN:  4,
  UNIFORM_BLOCK:  6,
} as const;

function psmForMode(mode: OCRMode): number {
  switch (mode) {
    case "screenshot": return PSM.UNIFORM_BLOCK;
    case "document":   return PSM.AUTO;
    case "code":       return PSM.UNIFORM_BLOCK;
    case "receipt":    return PSM.SINGLE_COLUMN;
  }
}

// ── Raw OCR ────────────────────────────────────────────────────────────────────

async function runTesseract(
  imageFile: File,
  mode: OCRMode,
  lang = "eng"
): Promise<string> {
  const Tesseract = await getTesseract();
  const psm = psmForMode(mode);

  const worker = await Tesseract.createWorker(lang, 1, {
    // Silence Tesseract's verbose console logs in production
    logger: import.meta.env.DEV
      ? (m: unknown) => console.debug("[tesseract]", m)
      : () => undefined,
  });

  await worker.setParameters({ tessedit_pageseg_mode: psm });

  const { data } = await worker.recognize(imageFile);
  await worker.terminate();

  return data.text ?? "";
}

// ── Post-processing: raw text → markdown ─────────────────────────────────────────

function normalizeToMarkdown(raw: string, mode: OCRMode, sourceName: string): string {
  // Normalize line endings and collapse runs of blank lines
  const text = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const header = `# OCR: ${sourceName}\n\n`;

  switch (mode) {
    case "code":
      // Wrap entire output in a fenced code block
      return `${header}\`\`\`\n${text}\n\`\`\``;

    case "receipt": {
      // Light field parsing: lines with key: value pattern become bold labels
      const lines = text.split("\n").map((line) => {
        const match = line.match(/^([A-Za-z][\w\s]{1,30}):\s*(.+)$/);
        if (match) return `**${match[1].trim()}:** ${match[2].trim()}`;
        return line;
      });
      return header + lines.join("\n");
    }

    case "screenshot":
    case "document":
    default:
      // Prose: paragraphs separated by blank lines, trimmed
      return header + text;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────────

export interface OCRResult {
  /** The companion markdown string produced from the image */
  markdown: string;
  /** The FileRecord written to IndexedDB (the .md companion) */
  fileRecord: FileRecord;
  /** Original image file name */
  sourceName: string;
  /** OCR mode used */
  mode: OCRMode;
  /** Word count of extracted text */
  wordCount: number;
}

/**
 * Full ingestion pipeline for an image file:
 *   1. Run Tesseract OCR with the appropriate PSM for `mode`
 *   2. Normalise raw text to markdown
 *   3. Store a companion FileRecord (ext: .md, sourceType: "ocr")
 *   4. Chunk and index the markdown text into chunks + terms stores
 *
 * The original image is NOT stored here — the caller is responsible for
 * storing the binary (e.g. as a Blob URL or separate asset record).
 *
 * @param imageFile  The image File object from a file input or drag-and-drop
 * @param rootId     The FileRootRecord id this should belong to
 * @param mode       OCR mode: "screenshot" | "document" | "code" | "receipt"
 * @param lang       Tesseract language code (default: "eng")
 */
export async function ingestImageAsMarkdown(
  imageFile: File,
  rootId: string,
  mode: OCRMode = "screenshot",
  lang = "eng"
): Promise<OCRResult> {
  // 1. Run OCR
  const rawText = await runTesseract(imageFile, mode, lang);

  // 2. Normalise to markdown
  const markdown = normalizeToMarkdown(rawText, mode, imageFile.name);

  // 3. Build the companion FileRecord
  const now = Date.now();
  const companionName = imageFile.name.replace(/\.[^.]+$/, "") + ".md";
  const companionPath = companionName;
  const fileId = uid();

  const fileRecord: FileRecord = {
    id: fileId,
    rootId,
    path: companionPath,
    name: companionName,
    ext: ".md",
    size: new TextEncoder().encode(markdown).byteLength,
    modifiedAt: now,
    contentHash: simpleHash(markdown),
    indexedAt: now,
    ingestedAt: now,
    sourceType: "ocr",
    ocrMode: mode,
    // sourceFileId is set by the caller if it has stored the original image record
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

  const wordCount = rawText.split(/\s+/).filter(Boolean).length;

  return { markdown, fileRecord, sourceName: imageFile.name, mode, wordCount };
}

// ── Internal helpers ────────────────────────────────────────────────────────────

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
