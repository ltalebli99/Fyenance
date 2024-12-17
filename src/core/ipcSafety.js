const { ipcMain } = require('electron');

function safeIpcHandle(channel, handler) {
  if (ipcMain.listenerCount(channel) > 0) {
    ipcMain.removeHandler(channel);
  }
  ipcMain.handle(channel, handler);
}

function safeIpcOn(channel, listener) {
  ipcMain.removeAllListeners(channel);
  ipcMain.on(channel, listener);
}

module.exports = {
  safeIpcHandle,
  safeIpcOn
};