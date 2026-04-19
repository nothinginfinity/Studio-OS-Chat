import { useState, useCallback, useEffect } from "react";
import { indexDirectory, indexFileList } from "../lib/fileIndex";
import { putFileRoot, listFileRoots } from "../lib/db";
import { uid } from "../lib/utils";
import type { FileRootRecord } from "../lib/types";

export interface IndexingProgress {
  total: number;
  done: number;
  currentFile: string;
}

export function useFiles() {
  const [roots, setRoots] = useState<FileRootRecord[]>([]);
  const [progress, setProgress] = useState<IndexingProgress | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load persisted roots from IndexedDB on mount — fixes empty roots after reload
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
          await indexFileList(files, rootId, (prog) =>
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
        await indexFileList(files, rootId, (prog) =>
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

  return { roots, progress, isIndexing, error, addFolder, addFiles };
}
