function calculateRecurringForPeriod(recurringItems, period) {
    const today = new Date();
    const periodStart = new Date();
    const periodEnd = new Date();
    
    // Set period range
    switch(period) {
        case 'year':
            periodStart.setMonth(0, 1);
            periodEnd.setMonth(11, 31);
            break;
        case 'quarter':
            periodStart.setMonth(Math.floor(today.getMonth() / 3) * 3, 1);
            periodEnd.setMonth(periodStart.getMonth() + 3, 0);
            break;
        case 'month':
        default:
            periodStart.setDate(1);
            periodEnd.setMonth(periodStart.getMonth() + 1, 0);
    }

    // Reset hours to start/end of day
    periodStart.setHours(0, 0, 0, 0);
    periodEnd.setHours(23, 59, 59, 999);

    return recurringItems
        .filter(item => {
            const startDate = new Date(item.start_date);
            startDate.setHours(0, 0, 0, 0);
            
            // If recurring hasn't started by the end of the period, exclude it
            if (startDate > periodEnd) return false;
            
            // If recurring has ended before the period starts, exclude it
            if (item.end_date) {
                const endDate = new Date(item.end_date);
                endDate.setHours(23, 59, 59, 999);
                if (endDate < periodStart) return false;
            }
            
            return true;
        })
        .reduce((sum, item) => {
            const startDate = new Date(item.start_date);
            startDate.setHours(0, 0, 0, 0);
            
            // Get effective start date (later of period start or recurring start)
            const effectiveStart = startDate > periodStart ? startDate : periodStart;
            
            // Get effective end date (earlier of period end or recurring end)
            const effectiveEnd = item.end_date ? 
                new Date(Math.min(new Date(item.end_date).getTime(), periodEnd.getTime())) : 
                periodEnd;

            let occurrences = 0;
            const amount = parseFloat(item.amount);

            switch(item.frequency) {
                case 'daily':
                    occurrences = Math.floor((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1;
                    break;
                case 'weekly':
                    occurrences = Math.floor((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24 * 7)) + 1;
                    break;
                case 'monthly':
                    occurrences = (effectiveEnd.getFullYear() - effectiveStart.getFullYear()) * 12 
                                + effectiveEnd.getMonth() - effectiveStart.getMonth() + 1;
                    break;
                case 'yearly':
                    occurrences = effectiveEnd.getFullYear() - effectiveStart.getFullYear() + 1;
                    if (effectiveEnd.getMonth() < startDate.getMonth() || 
                        (effectiveEnd.getMonth() === startDate.getMonth() && 
                         effectiveEnd.getDate() < startDate.getDate())) {
                        occurrences--;
                    }
                    break;
            }

            return sum + (amount * Math.max(0, occurrences));
        }, 0);
}

module.exports = { calculateRecurringForPeriod };