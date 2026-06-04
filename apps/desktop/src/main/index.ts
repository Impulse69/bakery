import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import {
  existsSync,
  readFileSync,
  writeFileSync,
  symlinkSync,
  mkdirSync,
  createWriteStream,
  statSync,
  appendFileSync,
  renameSync,
  rmSync,
  type WriteStream,
} from 'fs';
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import http from 'http';
import { randomBytes } from 'crypto';
import { autoUpdater } from 'electron-updater';

const SERVER_PORT = 3001;
let serverProcess: ChildProcess | null = null;
let logStream: WriteStream | null = null;

// ── Server log capture ─────────────────────────────────────────────
// In a packaged GUI app the embedded server's stdout/stderr would otherwise be
// discarded. Persist it to userData/logs/server.log so the real error (and the
// self-heal results) are retrievable from one file the client can send us.
const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 MB

function logsDir(): string {
  const dir = path.join(app.getPath('userData'), 'logs');
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  } catch {
    /* best-effort */
  }
  return dir;
}

function serverLogPath(): string {
  return path.join(logsDir(), 'server.log');
}

// Roll the log once at boot if it has grown past the cap (keeps one backup).
function rotateLogIfLarge(): void {
  const file = serverLogPath();
  try {
    if (existsSync(file) && statSync(file).size > MAX_LOG_BYTES) {
      const bak = `${file}.1`;
      if (existsSync(bak)) rmSync(bak, { force: true });
      renameSync(file, bak);
    }
  } catch {
    /* best-effort */
  }
}

function appendLog(text: string): void {
  try {
    appendFileSync(serverLogPath(), text);
  } catch {
    /* best-effort */
  }
}

function bootBanner(dbPath: string): string {
  return [
    '',
    '════════════════════════════════════════════════════════',
    `[boot] ${new Date().toISOString()} Bread Faculty POS v${app.getVersion()}`,
    `[boot] platform=${process.platform} arch=${process.arch} node=${process.version}`,
    `[boot] dbPath=${dbPath}`,
    `[boot] userData=${app.getPath('userData')}`,
    '════════════════════════════════════════════════════════',
    '',
  ].join('\n');
}

// ── Embedded backend ───────────────────────────────────────────────
// In packaged builds the Node/SQLite server is bundled under
// resources/server and run as a child process. The renderer talks to it on
// localhost:3001 exactly as before — there is no separate install, no service,
// no PostgreSQL. In dev (`electron-vite dev`) the server is started externally
// by `npm run dev`, so we skip spawning.

function readOrCreateJwtSecret(userData: string): string {
  const secretPath = path.join(userData, 'jwt-secret');
  if (existsSync(secretPath)) {
    const existing = readFileSync(secretPath, 'utf8').trim();
    if (existing) return existing;
  }
  const secret = randomBytes(48).toString('hex');
  writeFileSync(secretPath, secret, 'utf8');
  return secret;
}

function waitForHealth(timeoutMs: number): Promise<void> {
  const url = `http://localhost:${SERVER_PORT}/health`;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else retry();
      });
      req.on('error', retry);
      req.setTimeout(2000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) reject(new Error('Embedded server did not become healthy in time'));
      else setTimeout(attempt, 400);
    };
    attempt();
  });
}

