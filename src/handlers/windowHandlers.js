// src/handlers/windowHandlers.js
const { ipcMain, app } = require('electron');

function setupWindowHandlers(mainWindow) {
    ipcMain.on('minimize-window', () => {
        mainWindow.minimize();
    });

    ipcMain.on('close-window', () => {
        if (process.platform === 'darwin') {
            mainWindow.hide();
        } else {
            mainWindow.close();
        }
    });

    // Add dock click handler for macOS
    if (process.platform === 'darwin') {
        app.on('activate', () => {
            mainWindow.show();
            mainWindow.setWindowButtonVisibility(false);
        });
    }

    ipcMain.on('toggle-maximize-window', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });

    // These handlers are needed for all platforms
    ipcMain.handle('get-window-state', () => {
        return { 
            isMaximized: mainWindow.isMaximized(),
            platform: process.platform
        };
    });

    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window-state-change', { isMaximized: true });
    });

    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window-state-change', { isMaximized: false });
    });
}

module.exports = {
    setupWindowHandlers
};