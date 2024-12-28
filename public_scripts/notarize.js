const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  console.log('Notarizing macOS application...');
  
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  
  try {
    await notarize({
      tool: 'notarytool',
      appPath,
      teamId: process.env.APPLE_TEAM_ID,
      appleId: process.env.APPLEID,
      appleIdPassword: process.env.APPLEIDPASS
    });
    console.log('Notarization complete!');
  } catch (error) {
    console.error('Notarization failed:', error);
    throw error;
  }
};