import { useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface NodeProps {
  label: string;
  value: JsonValue;
  depth: number;
  defaultExpanded?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isObject(v: JsonValue): v is { [key: string]: JsonValue } {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isArray(v: JsonValue): v is JsonValue[] {
  return Array.isArray(v);
}

function typeLabel(v: JsonValue): string {
  if (v === null) return "null";
  if (isArray(v)) return `Array[${v.length}]`;
  if (isObject(v)) return `{${Object.keys(v).length}}`;
  return typeof v;
}

function scalarClass(v: JsonValue): string {
  if (v === null) return "jtv-null";
  if (typeof v === "boolean") return "jtv-bool";
  if (typeof v === "number") return "jtv-number";
  return "jtv-string";
}

function renderScalar(v: string | number | boolean | null): string {
  if (v === null) return "null";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

// ── TreeNode ──────────────────────────────────────────────────────────────────

function TreeNode({ label, value, depth, defaultExpanded = depth < 2 }: NodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isExpandable = isObject(value) || isArray(value);

  if (!isExpandable) {
    return (
      <div className="jtv-row" style={{ paddingLeft: `${depth * 16}px` }}>
        <span className="jtv-key">{label}</span>
        <span className="jtv-colon">: </span>
        <span className={scalarClass(value)}>{renderScalar(value as string | number | boolean | null)}</span>
      </div>
    );
  }

  const entries: Array<[string, JsonValue]> = isArray(value)
    ? (value as JsonValue[]).map((v, i) => [String(i), v])
    : Object.entries(value as { [key: string]: JsonValue });

  return (
    <div className="jtv-node">
      <div
        className="jtv-row jtv-row--expandable"
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={() => setExpanded(e => !e)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setExpanded(v => !v); }}
      >
        <span className="jtv-toggle">{expanded ? "▾" : "▸"}</span>
        <span className="jtv-key">{label}</span>
        <span className="jtv-colon">: </span>
        <span className="jtv-type-hint">{typeLabel(value)}</span>
      </div>
      {expanded && (
        <div className="jtv-children">
          {entries.map(([k, v]) => (
            <TreeNode key={k} label={k} value={v} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── JsonTreeView (public export) ──────────────────────────────────────────────

interface JsonTreeViewProps {
  /** Raw JSON string to render */
  raw: string;
}

export function JsonTreeView({ raw }: JsonTreeViewProps) {
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(raw) as JsonValue;
  } catch {
    return (
      <div className="jtv-parse-error">
        <span className="jtv-error-icon">⚠️</span>
        <p>Could not parse JSON: invalid syntax.</p>
        <pre className="jtv-raw-fallback">{raw}</pre>
      </div>
    );
  }

  const root: JsonValue = parsed;
  const isExpandable = isObject(root) || isArray(root);

  return (
    <div className="jtv-root" role="tree" aria-label="JSON tree">
      {isExpandable ? (
        <TreeNode label="(root)" value={root} depth={0} defaultExpanded />
      ) : (
        <div className="jtv-row">
          <span className={scalarClass(root)}>{renderScalar(root as string | number | boolean | null)}</span>
        </div>
      )}
    </div>
  );
}
