export function positionFilterPanel(button, panel) {
    if (!button || !panel) return;
    
    const buttonRect = button.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const panelHeight = panel.offsetHeight;
    const panelWidth = panel.offsetWidth || 300; // Default width if not set
    
    // Calculate available space
    const spaceBelow = windowHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    
    // Reset any previous positioning
    panel.style.position = 'fixed';
    panel.style.top = '';
    panel.style.bottom = '';
    
    // Vertical positioning
    if (spaceBelow >= panelHeight || spaceBelow > spaceAbove) {
      // Position below button
      panel.style.top = `${buttonRect.bottom}px`;
      panel.style.bottom = 'auto';
    } else {
      // Position above button
      panel.style.bottom = `${windowHeight - buttonRect.top}px`;
      panel.style.top = 'auto';
    }
    
    // Horizontal positioning
    let leftPosition = Math.min(
      buttonRect.right - panelWidth,
      windowWidth - panelWidth - 10 // 10px margin from right edge
    );
    leftPosition = Math.max(10, leftPosition); // At least 10px from left edge
    panel.style.left = `${leftPosition}px`;
    
    // Ensure panel stays within viewport
    if (panel.getBoundingClientRect().right > windowWidth) {
      panel.style.left = `${windowWidth - panelWidth - 10}px`;
    }
  }


    
  // Add debounced search functionality
  export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
  }