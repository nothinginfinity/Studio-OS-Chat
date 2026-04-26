import { useRef, useState, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { CsvMeta } from "../lib/types";

const VIRTUALIZATION_THRESHOLD = 2000;
const ESTIMATED_ROW_HEIGHT = 32;

interface Props {
  rows: Record<string, string>[];
  headers: string[];
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  csvMeta?: CsvMeta;
}

export function CsvTableView({ rows, headers, page, pageSize, onPageChange, csvMeta }: Props) {
  const useVirtual = rows.length > VIRTUALIZATION_THRESHOLD;

  return (
    <div className="csv-table-wrap">
      {csvMeta && (
        <div className="csv-meta-bar">
          <span className="csv-meta-pill">{csvMeta.rowCount.toLocaleString()} rows</span>
          <span className="csv-meta-pill">{csvMeta.columns.length} cols</span>
          {csvMeta.columns.map(col => (
            <span key={col.name} className="csv-meta-pill csv-meta-pill--col" title={`${col.nullCount} nulls`}>
              {col.name}
              <span className="csv-col-type">{col.type}</span>
            </span>
          ))}
        </div>
      )}
      {useVirtual
        ? <VirtualizedTable rows={rows} headers={headers} />
        : <PaginatedTable
            rows={rows}
            headers={headers}
            page={page}
            pageSize={pageSize}
            onPageChange={onPageChange}
          />
      }
    </div>
  );
}

// ─── B-3: Jump-to-row input ───────────────────────────────────────────────────

function JumpToRow({
  totalRows,
  onJump,
}: {
  totalRows: number;
  onJump: (rowIndex: number) => void;
}) {
  const [inputVal, setInputVal] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(inputVal, 10);
    if (!isNaN(n) && n >= 1 && n <= totalRows) {
      onJump(n - 1); // convert 1-based user input to 0-based index
      setInputVal("");
    }
  }

  return (
    <form
      className="csv-jump-row"
      onSubmit={handleSubmit}
      aria-label="Jump to row"
    >
      <label className="csv-jump-label" htmlFor="csv-jump-input">
        Jump to row:
      </label>
      <input
        id="csv-jump-input"
        className="csv-jump-input"
        type="number"
        min={1}
        max={totalRows}
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        placeholder={`1–${totalRows.toLocaleString()}`}
        aria-label={`Jump to row (1 to ${totalRows.toLocaleString()})`}
      />
      <button type="submit" className="csv-jump-btn" aria-label="Go to row">
        Go
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────
// Virtualized path  (rows.length > 2000)
// ─────────────────────────────────────────────
function VirtualizedTable({ rows, headers }: { rows: Record<string, string>[]; headers: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 10,
  });

  // B-3: Jump-to-row handler — scrollToIndex via virtualizer
  const handleJump = useCallback((rowIndex: number) => {
    virtualizer.scrollToIndex(rowIndex, { align: "start", behavior: "smooth" });
  }, [virtualizer]);

  const totalHeight = virtualizer.getTotalSize();
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <>
      <p className="sr-only" role="note">
        Large dataset: {rows.length.toLocaleString()} rows,{" "}
        {headers.length} column{headers.length !== 1 ? "s" : ""}.
        For row-by-row accessible navigation, use datasets under {VIRTUALIZATION_THRESHOLD.toLocaleString()} rows
        to enable the paginated view.
      </p>

      {/* B-3: Jump-to-row control above the virtual scroll container */}
      <JumpToRow totalRows={rows.length} onJump={handleJump} />

      <div
        ref={scrollRef}
        className="csv-table-scroll"
        style={{ overflowY: "auto", maxHeight: "60vh" }}
        aria-hidden="true"
      >
        <table className="csv-table">
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} className="csv-th" scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody style={{ height: totalHeight, position: "relative", display: "block" }}>
            {virtualItems.map(virtualRow => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className={virtualRow.index % 2 === 0 ? "csv-tr" : "csv-tr csv-tr--alt"}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {headers.map(h => (
                    <td key={h} className="csv-td">{row[h] ?? ""}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Paginated path  (rows.length <= 2000)
// ─────────────────────────────────────────────
function PaginatedTable({
  rows, headers, page, pageSize, onPageChange,
}: {
  rows: Record<string, string>[];
  headers: string[];
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const start = page * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return (
    <>
      <div className="csv-table-scroll">
        <table className="csv-table">
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} className="csv-th" scope="col">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="csv-td csv-td--empty">
                  No rows to display.
                </td>
              </tr>
            ) : (
              slice.map((row, i) => (
                <tr key={start + i} className={i % 2 === 0 ? "csv-tr" : "csv-tr csv-tr--alt"}>
                  {headers.map(h => (
                    <td key={h} className="csv-td">{row[h] ?? ""}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="csv-pagination">
          <button
            className="csv-page-btn"
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            aria-label="Previous page"
          >
            ‹ Prev
          </button>
          <span className="csv-page-label">
            Page {page + 1} of {totalPages}
            <span className="csv-page-sub">
              &nbsp;({(start + 1).toLocaleString()}–{Math.min(start + pageSize, rows.length).toLocaleString()} of {rows.length.toLocaleString()})
            </span>
          </span>
          <button
            className="csv-page-btn"
            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            aria-label="Next page"
          >
            Next ›
          </button>
        </div>
      )}
    </>
  );
}
