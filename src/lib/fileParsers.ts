/**
 * fileParsers.ts — v4
 *
 * Supported ingestion paths:
 *   1. Text / code files  → read as UTF-8 string (unchanged from v3)
 *   2. PDF files          → extract text via PDF.js (cdnjs build, no bundler needed)
 *   3. Image files        → return null from readSupportedFile(); OCR pipeline
 *                           handles images separately via src/lib/ocr.ts
 *
 * Call isSupportedFile()  to gate indexing (text + pdf + image).
 * Call isImageFile()      to route to the OCR pipeline instead of this parser.
 * Call isPdfFile()        to route to extractPdfText().
 */

// ── Extension sets ──────────────────────────────────────────────────────────────────

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".json",
  ".js", ".ts", ".tsx", ".jsx",
  ".html", ".css",
  ".yml", ".yaml",
  ".csv",
  ".py",
  ".java", ".go", ".rs",
  ".sh"
]);

const PDF_EXTENSIONS = new Set([".pdf"]);

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".tif"
]);

// 3 MB cap for text/code; 50 MB cap for PDF and images
const MAX_TEXT_BYTES  = 3  * 1024 * 1024;
const MAX_BINARY_BYTES = 50 * 1024 * 1024;

// ── Public predicates ───────────────────────────────────────────────────────────────

export function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function isTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.has(fileExt(name));
}

export function isPdfFile(name: string): boolean {
  return PDF_EXTENSIONS.has(fileExt(name));
}

export function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(fileExt(name));
}

/** True for any file type the system can ingest (text, pdf, or image). */
export function isSupportedFile(name: string): boolean {
  return isTextFile(name) || isPdfFile(name) || isImageFile(name);
}

// ── Text parser (unchanged from v3) ─────────────────────────────────────────────

export async function readSupportedFile(file: File): Promise<string | null> {
  if (!isTextFile(file.name)) return null;
  if (file.size > MAX_TEXT_BYTES) return null;

  const text = await file.text();

  // Heuristic: >10 % non-printable chars in first 512 bytes → binary, skip
  const sample = text.slice(0, 512);
  const nonPrintable = [...sample].filter(
    (c) => c.charCodeAt(0) < 9 || (c.charCodeAt(0) > 13 && c.charCodeAt(0) < 32)
  ).length;
  if (nonPrintable / Math.max(sample.length, 1) > 0.1) return null;

  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

// ── PDF parser (PDF.js via cdnjs CDN) ─────────────────────────────────────────────

// Using `any` here avoids a static `typeof import('pdfjs-dist')` annotation
// which would require pdfjs-dist in package.json and break the Vite build.
// PDF.js is loaded from CDN at runtime only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfjsLib = any;

let _pdfjsCache: PdfjsLib | null = null;

/**
 * Lazily loads PDF.js from cdnjs CDN and caches the module reference.
 * No static pdfjs-dist dependency required.
 */
async function getPdfjsLib(): Promise<PdfjsLib> {
  if (_pdfjsCache) return _pdfjsCache;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (g.pdfjsLib) {
    _pdfjsCache = g.pdfjsLib;
    return _pdfjsCache;
  }

  // Route through a plain string variable so TSC skips module resolution.
  // @vite-ignore prevents Vite from bundling it — loaded from CDN at runtime.
  const url: string = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: PdfjsLib = await (import(/* @vite-ignore */ url as any));

  // Point the worker at the matching CDN worker bundle
  mod.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs";

  _pdfjsCache = mod;
  g.pdfjsLib = mod;
  return mod;
}

/**
 * Extract all text from a PDF File object.
 * Returns the concatenated plain-text of every page, separated by form-feeds.
 * Returns null if the file is too large, not a PDF, or extraction fails.
 */
export async function extractPdfText(file: File): Promise<string | null> {
  if (!isPdfFile(file.name)) return null;
  if (file.size > MAX_BINARY_BYTES) return null;

  try {
    const pdfjs = await getPdfjsLib();
    const arrayBuffer = await file.arrayBuffer();

    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageStr = content.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/ {2,}/g, " ")
        .trim();
      if (pageStr) pageTexts.push(pageStr);
    }

    return pageTexts.join("\n\f\n"); // \f = form-feed as page separator
  } catch (err) {
    console.error("[fileParsers] PDF extraction failed:", err);
    return null;
  }
}

// ── Image passthrough note ────────────────────────────────────────────────────────────────
//
// Images are NOT parsed here. readSupportedFile() returns null for images.
// The OCR pipeline in src/lib/ocr.ts accepts a File directly and produces
// a markdown string that is then stored as a companion FileRecord and indexed
// via the standard fileIndex.ts path.
//
// Routing logic in fileIndex.ts:
//   isImageFile(file.name)  → ocr.ts → ingestImageAsMarkdown()
//   isPdfFile(file.name)    → fileParsers.ts → extractPdfText()
//   isTextFile(file.name)   → fileParsers.ts → readSupportedFile()
