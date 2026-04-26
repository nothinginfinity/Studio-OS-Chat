/**
 * useFiles.ts
 *
 * FIX-002-F4: route .csv files through ingestCsv() before indexFile() in
 * addFiles() and the addFolder fallback path, so CSV files get real text
 * content stored and show proper previews instead of
 * "No text content available for preview."
 */
import { useState, useCallback, useEffect } from "react";
import { indexDirectory, indexFileList, indexFile } from "../lib/fileIndex";
import { ingestCsv } from "../lib/csvIngestion";
import { putFileRoot, listFileRoots, removeFileRoot } from "../lib/db";
import { uid } from "../lib/utils";
import type { FileRootRecord } from "../lib/types";

export interface IndexingProgress {
  total: number;
  done: number;
  currentFile: string;
}

/**
 * Pre-processes a File before handing it off to indexFile().
 * For CSV files: runs ingestCsv() to parse the structure and converts the
 * tab-separated chunkText into a synthetic .txt File so that indexFile()
 * stores real searchable text content.
 * All other types are returned unchanged (indexFile handles them natively).
 */
async function preprocessFile(file: File): Promise<File> {
  const isCsv =
    file.type === "text/csv" ||
    file.type === "application/csv" ||
    file.name.toLowerCase().endsWith(".csv");

  if (!isCsv) return file;

  const result = await ingestCsv(file);
  if (!result) return file; // parse failed — let indexFile attempt to store as-is

  const textBlob = new Blob([result.chunkText], { type: "text/plain" });
  return new File([textBlob], file.name + ".txt", {
    type: "text/plain",
    lastModified: Date.now(),
  });
}

/**
 * Wraps indexFileList() with CSV pre-processing.
 * Each CSV is converted to a parsed .txt before indexing; all other types
 * pass through unchanged.
 */
async function indexFileListWithCsvSupport(
  files: File[],
  rootId: string,
  onProgress?: (p: { total: number; done: number; currentFile: string; skipped: number }) => void
): Promise<{ indexed: number; skipped: number }> {
  let indexed = 0;
  let skipped = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.({ total: files.length, done: i, currentFile: file.name, skipped });
    const processed = await preprocessFile(file);
    const ok = await indexFile(processed, rootId, processed.name);
    ok ? indexed++ : skipped++;
  }

  return { indexed, skipped };
}

export function useFiles() {
  const [roots, setRoots] = useState<FileRootRecord[]>([]);
  const [progress, setProgress] = useState<IndexingProgress | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFileRoots().then(setRoots).catch(() => {});
  }, []);

  const addFolder = useCallback(async () => {
    setError(null);
    try {
      if (typeof (window as any).showDirectoryPicker === "function") {
        const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker();
        setIsIndexing(true);
        const now = Date.now();
        const rootId = uid();
        const rootRecord: FileRootRecord = {
          id: rootId,
          name: handle.name,
          kind: "directory",
          addedAt: now,
          lastIndexedAt: null
        };
        await putFileRoot(rootRecord);
        await indexDirectory(handle, (prog) =>
          setProgress({ total: prog.total, done: prog.done, currentFile: prog.currentFile })
        );
        const finished: FileRootRecord = { ...rootRecord, lastIndexedAt: Date.now() };
        await putFileRoot(finished);
        setRoots((prev) => [...prev.filter((r) => r.id !== rootId), finished]);
      } else {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        // FIX-002-F4: accept CSV in the fallback folder picker too
        input.accept = "*/*";
        input.onchange = async () => {
          if (!input.files?.length) return;
          setIsIndexing(true);
          const files = Array.from(input.files);
          const now = Date.now();
          const rootId = uid();
          const rootRecord: FileRootRecord = {
            id: rootId,
            name: "Uploaded files",
            kind: "files",
            addedAt: now,
            lastIndexedAt: null
          };
          await putFileRoot(rootRecord);
          // FIX-002-F4: use CSV-aware indexing
          await indexFileListWithCsvSupport(files, rootId, (prog) =>
            setProgress({ total: prog.total, done: prog.done, currentFile: prog.currentFile })
          );
          const finished: FileRootRecord = { ...rootRecord, lastIndexedAt: Date.now() };
          await putFileRoot(finished);
          setRoots((prev) => [...prev.filter((r) => r.id !== rootId), finished]);
          setIsIndexing(false);
          setProgress(null);
        };
        input.click();
        return;
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Failed to index folder");
      }
    } finally {
      setIsIndexing(false);
      setProgress(null);
    }
  }, []);

  const addFiles = useCallback(async () => {
    setError(null);
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    // FIX-002-F4: explicitly include CSV so the file picker shows them
    input.accept = "*,.csv,text/csv";
    input.onchange = async () => {
      if (!input.files?.length) return;
      setIsIndexing(true);
      try {
        const files = Array.from(input.files);
        const now = Date.now();
        const rootId = uid();
        const rootRecord: FileRootRecord = {
          id: rootId,
          name: "Uploaded files",
          kind: "files",
          addedAt: now,
          lastIndexedAt: null
        };
        await putFileRoot(rootRecord);
        // FIX-002-F4: use CSV-aware indexing instead of bare indexFileList()
        await indexFileListWithCsvSupport(files, rootId, (prog) =>
          setProgress({ total: prog.total, done: prog.done, currentFile: prog.currentFile })
        );
        const finished: FileRootRecord = { ...rootRecord, lastIndexedAt: Date.now() };
        await putFileRoot(finished);
        setRoots((prev) => [...prev.filter((r) => r.id !== rootId), finished]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to index files");
      } finally {
        setIsIndexing(false);
        setProgress(null);
      }
    };
    input.click();
  }, []);

  const removeRoot = useCallback(async (rootId: string) => {
    await removeFileRoot(rootId);
    setRoots((prev) => prev.filter((r) => r.id !== rootId));
  }, []);

  const reindexRoot = useCallback(async (_rootId: string) => {
    // Placeholder until source handles are persisted.
    // For now this preserves the UX contract and can later reopen the picker.
    console.info("[Files] reindex requested");
  }, []);

  return {
    roots,
    progress,
    isIndexing,
    error,
    addFolder,
    addFiles,
    removeRoot,
    reindexRoot,
  };
}
