  // Theme initialization
const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }

  

// Function to toggle theme
export function toggleTheme() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }
  
  // Event listener for the toggle button
  document.getElementById('toggle-theme-btn').addEventListener('click', toggleTheme);
  
  // Load theme preference on startup
  export function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
    }
  }
  
  // Call loadThemePreference on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', loadThemePreference);
  
  