/**
 * CsvChartPanel.tsx — Task B-2
 * Renders auto-generated template charts for a CSV file.
 * - Each ChartSpec → ChartTile with a live Chart.js canvas
 * - Tap tile → ChartExpandModal (full-screen)
 * - Long-press canvas → share chart as PNG via Web Share API
 * Zero network calls, zero LLM calls.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChartSpec } from '../lib/types';
import { renderChart } from '../lib/chartRenderer';
import { Chart } from 'chart.js';

// ── Type badge label map ─────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  line:    '📈 line',
  bar:     '📊 bar',
  pie:     '🥧 pie',
  scatter: '✦ scatter',
};

// ── Full-screen expand modal ─────────────────────────────────────────────────

interface ExpandModalProps {
  spec: ChartSpec;
  rows: Record<string, string>[];
  onClose: () => void;
}

const ChartExpandModal: React.FC<ExpandModalProps> = ({ spec, rows, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = renderChart(canvasRef.current, spec, rows, { width: 800, height: 500 });
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id, rows.length]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleShare() {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(async blob => {
      if (!blob) return;
      const file = new File([blob], `${spec.title}.png`, { type: 'image/png' });
      try {
        await navigator.share({ files: [file], title: spec.title });
      } catch {
        // share cancelled or unsupported — silent
      }
    }, 'image/png');
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div
      className="csv-chart-expand-backdrop"
      onClick={e => { if (e.currentTarget === e.target) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`Expanded chart: ${spec.title}`}
    >
      <div className="csv-chart-expand-shell">
        <div className="csv-chart-expand-header">
          <span className="csv-chart-expand-title">{spec.title}</span>
          <div className="csv-chart-expand-actions">
            {canShare && (
              <button
                className="csv-chart-expand-btn"
                onClick={handleShare}
                aria-label="Share chart as image"
                type="button"
              >
                ↥ Share
              </button>
            )}
            <button
              className="csv-chart-expand-btn csv-chart-expand-btn--close"
              onClick={onClose}
              aria-label="Close expanded chart"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="csv-chart-expand-canvas-wrapper">
          <canvas
            ref={canvasRef}
            aria-label={spec.title}
            role="img"
          />
        </div>
        <p className="csv-chart-expand-source">
          Auto-generated · <span>{spec.source}</span>
        </p>
      </div>
    </div>
  );
};

// ── Single chart tile ────────────────────────────────────────────────────────

interface TileProps {
  spec: ChartSpec;
  rows: Record<string, string>[];
  onExpand: (spec: ChartSpec) => void;
}

const ChartTile: React.FC<TileProps> = ({ spec, rows, onExpand }) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const chartRef    = useRef<Chart | null>(null);
  const pressTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current = renderChart(canvasRef.current, spec, rows);
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id, rows.length]);

  // Long-press → share as PNG (mobile-first)
  const startPress = useCallback(() => {
    pressTimer.current = setTimeout(async () => {
      if (!canvasRef.current) return;
      canvasRef.current.toBlob(async blob => {
        if (!blob) return;
        const file = new File([blob], `${spec.title}.png`, { type: 'image/png' });
        try {
          await navigator.share({ files: [file], title: spec.title });
        } catch {
          // cancelled or unsupported
        }
      }, 'image/png');
    }, 600);
  }, [spec.title]);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  return (
    <div
      className="csv-chart-tile"
      role="button"
      tabIndex={0}
      aria-label={`Chart: ${spec.title}. Tap to expand.`}
      onClick={() => onExpand(spec)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onExpand(spec); }}
    >
      <div className="csv-chart-tile-header">
        <span className="csv-chart-title">{spec.title}</span>
        <span
          className="csv-chart-type-badge"
          aria-label={`Chart type: ${spec.type}`}
        >
          {TYPE_LABEL[spec.type] ?? spec.type}
        </span>
      </div>
      <div className="csv-chart-canvas-wrapper">
        <canvas
          ref={canvasRef}
          aria-label={spec.title}
          role="img"
          onMouseDown={startPress}
          onMouseUp={cancelPress}
          onMouseLeave={cancelPress}
          onTouchStart={startPress}
          onTouchEnd={cancelPress}
          onTouchCancel={cancelPress}
        />
      </div>
      <p className="csv-chart-source-label">
        Auto-generated · <span className="csv-chart-source">{spec.source}</span>
        <span className="csv-chart-expand-hint"> · tap to expand</span>
      </p>
    </div>
  );
};

// ── CsvChartPanel ────────────────────────────────────────────────────────────

interface Props {
  specs: ChartSpec[];
  rows: Record<string, string>[];
}

/**
 * CsvChartPanel renders all auto-generated ChartSpec tiles for a CSV file.
 * Tapping a tile opens a full-screen expand modal.
 * Long-pressing a canvas shares it as a PNG image (mobile Web Share API).
 * Returns null when there are no specs to show.
 */
export const CsvChartPanel: React.FC<Props> = ({ specs, rows }) => {
  const [expandedSpec, setExpandedSpec] = useState<ChartSpec | null>(null);

  if (specs.length === 0) return null;

  return (
    <section className="csv-chart-panel" aria-label="Auto-generated charts">
      <h3 className="csv-chart-panel-heading">
        Charts
        <span className="csv-chart-panel-badge" aria-label={`${specs.length} charts`}>
          {specs.length}
        </span>
      </h3>
      <div className="csv-chart-grid">
        {specs.map(spec => (
          <ChartTile
            key={spec.id}
            spec={spec}
            rows={rows}
            onExpand={setExpandedSpec}
          />
        ))}
      </div>

      {expandedSpec && (
        <ChartExpandModal
          spec={expandedSpec}
          rows={rows}
          onClose={() => setExpandedSpec(null)}
        />
      )}
    </section>
  );
};

export default CsvChartPanel;
