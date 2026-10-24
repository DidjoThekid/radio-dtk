const { app, BrowserWindow } = require('electron');

const SITE_URL = 'https://radio-dtk.vercel.app';

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });
  win.loadURL(SITE_URL);
  win.webContents.on('did-fail-load', () => {
    win.loadURL('data:text/html,<h2 style="font-family:sans-serif">Pas de connexion. Réessaie…</h2>');
    setTimeout(() => win.loadURL(SITE_URL), 5000);
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
