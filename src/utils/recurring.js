export function isRecurringActive(recurring, referenceDate = new Date()) {
    if (!recurring.is_active) return false;
    
    const startDate = new Date(recurring.start_date);
    if (startDate > referenceDate) return false;
    
    if (recurring.end_date && new Date(recurring.end_date) < referenceDate) return false;
    
    return true;
}

export function calculateRecurringAmount(recurring, period = 'month', referenceDate = new Date()) {
    if (!isRecurringActive(recurring, referenceDate)) return 0;
    
    const multipliers = {
        year: { daily: 365, weekly: 52, monthly: 12, yearly: 1 },
        quarter: { daily: 91, weekly: 13, monthly: 3, yearly: 0.25 },
        month: { daily: 30, weekly: 4, monthly: 1, yearly: 1/12 }
    };
    
    const multiplier = multipliers[period]?.[recurring.frequency] || 1;
    return parseFloat(recurring.amount) * multiplier;
}