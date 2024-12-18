const { BrowserWindow, app } = require('electron');
const path = require('path');

function getIconPath() {
  switch (process.platform) {
    case 'win32':
      return path.join(__dirname, '../../assets/images/favicon-256x256.ico');
    case 'darwin':
      return path.join(__dirname, '../../assets/images/favicon.icns');
    default:
      return path.join(__dirname, '../../assets/images/favicon-32x32.png');
  }
}

function createMainWindow(packageJson) {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: getIconPath(),
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 20, y: 20 },
    frame: false,
    transparent: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
      enableRemoteModule: false,
      additionalArguments: [`--app-version=${packageJson.version}`]
    },
    maximizable: true,
    fullscreenable: true,
    center: true
  });

  if (process.platform === 'darwin') {
    mainWindow.setWindowButtonVisibility(false);
  }

  mainWindow.on('close', () => {
    if (process.platform === 'darwin') {
      app.quit();
    }
  });

  mainWindow.on('maximize', () => {
    console.log('Window maximized');
  });

  mainWindow.on('unmaximize', () => {
    console.log('Window unmaximized');
  });

  mainWindow.loadFile('src/index.html');

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  return mainWindow;
}

module.exports = {
  createMainWindow,
  getIconPath
};