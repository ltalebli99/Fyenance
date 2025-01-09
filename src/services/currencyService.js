const defaultCurrencies = [
    { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', rate: 1 },
    { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', rate: 1.09 },
    { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', rate: 1.27 },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', rate: 0.0067 },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA', rate: 0.74 },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', rate: 0.66 },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', rate: 0.012 },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN', rate: 0.14 },
    { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR', rate: 0.21 },
    { code: 'RSD', symbol: ' дин.', name: 'Serbian Dinar', locale: 'sr-RS', symbolAfter: true, rate: 0.0093 }
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
  
  export function getCurrencyLocale() {
    const code = getCurrencyPreference();
    const currency = defaultCurrencies.find(c => c.code === code);
    return currency ? currency.locale : 'en-US';
  }
  
  // Convert amount from one currency to another
  export function convertCurrency(amount, fromCurrency, toCurrency) {
    const from = defaultCurrencies.find(c => c.code === fromCurrency);
    const to = defaultCurrencies.find(c => c.code === toCurrency);
    
    if (!from || !to) {
        console.log('Currency not found:', { fromCurrency, toCurrency });
        return amount;
    }
    
    // Convert to USD first (base currency), then to target currency
    const usdAmount = amount * from.rate;
    const result = usdAmount / to.rate;
    
    return result;
  }
  
  // Get exchange rate between two currencies
  export function getExchangeRate(fromCurrency, toCurrency) {
    const from = defaultCurrencies.find(c => c.code === fromCurrency);
    const to = defaultCurrencies.find(c => c.code === toCurrency);
    
    if (!from || !to) return 1;
    return to.rate / from.rate;
  }
  
  // Store the last update time
  let lastUpdateTime = null;
  
  // Update exchange rates from an API (to be called periodically)
  export async function updateExchangeRates() {
    try {
        const { success, data, error } = await window.electronAPI.fetchExchangeRates();
        
        if (!success) {
            throw new Error(error || 'Failed to fetch exchange rates');
        }
        
        defaultCurrencies.forEach(currency => {
            if (currency.code !== 'USD') {
                currency.rate = data.rates[currency.code];
            }
        });
        
        lastUpdateTime = new Date();
        
        // Update the last updated time in the UI
        const lastUpdatedElement = document.getElementById('rates-last-updated');
        if (lastUpdatedElement) {
            lastUpdatedElement.textContent = lastUpdateTime.toLocaleTimeString();
        }
        
        // Dispatch event to update UI
        window.dispatchEvent(new Event('exchangeRatesUpdated'));
        
        return true;
    } catch (error) {
        console.error('Failed to update exchange rates:', error);
        return false;
    }
  }
  
  // Get the last update time
  export function getLastUpdateTime() {
    return lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : 'Never';
  }
  
  // Initialize rates when the app starts
  export function initializeExchangeRates() {
    // Update rates immediately
    updateExchangeRates();
    
    // Then update every hour
    setInterval(updateExchangeRates, 60 * 60 * 1000);
  }