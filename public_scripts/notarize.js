const { notarize } = require('@electron/notarize');
const path = require('path');

function logWithTimestamp(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

module.exports = async function (params) {
  // Only notarize the app on macOS
  if (process.platform !== 'darwin') {
    return;
  }

  logWithTimestamp('Starting macOS notarization...');

  const appBundleId = 'com.fyenance.app';
  const appPath = path.join(params.appOutDir, `${params.packager.appInfo.productFilename}.app`);

  if (!process.env.APPLE_ID || !process.env.APPLE_TEAM_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    throw new Error('Required environment variables are missing for notarization. Need APPLE_ID, APPLE_TEAM_ID, and APPLE_APP_SPECIFIC_PASSWORD');
  }

  try {
    logWithTimestamp('Submitting to Apple notary service...');
    const startTime = Date.now();

    await notarize({
      tool: 'notarytool',
      appPath,
      appBundleId,
      teamId: process.env.APPLE_TEAM_ID,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logWithTimestamp(`Notarization completed in ${duration} seconds`);

  } catch (error) {
    logWithTimestamp('Notarization failed:');
    logWithTimestamp(`Error message: ${error.message}`);
    if (error.stderr) logWithTimestamp(`stderr: ${error.stderr}`);
    if (error.stdout) logWithTimestamp(`stdout: ${error.stdout}`);
    throw error;
  }
};