import { getCurrencySymbol, getCurrencyLocale, getCurrencyPreference, defaultCurrencies } from '../services/currencyService.js';

// Utility function to format numbers as currency
function formatCurrency(amount) {
    const code = getCurrencyPreference();
    const locale = getCurrencyLocale();
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount)) {
        return numAmount.toLocaleString(locale, {
            style: 'currency',
            currency: code
        });
    }
    
    return numAmount.toLocaleString(locale, {
        style: 'currency',
        currency: code
    });
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
    const currency = defaultCurrencies.find(c => c.code === getCurrencyPreference());
    const locale = currency.locale;
    const symbol = currency.symbol;
    const symbolAfter = currency.symbolAfter;
    
    // Special handling for Polish currency to prevent truncation
    const isPolish = locale.startsWith('pl');
    
    // Get format information from locale
    const format = new Intl.NumberFormat(locale).format(1111.1);
    const thousandSep = format.charAt(1);
    const decimalSep = format.charAt(5);
    
    // Store cursor position relative to the end
    const cursorFromEnd = input.value.length - input.selectionStart;
    
    // Remove currency symbol from either end
    let value = input.value
        .replace(new RegExp(`^${symbol}`), '')  // Start
        .replace(new RegExp(`${symbol}$`), '')  // End
        .trim();
    
    // Handle the case where user just typed a decimal separator
    const lastChar = value.slice(-1);
    const isNewDecimal = (lastChar === '.' || lastChar === ',');
    
    if (isPolish) {
        // For Polish, first remove all spaces (thousand separators)
        value = value.replace(/\s/g, '');
        // Convert any periods to commas for decimal handling
        value = value.replace(/\./g, ',');
    } else {
        // Remove existing thousand separators
        value = value.replace(new RegExp(`\\${thousandSep}`, 'g'), '');
        // Convert any existing periods or commas to the locale decimal separator
        value = value.replace(/[.,]/g, decimalSep);
    }
    
    // Split by appropriate decimal separator
    const parts = isPolish ? value.split(',') : value.split(decimalSep);
    
    // Only keep the first decimal separator
    let integerPart = parts[0].replace(/\D/g, '');
    let decimalPart = parts.length > 1 ? parts[1].replace(/\D/g, '').slice(0, 2) : '';
    
    // Add thousand separators to integer part if it exists
    if (integerPart) {
        if (isPolish) {
            // Format the integer part without parsing it first
            integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        } else {
            integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
        }
    }
    
    value = (integerPart || '0');
    if (decimalPart || isNewDecimal) {
        value += (isPolish ? ',' : decimalSep) + (decimalPart || '');
    }
    
    // Add debug logging
    console.log('Original Input:', input.value);
    console.log('Parts:', parts);
    console.log('Integer Part:', integerPart);
    console.log('Decimal Part:', decimalPart);
    
    if (isPolish) {
        // First remove spaces and get the raw number parts
        const cleanValue = value.replace(/\s/g, '');
        const [wholeNum, decimal] = cleanValue.split(',');
        
        // Debug logging
        console.log('Clean Value:', cleanValue);
        console.log('Whole Number:', wholeNum);
        console.log('Decimal:', decimal);
        
        // FIXED: Don't override existing decimal part
        const decimalPart = decimal || '00';
        
        // Store the raw string with proper decimal formatting
        const fullNumber = wholeNum + '.' + decimalPart;
        input.dataset.amount = fullNumber;
        
        // Debug logging
        console.log('Stored Amount:', input.dataset.amount);
    }
    
    const newValue = symbolAfter ? `${value} ${symbol}` : `${symbol}${value}`;
    input.value = newValue;
    
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
  const isPolish = locale.startsWith('pl');
  const currencyCode = getCurrencyPreference();
  const isJPY = currencyCode === 'JPY';
  
  // For Polish currency, use the stored dataset value
  if (isPolish && input.dataset.amount) {
    return input.dataset.amount;
  }

  // For Japanese Yen, handle whole numbers only
  if (isJPY) {
    // Remove currency symbol and any non-digit characters
    const value = input.value
      .replace(getCurrencySymbol(), '')
      .replace(/[^0-9-]/g, '');
    
    // If empty after cleaning, return null
    if (!value) return null;
    
    // Convert to number and validate
    const numValue = parseInt(value, 10);
    return isNaN(numValue) ? null : numValue.toString();
  }
  
  const format = new Intl.NumberFormat(locale).format(1111.1);
  const thousandSep = format.charAt(1);
  const decimalSep = format.charAt(5);
  
  // Remove currency symbol and clean the value
  let value = input.value
    .replace(getCurrencySymbol(), '')
    .trim();

  if (isPolish) {
    // For Polish, first remove all spaces (thousand separators)
    value = value.replace(/\s/g, '')
      .replace(decimalSep, '.');  // Convert locale decimal to period
  } else {
    value = value
      .replace(new RegExp(`\\${thousandSep}`, 'g'), '')  // Remove thousand separators
      .replace(decimalSep, '.');  // Convert locale decimal to period
  }
    
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
