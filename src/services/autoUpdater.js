// src/services/autoUpdater.js
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

  // Auto-updater events with error handling
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
    // Install on next app launch
    autoUpdater.quitAndInstall(false, true);
  });

  // Register IPC handlers
  safeIpcHandle('get-app-version', () => {
    return app.getVersion();
  });

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

  // Initial check for updates
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.error('Initial update check failed:', err);
      });
    }, 3000); // Check after 3 seconds
  }

  return autoUpdater;
}

// Renderer process functions
export function initializeVersionControl() {
  window.versions.app().then(version => {
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
      versionElement.textContent = version;
    }
  }).catch(err => {
    console.error('Error getting app version:', err);
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
      versionElement.textContent = 'Unknown';
    }
  });

  const checkUpdatesBtn = document.getElementById('check-updates-btn');
  const startUpdateBtn = document.getElementById('start-update-btn');

  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener('click', checkForUpdates);
  }

  if (startUpdateBtn) {
    startUpdateBtn.addEventListener('click', startUpdate);
  }

  setTimeout(checkForUpdates, 5000);
}

export async function checkForUpdates() {
  const updateStatus = document.getElementById('update-status');
  const checkUpdatesBtn = document.getElementById('check-updates-btn');
  const startUpdateBtn = document.getElementById('start-update-btn');
  
  if (!updateStatus || !checkUpdatesBtn) return;

  try {
    checkUpdatesBtn.disabled = true;
    updateStatus.textContent = 'Checking for updates...';
    startUpdateBtn.style.display = 'none';
    
    const currentVersion = await window.versions.app();
    const updateCheck = await window.updateApi.checkForUpdates();
    
    checkUpdatesBtn.disabled = false;

    if (!updateCheck) {
      updateStatus.textContent = 'You are using the latest version.';
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
    updateStatus.textContent = 'Error checking for updates. Please try again later.';
    checkUpdatesBtn.disabled = false;
  }
}

export async function startUpdate() {
  const updateStatus = document.getElementById('update-status');
  const startUpdateBtn = document.getElementById('start-update-btn');
  
  if (!updateStatus || !startUpdateBtn) return;

  try {
    updateStatus.textContent = 'Starting download...';
    startUpdateBtn.style.display = 'none';
    await window.updateApi.startUpdate();
  } catch (error) {
    console.error('Error starting update:', error);
    updateStatus.textContent = 'Error downloading update. Please try again later.';
    startUpdateBtn.style.display = 'block';
  }
}

// Export for main process
module.exports = { setupAutoUpdater };

// Handle update available
window.updateApi.onUpdateAvailable((info) => {
  const updateStatus = document.getElementById('update-status');
  const startUpdateBtn = document.getElementById('start-update-btn');
  
  if (updateStatus && startUpdateBtn) {
    updateStatus.textContent = `New version ${info.version} available!`;
    startUpdateBtn.style.display = 'block';
  }
});

// Handle update messages
window.updateApi.onUpdateMessage((message) => {
  const updateStatus = document.getElementById('update-status');
  if (updateStatus) {
    updateStatus.textContent = message;
  }
});