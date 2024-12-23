// src/handlers/analyticsHandlers.js
const { safeIpcHandle } = require('../core/ipcSafety');
const { calculateRecurringForPeriod } = require('../utils/recurringHelper.js');

function setupAnalyticsHandlers(database) {
  safeIpcHandle('db:getTransactionsForChart', async (event, accountId) => {
    try {
      const transactions = database.getTransactionsForChart(accountId);
      return { data: transactions, error: null };
    } catch (error) {
      console.error('Error fetching transactions for chart:', error);
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getIncomeExpenseData', async (event, filters) => {
    try {
      const data = database.getIncomeExpenseData(filters);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getTopSpendingCategories', async (event, filters) => {
    try {
      const categories = database.getTopSpendingCategories(filters);
      return { data: categories, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getExpenseCategoriesData', async (event, filters) => {
    try {
      const data = database.getExpenseCategoriesData(filters);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getMonthlyComparison', async (event, accountId = 'all') => {
    try {
      // Get transactions and recurring items for specific account(s)
      const transactions = database.getTransactions(accountId);
      const recurring = database.getRecurring(accountId);
      
      if (!Array.isArray(transactions) || !Array.isArray(recurring)) {
        return { data: null, error: null };
      }
      
      // Get current and last month dates
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  
      // Calculate one-time expenses for current month
      const currentMonthOneTime = transactions
        .filter(t => {
          const date = new Date(t.date);
          return date.getMonth() === currentMonth && 
                 date.getFullYear() === currentYear && 
                 t.type === 'expense';
        })
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
  
      // Calculate one-time expenses for last month
      const lastMonthOneTime = transactions
        .filter(t => {
          const date = new Date(t.date);
          return date.getMonth() === lastMonth && 
                 date.getFullYear() === lastMonthYear && 
                 t.type === 'expense';
        })
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

      // Calculate recurring expenses
      const currentMonthRecurring = calculateRecurringForPeriod(
        recurring.filter(r => r.type === 'expense'),
        'month',
        new Date(currentYear, currentMonth, 1)
      );

      const lastMonthRecurring = calculateRecurringForPeriod(
        recurring.filter(r => r.type === 'expense'),
        'month',
        new Date(lastMonthYear, lastMonth, 1)
      );
  
      // Calculate total expenses for both months
      const currentMonthExpenses = currentMonthOneTime + currentMonthRecurring;
      const lastMonthExpenses = lastMonthOneTime + lastMonthRecurring;
  
      // Calculate the percentage change
      const percentChange = lastMonthExpenses ? 
        ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 : 0;
  
      return { 
        data: { 
          percentChange, 
          trend: percentChange >= 0 ? 'higher' : 'lower',
          currentMonthExpenses,
          lastMonthExpenses
        }, 
        error: null 
      };
    } catch (error) {
      console.error('Monthly comparison error:', error);
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getUpcomingPayments', async (event, accountId = 'all') => {
    try {
      return database.getUpcomingPayments(accountId);
    } catch (error) {
      console.error('Error getting upcoming payments:', error);
      return { data: 0, error: error.message };
    }
  });

  safeIpcHandle('db:getNetWorth', async (event, accountId = 'all') => {
    try {
      // Get base account balances for specific account(s)
      const accounts = accountId === 'all' ? 
        database.getAccounts() : 
        database.getAccounts().filter(acc => acc.id === accountId);
      
      if (!Array.isArray(accounts)) {
        return { data: 0, error: null };
      }

      const baseNetWorth = accounts.reduce((total, account) => 
        total + parseFloat(account.balance), 0);

      // Get transactions for specific account(s)
      const transactions = database.getTransactions(accountId);
      const transactionTotal = Array.isArray(transactions) ? 
        transactions.reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0) : 0;

      // Get recurring items for specific account(s)
      const recurring = database.getRecurring(accountId);
      const today = new Date();
      
      const recurringTotal = recurring
        .filter(r => {
          if (!r.is_active) return false;
          if (r.end_date && new Date(r.end_date) < today) return false;
          
          const startDate = new Date(r.start_date);
          if (startDate > today) return false;

          return true;
        })
        .reduce((sum, r) => {
          // Calculate recurring amount based on frequency
          let multiplier = 1;
          switch(r.frequency) {
            case 'daily':
              multiplier = 30; // Assume one month
              break;
            case 'weekly':
              multiplier = 4; // Assume one month
              break;
            case 'monthly':
              multiplier = 1;
              break;
            case 'yearly':
              multiplier = 1/12; // One month portion
              break;
          }
          return sum + ((r.type === 'income' ? 1 : -1) * r.amount * multiplier);
        }, 0);

      // Calculate final net worth
      const totalNetWorth = baseNetWorth + transactionTotal + recurringTotal;

      return { data: totalNetWorth, error: null };
    } catch (error) {
      console.error('Error calculating net worth:', error);
      return { data: 0, error: error.message };
    }
  });

}

// Helper function for recurring multiplier calculation
function getRecurringMultiplier(frequency) {
  switch(frequency) {
    case 'daily': return 30;    // Assume one month
    case 'weekly': return 4;    // Assume one month
    case 'monthly': return 1;
    case 'yearly': return 1/12; // One month portion
    default: return 1;
  }
}

// Helper function to calculate next occurrence (same as in chartsService)
function getNextOccurrence(recurring, fromDate) {
    const startDate = new Date(recurring.start_date);
    startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());
    startDate.setHours(0, 0, 0, 0);

    if (startDate > fromDate) return startDate;

    let nextDate = new Date(startDate);
    
    while (nextDate <= fromDate) {
        switch (recurring.frequency) {
            case 'daily':
                nextDate.setDate(nextDate.getDate() + 1);
                break;
            case 'weekly':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'monthly':
                let nextMonth = nextDate.getMonth() + 1;
                let nextYear = nextDate.getFullYear();
                if (nextMonth > 11) {
                    nextMonth = 0;
                    nextYear++;
                }
                nextDate = new Date(nextYear, nextMonth, startDate.getDate());
                if (nextDate.getMonth() !== nextMonth) {
                    nextDate = new Date(nextYear, nextMonth + 1, 0);
                }
                break;
            case 'yearly':
                nextDate.setFullYear(nextDate.getFullYear() + 1);
                break;
        }
    }

    return nextDate;
}

module.exports = { setupAnalyticsHandlers };