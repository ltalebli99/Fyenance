const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const startTime = new Date();
  console.log(`[${startTime.toISOString()}] Starting macOS notarization...`);
  
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  
  console.log(`[${new Date().toISOString()}] Application path: ${appPath}`);
  console.log('Environment check:', {
    hasTeamId: !!process.env.APPLE_TEAM_ID,
    hasAppleId: !!process.env.APPLEID,
    hasPassword: !!process.env.APPLEIDPASS
  });

  try {
    console.log(`[${new Date().toISOString()}] Submitting to Apple notary service...`);
    await notarize({
      tool: 'notarytool',
      appPath,
      teamId: process.env.APPLE_TEAM_ID,
      appleId: process.env.APPLEID,
      appleIdPassword: process.env.APPLEIDPASS
    });
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000; // Convert to seconds
    console.log(`[${endTime.toISOString()}] Notarization complete! Duration: ${duration} seconds`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Notarization failed:`, error);
    throw error;
  }
};