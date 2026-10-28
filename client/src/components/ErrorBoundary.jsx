import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--bg-app, #000000)',
          color: 'var(--color-text-primary, #F5F7F2)',
          fontFamily: 'var(--body, sans-serif)',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '24px', marginBottom: '12px', color: 'var(--color-primary, #C6FF00)' }}>
            Something went wrong
          </h2>
          <p style={{ maxWidth: '480px', color: 'var(--color-text-secondary, #A5ADA0)', marginBottom: '20px' }}>
            {this.state.error?.message || 'An unexpected error occurred in this view.'}
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'var(--btn-primary-bg, #C6FF00)',
                color: 'var(--btn-primary-text, #101400)',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                background: 'var(--btn-secondary-bg, #080B07)',
                color: 'var(--btn-secondary-text, #F5F7F2)',
                border: '1px solid var(--btn-secondary-border, #647044)',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
