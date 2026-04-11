import { useEffect, useState } from 'react';
import { useToast } from './Toast';

export function AutoUpdater() {
  const { showToast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateAvailable(() => {
      setDownloading(true);
      setProgress(0);
      // Removed showToast here to fix duplicate notification
    });

    window.electronAPI.onUpdateProgress((info) => {
      if (info && typeof info.percent === 'number') {
        setProgress(Math.floor(info.percent));
      }
    });

    window.electronAPI.onUpdateDownloaded(() => {
      setDownloading(false);
      setDownloaded(true);
      showToast('Update ready to install.', 'success');
    });

    window.electronAPI.onUpdateError((err) => {
      setDownloading(false);
      console.error('AutoUpdater Error:', err);
    });
  }, [showToast]);

  return (
    <>
      {downloading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: '#3b82f6',
          color: '#fff',
          textAlign: 'center',
          padding: '8px',
          fontSize: '14px',
          fontWeight: 500,
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ 
            display: 'inline-block',
            width: '16px',
            height: '16px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: '50%',
            borderTopColor: '#fff',
            animation: 'spin 1s linear infinite'
          }}></span>
          <style>
            {`@keyframes spin { to { transform: rotate(360deg); } }`}
          </style>
          Downloading update... {progress}%
        </div>
      )}
      
      {downloaded && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: '#fff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          padding: '16px',
          borderRadius: '8px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>Update Ready</h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#4b5563' }}>
            A new version of the Bread Faculty POS has been downloaded. Restart the application to apply the update.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setDownloaded(false)}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#6b7280'
              }}
            >
              Later
            </button>
            <button 
              onClick={() => window.electronAPI?.restartApp()}
              style={{
                padding: '6px 12px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 500
              }}
            >
              Restart Now
            </button>
          </div>
        </div>
      )}
    </>
  );
}

