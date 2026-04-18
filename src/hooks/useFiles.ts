import { useState, useCallback } from "react";
import { indexDirectory, indexFileList } from "../lib/fileIndex";
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

  const addFolder = useCallback(async () => {
    setError(null);
    try {
      if (typeof (window as any).showDirectoryPicker === "function") {
        const handle: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker();
        setIsIndexing(true);
        const root = await indexDirectory(handle, (prog) => setProgress(prog));
        setRoots((prev) => [
          ...prev.filter((r) => r.id !== root.id),
          root
        ]);
      } else {
        // Fallback: file input
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.onchange = async () => {
          if (!input.files?.length) return;
          setIsIndexing(true);
          const root = await indexFileList(Array.from(input.files), (prog) =>
            setProgress(prog)
          );
          setRoots((prev) => [
            ...prev.filter((r) => r.id !== root.id),
            root
          ]);
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
        const root = await indexFileList(Array.from(input.files), (prog) =>
          setProgress(prog)
        );
        setRoots((prev) => [
          ...prev.filter((r) => r.id !== root.id),
          root
        ]);
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
