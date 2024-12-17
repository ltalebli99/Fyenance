const defaultCurrencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' }
  ];
  
  export function getCurrencyPreference() {
    return localStorage.getItem('currencyPreference') || 'USD';
  }
  
  export function getCurrencySymbol() {
    const code = getCurrencyPreference();
    const currency = defaultCurrencies.find(c => c.code === code);
    return currency ? currency.symbol : '$';
  }
  
  export function setCurrencyPreference(currencyCode) {
    if (defaultCurrencies.some(c => c.code === currencyCode)) {
      localStorage.setItem('currencyPreference', currencyCode);
      window.dispatchEvent(new Event('currencyPreferenceChanged'));
    }
  }
  
  export function getAllCurrencies() {
    return defaultCurrencies;
  }