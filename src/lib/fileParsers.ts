/**
 * fileParsers.ts — v5
 * Phase 1: added CSV routing case + isCsvFile predicate
 */

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".json",
  ".js", ".ts", ".tsx", ".jsx",
  ".html", ".css",
  ".yml", ".yaml",
  ".py",
  ".java", ".go", ".rs",
  ".sh"
]);

const CSV_EXTENSIONS = new Set([".csv"]);

const PDF_EXTENSIONS = new Set([".pdf"]);

const IMAGE_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".tif"
]);

const MAX_TEXT_BYTES   = 3  * 1024 * 1024;
const MAX_BINARY_BYTES = 50 * 1024 * 1024;

// ── CDN dynamic import helper ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const cdnImport = new Function("url", "return import(url)") as
  (url: string) => Promise<Record<string, unknown>>;

// ── Public predicates ────────────────────────────────────────────────────────

export function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function isTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.has(fileExt(name));
}

export function isCsvFile(name: string): boolean {
  return CSV_EXTENSIONS.has(fileExt(name));
}

export function isPdfFile(name: string): boolean {
  return PDF_EXTENSIONS.has(fileExt(name));
}

export function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(fileExt(name));
}

export function isSupportedFile(name: string): boolean {
  return isTextFile(name) || isCsvFile(name) || isPdfFile(name) || isImageFile(name);
}

// ── Text parser ──────────────────────────────────────────────────────────────

export async function readSupportedFile(file: File): Promise<string | null> {
  if (!isTextFile(file.name)) return null;
  if (file.size > MAX_TEXT_BYTES) return null;

  const text = await file.text();

  const sample = text.slice(0, 512);
  const nonPrintable = [...sample].filter(
    (c) => c.charCodeAt(0) < 9 || (c.charCodeAt(0) > 13 && c.charCodeAt(0) < 32)
  ).length;
  if (nonPrintable / Math.max(sample.length, 1) > 0.1) return null;

  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

// ── PDF parser (PDF.js via cdnjs CDN) ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PdfjsLib = any;

let _pdfjsCache: PdfjsLib | null = null;

async function getPdfjsLib(): Promise<PdfjsLib> {
  if (_pdfjsCache) return _pdfjsCache;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  if (g.pdfjsLib) {
    _pdfjsCache = g.pdfjsLib;
    return _pdfjsCache;
  }

  const mod: PdfjsLib = await cdnImport(
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs"
  );

  mod.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs";

  _pdfjsCache = mod;
  g.pdfjsLib = mod;
  return mod;
}

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

    return pageTexts.join("\n\f\n");
  } catch (err) {
    console.error("[fileParsers] PDF extraction failed:", err);
    return null;
  }
}
