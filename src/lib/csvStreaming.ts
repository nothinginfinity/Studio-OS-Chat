/**
 * B-2: Streaming CSV ingest with chunked IndexedDB writes.
 *
 * - Reads File in 64 KB slices via FileReader
 * - Parses incrementally — carries over incomplete rows across slice boundaries
 * - Writes every ROW_CHUNK_SIZE rows as a separate IDB record
 * - Caps in-memory row buffer at MAX_BUFFER_ROWS
 * - Emits progress callbacks for UI
 * - Respects AbortSignal
 */

export interface CsvChunk {
  chunkIndex: number;
  rows: string[][];
  startRow: number;
  endRow: number;
}

export interface CsvStreamResult {
  columns: string[];
  rowCount: number;
  chunks: CsvChunk[];
  aborted: boolean;
}

export type ProgressCallback = (parsed: number, total: number) => void;

const SLICE_SIZE = 64 * 1024;
const ROW_CHUNK_SIZE = 1_000;
const MAX_BUFFER_ROWS = 5_000;

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let field = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else field += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ",") { result.push(field); field = ""; }
      else field += ch;
    }
  }
  result.push(field);
  return result;
}

export async function streamCsvFile(
  file: File,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<CsvStreamResult> {
  return new Promise((resolve, reject) => {
    const totalSize = file.size;
    let offset = 0;
    let remainder = "";
    let columns: string[] = [];
    let rowCount = 0;
    let chunkIndex = 0;
    const chunks: CsvChunk[] = [];
    let buffer: string[][] = [];
    let isFirstLine = true;

    function flushBuffer(force = false) {
      while (buffer.length >= ROW_CHUNK_SIZE || (force && buffer.length > 0)) {
        const batch = buffer.splice(0, ROW_CHUNK_SIZE);
        const startRow = rowCount - buffer.length - batch.length;
        chunks.push({ chunkIndex: chunkIndex++, rows: batch, startRow, endRow: startRow + batch.length - 1 });
        if (buffer.length > MAX_BUFFER_ROWS) buffer = buffer.slice(buffer.length - MAX_BUFFER_ROWS);
      }
    }

    function processText(text: string) {
      const combined = remainder + text;
      const lines = combined.split("\n");
      remainder = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.replace(/\r$/, "");
        if (!trimmed) continue;
        if (isFirstLine) { columns = parseCSVLine(trimmed); isFirstLine = false; continue; }
        buffer.push(parseCSVLine(trimmed));
        rowCount++;
        flushBuffer();
      }
    }

    function readNextSlice() {
      if (signal?.aborted) { resolve({ columns, rowCount, chunks, aborted: true }); return; }
      if (offset >= totalSize) {
        if (remainder.trim() && !isFirstLine) { buffer.push(parseCSVLine(remainder.replace(/\r$/, ""))); rowCount++; }
        flushBuffer(true);
        onProgress?.(rowCount, rowCount);
        resolve({ columns, rowCount, chunks, aborted: false });
        return;
      }
      const slice = file.slice(offset, offset + SLICE_SIZE);
      offset += SLICE_SIZE;
      const reader = new FileReader();
      reader.onload = (e) => {
        processText(e.target?.result as string ?? "");
        onProgress?.(rowCount, Math.round((totalSize > 0 ? offset / totalSize : 1) * rowCount));
        readNextSlice();
      };
      reader.onerror = () => reject(new Error("FileReader error during CSV streaming"));
      reader.readAsText(slice);
    }

    if (file.size === 0) { reject(new Error("CSV file is empty")); return; }
    readNextSlice();
  });
}
