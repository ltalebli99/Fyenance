import { formatAmountInput } from './formatters.js';
import { showError } from './utils.js';
import { getCurrencySymbol } from '../services/currencyService.js';
import { initializeAmountInput } from './formatters.js';
import { formatCurrency } from './formatters.js';
import { getAmountValue } from './formatters.js';

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

function setupAmountInput(input) {
  if (input.dataset.amountField === 'true') return;

  input.type = 'text';
  input.dataset.amountField = 'true';
  initializeAmountInput(input);

  input.addEventListener('input', (e) => {
    formatAmountInput(e.target);
  });

  input.addEventListener('focus', (e) => {
    e.target.select();
  });

  input.addEventListener('blur', (e) => {
    clearTimeout(e.target.formatTimeout);
    if (e.target.value) {
      const value = getAmountValue(e.target);
      if (value !== null) {
        e.target.value = formatCurrency(value);
      }
    }
  });
}

export function initializeAmountInputs() {
  const amountInputs = document.querySelectorAll(
    'input[type="number"][step="0.01"], input[data-amount-field="true"]'
  );

  amountInputs.forEach(setupAmountInput);
}

export function refreshAmountInputsForCurrency() {
  document.querySelectorAll('input[data-amount-field="true"]').forEach((input) => {
    delete input.dataset.amount;
    initializeAmountInput(input);
  });
}

window.addEventListener('currencyPreferenceChanged', refreshAmountInputsForCurrency);