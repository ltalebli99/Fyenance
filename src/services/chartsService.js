let balanceChartInstance;
let incomeExpenseChartInstance;
let monthlyComparisonChartInstance;
let expenseCategoriesChartInstance;
let trendChartInstance;
let dashboardChartsDebounceTimer = null;

import  { formatCurrency } from '../utils/formatters.js';
import { calculateRecurringForPeriod } from './reportsService.js';

export async function renderDashboardCharts(accountId) {
    // Clear any pending render
    if (dashboardChartsDebounceTimer) {
        clearTimeout(dashboardChartsDebounceTimer);
    }

    // Set a new timer
    return new Promise((resolve) => {
        dashboardChartsDebounceTimer = setTimeout(async () => {
            try {
                // Use passed accountId or get from selector
                const effectiveAccountId = accountId || document.getElementById('dashboard-account-selector')?.value || 'all';
                
                console.log('Fetching data for account:', effectiveAccountId);
                
                // Fetch data with proper error handling
                const [transactionsResponse, recurringResponse] = await Promise.all([
                    window.databaseApi.getTransactionsForChart(effectiveAccountId),
                    window.databaseApi.fetchRecurring(effectiveAccountId)
                ]);

                // Ensure we have valid data arrays
                const transactions = Array.isArray(transactionsResponse.data) ? transactionsResponse.data : [];
                const recurring = Array.isArray(recurringResponse.data) ? recurringResponse.data : [];

                console.log('Fetched transactions:', transactions.length);
                console.log('Fetched recurring:', recurring.length);

                const currentDate = new Date();
                const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

                // Always render charts regardless of account selection
                const dailySpendingElement = document.getElementById('dailySpendingChart');
                if (dailySpendingElement) {
                    await renderDailySpendingChart(transactions, recurring, startOfMonth, endOfMonth);
                }

                await renderUpcomingExpensesCalendar();
                resolve();
            } catch (error) {
                console.error('Error in renderDashboardCharts:', error);
                resolve();
            }
        }, 100); // 100ms debounce
    });
}

  
  
  // Function to get upcoming expenses for the current week
  export async function getUpcomingExpensesForWeek(accountId = 'all') {
    try {
      const { data: recurring = [], error } = await window.databaseApi.getAllRecurring(accountId);
      if (error) throw error;
      if (!Array.isArray(recurring)) return [];
  
      const today = new Date();
      today.setHours(0, 0, 0, 0);
  
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + 4);
      endOfWeek.setHours(23, 59, 59, 999);
  
      return recurring.filter(expense => {
        
        // Check if expense is active and type is expense
        if (!expense.is_active || expense.type !== 'expense') return false;
  
        const startDate = new Date(expense.start_date);
        // Adjust for timezone
        startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());
        startDate.setHours(0, 0, 0, 0);
  
        if (startDate > endOfWeek) return false;
        if (expense.end_date && new Date(expense.end_date) < today) return false;
  
        let nextDate = getNextOccurrence(expense, today);
        if (!nextDate) return false;
  
        expense.nextDate = nextDate;
        return nextDate <= endOfWeek;
      });
    } catch (error) {
      console.error('Error getting upcoming expenses:', error);
      return [];
    }
  }

  // Helper function to calculate next occurrence
  function getNextOccurrence(recurring, fromDate) {
    const startDate = new Date(recurring.start_date);
    // Adjust for timezone
    startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset());
    startDate.setHours(0, 0, 0, 0);
  
    if (startDate > fromDate) return startDate;
  
    let nextDate = new Date(startDate);
  
    while (nextDate < fromDate) {
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
          nextDate.setFullYear(nextYear, nextMonth, startDate.getDate());
          
          // Handle month rollover
          if (nextDate.getMonth() !== nextMonth) {
            nextDate.setDate(0); // Last day of previous month
          }
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }
    }
  
    return nextDate;
  }

  export async function renderUpcomingExpensesCalendar() {
    try {
      const calendarElement = document.getElementById('upcomingExpensesCalendar');
      if (!calendarElement) return;
  
      // Get the selected account from the dashboard selector
      const selectedAccount = document.getElementById('dashboard-account-selector')?.value || 'all';
      const upcomingExpenses = await getUpcomingExpensesForWeek(selectedAccount) || [];
      
      calendarElement.innerHTML = '<h3>Upcoming Expenses</h3>';
  
      const calendarContainer = document.createElement('div');
      calendarContainer.className = 'calendar-container';
  
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const today = new Date();
  
      for (let i = 0; i < 5; i++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + i);
        
        const dayName = daysOfWeek[currentDate.getDay()];
        const isToday = i === 0;
        
        const expensesForDay = upcomingExpenses.filter(expense => {
          const nextDate = new Date(expense.nextDate);
          return nextDate.getDate() === currentDate.getDate() &&
                 nextDate.getMonth() === currentDate.getMonth() &&
                 nextDate.getFullYear() === currentDate.getFullYear();
        });
  
        const dayElement = document.createElement('div');
        dayElement.className = `calendar-day${isToday ? ' today' : ''}`;
        
        const dateStr = `${dayName} ${currentDate.getDate()}`;
        const expensesStr = expensesForDay.length > 0 
          ? expensesForDay.map(exp => 
              `<div class="expense-item">
                <span class="expense-amount">${formatCurrency(exp.amount)}</span>
                <span class="expense-name">${exp.name}</span>
              </div>`
            ).join('')
          : '<div class="no-expenses">No expenses</div>';
  
        dayElement.innerHTML = `
          <div class="day-header">${dateStr}</div>
          <div class="day-content">
            ${expensesStr}
          </div>
        `;
  
        calendarContainer.appendChild(dayElement);
      }
  
      calendarElement.appendChild(calendarContainer);
    } catch (error) {
      console.error('Error rendering upcoming expenses calendar:', error);
    }
  }
  
  export async function renderDailySpendingChart(transactions, recurring, startDate, endDate) {
    const canvas = document.getElementById('dailySpendingChart');
    if (!canvas) {
      console.error('Daily spending chart canvas not found');
      return;
    }

    // Get current date
    const currentDate = new Date();
    const currentDay = currentDate.getDate();

    // Initialize daily data array
    const dailyData = Array.from({ length: currentDay }, () => 0);

    // Handle one-time transactions
    transactions
        .filter(tx => {
            const txDate = new Date(tx.date);
            // Adjust for timezone
            txDate.setMinutes(txDate.getMinutes() + txDate.getTimezoneOffset());
            return txDate >= startDate && 
                   txDate <= endDate && 
                   txDate.getDate() <= currentDay && 
                   tx.type === 'expense';
        })
        .forEach(tx => {
            const txDate = new Date(tx.date);
            txDate.setMinutes(txDate.getMinutes() + txDate.getTimezoneOffset());
            const day = txDate.getDate() - 1;
            dailyData[day] += parseFloat(tx.amount);
        });

    // Handle recurring transactions
    if (recurring && recurring.length > 0) {
        recurring.forEach(rec => {
            if (!rec.is_active || rec.type !== 'expense') return;

            const recStartDate = new Date(rec.start_date);
            recStartDate.setMinutes(recStartDate.getMinutes() + recStartDate.getTimezoneOffset());
            if (recStartDate > endDate) return; // Hasn't started yet
            
            if (rec.end_date) {
                const recEndDate = new Date(rec.end_date);
                recEndDate.setMinutes(recEndDate.getMinutes() + recEndDate.getTimezoneOffset());
                if (recEndDate < startDate) return; // Already ended
            }

            const amount = parseFloat(rec.amount);
            
            // Iterate through each day of the month up to current day
            for (let day = 0; day < currentDay; day++) {
                const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), day + 1);
                currentDate.setHours(0, 0, 0, 0);
                
                // Skip if before start date or after end date
                if (currentDate < recStartDate) continue;
                if (rec.end_date) {
                    const recEndDate = new Date(rec.end_date);
                    recEndDate.setMinutes(recEndDate.getMinutes() + recEndDate.getTimezoneOffset());
                    if (currentDate > recEndDate) continue;
                }

                // Check if this day should include the recurring amount
                switch(rec.frequency) {
                    case 'daily':
                        dailyData[day] += amount;
                        break;
                    case 'weekly':
                        if (currentDate.getDay() === recStartDate.getDay()) {
                            dailyData[day] += amount;
                        }
                        break;
                    case 'monthly':
                        if (currentDate.getDate() === recStartDate.getDate()) {
                            dailyData[day] += amount;
                        }
                        break;
                    case 'yearly':
                        if (currentDate.getDate() === recStartDate.getDate() && 
                            currentDate.getMonth() === recStartDate.getMonth()) {
                            dailyData[day] += amount;
                        }
                        break;
                    default:
                        break;
                }
            }
        });
    }

    // Check if we have any data
    const hasData = dailyData.some(amount => amount > 0);

    // Format date labels only up to current day
    const dateLabels = Array.from({length: currentDay}, (_, i) => {
      const date = new Date(startDate.getFullYear(), startDate.getMonth(), i + 1);
      return date.getDate();
    });

    const ctx = canvas.getContext('2d');
    if (balanceChartInstance) balanceChartInstance.destroy();

    // Custom gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(54, 162, 235, 0.2)');
    gradient.addColorStop(1, 'rgba(54, 162, 235, 0)');

    balanceChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dateLabels,
        datasets: [{
          label: 'Daily Spending',
          data: hasData ? dailyData : [0],
          backgroundColor: gradient,
          borderColor: 'rgba(54, 162, 235, 0.8)',
          borderWidth: 2,
          borderRadius: 8,
          barThickness: 'flex',
          maxBarThickness: 25,
          minBarLength: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            titleColor: '#333',
            bodyColor: '#666',
            borderColor: 'rgba(54, 162, 235, 0.2)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            titleFont: {
              size: 14,
              family: "'Inter Tight', sans-serif",
              weight: '600'
            },
            bodyFont: {
              size: 13,
              family: "'Inter Tight', sans-serif"
            },
            displayColors: false,
            callbacks: {
              label: function(context) {
                return `${formatCurrency(context.parsed.y.toFixed(2))}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                family: "'Inter Tight', sans-serif",
                size: 12
              },
              color: '#888'
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            },
            ticks: {
              callback: function(value) {
                return '$' + value;
              },
              font: {
                family: "'Inter Tight', sans-serif",
                size: 12
              },
              color: '#888',
              callback: function(value) {
                return '$' + value;
              }
            }
          }
        }
      }
    });
  }