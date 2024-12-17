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
}

module.exports = { setupSystemHandlers };