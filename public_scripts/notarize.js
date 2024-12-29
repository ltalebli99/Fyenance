const { notarize } = require('@electron/notarize');
const path = require('path');

function logWithTimestamp(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Check environment variables first
  const requiredVars = {
    APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
    APPLE_ID: process.env.APPLE_ID,
    APPLE_APP_SPECIFIC_PASSWORD: process.env.APPLE_APP_SPECIFIC_PASSWORD
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  logWithTimestamp('Starting macOS notarization...');
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  const appBundleId = packager.appInfo.id;
  
  logWithTimestamp(`Application path: ${appPath}`);
  logWithTimestamp(`Bundle ID: ${appBundleId}`);
  logWithTimestamp(`Team ID: ${process.env.APPLE_TEAM_ID}`);
  logWithTimestamp(`Apple ID: ${process.env.APPLE_ID}`);

  try {
    logWithTimestamp('Submitting to Apple notary service...');
    const startTime = Date.now();

    const result = await notarize({
      tool: 'notarytool',
      appPath,
      appBundleId,
      teamId: process.env.APPLE_TEAM_ID,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      debug: true,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logWithTimestamp(`Notarization completed in ${duration} seconds`);
    
    if (result) {
      logWithTimestamp('Notarization result:');
      logWithTimestamp(JSON.stringify(result, null, 2));
    }
    
    // Verify the notarization
    logWithTimestamp('Verifying notarization with stapler...');
    const { spawnSync } = require('child_process');
    
    // First, try to staple
    const stapleResult = spawnSync('xcrun', ['stapler', 'staple', appPath], { encoding: 'utf8' });
    logWithTimestamp(`Stapler result: ${stapleResult.stdout || stapleResult.stderr}`);
    
    // Then validate
    const validateResult = spawnSync('xcrun', ['stapler', 'validate', appPath], { encoding: 'utf8' });
    logWithTimestamp(`Validation result: ${validateResult.stdout || validateResult.stderr}`);

    // Also check with spctl
    const spctlResult = spawnSync('spctl', ['--assess', '--verbose', '--type', 'execute', appPath], { encoding: 'utf8' });
    logWithTimestamp(`Security assessment result: ${spctlResult.stdout || spctlResult.stderr}`);

  } catch (error) {
    logWithTimestamp('Notarization failed:');
    logWithTimestamp(`Error message: ${error.message}`);
    if (error.stderr) logWithTimestamp(`stderr: ${error.stderr}`);
    if (error.stdout) logWithTimestamp(`stdout: ${error.stdout}`);
    throw error;
  }
};