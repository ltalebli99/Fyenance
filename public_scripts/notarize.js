const { notarize } = require('@electron/notarize');
const path = require('path');

function logWithTimestamp(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function waitForStatus(statusCheckFn, timeout = 1800000) { // 30 minutes timeout
  const startTime = Date.now();
  const checkInterval = 30000; // Check every 30 seconds

  while (Date.now() - startTime < timeout) {
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    logWithTimestamp(`Checking notarization status (${elapsedSeconds}s elapsed)...`);

    try {
      const result = await statusCheckFn();
      if (result.status === 'success') {
        return true;
      }
      logWithTimestamp(`Current status: ${result.status}`);
      if (result.message) {
        logWithTimestamp(`Status message: ${result.message}`);
      }
    } catch (error) {
      logWithTimestamp(`Error checking status: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  throw new Error('Notarization timed out');
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const startTime = new Date();
  logWithTimestamp('Starting macOS notarization...');
  
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  
  logWithTimestamp(`Application path: ${appPath}`);
  
  const envCheck = {
    hasTeamId: !!process.env.APPLE_TEAM_ID,
    hasAppleId: !!process.env.APPLEID,
    hasPassword: !!process.env.APPLEIDPASS
  };
  
  logWithTimestamp('Environment check: ' + JSON.stringify(envCheck));

  if (!envCheck.hasTeamId || !envCheck.hasAppleId || !envCheck.hasPassword) {
    throw new Error('Missing required environment variables for notarization');
  }

  try {
    logWithTimestamp('Submitting to Apple notary service...');
    
    const notarizationOptions = {
      tool: 'notarytool',
      appPath,
      teamId: process.env.APPLE_TEAM_ID,
      appleId: process.env.APPLEID,
      appleIdPassword: process.env.APPLEIDPASS,
      debug: true, // Enable debug logging
      verbose: true // Enable verbose output
    };

    // Add progress callback if supported
    if (typeof notarize.onProgress === 'function') {
      notarizationOptions.onProgress = (progress) => {
        logWithTimestamp(`Notarization progress: ${JSON.stringify(progress)}`);
      };
    }

    await notarize(notarizationOptions);
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    logWithTimestamp(`Notarization complete! Duration: ${duration} seconds`);
    
    // Verify the notarization was successful
    logWithTimestamp('Verifying notarization...');
    const { spawnSync } = require('child_process');
    const verifyResult = spawnSync('xcrun', ['stapler', 'validate', appPath], { encoding: 'utf8' });
    logWithTimestamp(`Verification result: ${verifyResult.stdout || verifyResult.stderr}`);

  } catch (error) {
    logWithTimestamp('Notarization failed with error:');
    logWithTimestamp(error.message);
    if (error.stderr) logWithTimestamp(`stderr: ${error.stderr}`);
    if (error.stdout) logWithTimestamp(`stdout: ${error.stdout}`);
    throw error;
  }
};