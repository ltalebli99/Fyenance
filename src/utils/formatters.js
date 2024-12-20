import { getCurrencySymbol } from '../services/currencyService.js';

// Utility function to format numbers as currency
function formatCurrency(amount) {
    const symbol = getCurrencySymbol();
    return `${symbol}${parseFloat(amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

// Capitalize first letter of a string
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert 3-digit hex to 6-digits
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // Convert hex to rgb
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return [r, g, b];
  }

  function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
  }

  function setTextContent(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = sanitizeHTML(text);
    }
}

function formatDate(date) {
  if (!(date instanceof Date)) {
      date = new Date(date);
  }
  return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
  });
}

function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    try {
        // Create a new date object
        const date = new Date(dateString);
        
        // Check if the date is valid
        if (isNaN(date.getTime())) {
            console.error('Invalid date:', dateString);
            return '';
        }
        
        // Format the date as YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error formatting date:', error);
        return '';
    }
}

function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    // Create date and adjust for timezone
    const date = new Date(dateString);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    
    // Get month abbreviation
    const month = date.toLocaleString('en-US', { month: 'short' });
    
    // Get day with ordinal suffix
    const day = date.getDate();
    const suffix = getOrdinalSuffix(day);
    
    // Get year
    const year = date.getFullYear().toString();
    
    return `${month} ${day}${suffix}, ${year}`;
}

function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

function formatAmountInput(input) {
  const symbol = getCurrencySymbol();
  
  // Clear any existing timeout
  clearTimeout(input.formatTimeout);
  
  // Remove currency symbol and any non-numeric characters except decimal point
  let value = input.value.replace(symbol, '').replace(/[^\d.-]/g, '');
  
  // Ensure only one decimal point
  const parts = value.split('.');
  if (parts.length > 2) {
    parts[1] = parts.slice(1).join('');
    value = parts.join('.');
  }

  // Store the raw numeric value
  input.dataset.amount = value;

  // If actively typing, just add the symbol and wait
  if (!input.formatTimeout) {
    input.value = symbol + value;
    const cursorPosition = input.selectionStart;
    input.setSelectionRange(cursorPosition, cursorPosition);
  }

  // Set a timeout to format after typing stops
  input.formatTimeout = setTimeout(() => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      // Format with commas and currency symbol
      const formatted = symbol + new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Math.abs(numValue));

      input.value = formatted;
    } else {
      input.value = symbol;
      input.setSelectionRange(symbol.length, symbol.length);
    }
  }, 500); // Wait 500ms after typing stops before formatting
}

// When initializing an empty input, set cursor after symbol
function initializeAmountInput(input) {
  const symbol = getCurrencySymbol();
  if (!input.value || input.value === symbol) {
    input.value = symbol;
    input.setSelectionRange(symbol.length, symbol.length);
  }
}

function getAmountValue(input) {
  if (!input || !input.value || input.value.trim() === '' || input.value === getCurrencySymbol()) {
    return null;
  }
  
  // Remove currency symbol and any formatting characters
  const value = input.value
    .replace(getCurrencySymbol(), '')
    .replace(/,/g, '')
    .trim();
    
  // If empty after cleaning, return null
  if (!value) return null;
  
  // Convert to number and validate
  const numValue = parseFloat(value);
  return isNaN(numValue) ? null : numValue.toString();
}

export { formatCurrency, 
    capitalizeFirstLetter, 
    hexToRgb, 
    sanitizeHTML, 
    setTextContent, 
    formatDate, 
    formatDateForDisplay,
    formatDateForInput,
    formatAmountInput,
    getAmountValue,
    initializeAmountInput
};
