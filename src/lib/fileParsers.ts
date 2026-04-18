/**
 * fileParsers.ts — v3
 * Reads supported text/code files into a plain string.
 * Binary, unsupported, and oversized files return null.
 */

const SUPPORTED_EXTENSIONS = new Set([
  ".txt", ".md", ".json",
  ".js", ".ts", ".tsx", ".jsx",
  ".html", ".css",
  ".yml", ".yaml",
  ".csv",
  ".py",
  ".java", ".go", ".rs",
  ".sh"
]);

// 3 MB — skip larger files in v3
const MAX_FILE_BYTES = 3 * 1024 * 1024;

export function isSupportedFile(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return false;
  return SUPPORTED_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

export function fileExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export async function readSupportedFile(file: File): Promise<string | null> {
  if (!isSupportedFile(file.name)) return null;
  if (file.size > MAX_FILE_BYTES) return null;

  const text = await file.text();

  // Heuristic: if more than 10 % of the first 512 chars are non-printable,
  // treat it as binary and skip.
  const sample = text.slice(0, 512);
  const nonPrintable = [...sample].filter(
    (c) => c.charCodeAt(0) < 9 || (c.charCodeAt(0) > 13 && c.charCodeAt(0) < 32)
  ).length;
  if (nonPrintable / Math.max(sample.length, 1) > 0.1) return null;

  // Normalize line endings
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
