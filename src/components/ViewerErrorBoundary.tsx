import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ViewerErrorBoundary
 *
 * Wraps any file-viewer child tree. If the child throws during render or a
 * lifecycle method, the boundary catches the error and renders a friendly
 * fallback instead of a white screen.
 *
 * Usage:
 *   <ViewerErrorBoundary>
 *     <FileViewer file={file} />
 *   </ViewerErrorBoundary>
 *
 * Or with a custom fallback:
 *   <ViewerErrorBoundary fallback={(err, reset) => <MyFallback error={err} onReset={reset} />}>
 *     <FileViewer file={file} />
 *   </ViewerErrorBoundary>
 */
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
    // Log to console in development; swap for a real error-reporting service
    // (e.g. Sentry) in production.
    console.error('[ViewerErrorBoundary] caught error:', error, info.componentStack);
  }

  reset(): void {
    this.setState({ hasError: false, error: null });
  }

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.reset);
      }

      // Default fallback UI — deliberately minimal so it works in every context.
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            gap: '0.75rem',
            color: 'var(--color-text-secondary, #6b7280)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-primary, #111827)' }}>
            Unable to display this file
          </p>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            {error.message || 'An unexpected error occurred while rendering the viewer.'}
          </p>
          <button
            onClick={this.reset}
            style={{
              marginTop: '0.5rem',
              padding: '0.375rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border, #d1d5db)',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return children;
  }
}

export default ViewerErrorBoundary;
