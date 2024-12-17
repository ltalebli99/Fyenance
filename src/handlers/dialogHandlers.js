// src/handlers/dialogHandlers.js
const { dialog } = require('electron');
const { safeIpcHandle } = require('../core/ipcSafety');

function setupDialogHandlers(mainWindow) {
  // Database export dialog
  safeIpcHandle('dialog:showSaveDialog', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Database',
      defaultPath: 'fyenance-backup.db',
      filters: [
        { name: 'Database Files', extensions: ['db'] }
      ]
    });
    return result;
  });

  // Database import dialog
  safeIpcHandle('dialog:showOpenDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Database',
      filters: [
        { name: 'Database Files', extensions: ['db'] }
      ],
      properties: ['openFile']
    });
    return result;
  });

  // CSV export folder selection dialog
  safeIpcHandle('dialog:showFolderDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Export Location',
      properties: ['openDirectory']
    });
    return result;
  });
}

module.exports = { setupDialogHandlers };