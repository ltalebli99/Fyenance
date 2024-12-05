const { app } = require('electron');
const DatabaseService = require('./database');

let databaseInstance = null;

function initializeDatabase() {
  if (!databaseInstance) {
    const userDataPath = app.getPath('userData');
    databaseInstance = DatabaseService.initialize(userDataPath);
  }
  return databaseInstance;
}

module.exports = { initializeDatabase };