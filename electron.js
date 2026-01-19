const { app, BrowserWindow } = require('electron');
const path = require('path');

// Set data directory for uploads before loading server
const userDataPath = app.getPath('userData');
process.env.DATA_DIR = userDataPath;

// Start the Express server
require('./server.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Wait a moment for server to start, then load the app
  setTimeout(() => {
    const port = process.env.PORT || 51234;
    mainWindow.loadURL(`http://localhost:${port}`);
  }, 1000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
