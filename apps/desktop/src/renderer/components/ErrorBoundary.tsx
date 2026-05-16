import { Component, type ReactNode, type ErrorInfo } from 'react';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  /** Optional fallback override. Receives the error + a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-wide error boundary. Catches any render-time exception in the tree
 * below it and replaces the would-be white screen with a recoverable card.
 * Use one instance high in the app and as many local ones as you need to
 * isolate failures of individual surfaces.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] render error', error, info);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div className={styles.wrap}>
          <div className={styles.card}>
            <span className={styles.eyebrow}>Something broke</span>
            <h2 className={styles.heading}>This screen hit an unexpected error</h2>
            <p className={styles.message}>
              {this.state.error.message || 'Unknown render error'}
            </p>
            <p className={styles.hint}>
              The page didn&rsquo;t crash, just this view. Try reloading, or go back
              and reopen the screen. The error has been logged to the console.
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.btnPrimary} onClick={this.reset}>
                Try again
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => window.location.reload()}
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
