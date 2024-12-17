// Update-related code for renderer process
export async function checkForUpdates() {
    const updateStatus = document.getElementById('update-status');
    const checkUpdatesBtn = document.getElementById('check-updates-btn');
    const startUpdateBtn = document.getElementById('start-update-btn');
    
    if (!updateStatus || !checkUpdatesBtn) return;
  
    try {
        // Disable button and show checking status
        checkUpdatesBtn.disabled = true;
        updateStatus.textContent = 'Checking for updates...';
        startUpdateBtn.style.display = 'none';
        
        // Check for updates
        const currentVersion = await window.versions.app();
        const updateCheck = await window.updateApi.checkForUpdates();
        
        // Re-enable button
        checkUpdatesBtn.disabled = false;
  
        if (!updateCheck) {
            updateStatus.textContent = 'You are using the latest version.';
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
        updateStatus.textContent = 'Error checking for updates. Please try again later.';
        checkUpdatesBtn.disabled = false;
    }
}

// Start update process
export async function startUpdate() {
    const updateStatus = document.getElementById('update-status');
    const startUpdateBtn = document.getElementById('start-update-btn');
    
    if (!updateStatus || !startUpdateBtn) return;
  
    try {
        updateStatus.textContent = 'Starting download...';
        startUpdateBtn.style.display = 'none';
        await window.updateApi.startUpdate();
    } catch (error) {
        console.error('Error starting update:', error);
        updateStatus.textContent = 'Error downloading update. Please try again later.';
        startUpdateBtn.style.display = 'block';
    }
}

// Initialize version control
export function initializeVersionControl() {
    // Set version number
    window.versions.app().then(version => {
        const versionElement = document.getElementById('app-version');
        if (versionElement) {
            versionElement.textContent = version;
        }
    }).catch(err => {
        console.error('Error getting app version:', err);
        const versionElement = document.getElementById('app-version');
        if (versionElement) {
            versionElement.textContent = 'Unknown';
        }
    });
  
    // Add event listeners
    const checkUpdatesBtn = document.getElementById('check-updates-btn');
    const startUpdateBtn = document.getElementById('start-update-btn');
  
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', checkForUpdates);
    }
  
    if (startUpdateBtn) {
        startUpdateBtn.addEventListener('click', startUpdate);
    }
  
    // Check for updates after a delay
    setTimeout(checkForUpdates, 5000);

    // Set up update event listeners
    setupUpdateEventListeners();
}

// Set up event listeners for update events
function setupUpdateEventListeners() {
    // Handle update available
    window.updateApi.onUpdateAvailable((info) => {
        const updateStatus = document.getElementById('update-status');
        const startUpdateBtn = document.getElementById('start-update-btn');
        
        if (updateStatus && startUpdateBtn) {
            updateStatus.textContent = `New version ${info.version} available!`;
            startUpdateBtn.style.display = 'block';
        }
    });
    
    // Handle update messages
    window.updateApi.onUpdateMessage((message) => {
        const updateStatus = document.getElementById('update-status');
        if (updateStatus) {
            updateStatus.textContent = message;
        }
    });
}

// Handle tab changes
export function onTabChange(activeSection) {
    if (activeSection === 'Settings') {
        initializeVersionControl();
    }
}

// Initialize on DOM load if on Settings tab
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('Settings')?.classList.contains('active')) {
        initializeVersionControl();
    }
});