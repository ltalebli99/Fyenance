import { getCurrencySymbol } from '../services/currencyService.js';

// Utility function to format numbers as currency
function formatCurrency(amount) {
    const symbol = getCurrencySymbol();
    
    // Convert to number and handle invalid inputs
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return `${symbol}0.00`;

    // Format with fixed decimal places and explicit US formatting
    return `${symbol}${numAmount.toLocaleString('en-US', {
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
  
  // Store cursor position relative to the end of the input
  const cursorFromEnd = input.value.length - input.selectionStart;
  
  // Remove currency symbol and allow decimal point
  let value = input.value.replace(symbol, '');
  
  // Then remove all non-numeric characters except decimal point
  value = value.replace(/[^\d.]/g, '');
  
  // Ensure only one decimal point
  const parts = value.split('.');
  if (parts.length > 2) {
    parts[1] = parts.slice(1).join('');
    value = parts.join('.');
  }
  
  // Limit decimal places to 2
  if (parts.length === 2) {
    parts[1] = parts[1].slice(0, 2);
    value = parts.join('.');
  }
  
  // Format with commas for thousands
  let [integerPart, decimalPart] = value.split('.');
  if (!integerPart && value.startsWith('.')) {
    integerPart = '0';
  }
  
  if (integerPart) {
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  // Reconstruct the value
  value = integerPart || '0';
  if (decimalPart !== undefined) {
    value += '.' + decimalPart;
  }
  
  // Store the raw numeric value without commas
  input.dataset.amount = value.replace(/,/g, '');
  
  // Add symbol while typing
  const newValue = symbol + value;
  input.value = newValue;
  
  // Restore cursor position
  const newPosition = newValue.length - cursorFromEnd;
  input.setSelectionRange(newPosition, newPosition);
  
  // Add blur handler to format when input loses focus
  input.onblur = () => {
    const numValue = parseFloat(value.replace(/,/g, ''));
    if (!isNaN(numValue)) {
      // Format with commas and currency symbol
      const formatted = formatCurrency(Math.abs(numValue));
      input.value = formatted;
    } else {
      input.value = symbol;
      input.setSelectionRange(symbol.length, symbol.length);
    }
  };
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

function formatInitialAmount(amount) {
    if (!amount) return getCurrencySymbol();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return getCurrencySymbol();
    return formatCurrency(Math.abs(numAmount));
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
    initializeAmountInput,
    formatInitialAmount
};
