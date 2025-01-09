import { formatAmountInput } from './formatters.js';
import { showError } from './utils.js';
import { getCurrencySymbol } from '../services/currencyService.js';
import { initializeAmountInput } from './formatters.js';
import { formatCurrency } from './formatters.js';

export function validateProjectDates(startDate, endDate) {
    if (!startDate || !endDate) return true;
    return new Date(startDate) <= new Date(endDate);
}

export function validateProjectForm(project) {
    if (!project.name?.trim()) {
        showError('Project name is required');
        return false;
    }
    
    if (project.budget && project.budget < 0) {
        showError('Budget cannot be negative');
        return false;
    }
    
    if (project.start_date && project.end_date && 
        !validateProjectDates(project.start_date, project.end_date)) {
        showError('End date must be after start date');
        return false;
    }
    
    return true;
}

export function initializeAmountInputs() {
  // Find all number inputs with step="0.01"
  const amountInputs = document.querySelectorAll('input[type="number"][step="0.01"]');
  
  amountInputs.forEach(input => {
    // Convert to text type to allow formatting
    input.type = 'text';
    
    // Initialize the input
    initializeAmountInput(input);

    // Add input event listener
    input.addEventListener('input', (e) => {
      formatAmountInput(e.target);
    });

    // Handle focus to select all text
    input.addEventListener('focus', (e) => {
      e.target.select();
    });

    // Handle blur to ensure proper formatting
    input.addEventListener('blur', (e) => {
      clearTimeout(e.target.formatTimeout);
      if (e.target.value) {
        // Use the stored numeric value from the dataset instead of parsing the display value
        const numValue = parseFloat(e.target.dataset.amount);
        if (!isNaN(numValue)) {
          e.target.value = formatCurrency(numValue);
        }
      }
    });
  });
}