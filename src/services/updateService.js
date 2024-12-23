// Update-related code for renderer process
export async function checkForUpdates() {
    const updateStatus = document.getElementById('update-status');
    const checkUpdatesBtn = document.getElementById('check-updates-btn');
    const startUpdateBtn = document.getElementById('start-update-btn');
    
    if (!updateStatus || !checkUpdatesBtn) return;
  
    try {
        checkUpdatesBtn.disabled = true;
        updateStatus.textContent = 'Checking for updates...';
        startUpdateBtn.style.display = 'none';
        
        // Check for updates
        const currentVersion = await window.versions.app();
        const updateCheck = await window.updateApi.checkForUpdates();
        checkUpdatesBtn.disabled = false;

        if (!updateCheck) {
            if (window.electronAPI.platform === 'darwin') {
                // For macOS, show download link
                updateStatus.innerHTML = `New version ${updateCheck.latestVersion} available! ` +
                    `<a href="#" class="download-link">Click here to download</a>`;
                
                // Add click handler for the download link
                const downloadLink = updateStatus.querySelector('.download-link');
                if (downloadLink) {
                    downloadLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        window.electronAPI.openExternal('https://www.fyenanceapp.com/success');
                    });
                }
            } else {
                // For Windows/Linux, show update button
                updateStatus.textContent = `New version ${updateCheck.latestVersion} available!`;
                startUpdateBtn.style.display = 'block';
            }
        } else {
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

        
        // Platform-specific messaging
        if (window.electronAPI.platform === 'darwin') {
            updateStatus.textContent = 'Downloading update... You will be prompted to restart when ready.';
        } else {
            updateStatus.textContent = 'Downloading update... The app will restart automatically when ready.';
        }
        
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