const { app } = require('electron');
const { createMainWindow } = require('./core/window');
const { initializeDatabase } = require('./services/initDatabase');
const { setupAutoUpdater } = require('./services/autoUpdaterMain');
const { setupDatabaseHandlers } = require('./handlers/databaseHandlers');
const { setupAnalyticsHandlers } = require('./handlers/analyticsHandlers');
const { setupDialogHandlers } = require('./handlers/dialogHandlers');
const { setupLicenseHandlers } = require('./handlers/licenseHandlers');
const { setupTutorialHandlers } = require('./handlers/tutorialHandlers');
const { setupWindowHandlers } = require('./handlers/windowHandlers');
const { setupSystemHandlers } = require('./handlers/systemHandlers');
const { setupImportHandlers } = require('./handlers/importHandlers');
const { globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs').promises;

const licenseService = require('./services/licenseService');

// Development environment setup
if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}

let mainWindow;
let database;

async function createWindow() {
  // Initialize database
  database = initializeDatabase();

  // Initialize backup service
  const BackupService = require('./services/backupService');
  const backupService = new BackupService(database);

  // Create initial backup on launch
  backupService.createBackup('startup');

  // Set up hourly backup
  setInterval(() => {
    backupService.createBackup('hourly');
  }, 60 * 60 * 1000);

  // Create main window using our centralized window module
  mainWindow = createMainWindow(require('../package.json'));

  // Set up handlers BEFORE loading the file
  setupWindowHandlers(mainWindow);
  
  // Set up all other handlers
  setupDatabaseHandlers(database, backupService);
  setupAnalyticsHandlers(database);
  setupDialogHandlers(mainWindow);
  setupLicenseHandlers(licenseService);
  setupTutorialHandlers(database);
  setupSystemHandlers();
  setupImportHandlers(database);

  // Set up auto-updater in production
    setupAutoUpdater(mainWindow);

  // Add marketing shortcuts
  setupMarketingShortcuts(mainWindow);
}

function setupMarketingShortcuts(mainWindow) {
  globalShortcut.register('CommandOrControl+Shift+S', async () => {
    try {
      const image = await mainWindow.webContents.capturePage();
      const pngBuffer = image.toPNG();
      
      const downloadPath = app.getPath('downloads');
      const fileName = `fyenance-screenshot-${Date.now()}.png`;
      const filePath = path.join(downloadPath, fileName);
      
      await fs.writeFile(filePath, pngBuffer);
      
      mainWindow.webContents.executeJavaScript(`
        if (!document.querySelector('.screenshot-notification')) {
          const notification = document.createElement('div');
          notification.className = 'screenshot-notification';
          notification.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#4CAF50;color:white;padding:8px 16px;border-radius:4px;z-index:9999;';
          notification.textContent = 'Screenshot saved to Downloads';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 2000);
        }
      `);
    } catch (error) {
      console.error('Screenshot error:', error);
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
