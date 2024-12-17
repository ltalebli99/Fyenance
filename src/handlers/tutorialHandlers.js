// src/handlers/tutorialHandlers.js
const { safeIpcHandle } = require('../core/ipcSafety');

function setupTutorialHandlers(database) {
  safeIpcHandle('tutorial:getStatus', () => {
    return database.getTutorialStatus();
  });

  safeIpcHandle('tutorial:complete', () => {
    return database.setTutorialComplete();
  });

  safeIpcHandle('tutorial:reset', () => {
    return database.resetTutorialStatus();
  });
}

module.exports = { setupTutorialHandlers };