async function startEmbeddedServer(): Promise<void> {
  const serverDir = path.join(process.resourcesPath, 'server');
  const userData = app.getPath('userData');
  const dbPath = path.join(userData, 'bakery.db');

  rotateLogIfLarge();
  appendLog(bootBanner(dbPath));

  const nodeExe = (() => {
    const bundled = path.join(serverDir, 'runtime', 'node.exe');
    return existsSync(bundled) ? bundled : process.execPath;
  })();

  // The bundle's deps live in server_modules (node_modules is renamed at build
  // time — electron-builder empties any folder literally named node_modules in
  // extraResources). Restore a real node_modules via a directory junction so
  // both CJS require() and ESM imports resolve normally (NODE_PATH is CJS-only,
  // and Prisma's CLI has ESM-only transitive deps). Idempotent, no admin.
  const serverModules = path.join(serverDir, 'server_modules');
  const nodeModules = path.join(serverDir, 'node_modules');
  if (existsSync(serverModules) && !existsSync(nodeModules)) {
    try {
      symlinkSync(serverModules, nodeModules, 'junction');
    } catch (err) {
      console.error('Could not create node_modules junction:', err);
    }
  }

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(SERVER_PORT),
    DATABASE_URL: `file:${dbPath}`,
    JWT_SECRET: readOrCreateJwtSecret(userData),
  };

  // 1. First-run bootstrap: self-heal DB + sync schema + seed (idempotent).
  //    Output is piped so the [self-heal]/[first-run] lines land in server.log.
  const bootstrap = spawnSync(nodeExe, [path.join(serverDir, 'scripts', 'first-run.js')], {
    cwd: serverDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (bootstrap.stdout?.length) appendLog('[first-run:out] ' + bootstrap.stdout.toString());
  if (bootstrap.stderr?.length) appendLog('[first-run:err] ' + bootstrap.stderr.toString());
  if (bootstrap.status !== 0) {
    appendLog(`[first-run] exited status=${bootstrap.status} signal=${bootstrap.signal ?? ''}\n`);
    throw new Error(`First-run bootstrap failed (exit ${bootstrap.status})`);
  }

  // 2. Start the API server as a child process; capture its output to the log.
  logStream = createWriteStream(serverLogPath(), { flags: 'a' });
  serverProcess = spawn(nodeExe, [path.join(serverDir, 'dist', 'index.js')], {
    cwd: serverDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout?.on('data', (b: Buffer) => logStream?.write('[server] ' + b.toString()));
  serverProcess.stderr?.on('data', (b: Buffer) => logStream?.write('[server:err] ' + b.toString()));
  serverProcess.on('error', (err) => appendLog(`[server] spawn error: ${err.message}\n`));
  serverProcess.on('exit', (code, signal) => {
    appendLog(`[server] exited code=${code} signal=${signal ?? ''}\n`);
    console.error(`Embedded server exited with code ${code}`);
    serverProcess = null;
  });

  // 3. Wait until it answers before opening the window.
  await waitForHealth(20000);
}

function stopEmbeddedServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (logStream) {
    try {
      logStream.end();
    } catch {
      /* best-effort */
    }
    logStream = null;
  }
}

// ── View zoom ──────────────────────────────────────────────────────
// The UI ships compact (0.7) so more fits on screen, and the user can scale the
// whole view (fonts, spacing, everything) with the standard Ctrl +/-/0 shortcuts.
// Ctrl+0 resets to this default. The chosen factor persists across launches.
const DEFAULT_ZOOM = 0.7;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

function zoomFilePath(): string {
  return path.join(app.getPath('userData'), 'zoom');
}

function readZoom(): number {
  try {
    const raw = parseFloat(readFileSync(zoomFilePath(), 'utf8').trim());
    if (Number.isFinite(raw)) return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, raw));
  } catch {
    /* no saved zoom yet */
  }
  return DEFAULT_ZOOM;
}

function writeZoom(factor: number): void {
  try {
    writeFileSync(zoomFilePath(), String(factor), 'utf8');
  } catch {
    /* best-effort persistence */
  }
}

