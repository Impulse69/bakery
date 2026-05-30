import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, readFileSync, writeFileSync, symlinkSync } from 'fs';
import { spawn, spawnSync, type ChildProcess } from 'child_process';
import http from 'http';
import { randomBytes } from 'crypto';
import { autoUpdater } from 'electron-updater';

const SERVER_PORT = 3001;
let serverProcess: ChildProcess | null = null;

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

  // 1. First-run bootstrap: sync schema + seed admin/location (idempotent).
  const bootstrap = spawnSync(nodeExe, [path.join(serverDir, 'scripts', 'first-run.js')], {
    cwd: serverDir,
    env,
    stdio: 'inherit',
  });
  if (bootstrap.status !== 0) {
    throw new Error(`First-run bootstrap failed (exit ${bootstrap.status})`);
  }

  // 2. Start the API server as a child process.
  serverProcess = spawn(nodeExe, [path.join(serverDir, 'dist', 'index.js')], {
    cwd: serverDir,
    env,
    stdio: 'inherit',
  });
  serverProcess.on('exit', (code) => {
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

  // Auto-updater is intentionally disabled — this is a fully offline build with
  // no network dependency. (Event wiring in createWindow stays harmless; it
  // simply never fires.)
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
