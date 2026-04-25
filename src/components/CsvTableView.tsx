import type { CsvMeta } from "../lib/types";

interface Props {
  rows: Record<string, string>[];
  headers: string[];
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  csvMeta?: CsvMeta;
}

export function CsvTableView({ rows, headers, page, pageSize, onPageChange, csvMeta }: Props) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const start = page * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return (
    <div className="csv-table-wrap">
      {/* ── Meta bar ── */}
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

      {/* ── Table ── */}
      <div className="csv-table-scroll">
        <table className="csv-table">
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} className="csv-th">{h}</th>
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

      {/* ── Pagination ── */}
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
    </div>
  );
}
