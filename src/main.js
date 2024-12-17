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

  // Create main window using our centralized window module
  mainWindow = createMainWindow(require('../package.json'));

  // Set up handlers BEFORE loading the file
  setupWindowHandlers(mainWindow);
  
  // Set up all other handlers
  setupDatabaseHandlers(database);
  setupAnalyticsHandlers(database);
  setupDialogHandlers(mainWindow);
  setupLicenseHandlers(licenseService);
  setupTutorialHandlers(database);
  setupSystemHandlers();
  setupImportHandlers(database);

  // Set up auto-updater in production
  if (process.env.NODE_ENV === 'production') {
    setupAutoUpdater(mainWindow);
  }
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

const { ipcMain } = require('electron');

ipcMain.handle('check-for-updates', async () => {
  // Implement your update checking logic here
  try {
    // Return update check results
    return { updateAvailable: false };
  } catch (error) {
    throw error;
  }
});