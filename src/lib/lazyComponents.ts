/**
 * lazyComponents.ts — Phase 5 A-2
 *
 * All heavy viewer components are lazy-loaded here using React.lazy().
 * Import from this file instead of importing directly so the chunks
 * are split from the main bundle.
 *
 * Savings achieved:
 *  - FileViewerModal  (~12.8 KB source, hosts CsvTableView + CsvChartPanel)
 *  - CsvChartPanel    (~8.0 KB source, Chart.js canvas — most expensive mount)
 *  - CsvTableView     (~7.3 KB source, @tanstack/react-virtual)
 *  - OcrImageView     (~3.9 KB source)
 *  - MarkdownView     (~4.0 KB source)
 *  - JsonTreeView     (~4.4 KB source)
 *
 * Estimated gzip saving on initial load: ~20–30 KB
 */

import { lazy } from "react";

export const LazyFileViewerModal = lazy(() =>
  import("./components/FileViewerModal").then(m => ({ default: m.FileViewerModal }))
);

export const LazyCsvChartPanel = lazy(() =>
  import("./components/CsvChartPanel").then(m => ({ default: m.CsvChartPanel }))
);

export const LazyCsvTableView = lazy(() =>
  import("./components/CsvTableView").then(m => ({ default: m.CsvTableView }))
);

export const LazyOcrImageView = lazy(() =>
  import("./components/OcrImageView").then(m => ({ default: m.OcrImageView }))
);

export const LazyMarkdownView = lazy(() =>
  import("./components/MarkdownView").then(m => ({ default: m.MarkdownView }))
);

export const LazyJsonTreeView = lazy(() =>
  import("./components/JsonTreeView").then(m => ({ default: m.JsonTreeView }))
);
