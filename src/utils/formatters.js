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

function formatDateForDisplay(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    
    // Get month abbreviation
    const month = date.toLocaleString('en-US', { month: 'short' });
    
    // Get day with ordinal suffix
    const day = date.getDate();
    const suffix = getOrdinalSuffix(day);
    
    // Get 2-digit year
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

export { formatCurrency, capitalizeFirstLetter, hexToRgb, sanitizeHTML, setTextContent, formatDate, formatDateForDisplay };
