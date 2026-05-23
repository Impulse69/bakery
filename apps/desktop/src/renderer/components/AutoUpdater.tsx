import { useEffect, useState } from 'react';
import { useToast } from './Toast';

/**
 * AutoUpdater UI — small, unobtrusive bottom-right floating widget that
 * mirrors the autoUpdater lifecycle:
 *
 *   checking-for-update → spinner ring
 *   download-progress   → animated SVG ring with % in the middle
 *   update-downloaded   → "Update ready" dialog with Restart / Later
 *   update-error        → silently logged (no UI noise)
 *
 * Sized at 56px so it stays out of the cashier's way during a sale.
 */
export function AutoUpdater() {
  const { showToast } = useToast();
  const [phase, setPhase] = useState<'idle' | 'checking' | 'downloading' | 'ready'>('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateChecking?.(() => {
      setPhase('checking');
    });

    window.electronAPI.onUpdateAvailable(() => {
      setPhase('downloading');
      setProgress(0);
    });

    window.electronAPI.onUpdateNotAvailable?.(() => {
      setPhase('idle');
    });

    window.electronAPI.onUpdateProgress((info) => {
      if (info && typeof info.percent === 'number') {
        setProgress(Math.floor(info.percent));
        setPhase('downloading');
      }
    });

    window.electronAPI.onUpdateDownloaded(() => {
      setPhase('ready');
      showToast('Update ready to install.', 'success');
    });

    window.electronAPI.onUpdateError((err) => {
      setPhase('idle');
      console.error('AutoUpdater Error:', err);
    });
  }, [showToast]);

  return (
    <>
      {(phase === 'checking' || phase === 'downloading') && (
        <CircularProgress
          phase={phase}
          progress={progress}
        />
      )}

      {phase === 'ready' && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#fff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          padding: '16px',
          borderRadius: '12px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: 320,
        }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#131b2e' }}>
            Update ready
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#4b5563', lineHeight: 1.4 }}>
            A new version of Bread Faculty POS has been downloaded. Restart to apply.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setPhase('idle')}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#6b7280',
                fontWeight: 500,
              }}
            >
              Later
            </button>
            <button
              onClick={() => window.electronAPI?.restartApp()}
              style={{
                padding: '6px 14px',
                background: '#e07b3c',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Restart now
            </button>
          </div>
        </div>
      )}
    </>
  );
}

interface CircularProgressProps {
  phase: 'checking' | 'downloading';
  progress: number;
}

/** Small SVG circular progress widget. Checking = spinner, downloading = arc + %. */
function CircularProgress({ phase, progress }: CircularProgressProps) {
  const size = 56;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  const isChecking = phase === 'checking';

  return (
    <div
      title={isChecking ? 'Checking for updates…' : `Downloading update ${progress}%`}
      style={{
        position: 'fixed',
        bottom: 18,
        right: 18,
        width: size,
        height: size,
        background: '#fff',
        borderRadius: '50%',
        boxShadow: '0 8px 20px -6px rgba(19, 27, 46, 0.25), 0 0 0 1px rgba(19, 27, 46, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <style>
        {`@keyframes bf-updater-spin { to { transform: rotate(360deg); } }`}
      </style>
      <svg
        width={size}
        height={size}
        style={{
          transform: 'rotate(-90deg)',
          animation: isChecking ? 'bf-updater-spin 1.2s linear infinite' : undefined,
        }}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(19, 27, 46, 0.08)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e07b3c"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={isChecking ? circumference * 0.75 : offset}
          style={{ transition: isChecking ? 'none' : 'stroke-dashoffset 200ms linear' }}
        />
      </svg>
      {!isChecking && (
        <span
          style={{
            position: 'absolute',
            fontSize: 11,
            fontWeight: 700,
            color: '#131b2e',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {progress}%
        </span>
      )}
    </div>
  );
}
