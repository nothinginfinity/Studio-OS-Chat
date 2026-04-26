/**
 * A-3: React.memo wrapper for FileRootCard.
 * FilesPanel maps over roots — without memo, every card re-renders
 * whenever any root changes (e.g. progress tick on one file).
 */
import React, { memo } from "react";

export interface FileRootCardProps {
  id: string;
  name: string;
  fileCount: number;
  isIndexing: boolean;
  progress?: number;
  onClick: (id: string) => void;
}

const FileRootCardInner: React.FC<FileRootCardProps> = ({
  id, name, fileCount, isIndexing, progress, onClick,
}) => (
  <div
    data-testid="file-root-card"
    data-id={id}
    className="file-root-card"
    onClick={() => onClick(id)}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === "Enter" && onClick(id)}
  >
    <span className="file-root-card__name">{name}</span>
    <span className="file-root-card__count">{fileCount} files</span>
    {isIndexing && (
      <progress
        className="file-root-card__progress"
        value={progress ?? 0}
        max={1}
        aria-label={`Indexing ${name}`}
      />
    )}
  </div>
);

FileRootCardInner.displayName = "FileRootCard";

export const MemoizedFileRootCard = memo(
  FileRootCardInner,
  (prev, next) =>
    prev.id === next.id &&
    prev.name === next.name &&
    prev.fileCount === next.fileCount &&
    prev.isIndexing === next.isIndexing &&
    prev.progress === next.progress &&
    prev.onClick === next.onClick
);

MemoizedFileRootCard.displayName = "MemoizedFileRootCard";
