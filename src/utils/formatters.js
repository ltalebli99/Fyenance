import { getCurrencySymbol, getCurrencyLocale } from '../services/currencyService.js';

// Utility function to format numbers as currency
function formatCurrency(amount) {
    const symbol = getCurrencySymbol();
    const locale = getCurrencyLocale();
    
    // Convert to number and handle invalid inputs
    const numAmount = parseFloat(amount);
    
    // Special handling for Serbian Dinar
    if (symbol === ' дин.') {
        if (isNaN(numAmount)) return `0,00 ${symbol}`;
        const formatted = numAmount.toLocaleString('sr-RS', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return `${formatted}${symbol}`;
    }

    // Default handling for other currencies
    if (isNaN(numAmount)) return `${symbol}0.00`;
    const formatted = numAmount.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return `${symbol}${formatted}`;
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
  const locale = getCurrencyLocale();
  
  // Get locale-specific separators
  const format = new Intl.NumberFormat(locale).format(1111.1);
  const thousandSep = format.charAt(1);
  const decimalSep = format.charAt(5);
  
  // Store cursor position relative to the end
  const cursorFromEnd = input.value.length - input.selectionStart;
  
  // Remove currency symbol
  let value = input.value.replace(symbol, '');
  
  // Handle the case where user just typed a decimal separator
  const lastChar = value.slice(-1);
  const isNewDecimal = (lastChar === '.' || lastChar === ',');
  
  // Remove existing thousand separators
  value = value.replace(new RegExp(`\\${thousandSep}`, 'g'), '');
  
  // Convert any existing periods or commas to the locale decimal separator
  value = value.replace(/[.,]/g, decimalSep);
  
  // Split by decimal separator
  const parts = value.split(decimalSep);
  
  // Only keep the first decimal separator
  let integerPart = parts[0].replace(/\D/g, '');
  let decimalPart = parts.length > 1 ? parts[1].replace(/\D/g, '').slice(0, 2) : '';
  
  // Add thousand separators to integer part if it exists
  if (integerPart) {
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  }
  
  // Reconstruct value, keeping decimal separator if just typed
  value = (integerPart || '0');
  if (decimalPart || isNewDecimal) {
    value += decimalSep + (decimalPart || '');
  }
  
  // Store numeric value
  const numericValue = parseFloat(value.replace(new RegExp(`\\${thousandSep}`, 'g'), '').replace(decimalSep, '.'));
  input.dataset.amount = isNaN(numericValue) ? '0' : numericValue.toString();
  
  // Add currency symbol
  const newValue = symbol + value;
  input.value = newValue;
  
  // Restore cursor position from end
  const newPosition = newValue.length - cursorFromEnd;
  input.setSelectionRange(newPosition, newPosition);
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
  
  const locale = getCurrencyLocale();
  const format = new Intl.NumberFormat(locale).format(1111.1);
  const thousandSep = format.charAt(1);
  const decimalSep = format.charAt(5);
  
  // Remove currency symbol and clean the value
  const value = input.value
    .replace(getCurrencySymbol(), '')
    .replace(new RegExp(`\\${thousandSep}`, 'g'), '')  // Remove thousand separators
    .replace(decimalSep, '.')  // Convert locale decimal to period
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
