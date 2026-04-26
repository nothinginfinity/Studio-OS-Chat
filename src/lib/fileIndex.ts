/**
 * fileIndex.ts — v3
 * Ingestion pipeline: file → chunks → terms → IndexedDB
 *
 * B-1: indexFile() now accepts an optional `extra` partial FileRecord that is
 * merged in before putFile. This lets callers (e.g. useFiles CSV path) attach
 * csvMeta / chartSpecs without duplicating the indexing logic.
 */

import { uid } from "./utils";
import { isSupportedFile, fileExt, readSupportedFile } from "./fileParsers";
import { putFile, putChunks, putTerms, putFileRoot } from "./db";
import type { FileRecord, ChunkRecord, TermRecord, FileRootRecord } from "./types";

// ── Tokenizer ──────────────────────────────────────────────────────────────────

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Split camelCase and snake_case so identifiers are findable as sub-tokens
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_+/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && t.length <= 64);
}

function computeTf(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  const total = tokens.length || 1;
  const tf = new Map<string, number>();
  for (const [term, count] of counts) tf.set(term, count / total);
  return tf;
}

// ── Chunking ────────────────────────────────────────────────────────────────────

const CODE_EXTS = new Set([
  ".js", ".ts", ".tsx", ".jsx", ".py", ".java",
  ".go", ".rs", ".sh", ".css", ".html"
]);

const CODE_CHUNK_LINES = 100;
const CODE_OVERLAP_LINES = 15;
const PROSE_CHUNK_CHARS = 900;
const PROSE_OVERLAP_CHARS = 120;

function chunkCode(text: string): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const slice = lines.slice(i, i + CODE_CHUNK_LINES).join("\n");
    if (slice.trim()) chunks.push(slice);
    i += CODE_CHUNK_LINES - CODE_OVERLAP_LINES;
  }
  return chunks;
}

function chunkProse(text: string): string[] {
  // Split on blank lines (paragraph boundaries) first, then merge into target size
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > PROSE_CHUNK_CHARS && current.length > 0) {
      chunks.push(current.trim());
      // carry overlap: last PROSE_OVERLAP_CHARS of current
      current = current.slice(-PROSE_OVERLAP_CHARS) + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export function chunkText(text: string, ext: string): string[] {
  return CODE_EXTS.has(ext) ? chunkCode(text) : chunkProse(text);
}

// ── Content hash (simple, no crypto dependency) ─────────────────────────────────

function simpleHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (Math.imul(h, 0x01000193) >>> 0);
  }
  return h.toString(16);
}

// ── Progress callback type ─────────────────────────────────────────────────────────

export interface IndexProgress {
  total: number;
  done: number;
  currentFile: string;
  skipped: number;
}

export type ProgressCallback = (p: IndexProgress) => void;

// ── Index a single File object ─────────────────────────────────────────────────────

/**
 * Index a single File into IndexedDB.
 *
 * @param extra  Optional partial FileRecord to merge in before writing.
 *               Callers can use this to attach csvMeta, chartSpecs, ocrMode, etc.
 *               without duplicating the indexing pipeline.
 *               Fields `id`, `rootId`, `path`, `name`, `ext`, `size`,
 *               `modifiedAt`, `contentHash`, `indexedAt`, `ingestedAt`, and
 *               `sourceType` are always set by this function and cannot be
 *               overridden via `extra`.
 */
export async function indexFile(
  file: File,
  rootId: string,
  relativePath: string,
  extra?: Partial<FileRecord>
): Promise<boolean> {
  if (!isSupportedFile(file.name)) return false;

  const text = await readSupportedFile(file);
  if (text === null) return false;

  const ext = fileExt(file.name);
  const hash = simpleHash(text);
  const fileId = uid();
  const now = Date.now();

  const fileRecord: FileRecord = {
    // Spread caller extras first so our required fields always win
    ...extra,
    id: fileId,
    rootId,
    path: relativePath,
    name: file.name,
    ext,
    size: file.size,
    modifiedAt: file.lastModified || now,
    contentHash: hash,
    indexedAt: now,
    ingestedAt: now,
    sourceType: "file",
  };

  await putFile(fileRecord);

  const rawChunks = chunkText(text, ext);
  const chunkRecords: ChunkRecord[] = [];
  const termRecords: TermRecord[] = [];

  for (let i = 0; i < rawChunks.length; i++) {
    const chunkText = rawChunks[i];
    const chunkId = uid();
    const tokens = tokenize(chunkText);
    const tf = computeTf(tokens);

    chunkRecords.push({
      id: chunkId,
      fileId,
      ordinal: i,
      text: chunkText,
      textLower: chunkText.toLowerCase(),
      tokenCount: tokens.length
    });

    for (const [term, tfScore] of tf) {
      termRecords.push({ term, chunkId, tf: tfScore });
    }
  }

  await putChunks(chunkRecords);
  await putTerms(termRecords);

  return true;
}

// ── Index a batch of File objects (file input fallback) ─────────────────────────────

export async function indexFileList(
  files: File[],
  rootId: string,
  onProgress?: ProgressCallback
): Promise<{ indexed: number; skipped: number }> {
  let indexed = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.({
      total: files.length,
      done: i,
      currentFile: file.name,
      skipped
    });
    const ok = await indexFile(file, rootId, file.name);
    ok ? indexed++ : skipped++;
  }

  return { indexed, skipped };
}

// ── Index a directory via FileSystemDirectoryHandle ───────────────────────────────

async function walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  rootId: string,
  prefix: string,
  collector: Array<{ file: File; path: string }>
): Promise<void> {
  for await (const [name, handle] of dirHandle) {
    if (handle.kind === "directory") {
      await walkDirectory(
        handle as FileSystemDirectoryHandle,
        rootId,
        prefix ? `${prefix}/${name}` : name,
        collector
      );
    } else if (handle.kind === "file" && isSupportedFile(name)) {
      const file = await (handle as FileSystemFileHandle).getFile();
      collector.push({ file, path: prefix ? `${prefix}/${name}` : name });
    }
  }
}

export async function indexDirectory(
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: ProgressCallback
): Promise<{ rootId: string; indexed: number; skipped: number }> {
  const rootId = uid();
  const now = Date.now();

  const root: FileRootRecord = {
    id: rootId,
    name: dirHandle.name,
    kind: "directory",
    addedAt: now,
    lastIndexedAt: null
  };
  await putFileRoot(root);

  // Walk first to get total count for progress
  const collector: Array<{ file: File; path: string }> = [];
  await walkDirectory(dirHandle, rootId, "", collector);

  let indexed = 0;
  let skipped = 0;

  for (let i = 0; i < collector.length; i++) {
    const { file, path } = collector[i];
    onProgress?.({
      total: collector.length,
      done: i,
      currentFile: path,
      skipped
    });
    const ok = await indexFile(file, rootId, path);
    ok ? indexed++ : skipped++;
  }

  // Mark last indexed time
  await putFileRoot({ ...root, lastIndexedAt: Date.now() });

  return { rootId, indexed, skipped };
}
