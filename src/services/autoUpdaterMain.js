// Main process auto-updater setup
const { autoUpdater } = require('electron-updater');
const electronLog = require('electron-log');
const { safeIpcHandle } = require('../core/ipcSafety');
const { app } = require('electron');

function setupAutoUpdater(mainWindow) {
  if (!mainWindow) {
    throw new Error('MainWindow is required for auto updater');
  }

  // Configure logging
  autoUpdater.logger = electronLog;
  autoUpdater.logger.transports.file.level = 'debug';

  // Configure updater options
  autoUpdater.autoDownload = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.fullChangelog = true;

  // Helper function to send status to window
  function sendStatusToWindow(text) {
    if (mainWindow) {
      mainWindow.webContents.send('update-message', text);
    }
  }

  // Auto-updater events
  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    });
    sendStatusToWindow(`Update error: ${error.message || 'Unknown error'}`);
  });

  autoUpdater.on('checking-for-update', () => {
    sendStatusToWindow('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    sendStatusToWindow('Update available.');
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
    autoUpdater.quitAndInstall(false, true);
  });

  // Register IPC handlers
  safeIpcHandle('get-app-version', () => app.getVersion());
  
  safeIpcHandle('check-for-updates', async () => {
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

  safeIpcHandle('start-update', async () => {
    try {
      return await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('Error downloading update:', error);
      return { status: 'error', message: error.message };
    }
  });

  // Initial check for updates in production
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.error('Initial update check failed:', err);
      });
    }, 3000);
  }

  return autoUpdater;
}

module.exports = { setupAutoUpdater };