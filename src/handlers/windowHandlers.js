// src/handlers/windowHandlers.js
const { ipcMain } = require('electron');

function setupWindowHandlers(mainWindow) {
    ipcMain.on('minimize-window', () => {
        mainWindow.minimize();
    });

    ipcMain.on('close-window', () => {
        mainWindow.close();
    });

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