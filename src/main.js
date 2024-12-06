require('./moduleResolver');
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { initializeDatabase } = require('./services/initDatabase');
const { autoUpdater } = require('electron-updater');
const packageJson = require('../package.json');
const licenseService = require('./services/licenseService');

// Only load dotenv in development
if (process.env.NODE_ENV === 'development') {
    require('dotenv').config();
}

// Configure logging for updater
autoUpdater.logger = require('electron-log');
autoUpdater.logger.transports.file.level = 'debug';

// Configure updater with more specific options
autoUpdater.autoDownload = false;
autoUpdater.allowPrerelease = false;
autoUpdater.fullChangelog = true;

// electron-builder will handle the GitHub configuration during build
console.log('Configuring auto-updater for updates');

let mainWindow;
let database;

function getIconPath() {
  switch (process.platform) {
    case 'win32':
      return path.join(__dirname, '../assets/images/favicon-256x256.ico');
    case 'darwin':
      return path.join(__dirname, '../assets/images/favicon.icns');
    default:
      return path.join(__dirname, '../assets/images/favicon-32x32.png');
  }
}

function createWindow() {
  // Initialize database
  database = initializeDatabase();

  // Set up IPC handlers for database operations
  ipcMain.handle('db:getAccounts', async () => {
    try {
      const accounts = database.getAccounts();
      return { data: accounts, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:addAccount', async (event, account) => {
    try {
      const result = database.addAccount(account);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:updateAccount', async (event, id, balance) => {
    try {
      const result = database.updateAccount(id, balance);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:deleteAccount', async (event, id) => {
    try {
      const result = database.deleteAccount(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getTransactions', async (event, accountId) => {
    try {
      const transactions = database.getTransactions(accountId);
      return { data: transactions, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getCategories', async () => {
    try {
      const categories = database.getCategories();
      return { data: categories, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:addCategory', async (event, category) => {
    try {
      const result = database.addCategory(category);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:updateCategory', async (event, id, data) => {
    try {
      const result = database.updateCategory(id, data);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:deleteCategory', async (event, id) => {
    try {
      const result = database.deleteCategory(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getRecurring', async (event, accountId) => {
    try {
      const recurring = database.getRecurring(accountId);
      return { data: recurring, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:addRecurring', async (event, recurring) => {
    try {
      const result = database.addRecurring(recurring);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:updateRecurring', async (event, id, data) => {
    try {
      const result = database.updateRecurring(id, data);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:deleteRecurring', async (event, id) => {
    try {
      const result = database.deleteRecurring(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }); 

  // Add handlers for other database operations
  ipcMain.handle('db:addTransaction', async (event, transaction) => {
    try {
      const result = database.addTransaction(transaction);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:updateTransaction', async (event, id, data) => {
    try {
      const result = database.updateTransaction(id, data);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:deleteTransaction', async (event, id) => {
    try {
      const result = database.deleteTransaction(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getTransactionsForChart', async (event, accountId) => {
    try {
      const transactions = database.getTransactionsForChart(accountId);
      return { data: transactions, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getIncomeExpenseData', async (event, accountId, period) => {
    try {
      const data = database.getIncomeExpenseData(accountId, period);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getTopSpendingCategories', async (event, accountId, period) => {
    try {
      const categories = database.getTopSpendingCategories(accountId, period);
      return { data: categories, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getExpenseCategoriesData', async (event, accountId, period) => {
    try {
      const categories = database.getExpenseCategoriesData(accountId, period);
      return { data: categories, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:export', async (event, filePath) => {
    try {
      database.exportDatabase(filePath);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('db:import', async (event, filePath) => {
    try {
      database.importDatabase(filePath);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('dialog:showSaveDialog', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Database',
      defaultPath: 'fyenance-backup.db',
      filters: [
        { name: 'Database Files', extensions: ['db'] }
      ]
    });
    return result;
  });

  ipcMain.handle('dialog:showOpenDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Database',
      filters: [
        { name: 'Database Files', extensions: ['db'] }
      ],
      properties: ['openFile']
    });
    return result;
  });

  ipcMain.handle('license:validate', async (event, licenseKey) => {
    return await licenseService.validateLicense(licenseKey);
  });

  ipcMain.handle('license:check', () => {
    return licenseService.checkLicenseExists();
  });

  ipcMain.handle('license:info', () => {
    return licenseService.getLicenseInfo();
  });

  ipcMain.handle('license:clear', () => {
    return licenseService.clearLicense();
  });

  ipcMain.handle('db:delete', async () => {
    try {
      database.deleteDatabase();
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.on('relaunch-app', () => {
    app.relaunch();
    app.exit();
  });

  ipcMain.handle('open-external', async (_, url) => {
    return shell.openExternal(url);
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    icon: getIconPath(),
    titleBarStyle: 'hidden',
    frame: false,
    transparent: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: false,
      additionalArguments: [`--app-version=${packageJson.version}`]
    },
    maximizable: true,
    fullscreenable: true
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-change', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-change', { isMaximized: false });
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Only check for updates in production
  if (process.env.NODE_ENV === 'production') {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('Error checking for updates:', err);
    });
  }
}

// Auto-updater events with better error handling
autoUpdater.on('error', (error) => {
  console.error('Auto-updater error details:', {
    message: error.message,
    stack: error.stack,
    code: error.code,
    statusCode: error.statusCode
  });
  if (mainWindow) {
    mainWindow.webContents.send('update-message', 
      `Update error: ${error.message || 'Unknown error'}`);
  }
});

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  sendStatusToWindow('Update available.');
  // Prompt user to start download
  mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', (info) => {
  sendStatusToWindow('Up to date.');
});

autoUpdater.on('download-progress', (progressObj) => {
  sendStatusToWindow(
    `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`
  );
});

autoUpdater.on('update-downloaded', (info) => {
  sendStatusToWindow('Update downloaded; will install now');
  // Install on next app launch
  autoUpdater.quitAndInstall(false, true);
});

function sendStatusToWindow(text) {
  if (mainWindow) {
    mainWindow.webContents.send('update-message', text);
  }
}

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// IPC handlers for update actions
ipcMain.handle('check-for-updates', async () => {
  try {
      console.log('Checking for updates...');
      console.log('Current version:', app.getVersion());
      
      const result = await autoUpdater.checkForUpdates();
      console.log('Check result:', result);
      return result;
  } catch (error) {
      console.error('Update check error:', error);
      throw error;
  }
});

ipcMain.handle('start-update', async () => {
  try {
    return await autoUpdater.downloadUpdate();
  } catch (error) {
    console.error('Error downloading update:', error);
    return { status: 'error', message: error.message };
  }
});

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

ipcMain.on('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.on('toggle-maximize-window', () => {
  if (!mainWindow) return;
  
  if (mainWindow.isMaximized()) {
    mainWindow.restore();
    mainWindow.webContents.send('window-state-change', { isMaximized: false });
  } else {
    mainWindow.maximize();
    mainWindow.webContents.send('window-state-change', { isMaximized: true });
  }
});

ipcMain.on('close-window', () => {
  mainWindow?.close();
});

ipcMain.handle('is-window-maximized', () => {
  return mainWindow?.isMaximized();
});

ipcMain.handle('get-window-state', () => {
  return { isMaximized: mainWindow?.isMaximized() || false };
});