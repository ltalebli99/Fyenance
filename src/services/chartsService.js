let balanceChartInstance;
let incomeExpenseChartInstance;
let monthlyComparisonChartInstance;
let expenseCategoriesChartInstance;
let trendChartInstance;

import  { formatCurrency } from '../utils/formatters.js';

export async function renderDashboardCharts() {

    try {
      const accountId = document.getElementById('account-selector')?.value || 'all';
      
      // Fetch data for current month
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
      // Get transactions and recurring items
      const [
        { data: transactions },
        { data: recurring },
        { data: categories }
      ] = await Promise.all([
        window.databaseApi.fetchTransactions(accountId),
        window.databaseApi.fetchRecurring(accountId),
        window.databaseApi.fetchCategories()
      ]);
  
      // Debug log
      console.log('Dashboard Data:', {
        transactions,
        recurring,
        categories,
        startOfMonth,
        endOfMonth
      });
  
      // First, check if chart elements exist
      const dailySpendingElement = document.getElementById('dailySpendingChart');
  
      if (!dailySpendingElement) {
        console.error('Missing chart elements:', {
          dailySpending: !!dailySpendingElement,
        });
        return;
      }
  
      // Render each chart individually and catch errors
      try {
        await renderDailySpendingChart(transactions, startOfMonth, endOfMonth);
      } catch (error) {
        console.error('Error rendering daily spending chart:', error);
      }
  
      try {
        renderUpcomingExpensesCalendar();
      } catch (error) {
        console.error('Error rendering upcoming expenses chart:', error);
      }
  
    } catch (error) {
      console.error('Error in renderDashboardCharts:', error);
    }
  }

  
  
  // Function to get upcoming expenses for the current week
  export async function getUpcomingExpensesForWeek() {
    try {
      const { data: recurring = [], error } = await window.databaseApi.fetchRecurring();
      if (error) throw error;
      if (!Array.isArray(recurring)) return [];
  
      const today = new Date();
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + 4);
      endOfWeek.setHours(23, 59, 59, 999);
  
      // Filter recurring expenses that are active and are expenses
      return recurring.filter(expense => {
        if (!expense.is_active || expense.type !== 'expense') return false;
  
        const startDate = new Date(expense.start_date);
        if (!startDate || isNaN(startDate.getTime())) return false;
  
        // If there's an end_date and it's before today, exclude it
        if (expense.end_date && new Date(expense.end_date) < today) return false;
  
        // Calculate the next occurrence
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
  
        // Add the calculated next date to the expense object
        expense.nextDate = nextDate;
        return nextDate <= endOfWeek;
      });
    } catch (error) {
      console.error('Error fetching upcoming expenses:', error);
      return [];
    }
  }

  export async function renderUpcomingExpensesCalendar() {
    try {
      const calendarElement = document.getElementById('upcomingExpensesCalendar');
      if (!calendarElement) return;
  
      const upcomingExpenses = await getUpcomingExpensesForWeek() || [];
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
        
        // Filter expenses for this day using nextDate
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
      console.error('Error rendering calendar:', error);
    }
  }
  
  export async function renderDailySpendingChart(transactions, startDate, endDate) {
    const canvas = document.getElementById('dailySpendingChart');
    if (!canvas) {
      console.error('Daily spending chart canvas not found');
      return;
    }
  
    // Get current date
    const currentDate = new Date();
    const currentDay = currentDate.getDate();
  
    // Calculate daily spending with proper UTC date handling
    const dailyData = new Array(currentDay).fill(0); // Only up to current day
  
    transactions
      .filter(tx => {
        const txDate = new Date(tx.date);
        return txDate >= startDate && 
               txDate <= endDate && 
               txDate.getDate() <= currentDay && // Only include up to current day
               tx.type === 'expense';
      })
      .forEach(tx => {
        const txDate = new Date(tx.date);
        const day = txDate.getUTCDate() - 1;
        dailyData[day] += parseFloat(tx.amount);
      });
  
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
                return `${context.parsed.y.toFixed(2)}`;
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