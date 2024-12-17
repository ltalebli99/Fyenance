// Initialize navigation style
if (typeof window !== 'undefined') {
    const savedNavStyle = localStorage.getItem('navStyle');
    if (savedNavStyle === 'static') {
        document.body.classList.add('static-nav');
    }
}

// Function to toggle navigation style
export function toggleNavigationStyle() {
    const isStatic = document.body.classList.toggle('static-nav');
    localStorage.setItem('navStyle', isStatic ? 'static' : 'dynamic');
    
    // Update button text and icon
    const button = document.getElementById('toggle-nav-style-btn');
    if (button) {
        const icon = button.querySelector('i');
        icon.className = isStatic ? 'fas fa-thumbtack' : 'fas fa-expand';
    }
}

// Initialize on DOM load
export function loadNavigationPreference() {
    const savedNavStyle = localStorage.getItem('navStyle');
    if (savedNavStyle === 'static') {
        document.body.classList.add('static-nav');
        const button = document.getElementById('toggle-nav-style-btn');
        if (button) {
            const icon = button.querySelector('i');
            icon.className = 'fas fa-thumbtack';
        }
    }
}

// Add event listener for the toggle button
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        loadNavigationPreference();
    });
}