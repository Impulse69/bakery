/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SOCKET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  electronAPI: {
    onUpdateChecking?: (callback: () => void) => void;
    onUpdateAvailable: (callback: (info: any) => void) => void;
    onUpdateNotAvailable?: (callback: (info: any) => void) => void;
    onUpdateProgress: (callback: (progress: any) => void) => void;
    onUpdateDownloaded: (callback: (info: any) => void) => void;
    onUpdateError: (callback: (error: string) => void) => void;
    restartApp: () => void;
    printPreview: (opts?: { kind?: 'receipt' | 'a4'; heightMicrons?: number }) => Promise<{ ok: boolean }>;
    printSystemPreview: (opts?: { kind?: 'receipt' | 'a4'; heightMicrons?: number }) => Promise<{ ok: boolean; path: string }>;
  };
}
