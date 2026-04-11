import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'path';
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

  // Set up auto-updater events
  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-available', info);
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

  // Check for updates
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('Failed to check for updates:', err);
  });
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
