import React, { Component, ErrorInfo, ReactNode, useState } from 'react';
import "../phase4.css";

type SourceType = 'csv' | 'json' | 'image' | 'pdf' | 'markdown' | 'unknown';

interface Props {
  children: ReactNode;
  /** The file source type — used to pick the file-type icon in the fallback UI. */
  sourceType?: SourceType;
  /** Called when the user clicks "Try re-indexing". Receives the doc id if provided. */
  onReIndex?: () => void;
  /** Optional custom fallback. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function sourceIcon(type: SourceType): string {
  switch (type) {
    case 'csv':      return '📊';
    case 'json':     return '🗂️';
    case 'image':    return '🖼️';
    case 'pdf':      return '📄';
    case 'markdown': return '📝';
    default:         return '📁';
  }
}

// B-5: Polished error boundary fallback UI
function ErrorFallbackUI({
  error,
  sourceType = 'unknown',
  onReset,
  onReIndex,
}: {
  error: Error;
  sourceType?: SourceType;
  onReset: () => void;
  onReIndex?: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div className="viewer-error-boundary" role="alert">
      <span className="viewer-error-icon" aria-hidden="true">
        {sourceIcon(sourceType)}
      </span>
      <h3 className="viewer-error-heading">Couldn't load this file</h3>
      <p className="viewer-error-subtext">
        <button
          className="viewer-error-detail-toggle"
          aria-expanded={detailOpen}
          onClick={() => setDetailOpen((o) => !o)}
        >
          {detailOpen ? 'Hide details ▲' : 'Show details ▼'}
        </button>
      </p>
      {detailOpen && (
        <pre className="viewer-error-detail">
          {error.message || 'An unexpected error occurred.'}
        </pre>
      )}
      <div className="viewer-error-actions">
        {onReIndex && (
          <button
            className="viewer-error-btn viewer-error-btn--primary"
            onClick={() => { onReIndex(); onReset(); }}
          >
            <span aria-hidden="true">🔄</span> Try re-indexing
          </button>
        )}
        <button
          className="viewer-error-btn viewer-error-btn--secondary"
          onClick={onReset}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export class ViewerErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ViewerErrorBoundary] caught error:', error, info.componentStack);
  }

  reset(): void {
    this.setState({ hasError: false, error: null });
  }

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, sourceType, onReIndex } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.reset);
      }
      return (
        <ErrorFallbackUI
          error={error}
          sourceType={sourceType}
          onReset={this.reset}
          onReIndex={onReIndex}
        />
      );
    }

    return children;
  }
}

export default ViewerErrorBoundary;
