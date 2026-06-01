import { useEffect, useRef, useState } from 'react';
import { Button } from '@bakery/ui';
import styles from './UpdatesCard.module.css';

// Current app version, injected at build time by Vite from package.json.
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '';

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up-to-date'; version: string }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; percent: number }
  | { kind: 'ready' }
  | { kind: 'error'; message: string }
  | { kind: 'dev' };

/**
 * Settings → "Check for updates" card. The button triggers a manual GitHub
 * Releases check; the detailed download lifecycle is mirrored here (and by the
 * global progress ring) via the update-* events. The app also auto-checks on
 * launch, so this is the manual escape hatch.
 */
export function UpdatesCard() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const api = window.electronAPI;
    if (!api) return;

    api.onUpdateProgress?.((p) => {
      if (mounted.current && p && typeof p.percent === 'number') {
        setState({ kind: 'downloading', percent: Math.floor(p.percent) });
      }
    });
    api.onUpdateDownloaded?.(() => mounted.current && setState({ kind: 'ready' }));
    api.onUpdateError?.((msg) => mounted.current && setState({ kind: 'error', message: msg }));
    api.onUpdateNotAvailable?.(() =>
      mounted.current && setState({ kind: 'up-to-date', version: APP_VERSION }),
    );

    return () => { mounted.current = false; };
  }, []);

  const check = async () => {
    const api = window.electronAPI;
    if (!api?.checkForUpdates) {
      setState({ kind: 'dev' });
      return;
    }
    setState({ kind: 'checking' });
    const res = await api.checkForUpdates();
    if (!mounted.current) return;
    switch (res.status) {
      case 'dev':
        setState({ kind: 'dev' });
        break;
      case 'up-to-date':
        setState({ kind: 'up-to-date', version: res.latestVersion });
        break;
      case 'available':
        // Download starts automatically; progress/ready arrive via events.
        setState({ kind: 'available', version: res.latestVersion });
        break;
      case 'error':
        setState({ kind: 'error', message: res.message });
        break;
    }
  };

  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <h2>Software Updates</h2>
        {APP_VERSION && <span className={styles.version}>v{APP_VERSION}</span>}
      </header>
      <p className={styles.intro}>
        Bread Faculty POS updates automatically when an internet connection is
        available. You can also check manually.
      </p>

      <div className={styles.row}>
        <Button
          onClick={check}
          loading={state.kind === 'checking'}
          disabled={state.kind === 'checking' || state.kind === 'downloading'}
        >
          Check for updates
        </Button>
        <StatusLine state={state} />
      </div>

      {state.kind === 'ready' && (
        <div className={styles.readyRow}>
          <span className={styles.readyMsg}>An update is downloaded and ready.</span>
          <Button variant="primary" onClick={() => window.electronAPI?.restartApp()}>
            Restart &amp; install
          </Button>
        </div>
      )}
    </section>
  );
}

function StatusLine({ state }: { state: State }) {
  switch (state.kind) {
    case 'idle':
      return null;
    case 'checking':
      return <span className={styles.status}>Checking GitHub for the latest version…</span>;
    case 'up-to-date':
      return <span className={`${styles.status} ${styles.ok}`}>You’re on the latest version{state.version ? ` (v${state.version})` : ''}.</span>;
    case 'available':
      return <span className={styles.status}>Update v{state.version} found — downloading…</span>;
    case 'downloading':
      return <span className={styles.status}>Downloading update… {state.percent}%</span>;
    case 'ready':
      return <span className={`${styles.status} ${styles.ok}`}>Update downloaded.</span>;
    case 'dev':
      return <span className={styles.status}>Updates are only available in the installed app.</span>;
    case 'error':
      return <span className={`${styles.status} ${styles.err}`}>Couldn’t check for updates: {state.message}</span>;
  }
}
