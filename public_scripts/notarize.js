const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") {
    return;
  }

  console.log('Notarizing macOS application...');
  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`Attempting to notarize ${appPath}`);
  console.log('Environment check:', {
    hasAppleId: !!process.env.APPLE_ID,
    hasTeamId: !!process.env.APPLE_TEAM_ID,
    hasPassword: !!process.env.APPLE_APP_SPECIFIC_PASSWORD
  });

  try {
    console.log('Starting notarization...');
    console.log(`Uploading ${appPath} to Apple's notary service...`);
    
    await notarize({
      tool: "notarytool",
      appBundleId: 'com.fyenance.app',
      appPath,
      teamId: process.env.APPLE_TEAM_ID,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      verbose: true
    });
    
    console.log('✅ Notarization complete and successful!');
  } catch (error) {
    console.error('❌ Notarization failed:', error);
    throw error;
  }
};