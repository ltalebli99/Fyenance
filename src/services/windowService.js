// Window Controls
export function initializeWindowControls() {
    console.log('Window controls initialization started');

    const minimizeButton = document.getElementById('minimizeButton');
    const maximizeButton = document.getElementById('maximizeButton');
    const closeButton = document.getElementById('closeButton');
    
    console.log('Buttons found:', {
        minimize: !!minimizeButton,
        maximize: !!maximizeButton,
        close: !!closeButton
    });

    if (!minimizeButton || !maximizeButton || !closeButton) {
        console.error('Window control buttons not found');
        return;
    }

    console.log('electronAPI available:', !!window.electronAPI);

    minimizeButton.addEventListener('click', () => {
        console.log('Minimize clicked');
        window.electronAPI?.minimizeWindow();
    });

    maximizeButton.addEventListener('click', () => {
        console.log('Maximize/Restore clicked');
        window.electronAPI?.toggleMaximizeWindow();
    });

    closeButton.addEventListener('click', () => {
        console.log('Close clicked');
        window.electronAPI?.closeWindow();
    });

    // Initialize maximize button state
    window.electronAPI?.getWindowState().then(({ isMaximized }) => {
        updateMaximizeButton(isMaximized);
    });

    // Listen for window state changes
    window.electronAPI?.onWindowStateChange((isMaximized) => {
        console.log('Window state changed:', isMaximized);
        updateMaximizeButton(isMaximized);
    });

    // Add platform class
    if (window.electronAPI?.platform) {
        document.body.classList.add(`platform-${window.electronAPI.platform}`);
    }
}

function updateMaximizeButton(isMaximized) {
    const maximizeButton = document.getElementById('maximizeButton');
    if (maximizeButton) {
        const icon = maximizeButton.querySelector('i');
        if (icon) {
            // Use different icons for maximized vs restored state
            icon.className = isMaximized ? 'fas fa-clone' : 'fas fa-square';
        }
    }
}