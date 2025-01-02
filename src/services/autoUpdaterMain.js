// Main process auto-updater setup
const { autoUpdater } = require('electron-updater');
const electronLog = require('electron-log');
const { safeIpcHandle } = require('../core/ipcSafety');
const { app } = require('electron');
const { dialog } = require('electron');
const BackupService = require('./backupService');

function setupAutoUpdater(mainWindow, database) {
  if (!mainWindow) {
    throw new Error('MainWindow is required for auto updater');
  }

  // Configure logging
  autoUpdater.logger = electronLog;
  autoUpdater.logger.transports.file.level = 'debug';
  electronLog.info('Auto Updater starting...');

  // Configure updater options
  autoUpdater.autoDownload = false;
  autoUpdater.fullChangelog = true;
  autoUpdater.allowPrerelease = process.env.NODE_ENV === 'development';

  // Set up GitHub feed URL
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'ltalebli99',
    repo: 'Fyenance',
    private: true
  });

  let updatePopupShown = false;

  // Helper function to send status to window
  function sendStatusToWindow(text) {
    if (mainWindow) {
      mainWindow.webContents.send('update-message', text);
    }
  }

  // Single check-for-updates handler for all platforms
  safeIpcHandle('check-for-updates', async () => {
    try {
      electronLog.info('Checking for updates...');
      electronLog.info('Current version:', app.getVersion());
      
      const result = await autoUpdater.checkForUpdates();
      
      // Log the raw result to see its structure
      electronLog.info('Raw update check result:', JSON.stringify(result, null, 2));

      // Create a serializable response object
      const response = {
        updateAvailable: result.updateInfo.version !== app.getVersion(),
        currentVersion: app.getVersion(),
        latestVersion: result.updateInfo.version,
        releaseNotes: result.updateInfo.releaseNotes || null,
        releaseDate: result.updateInfo.releaseDate || null
      };

      electronLog.info('Serialized response:', response);
      return response;
    } catch (error) {
      electronLog.error('Update check error:', error);
      throw new Error(`Update check failed: ${error.message}`);
    }
  });

  // Auto-updater events
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
    updatePopupShown = false;
    electronLog.info('Checking for updates...');
    sendStatusToWindow('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    electronLog.info('Update available:', info);
    sendStatusToWindow('Update available.');
    
    // Send update info to renderer immediately
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate
    });
    
    // Show popup after delay if not shown yet
    if (!updatePopupShown) {
      updatePopupShown = true;
      setTimeout(() => {
        mainWindow.webContents.send('show-update-popup', {
          version: info.version,
          releaseNotes: info.releaseNotes
        });
      }, 30000);
    }
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
    
    if (process.platform === 'darwin') {
      dialog.showMessageBox({
        type: 'question',
        buttons: ['Install and Restart', 'Later'],
        defaultId: 0,
        message: 'A new version has been downloaded. Would you like to install and restart the app now?'
      }).then(selection => {
        if (selection.response === 0) {
          // User clicked 'Install and Restart'
          autoUpdater.quitAndInstall();
        }
      });
    } else {
      // On Windows/Linux continue with normal quit and install
      sendStatusToWindow('Update downloaded; will install now');
      autoUpdater.quitAndInstall(false, true);
    }
  });

  // Handle the start-update IPC call
  safeIpcHandle('start-update', async () => {
    try {
      electronLog.info('Starting update download...');

      // Create backup before update
      const backupService = new BackupService(database);
      await backupService.createBackup('pre-update');

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