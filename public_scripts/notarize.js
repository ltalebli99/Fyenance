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

  // Get the app bundle id from the packager
  const appBundleId = params.packager.config.appId || 'com.fyenance.app';
  const appPath = path.join(params.appOutDir, `${params.packager.appInfo.productFilename}.app`);

  if (!appPath) {
    throw new Error(`Cannot find application at: ${appPath}`);
  }

  logWithTimestamp(`Application path: ${appPath}`);
  logWithTimestamp(`Bundle ID: ${appBundleId}`);
  logWithTimestamp(`Team ID: ${process.env.APPLE_TEAM_ID}`);
  logWithTimestamp(`Apple ID: ${process.env.APPLE_ID}`);

  try {
    logWithTimestamp('Submitting to Apple notary service...');
    const startTime = Date.now();

    // Pass all required options explicitly
    const notarizeOptions = {
      tool: 'notarytool',
      appPath,
      appBundleId,
      teamId: process.env.APPLE_TEAM_ID,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    };

    await notarize(notarizeOptions);

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