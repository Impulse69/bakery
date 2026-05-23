import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { autoUpdater } from 'electron-updater';

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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  // Only run the autoUpdater in packaged builds. In dev (`electron-vite dev`)
  // there's no installer and no app-update.yml; running the check throws.
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('Failed to check for updates:', err);
    });
    // Re-check every hour so long-running terminals pick up new releases
    // without needing a manual restart.
    setInterval(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('Periodic update check failed:', err);
      });
    }, 60 * 60 * 1000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Handle quit and install
ipcMain.on('app:restart', () => {
  autoUpdater.quitAndInstall();
});

// ── Print preview ──────────────────────────────────────────────
// Electron's native print dialog on Windows does not support preview
// ("This app doesn't support print preview"). We work around this by
// rendering the caller window to PDF and opening it in an in-app
// Chromium PDF viewer window, which has preview + print + save/zoom.
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
