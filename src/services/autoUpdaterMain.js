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
  electronLog.info('Auto Updater starting...');

  // Force enable updates even in dev mode
  // autoUpdater.forceDevUpdateConfig = true;
  // autoUpdater.allowDowngrade = true;
  autoUpdater.allowPrerelease = process.env.NODE_ENV === 'development';

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'ltalebli99',
    repo: 'Fyenance',
    private: true
  });

  electronLog.info('Current version:', app.getVersion());

  // Configure updater options
  autoUpdater.autoDownload = false;
  autoUpdater.fullChangelog = true;

  // Helper function to send status to window
  function sendStatusToWindow(text) {
    if (mainWindow) {
      mainWindow.webContents.send('update-message', text);
    }
  }

  // Auto-updater events with enhanced error logging
  autoUpdater.on('error', (error) => {
    electronLog.error('Auto-updater error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode
    });
    sendStatusToWindow(`Update error: ${error.message || 'Unknown error'}`);
  });

  autoUpdater.on('checking-for-update', () => {
    electronLog.info('Checking for updates...');
    sendStatusToWindow('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    electronLog.info('Update available:', info);
    sendStatusToWindow('Update available.');
    mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    electronLog.info('Update not available:', info);
    sendStatusToWindow('Up to date.');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    electronLog.info('Download progress:', message);
    sendStatusToWindow(message);
    mainWindow.webContents.send('download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    electronLog.info('Update downloaded:', info);
    sendStatusToWindow('Update downloaded; will install on next launch');
    autoUpdater.quitAndInstall(false, true);
  });

  safeIpcHandle('check-for-updates', async () => {
    try {
      electronLog.info('Checking for updates...');
      electronLog.info('Current version:', app.getVersion());
      
      const result = await autoUpdater.checkForUpdates();
      electronLog.info('Check result:', result);
      return {
        updateAvailable: result.updateInfo.version !== app.getVersion(),
        currentVersion: app.getVersion(),
        latestVersion: result.updateInfo.version,
        ...result
      };
    } catch (error) {
      electronLog.error('Update check error:', error);
      throw error;
    }
  });

  safeIpcHandle('start-update', async () => {
    try {
      electronLog.info('Starting update download...');
      return await autoUpdater.downloadUpdate();
    } catch (error) {
      electronLog.error('Error downloading update:', error);
      return { status: 'error', message: error.message };
    }
  });

  // Initial check for updates in production
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        electronLog.error('Initial update check failed:', err);
      });
    }, 3000);
  }

  return autoUpdater;
}

module.exports = { setupAutoUpdater };