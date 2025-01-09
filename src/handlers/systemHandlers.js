// handlers/systemHandlers.js
const { app, shell } = require('electron');
const { safeIpcHandle, safeIpcOn } = require('../core/ipcSafety');

function setupSystemHandlers() {
  safeIpcOn('relaunch-app', () => {
    app.relaunch();
    app.exit();
  });

  safeIpcHandle('open-external', async (_, url) => {
    return shell.openExternal(url);
  });

  safeIpcHandle('get-app-version', () => {
    return app.getVersion();
  });

  safeIpcHandle('fetch-exchange-rates', async () => {
    try {
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
}

module.exports = { setupSystemHandlers };