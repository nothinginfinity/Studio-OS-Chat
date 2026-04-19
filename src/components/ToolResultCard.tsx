import type { SearchResult } from "../lib/types";

interface Props {
  name: string;
  data: unknown;
}

function isSearchResults(data: unknown): data is SearchResult[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    typeof (data[0] as any)?.filePath === "string" &&
    typeof (data[0] as any)?.snippet === "string"
  );
}

function fileName(filePath: string): string {
  return filePath.split(/[\/\\]/).pop() ?? filePath;
}

export function ToolResultCard({ name, data }: Props) {
  if (isSearchResults(data)) {
    return (
      <div className="tool-card tool-card--files">
        <div className="tool-card-header">
          <span className="tool-card-icon">📂</span>
          <strong>{name}</strong>
          <span className="tool-card-count">{data.length} result{data.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="tool-card-results">
          {data.map((r) => (
            <div key={r.chunkId} className="tool-file-result">
              <div className="tool-file-name" title={r.filePath}>
                📄 {fileName(r.filePath)}
              </div>
              <div className="tool-file-snippet">{r.snippet}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Generic fallback for all other tools (echo, calculator, etc.)
  return (
    <div className="tool-card">
      <strong>{name}</strong>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