function setupZoom(win: BrowserWindow): void {
  const apply = (factor: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(factor * 100) / 100));
    win.webContents.setZoomFactor(clamped);
    writeZoom(clamped);
  };

  // Apply the saved (or default) zoom once the page has loaded.
  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(readZoom());
  });

  // Standard zoom shortcuts (the app menu is removed, so we wire them here).
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return;
    const current = win.webContents.getZoomFactor();
    switch (input.key) {
      case '=':
      case '+': // includes numpad +
        apply(current + ZOOM_STEP);
        event.preventDefault();
        break;
      case '-':
      case '_': // includes numpad -
        apply(current - ZOOM_STEP);
        event.preventDefault();
        break;
      case '0':
        apply(DEFAULT_ZOOM);
        event.preventDefault();
        break;
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  setupZoom(win);

  // Set up auto-updater events — forward every relevant event to the renderer
  // so the UI can reflect state (checking / available / downloading / ready).
  autoUpdater.on('checking-for-update', () => {
    win.webContents.send('update-checking');
  });
  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-available', info);
  });
  autoUpdater.on('update-not-available', (info) => {
    win.webContents.send('update-not-available', info);
  });
  autoUpdater.on('download-progress', (progressObj) => {
    win.webContents.send('update-progress', progressObj);
  });
  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('update-downloaded', info);
  });
  autoUpdater.on('error', (err) => {
    win.webContents.send('update-error', err.message);
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);

  // Packaged builds run the bundled SQLite server in-process (as a child).
  // Boot it and wait for health before showing the window so the first API
  // call from the renderer succeeds. Dev runs the server externally.
  if (app.isPackaged) {
    try {
      await startEmbeddedServer();
    } catch (err) {
      console.error('Failed to start embedded server:', err);
    }
  }

  createWindow();

  // Auto-update: the app runs fully offline, but when a connection IS available
  // it checks GitHub Releases on launch and downloads any newer version in the
  // background (events drive the in-app progress ring). Failures (offline, etc.)
  // are caught by the 'error' handler and surface as a no-op. Packaged only —
  // electron-updater throws in dev/unpackaged.
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.warn('Startup update check failed (offline?):', err?.message ?? err);
    });
  }
});

// Manual "Check for updates" (Settings button). Returns a small status summary
// for immediate UI feedback; the detailed lifecycle (download progress, ready)
// still flows through the update-* events to the in-app progress widget.
ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) {
    return { status: 'dev' as const };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    const available = !!result?.updateInfo
      && result.updateInfo.version !== app.getVersion();
    return {
      status: available ? ('available' as const) : ('up-to-date' as const),
      currentVersion: app.getVersion(),
      latestVersion: result?.updateInfo?.version ?? app.getVersion(),
    };
  } catch (err) {
    return {
      status: 'error' as const,
      message: err instanceof Error ? err.message : String(err),
    };
  }
});

app.on('window-all-closed', () => {
  stopEmbeddedServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopEmbeddedServer();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Handle quit and install
ipcMain.on('app:restart', () => {
  autoUpdater.quitAndInstall();
});

// ── Print preview (A4 documents only) ──────────────────────────
// Used by invoices, customer statements and the customer page. Renders the
// caller window to an A4 PDF and opens it in an in-app Chromium PDF viewer
// (preview + print + save/zoom). Thermal receipts do NOT use this — they
// print via the renderer's window.print() (Chrome print dialog) so the
// 80mm @page size is honoured by the thermal printer directly.
ipcMain.handle('print:preview', async (event) => {
  const callerWin = BrowserWindow.fromWebContents(event.sender);
  if (!callerWin) throw new Error('No window found for print:preview');

  const pdfData = await callerWin.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { marginType: 'default' },
  });

  const filename = `bread-faculty-${Date.now()}.pdf`;
  const pdfPath = path.join(app.getPath('temp'), filename);
  await fs.writeFile(pdfPath, pdfData);

  const previewWin = new BrowserWindow({
    width: 900,
    height: 1000,
    title: 'Print Preview — Bread Faculty',
    parent: callerWin,
    backgroundColor: '#2b2b2b',
    autoHideMenuBar: true,
    webPreferences: {
      plugins: true,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Chromium in Electron ships with the built-in PDF viewer extension, which
  // renders PDF files with a preview, zoom, print, and download toolbar.
  await previewWin.loadURL(`file://${pdfPath.replace(/\\/g, '/')}`);

  // Clean up the temp file when the preview window closes.
  previewWin.on('closed', () => {
    fs.unlink(pdfPath).catch(() => {
      /* ignore */
    });
  });

  return { ok: true };
});

// Fallback: open the generated PDF with the system default viewer.
// (Some environments disable Chromium's PDF plugin.)
ipcMain.handle('print:systemPreview', async (event) => {
  const callerWin = BrowserWindow.fromWebContents(event.sender);
  if (!callerWin) throw new Error('No window found for print:systemPreview');

  const pdfData = await callerWin.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { marginType: 'default' },
  });

  const filename = `bread-faculty-${Date.now()}.pdf`;
  const pdfPath = path.join(app.getPath('temp'), filename);
  await fs.writeFile(pdfPath, pdfData);
  await shell.openPath(pdfPath);
  return { ok: true, path: pdfPath };
});
