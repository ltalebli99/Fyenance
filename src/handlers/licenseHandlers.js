// src/handlers/licenseHandlers.js
const { safeIpcHandle } = require('../core/ipcSafety');

function setupLicenseHandlers(licenseService) {
  if (!licenseService) {
    throw new Error('License service is required for license handlers');
  }

  safeIpcHandle('getLicenseInfo', () => {
    return licenseService.getLicenseInfo();
  });

  safeIpcHandle('checkLicenseExists', async () => {
    return await licenseService.checkLicenseExists();
  });

  safeIpcHandle('validateLicense', async (event, licenseKey) => {
    return await licenseService.validateLicense(licenseKey);
  });

  safeIpcHandle('clearLicense', () => {
    return licenseService.clearLicense();
  });

  safeIpcHandle('isValidKeyFormat', (event, key) => {
    return licenseService.isValidKeyFormat(key);
  });

  safeIpcHandle('saveLicense', (event, key) => {
    return licenseService.saveLicense(key);
  });
}

module.exports = { setupLicenseHandlers };