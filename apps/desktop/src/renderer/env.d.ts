/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SOCKET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type UpdateCheckResult =
  | { status: 'dev' }
  | { status: 'up-to-date'; currentVersion: string; latestVersion: string }
  | { status: 'available'; currentVersion: string; latestVersion: string }
  | { status: 'error'; message: string };

interface Window {
  electronAPI: {
    onUpdateChecking?: (callback: () => void) => void;
    onUpdateAvailable: (callback: (info: any) => void) => void;
    onUpdateNotAvailable?: (callback: (info: any) => void) => void;
    onUpdateProgress: (callback: (progress: any) => void) => void;
    onUpdateDownloaded: (callback: (info: any) => void) => void;
    onUpdateError: (callback: (error: string) => void) => void;
    restartApp: () => void;
    checkForUpdates: () => Promise<UpdateCheckResult>;
    printPreview: () => Promise<{ ok: boolean }>;
    printSystemPreview: () => Promise<{ ok: boolean; path: string }>;
  };
}
