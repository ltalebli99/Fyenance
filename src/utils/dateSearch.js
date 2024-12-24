export const monthMappings = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11
};

function parseSearchDate(searchTerm) {
    if (!searchTerm) return null;

    const term = searchTerm.toLowerCase().trim();
    const currentYear = new Date().getFullYear();

    console.log('Parsing search term:', term);

    // Single number could be day, month, or year
    const singleNumberPattern = /^(\d{1,4})$/;
    const singleMatch = term.match(singleNumberPattern);
    if (singleMatch) {
        const num = parseInt(singleMatch[1]);
        
        // First check if it could be a month (1-12)
        if (num >= 1 && num <= 12) {
            return {
                type: 'full-date',
                month: num - 1,
                day: null,
                year: currentYear,
                yearSpecified: false
            };
        }
        
        // Then check if it could be a day (1-31)
        if (num >= 1 && num <= 31) {
            return {
                type: 'full-date',
                month: null,
                day: num,
                year: currentYear,
                yearSpecified: false
            };
        }

        // Finally check if it could be a year
        if (num >= 1900 && num <= 2100) {
            return { type: 'year', value: num };
        }
    }

    // Check for M/D format
    const datePattern = /^(\d{1,2})[-\/](\d{1,2})(?:[-\/](\d{2}|\d{4}))?$/;
    const match = term.match(datePattern);
    if (match) {
        const [_, month, day, yearStr] = match;
        let year = yearStr ? parseInt(yearStr) : currentYear;
        if (year < 100) year += year < 50 ? 2000 : 1900;
        
        return {
            type: 'full-date',
            month: parseInt(month) - 1,
            day: parseInt(day),
            year: year,
            yearSpecified: !!yearStr  // true if year was provided in search
        };
    }

    return null;
}

function isValidDate(date) {
    return date instanceof Date && !isNaN(date) && date.getFullYear() > 1900;
}

function isSameDay(date1, date2) {
    // Ensure both inputs are valid dates
    if (!date1 || !date2 || !(date1 instanceof Date) || !(date2 instanceof Date)) {
        return false;
    }
    
    // Compare UTC components
    return date1.getUTCFullYear() === date2.getUTCFullYear() &&
           date1.getUTCMonth() === date2.getUTCMonth() &&
           date1.getUTCDate() === date2.getUTCDate();
}

// Add some test cases to verify functionality
function testDateParsing() {
    const testCases = [
        'march 2',
        'mar 2',
        'march 2 2023',
        'mar 2, 2023',
        '3/2',
        '3-2',
        '2023-03-02',
        'may 15',
        'december 25'
    ];

    console.log('Testing date parsing:');
    testCases.forEach(test => {
        const result = parseSearchDate(test);
        console.log(`Input: "${test}" => ${result ? result.toLocaleDateString() : 'null'}`);
    });
}

// Uncomment to run tests
// testDateParsing();

export { parseSearchDate, isSameDay };