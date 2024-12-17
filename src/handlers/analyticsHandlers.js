// src/handlers/analyticsHandlers.js
const { safeIpcHandle } = require('../core/ipcSafety');

function setupAnalyticsHandlers(database) {
  safeIpcHandle('db:getTransactionsForChart', async (event, filters) => {
    try {
      const transactions = database.getTransactionsForChart(filters);
      return { data: transactions, error: null };
    } catch (error) {
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

  safeIpcHandle('db:getMonthlyComparison', async () => {
    try {
      // Get all transactions
      const transactions = database.getTransactions();
      
      // Get current and last month dates
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  
      // Calculate expenses for current month
      const currentMonthExpenses = transactions
        .filter(t => {
          const date = new Date(t.date);
          return date.getMonth() === currentMonth && 
                 date.getFullYear() === currentYear && 
                 t.type === 'expense';
        })
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
  
      // Calculate expenses for last month
      const lastMonthExpenses = transactions
        .filter(t => {
          const date = new Date(t.date);
          return date.getMonth() === lastMonth && 
                 date.getFullYear() === lastMonthYear && 
                 t.type === 'expense';
        })
        .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
  
      console.log('Current month expenses:', currentMonthExpenses);
      console.log('Last month expenses:', lastMonthExpenses);
  
      // Calculate the percentage change
      const percentChange = lastMonthExpenses ? 
        ((lastMonthExpenses - currentMonthExpenses) / lastMonthExpenses) * 100 : 0;
  
      return { 
        data: { 
          percentChange, 
          trend: percentChange >= 0 ? 'lower' : 'higher',
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

  safeIpcHandle('db:getUpcomingPayments', async () => {
    try {
      const recurring = database.getRecurring();
      if (!Array.isArray(recurring)) return { data: 0, error: null };

      const today = new Date();
      const currentMonth = today.getMonth();
      const nextMonth = (currentMonth + 1) % 12;
      const currentYear = today.getFullYear();
      const currentDay = today.getDate();

      // Get the week boundaries (5 days from today)
      const startOfWeek = new Date(today);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + 4);
      endOfWeek.setHours(23, 59, 59, 999);

      // Filter recurring expenses that are active and due within the next 5 days
      const upcoming = recurring.filter(expense => {
        if (!expense.is_active || expense.type !== 'expense') return false;

        const startDate = new Date(expense.start_date);
        
        // If it hasn't started yet or has ended, exclude it
        if (startDate > endOfWeek) return false;
        if (expense.end_date && new Date(expense.end_date) < today) return false;

        // Calculate the next occurrence based on frequency
        let nextDate = new Date(startDate);
        while (nextDate < today) {
          switch (expense.frequency) {
            case 'daily':
              nextDate.setDate(nextDate.getDate() + 1);
              break;
            case 'weekly':
              nextDate.setDate(nextDate.getDate() + 7);
              break;
            case 'monthly':
              // Handle month rollover correctly
              let nextMonth = nextDate.getMonth() + 1;
              let nextYear = nextDate.getFullYear();
              if (nextMonth > 11) {
                nextMonth = 0;
                nextYear++;
              }
              nextDate.setFullYear(nextYear, nextMonth, startDate.getDate());
              break;
            case 'yearly':
              nextDate.setFullYear(nextDate.getFullYear() + 1);
              break;
          }
        }

        // Check if next occurrence falls within our 5-day window
        return nextDate <= endOfWeek;
      });

      return { data: upcoming.length, error: null };
    } catch (error) {
      console.error('Error in getUpcomingPayments:', error);
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getNetWorth', async () => {
    try {
      const accounts = database.getAccounts();
      const netWorth = accounts.reduce((total, account) => total + account.balance, 0);
      return { data: netWorth, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

}

module.exports = { setupAnalyticsHandlers };