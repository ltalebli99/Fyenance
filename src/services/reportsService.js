import { formatCurrency, hexToRgb, capitalizeFirstLetter } from '../utils/formatters.js';
import { openSection } from '../utils/utils.js';

let monthlyComparisonChartInstance;
let expenseCategoriesChartInstance;
let trendChartInstance;
let cashFlowChartInstance = null;
let isInitialized = false;

// Calculate Monthly Recurring
export async function calculateMonthlyRecurring(accountId = 'all') {
    const { data: recurring, error } = await window.databaseApi.fetchRecurring(accountId);
    
    if (error) {
      console.error('Error fetching recurring:', error);
      return 0;
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
    // Filter active recurring within the current month
    return recurring
      .filter(recur => {
        const startDate = new Date(recur.start_date);
        startDate.setHours(0, 0, 0, 0);
        
        // If recurring starts after this month, exclude it
        if (startDate > endOfMonth) return false;
        
        // If recurring has ended before this month, exclude it
        if (recur.end_date) {
          const endDate = new Date(recur.end_date);
          endDate.setHours(23, 59, 59, 999);
          if (endDate < startOfMonth) return false;
        }
        
        // For future recurring items, only include if they start this month
        if (startDate > startOfMonth) {
          return startDate.getMonth() === today.getMonth() && 
                 startDate.getFullYear() === today.getFullYear();
        }
        
        return recur.is_active;
      })
      .reduce((total, recur) => total + parseFloat(recur.amount), 0);
}

// Fetch Total Balance
export async function fetchTotalBalance(accountId = 'all') {
    try {
      // Fetch accounts data
      const { data: accounts, error: accountsError } = await window.databaseApi.fetchAccounts();
      if (accountsError) throw accountsError;
  
      // Fetch transactions and recurring for the account
      const { data: transactions, error: txError } = await window.databaseApi.getAllTransactions(accountId);
      if (txError) throw txError;

      const { data: recurring, error: recError } = await window.databaseApi.getAllRecurring(accountId);
      if (recError) throw recError;

      if (!transactions?.length && !recurring?.length) {
        displayEmptyState();
        return;
      }
  
      // Calculate base balance from accounts
      let accountBalance;
      if (accountId === 'all') {
        accountBalance = accounts.reduce((acc, account) => acc + parseFloat(account.balance), 0);
      } else {
        accountBalance = accounts
          .filter(acc => acc.id === accountId)
          .reduce((acc, account) => acc + parseFloat(account.balance), 0);
      }
  
      // Get current month's transactions
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();
      
      const monthlyTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      });
  
      // Calculate this month's income and expenses
      const thisMonthsTransactionIncome = monthlyTransactions
        .filter(tx => tx.type === 'income')
        .reduce((total, tx) => total + parseFloat(tx.amount), 0);
  
      const thisMonthsTransactionExpenses = monthlyTransactions
        .filter(tx => tx.type === 'expense')
        .reduce((total, tx) => total + parseFloat(tx.amount), 0);
  
      // Calculate this month's recurring amounts
      const thisMonthsRecurringIncome = calculateRecurringForMonth(
        recurring.filter(r => r.type === 'income'),
        currentYear,
        currentMonth
      );
  
      const thisMonthsRecurringExpenses = calculateRecurringForMonth(
        recurring.filter(r => r.type === 'expense'),
        currentYear,
        currentMonth
      );
  
      // Calculate totals
      const totalMonthlyIncome = thisMonthsTransactionIncome + thisMonthsRecurringIncome;
      const totalMonthlyExpenses = thisMonthsTransactionExpenses + thisMonthsRecurringExpenses;
      
      // Calculate this month's balance (account balance + all income - all expenses)
      const thisMonthsBalance = accountBalance + totalMonthlyIncome - totalMonthlyExpenses;
  
      // Update dashboard displays
      document.getElementById('this-month-balance').innerText = formatCurrency(thisMonthsBalance);
      document.getElementById('this-month-income').innerText = formatCurrency(totalMonthlyIncome);
      document.getElementById('this-month-expenses').innerText = formatCurrency(totalMonthlyExpenses);
  
    } catch (error) {
      console.error('Failed to fetch total balance:', error);
    }
  }


  
function getPeriod() {
  const period = document.getElementById('reports-period-selector').value;
  return period;
}

// Update the updateReports function to include recurring
export async function updateReports(period = getPeriod(), accountIds = ['all']) {
  // Add initialization guard
  if (!isInitialized) {
    console.log('Reports not yet initialized, skipping update');
    return;
  }

  try {
    // Normalize account IDs
    const normalizedAccountIds = Array.isArray(accountIds) ? accountIds : [accountIds];
    
    // If 'all' is in the array, use only 'all'
    const effectiveAccountIds = normalizedAccountIds.includes('all') ? 
        ['all'] : normalizedAccountIds;

    console.log('Updating reports with accounts:', effectiveAccountIds);

    // Destroy existing charts
    if (monthlyComparisonChartInstance) monthlyComparisonChartInstance.destroy();
    if (expenseCategoriesChartInstance) expenseCategoriesChartInstance.destroy();
    if (trendChartInstance) trendChartInstance.destroy();
    if (cashFlowChartInstance) cashFlowChartInstance.destroy();

    // Use new methods for fetching data
    const { data: transactions, error: txError } = await window.databaseApi.fetchTransactionsForReports(effectiveAccountIds);
    if (txError) throw txError;

    const { data: recurring, error: recError } = await window.databaseApi.fetchRecurringForReports(effectiveAccountIds);
    if (recError) throw recError;

    // Check for empty data conditions
    const hasNoTransactions = !transactions || transactions.length === 0;
    const hasNoRecurring = !recurring || recurring.length === 0;
    const hasNoData = hasNoTransactions && hasNoRecurring;

    if (hasNoData) {
      // Hide reports content
      const reportsContent = document.getElementById('reports-content');
      if (reportsContent) {
          reportsContent.style.display = 'none';
      }

      // Show empty state
      const reportsEmptyState = document.getElementById('reports-empty-state');
      if (reportsEmptyState) {
          reportsEmptyState.style.display = 'flex';
      }

      // Hide charts grid
      const chartsGrid = document.querySelector('.charts-grid');
      if (chartsGrid) {
        chartsGrid.style.display = 'none';
      }

      // Show individual chart empty states
      displayEmptyStateForChart('monthlyComparisonChart', 'Add transactions to see monthly comparisons', 'fa-chart-bar');
      displayEmptyStateForChart('expenseCategoriesChart', 'Add categorized transactions to see spending breakdown', 'fa-pie-chart');
      displayEmptyStateForChart('trendChart', 'Add transactions to see your income vs expenses trend', 'fa-line-chart');
      displayEmptyStateForChart('cashFlowTimeline', 'Add transactions to see your cash flow timeline', 'fa-chart-line');

      // Reset summary values
      document.getElementById('reports-total-income').textContent = formatCurrency(0);
      document.getElementById('reports-total-expenses').textContent = formatCurrency(0);
      document.getElementById('reports-net-savings').textContent = formatCurrency(0);
      document.getElementById('reports-savings-rate').textContent = '0';
      return;
    } else {
      // Show reports content
      const reportsContent = document.getElementById('reports-content');
      if (reportsContent) {
          reportsContent.style.display = 'block';
      }

      // Hide empty state
      const reportsEmptyState = document.getElementById('reports-empty-state');
      if (reportsEmptyState) {
          reportsEmptyState.style.display = 'none';
      }

      // If we have data, hide empty states and show charts
      const chartsGrid = document.querySelector('.charts-grid');
      if (chartsGrid) {
        chartsGrid.style.display = 'grid';
      }

      // Filter transactions for the selected period
      const filteredTransactions = filterTransactionsByPeriod(transactions || [], period);
      console.log('Filtered transactions:', filteredTransactions);

      // Get active recurring items
      const activeRecurring = (recurring || []).filter(r => r.is_active);
      console.log('Active recurring:', activeRecurring);

      // Calculate income and expenses
      const oneTimeIncome = filteredTransactions
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      const oneTimeExpenses = filteredTransactions
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      const recurringExpenses = calculateRecurringForPeriod(
        activeRecurring.filter(r => r.type === 'expense'),
        period
      );

      const recurringIncome = calculateRecurringForPeriod(
        activeRecurring.filter(r => r.type === 'income'),
        period
      );

      // Calculate totals
      const totalIncome = oneTimeIncome + recurringIncome;
      const totalExpenses = oneTimeExpenses + recurringExpenses;
      const netSavings = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

      // Update UI elements
      document.getElementById('reports-total-income').textContent = formatCurrency(totalIncome);
      document.getElementById('reports-total-expenses').textContent = formatCurrency(totalExpenses);
      document.getElementById('reports-net-savings').textContent = formatCurrency(netSavings);
      document.getElementById('reports-savings-rate').textContent = Math.round(savingsRate);

      const savingsValueElement = document.getElementById('reports-savings-value');
      if (savingsValueElement) {
        savingsValueElement.className = `value ${netSavings >= 0 ? 'positive' : 'negative'}`;
      }

      // Clear existing charts
      if (monthlyComparisonChartInstance) monthlyComparisonChartInstance.destroy();
      if (expenseCategoriesChartInstance) expenseCategoriesChartInstance.destroy();
      if (trendChartInstance) trendChartInstance.destroy();
      if (cashFlowChartInstance) cashFlowChartInstance.destroy();

      // Render new charts
      await Promise.all([
        renderMonthlyComparisonChart(filteredTransactions, activeRecurring, period),
        renderExpenseCategoriesChart(filteredTransactions, activeRecurring, period),
        renderTrendChart(filteredTransactions, activeRecurring),
        renderCashFlowTimeline(filteredTransactions, activeRecurring, period, effectiveAccountIds)
      ]);
    }

    await updateBudgetTracking(accountIds, period);

  } catch (error) {
    console.error('Error updating reports:', error);
    displayErrorState(error);
  }
}

  // Add empty state handling
function displayEmptyState() {
  const containers = [
    'monthlyComparisonChart',
    'expenseCategoriesChart',
    'trendChart',
    'cashFlowTimeline',
  ];

  // Destroy chart instances first
  if (monthlyComparisonChartInstance) monthlyComparisonChartInstance.destroy();
  if (expenseCategoriesChartInstance) expenseCategoriesChartInstance.destroy();
  if (trendChartInstance) trendChartInstance.destroy();
  if (cashFlowChartInstance) cashFlowChartInstance.destroy();

  containers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No data available for the selected period</p>
        </div>
      `;
    }
  });
}

// Add error state handling
function displayErrorState(error) {
  const containers = [
    'monthlyComparisonChart',
    'expenseCategoriesChart',
    'trendChart',
    'cashFlowTimeline',
  ];

  // Destroy chart instances first
  if (monthlyComparisonChartInstance) monthlyComparisonChartInstance.destroy();
  if (expenseCategoriesChartInstance) expenseCategoriesChartInstance.destroy();
  if (trendChartInstance) trendChartInstance.destroy();
  if (cashFlowChartInstance) cashFlowChartInstance.destroy();

  containers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="error-state">
          <p>Error loading data: ${error.message}</p>
        </div>
      `;
    }
  });
}

  
export function calculateRecurringForPeriod(recurringItems, period, referenceDate = new Date()) {
    const today = new Date(referenceDate);
    let periodStart = new Date(today);
    let periodEnd = new Date(today);
    
    // Set period range based on period type
    switch(period) {
        case 'year':
            periodStart.setMonth(0, 1);
            periodEnd.setFullYear(periodStart.getFullYear(), 11, 31);
            break;
        case 'quarter':
            const currentQuarter = Math.floor(today.getMonth() / 3);
            periodStart.setMonth(currentQuarter * 3, 1);
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

    return recurringItems.reduce((total, item) => {
        const startDate = new Date(item.start_date);
        startDate.setHours(0, 0, 0, 0);

        // If the recurring hasn't started by period end, exclude it
        if (startDate > periodEnd) return total;

        // If there's an end_date and it ended before period start, exclude
        if (item.end_date) {
            const endDate = new Date(item.end_date);
            endDate.setHours(23, 59, 59, 999);
            if (endDate < periodStart) return total;
        }

        // Determine the effective start and end dates for the calculation
        const effectiveStart = startDate > periodStart ? startDate : periodStart;
        const effectiveEnd = item.end_date 
            ? new Date(Math.min(new Date(item.end_date), periodEnd)) 
            : periodEnd;

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
                occurrences = effectiveEnd.getFullYear() - effectiveStart.getFullYear() + 
                              ((effectiveEnd.getMonth() > effectiveStart.getMonth() || 
                               (effectiveEnd.getMonth() === effectiveStart.getMonth() && 
                                effectiveEnd.getDate() >= effectiveStart.getDate())) ? 1 : 0);
                break;
            default:
                occurrences = 0;
        }

        return total + (amount * Math.max(0, occurrences));
    }, 0);
}
  
  // Update the renderMonthlyComparisonChart function
  export async function renderMonthlyComparisonChart(transactions, recurring, period = 'month') {
    // Determine number of months to show based on period
    let monthsToShow;
    switch (period) {
      case 'month':
        monthsToShow = 1;
        break;
      case 'quarter':
        monthsToShow = 3;
        break;
      case 'year':
        monthsToShow = 12;
        break;
      case 'all':
        const dates = transactions.map(tx => new Date(tx.date));
        const oldestDate = dates.length ? new Date(Math.min(...dates)) : new Date();
        const monthDiff = (new Date().getMonth() + 12 * new Date().getFullYear()) - 
                         (oldestDate.getMonth() + 12 * oldestDate.getFullYear());
        monthsToShow = Math.max(monthDiff + 1, 1);
        break;
      default:
        monthsToShow = 1;
    }

    // Generate array of months based on period
    const months = Array.from({ length: monthsToShow }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return {
        name: d.toLocaleString('default', { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth()
      };
    }).reverse();

    const monthlyData = months.map(month => {
      // Get transactions for this month
      const monthTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getMonth() === month.month && 
               txDate.getFullYear() === month.year;
      });

      // Calculate recurring amounts for this specific month
      const monthlyRecurringIncome = calculateRecurringForMonth(
        recurring.filter(rec => rec.type === 'income'),
        month.year,
        month.month
      );

      const monthlyRecurringExpenses = calculateRecurringForMonth(
        recurring.filter(rec => rec.type === 'expense'),
        month.year,
        month.month
      );

      const transactionIncome = monthTransactions
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      const transactionExpenses = monthTransactions
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      return {
        recurringIncome: monthlyRecurringIncome,
        recurringExpenses: monthlyRecurringExpenses,
        transactionIncome,
        transactionExpenses
      };
    });

    const ctx = document.getElementById('monthlyComparisonChart').getContext('2d');
    
    if (monthlyComparisonChartInstance) {
      monthlyComparisonChartInstance.destroy();
    }

    // Create gradients
    const incomeGradient = ctx.createLinearGradient(0, 0, 0, 400);
    incomeGradient.addColorStop(0, 'rgba(72, 187, 120, 0.7)');
    incomeGradient.addColorStop(1, 'rgba(72, 187, 120, 0.1)');

    const expenseGradient = ctx.createLinearGradient(0, 0, 0, 400);
    expenseGradient.addColorStop(0, 'rgba(245, 101, 101, 0.7)');
    expenseGradient.addColorStop(1, 'rgba(245, 101, 101, 0.1)');

    // Add period to chart title
    const periodText = {
      month: 'This Month',
      quarter: 'This Quarter',
      year: 'This Year',
      all: 'All Time'
    }[period] || 'This Month';

    monthlyComparisonChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months.map(m => `${m.name} ${m.year}`),
        datasets: [
          {
            label: 'Recurring Income',
            data: monthlyData.map(d => d.recurringIncome),
            backgroundColor: 'rgba(72, 187, 120, 0.8)',
            borderColor: 'rgba(72, 187, 120, 1)',
            borderWidth: 1,
            borderRadius: 4,
            stack: 'Income'
          },
          {
            label: 'One-time Income',
            data: monthlyData.map(d => d.transactionIncome),
            backgroundColor: 'rgba(72, 187, 120, 0.4)',
            borderColor: 'rgba(72, 187, 120, 0.8)',
            borderWidth: 1,
            borderRadius: 4,
            stack: 'Income'
          },
          {
            label: 'Recurring Expenses',
            data: monthlyData.map(d => d.recurringExpenses),
            backgroundColor: 'rgba(245, 101, 101, 0.8)',
            borderColor: 'rgba(245, 101, 101, 1)',
            borderWidth: 1,
            borderRadius: 4,
            stack: 'Expenses'
          },
          {
            label: 'One-time Expenses',
            data: monthlyData.map(d => d.transactionExpenses),
            backgroundColor: 'rgba(245, 101, 101, 0.4)',
            borderColor: 'rgba(245, 101, 101, 0.8)',
            borderWidth: 1,
            borderRadius: 4,
            stack: 'Expenses'
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        aspectRatio: 2,
        plugins: {
          title: {
            display: true,
            text: `Income vs Expenses - ${periodText}`,
            font: {
              size: 16,
              family: "'Inter', sans-serif"
            }
          },
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              padding: 10,
              font: {
                family: "'Inter', sans-serif",
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#1a202c',
            bodyColor: '#4a5568',
            borderColor: 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
            padding: 12,
            bodyFont: {
              family: "'Inter', sans-serif",
              size: 13
            },
            titleFont: {
              family: "'Inter', sans-serif",
              size: 14,
              weight: '600'
            },
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const sign = context.dataset.label.includes('Expense') ? '-' : '+';
                return `${context.dataset.label}: ${sign}${formatCurrency(Math.abs(value))}`;
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
                family: "'Inter', sans-serif",
                size: 12
              }
            }
          },
          y: {
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              drawBorder: false
            },
            ticks: {
              font: {
                family: "'Inter', sans-serif",
                size: 12
              },
              callback: value => `${formatCurrency(value)}`
            }
          }
        }
      }
    });
  }
  
  export async function renderExpenseCategoriesChart(transactions, recurring) {
    try {
      // Combine transaction and recurring expenses
      const expenseTransactions = transactions.filter(tx => tx.type === 'expense');
      const activeRecurringExpenses = recurring.filter(r => r.is_active && r.type === 'expense');
  
      // Create a map to store category totals
      const categoryTotals = new Map();
  
      // Add transaction expenses
      expenseTransactions.forEach(tx => {
        const categoryId = tx.category_id || 'uncategorized';
        const currentTotal = categoryTotals.get(categoryId) || 0;
        categoryTotals.set(categoryId, currentTotal + parseFloat(tx.amount));
      });
  
      // Add recurring expenses
      activeRecurringExpenses.forEach(rec => {
        const categoryId = rec.category_id || 'uncategorized';
        const currentTotal = categoryTotals.get(categoryId) || 0;
        categoryTotals.set(categoryId, currentTotal + parseFloat(rec.amount));
      });
  
      // Get category names and create final data array
      const { data: categories } = await window.databaseApi.fetchCategories();
      const categoryMap = new Map(categories.map(cat => [cat.id, cat.name]));
  
      const chartData = Array.from(categoryTotals.entries())
        .map(([categoryId, total]) => ({
          category_name: categoryId === 'uncategorized' ? 'Uncategorized' : categoryMap.get(categoryId),
          total
        }))
        .filter(item => item.total > 0)
        .sort((a, b) => b.total - a.total);
  
      const container = document.getElementById('expenseCategoriesChart');
      
      // Clear any existing content
      container.innerHTML = '';

      if (!chartData || chartData.length === 0) {
        container.innerHTML = '<div class="empty-state">No expense data available</div>';
        return;
      }

      // Use explicit colors instead of CSS variables
      const brandColors = [
        '#48bb78', // Green
        '#4299e1', // Blue
        '#9f7aea', // Purple
        '#ed8936', // Orange
        '#f56565', // Red
        '#38b2ac', // Teal
        '#667eea', // Indigo
        '#d53f8c'  // Pink
      ];

      // Create wrapper with responsive sizing
      const chartWrapper = document.createElement('div');
      chartWrapper.className = 'chart-wrapper';

      const chartContainer = document.createElement('div');
      chartContainer.className = 'custom-pie-chart';

      const legendContainer = document.createElement('div');
      legendContainer.className = 'pie-chart-legend';

      // Calculate total for percentages
      const total = chartData.reduce((sum, cat) => sum + cat.total, 0);

      // Generate pie chart segments with opacity transitions
      let currentDegree = 0;
      const pieChartSegments = chartData.map((category, index) => {
        const percentage = (category.total / total) * 100;
        const degrees = (percentage / 100) * 360;
        const color = brandColors[index % brandColors.length];
        const segment = `${color} ${currentDegree}deg ${currentDegree + degrees}deg`;
        currentDegree += degrees;
        return { segment, color, startDegree: currentDegree - degrees, endDegree: currentDegree };
      });

      // Apply the gradient with transition
      chartContainer.style.background = `conic-gradient(${pieChartSegments.map(s => s.segment).join(', ')})`;
      chartContainer.style.transition = 'filter 0.3s ease, background 0.3s ease';

      // Create legend items with enhanced hover effects
      chartData.forEach((category, index) => {
        const percentage = ((category.total / total) * 100).toFixed(1);
        const color = pieChartSegments[index].color;

        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
          <div class="legend-color" style="background: ${color}"></div>
          <div class="legend-text">
            <div class="legend-label">${category.category_name || 'Uncategorized'}</div>
            <div class="legend-value">${formatCurrency(category.total)} (${percentage}%)</div>
          </div>
        `;

        // Enhanced hover interaction
        legendItem.addEventListener('mouseenter', () => {
          // Create new gradient with smooth transition
          const newGradient = pieChartSegments.map((segment, i) => {
            if (i === index) {
              return `${segment.color} ${segment.startDegree}deg ${segment.endDegree}deg`;
            } else {
              const [r, g, b] = hexToRgb(segment.color);
              return `rgba(${r}, ${g}, ${b}, 0.3) ${segment.startDegree}deg ${segment.endDegree}deg`;
            }
          }).join(', ');
          
          chartContainer.style.background = `conic-gradient(${newGradient})`;
          
          // Add transition class for smooth effect
          chartContainer.classList.add('transitioning');
          
          // Dim other legend items with transition
          const otherItems = legendContainer.querySelectorAll('.legend-item');
          otherItems.forEach((item, i) => {
            if (i !== index) {
              item.style.opacity = '0.3';
              item.style.transition = 'opacity 0.3s ease';
            }
          });
        });

        legendItem.addEventListener('mouseleave', () => {
          // Restore original gradient with transition
          const originalGradient = pieChartSegments.map(s => s.segment).join(', ');
          chartContainer.style.background = `conic-gradient(${originalGradient})`;
          
          // Remove transition class
          chartContainer.classList.remove('transitioning');
          
          // Restore legend items opacity with transition
          const allItems = legendContainer.querySelectorAll('.legend-item');
          allItems.forEach(item => {
            item.style.opacity = '1';
            item.style.transition = 'opacity 0.3s ease';
          });
        });

        legendContainer.appendChild(legendItem);
      });

      chartWrapper.appendChild(chartContainer);
      chartWrapper.appendChild(legendContainer);
      container.appendChild(chartWrapper);

    } catch (error) {
      console.error('Error rendering expense categories chart:', error);
      container.innerHTML = '<div class="error-state">Error loading expense categories</div>';
    }
  }
  
  export async function updateTopSpendingCategories(accountIds = ['all'], period) {
    try {
      console.log('Fetching top spending categories for accounts:', accountIds);
      
      // If it's an array with multiple accounts, use 'all'
      const effectiveAccountId = Array.isArray(accountIds) && accountIds.length > 1 ? 'all' : 
                               Array.isArray(accountIds) ? accountIds[0] : 
                               accountIds;

      const { data: categories, error } = await window.databaseApi.getTopSpendingCategories(effectiveAccountId);
      if (error) throw error;

      console.log('Received categories:', categories);
      const container = document.getElementById('top-spending-list');
      if (!container) {
        console.error('Could not find top-spending-list container');
        return;
      }

      container.innerHTML = '';

      if (categories && categories.length > 0) {
        categories.forEach(category => {
          const item = document.createElement('div');
          item.className = 'spending-item';
          item.innerHTML = `
            <span class="category-name">${category.category_name || 'Uncategorized'}</span>
            <span class="amount negative">${formatCurrency(Math.abs(category.total))}</span>
          `;
          container.appendChild(item);
        });
      } else {
        container.innerHTML = `
          <div class="spending-item empty-state">
            <span class="category-name">No expense data for this period</span>
            <span class="amount">$0.00</span>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error updating top spending categories:', error);
      const container = document.getElementById('top-spending-list');
      if (container) {
        container.innerHTML = `
          <div class="spending-item error-state">
            <span class="category-name">Error loading categories</span>
            <span class="amount">--</span>
          </div>
        `;
      }
    }
  }
  
// Add this helper function to handle multiple account IDs
function normalizeAccountIds(accountIds) {
  if (!accountIds) return ['all'];
  if (typeof accountIds === 'string') return [accountIds];
  if (Array.isArray(accountIds)) {
    return accountIds.length === 0 ? ['all'] : accountIds;
  }
  return ['all'];
}

  // Add this helper function to filter transactions by period
export function filterTransactionsByPeriod(transactions, period) {
    const now = new Date();
    const startDate = new Date();
    let endDate = new Date();
    
    switch (period) {
      case 'month':
        startDate.setDate(1); // First day of current month
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'quarter':
        startDate.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 0);
        break;
      case 'year':
        startDate.setMonth(0, 1); // First day of current year
        endDate.setMonth(11, 31); // Last day of current year
        break;
      case 'all':
        return transactions;
      default:
        startDate.setDate(1); // Default to current month
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= startDate && txDate <= endDate;
    });
  }
  
  // Add the renderTrendChart function
  export async function renderTrendChart(transactions, recurring) {
    // Set date range to last 12 months
    const maxDate = new Date();
    const minDate = new Date();
    minDate.setMonth(minDate.getMonth() - 11);
    minDate.setDate(1);

    // Create array of all months in the range
    const months = [];
    const currentDate = new Date(minDate);
    while (currentDate <= maxDate) {
      months.push({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth(),
        date: new Date(currentDate)
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Calculate monthly totals with proper recurring handling
    const monthlyTotals = months.map(month => {
      // Get transactions for this month
      const monthTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getMonth() === month.month && 
               txDate.getFullYear() === month.year;
      });

      // Calculate recurring amounts for this specific month
      const monthlyRecurringIncome = calculateRecurringForMonth(
        recurring.filter(rec => rec.type === 'income'),
        month.year,
        month.month
      );

      const monthlyRecurringExpenses = calculateRecurringForMonth(
        recurring.filter(rec => rec.type === 'expense'),
        month.year,
        month.month
      );

      // Calculate one-time transaction totals
      const monthlyTransactionIncome = monthTransactions
        .filter(tx => tx.type === 'income')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      const monthlyTransactionExpenses = monthTransactions
        .filter(tx => tx.type === 'expense')
        .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

      return {
        date: month.date,
        income: monthlyTransactionIncome + monthlyRecurringIncome,
        expenses: monthlyTransactionExpenses + monthlyRecurringExpenses
      };
    });

    // Calculate cumulative totals
    let cumulativeIncome = 0;
    let cumulativeExpenses = 0;
    const cumulativeData = monthlyTotals.map(month => {
      cumulativeIncome += month.income;
      cumulativeExpenses += month.expenses;
      return {
        date: month.date,
        income: cumulativeIncome,
        expenses: cumulativeExpenses
      };
    });

    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if (trendChartInstance) {
      trendChartInstance.destroy();
    }

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months.map(m => m.date.toLocaleString('default', { 
          month: 'short', 
          year: '2-digit' 
        })),
        datasets: [
          {
            label: 'Cumulative Income',
            data: cumulativeData.map(d => d.income),
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Cumulative Expenses',
            data: cumulativeData.map(d => d.expenses),
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        aspectRatio: 2.5,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Cumulative Amount ($)'
            },
            ticks: {
              callback: value => formatCurrency(value)
            }
          }
        }
      }
    });
  }
  
  // Add the generateColors helper function
  export function generateColors(count) {
    const baseColors = [
      '#4CAF50', '#2196F3', '#9C27B0', '#F44336', '#FF9800',
      '#795548', '#607D8B', '#E91E63', '#9E9E9E', '#FFC107',
      '#3F51B5', '#009688', '#FF5722', '#8BC34A', '#00BCD4'
    ];
  
    // If we need more colors than in our base array, generate them
    if (count > baseColors.length) {
      const additionalColors = Array.from({ length: count - baseColors.length }, (_, i) => {
        const hue = (i * 137.508) % 360; // Use golden angle approximation
        return `hsl(${hue}, 70%, 60%)`; // Generate HSL colors
      });
      return [...baseColors, ...additionalColors];
    }
  
    // Otherwise return just the colors we need
    return baseColors.slice(0, count);
  }

function initializeCustomMultiSelect() {
  const multiSelect = document.getElementById('reports-account-selector');
  if (!multiSelect) {
    console.error('Reports account selector not found');
    return null;
  }

  const header = multiSelect.querySelector('.select-header');
  const dropdown = multiSelect.querySelector('.select-dropdown');
  const optionsContainer = multiSelect.querySelector('.options-container');
  const selectAllCheckbox = multiSelect.querySelector('#select-all-accounts');
  const selectedText = multiSelect.querySelector('.selected-text');

  let accounts = [];
  let selectedAccounts = new Set(['all']);

  async function initializeOptions() {
    try {
      const { data: fetchedAccounts, error } = await window.databaseApi.fetchAccounts();
      if (error) throw error;

      accounts = fetchedAccounts;
      renderOptions();
      updateSelectedText();
      
      triggerChange();
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  }

  function renderOptions() {
    optionsContainer.innerHTML = accounts.map(account => `
      <div class="option">
        <input type="checkbox" id="account-${account.id}" value="${account.id}"
               ${selectedAccounts.has(account.id) ? 'checked' : ''}>
        <label for="account-${account.id}">${account.name}</label>
      </div>
    `).join('');

    // Add event listeners to options
    optionsContainer.querySelectorAll('.option input').forEach(checkbox => {
      checkbox.addEventListener('change', handleOptionChange);
    });
  }

  function updateSelectedText() {
    if (selectedAccounts.has('all')) {
      selectedText.textContent = 'All Accounts';
    } else {
      const count = selectedAccounts.size;
      selectedText.textContent = `${count} Account${count !== 1 ? 's' : ''} Selected`;
    }
  }

  function handleOptionChange(e) {
    const accountId = e.target.value;
    
    if (accountId === 'all') {
        // If "All" is selected, clear other selections
        selectedAccounts.clear();
        selectedAccounts.add('all');
        selectAllCheckbox.checked = true;
        
        // Update all other checkboxes to unchecked
        optionsContainer.querySelectorAll('.option input').forEach(checkbox => {
            if (checkbox.value !== 'all') {
                checkbox.checked = false;
            }
        });
    } else {
        // If a specific account is selected
        if (e.target.checked) {
            // Remove 'all' if it was previously selected
            selectedAccounts.delete('all');
            selectAllCheckbox.checked = false;
            selectedAccounts.add(accountId);
        } else {
            selectedAccounts.delete(accountId);
            
            // If no accounts are selected, revert to 'all'
            if (selectedAccounts.size === 0) {
                selectedAccounts.add('all');
                selectAllCheckbox.checked = true;
            }
        }
    }

    updateSelectedText();
    triggerChange();
  }

  // Toggle dropdown
  header.addEventListener('click', () => {
    const isActive = header.classList.toggle('active');
    dropdown.classList.toggle('show', isActive);
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!multiSelect.contains(e.target)) {
      header.classList.remove('active');
      dropdown.classList.remove('show');
    }
  });

  // Handle "Select All" option
  selectAllCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      selectedAccounts.clear();
      selectedAccounts.add('all');
    } else {
      selectedAccounts.delete('all');
    }
    renderOptions();
    updateSelectedText();
    triggerChange();
  });

  function triggerChange() {
    // Dispatch custom event with selected accounts
    const event = new CustomEvent('accountschange', {
      detail: Array.from(selectedAccounts)
    });
    multiSelect.dispatchEvent(event);
  }

  // Initialize
  initializeOptions();

  // Return public methods
  return {
    getSelectedAccounts: () => Array.from(selectedAccounts),
    setSelectedAccounts: (accounts) => {
      selectedAccounts = new Set(accounts);
      renderOptions();
      updateSelectedText();
    }
  };
}

function setupReportsEventListeners() {
  const multiSelect = initializeCustomMultiSelect();
  
  if (multiSelect) {
    // Listen for account selection changes
    const accountSelector = document.getElementById('reports-account-selector');
    if (accountSelector) {
      accountSelector.addEventListener('accountschange', (event) => {
        if (!isInitialized) return; // Skip if not initialized
        const selectedAccounts = event.detail;
        const periodSelector = document.getElementById('reports-period-selector');
        const period = periodSelector ? periodSelector.value : 'month';
        updateReports(period, selectedAccounts);
      });
    }

    // Listen for period changes
    const periodSelector = document.getElementById('reports-period-selector');
    if (periodSelector) {
      periodSelector.addEventListener('change', () => {
        if (!isInitialized) return; // Skip if not initialized
        const selectedAccounts = multiSelect.getSelectedAccounts();
        updateReports(periodSelector.value, selectedAccounts);
      });
    }
  }
  
  return multiSelect;
}

// Export the setup function
export { setupReportsEventListeners };

// Add this function
export async function renderCashFlowTimeline(transactions, recurring, period = 'month', accountIds = ['all']) {
    try {
      if (cashFlowChartInstance) {
        cashFlowChartInstance.destroy();
        cashFlowChartInstance = null;
      }

      const canvas = document.getElementById('cashFlowTimeline');
      if (!canvas) {
        console.error('Cash flow timeline canvas not found');
        return;
      }

      // Create a new canvas element
      const newCanvas = document.createElement('canvas');
      newCanvas.id = 'cashFlowTimeline';
      canvas.parentNode.replaceChild(newCanvas, canvas);
      const ctx = newCanvas.getContext('2d');

      // Get the date range based on period
      const today = new Date();
      let startDate, endDate;
      
      switch(period) {
        case 'year':
          startDate = new Date(today.getFullYear(), 0, 1);
          endDate = new Date(today.getFullYear(), 11, 31);
          break;
        case 'quarter':
          const currentQuarter = Math.floor(today.getMonth() / 3) * 3;
          startDate = new Date(today.getFullYear(), currentQuarter, 1);
          endDate = new Date(today.getFullYear(), currentQuarter + 3, 0);
          break;
        case 'month':
        default:
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      }

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      
      // Filter active recurring items within date range
      const activeRecurring = recurring.filter(item => {
        const itemStartDate = new Date(item.start_date);
        itemStartDate.setHours(0, 0, 0, 0);
        
        // Don't include if it hasn't started yet
        if (itemStartDate > endDate) return false;
        
        // Don't include if it has ended
        if (item.end_date) {
          const itemEndDate = new Date(item.end_date);
          itemEndDate.setHours(23, 59, 59, 999);
          if (itemEndDate < startDate) return false;
        }
        
        return item.is_active;
      });

      // Get base cash flow data
      const { data: cashFlowData, error } = await window.databaseApi.getCashFlowData(accountIds, period);
      if (error) throw error;

      // Add recurring transactions to cash flow data
      const enhancedCashFlow = cashFlowData.map(day => {
        const date = new Date(day.date);
        let dailyRecurringNet = 0;

        activeRecurring.forEach(recurring => {
          const recurringStartDate = new Date(recurring.start_date);
          recurringStartDate.setHours(0, 0, 0, 0);
          const recurringEndDate = recurring.end_date ? new Date(recurring.end_date) : null;
          if (recurringEndDate) recurringEndDate.setHours(23, 59, 59, 999);
          
          // Only apply if the current date is within the recurring's date range
          if (date >= recurringStartDate && (!recurringEndDate || date <= recurringEndDate)) {
              let applies = false;
              switch (recurring.frequency) {
                  case 'daily':
                      applies = true;
                      break;
                  case 'weekly':
                      applies = date.getDay() === recurringStartDate.getDay();
                      break;
                  case 'monthly':
                      applies = date.getDate() === recurringStartDate.getDate();
                      break;
                  case 'yearly':
                      applies = date.getDate() === recurringStartDate.getDate() && 
                               date.getMonth() === recurringStartDate.getMonth();
                      break;
              }

              if (applies) {
                  const amount = parseFloat(recurring.amount);
                  dailyRecurringNet += recurring.type === 'income' ? amount : -amount;
              }
          }
        });

        return {
          ...day,
          net_amount: parseFloat(day.net_amount) + dailyRecurringNet,
          running_balance: parseFloat(day.running_balance) + dailyRecurringNet
        };
      });

      // Create chart
      cashFlowChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: enhancedCashFlow.map(d => new Date(d.date).toLocaleDateString('default', {
            month: 'short',
            day: 'numeric'
          })),
          datasets: [{
            label: 'Daily Balance',
            data: enhancedCashFlow.map(d => d.running_balance),
            borderColor: '#2196F3',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            fill: true,
            tension: 0.4
          }, {
            label: 'Daily Cash Flow',
            data: enhancedCashFlow.map(d => d.net_amount),
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            fill: true,
            tension: 0.4,
            hidden: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            intersect: false,
            mode: 'index'
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: false,
              title: {
                display: true,
                text: 'Amount ($)'
              },
              ticks: {
                callback: value => formatCurrency(value)
              }
            },
            x: {
              title: {
                display: true,
                text: 'Date'
              }
            }
          }
        }
      });
    } catch (error) {
      console.error('Error rendering cash flow timeline:', error);
      displayErrorState(error);
    }
}

// Add this function at the top with other empty state handling
function displayEmptyStateForChart(containerId, message, icon = 'fa-chart-line') {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <i class="fas ${icon}"></i>
        </div>
        <h3>No Data Available</h3>
        <p>${message}</p>
      </div>
    `;
  }
}

export async function updateBudgetTracking(accountIds = ['all'], period = 'month') {
    try {
        const { data: budgetProgress, error } = await window.databaseApi.getAllBudgetProgress(period);
        if (error) throw error;

        const container = document.querySelector('.budget-tracking-section');
        const table = container.querySelector('.budget-tracking-table');
        const tbody = document.getElementById('budget-tracking-body');

        if (!budgetProgress || budgetProgress.length === 0) {
            // Hide the table
            table.style.display = 'none';
            
            // Show empty state
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state-content';
            emptyState.innerHTML = `
                <i class="fas fa-piggy-bank"></i>
                <h3>No Budget Data</h3>
                <p>Start by setting up budgets for your expense categories</p>
                <button class="primary-btn">Add Category Budget</button>
            `;
            
            // Add click handler with mock event
            const button = emptyState.querySelector('button');
            button.addEventListener('click', (e) => {
                // Create a mock event with currentTarget
                const mockEvent = {
                    currentTarget: document.querySelector('.tablink[data-section="Categories"]')
                };
                openSection({ currentTarget: mockEvent.currentTarget }, 'Categories');
            });
            
            // Remove any existing empty state
            const existingEmptyState = container.querySelector('.empty-state-content');
            if (existingEmptyState) {
                existingEmptyState.remove();
            }
            
            container.appendChild(emptyState);
            return;
        }

        // If we have data, show the table and remove empty state
        table.style.display = 'table';
        const existingEmptyState = container.querySelector('.empty-state-content');
        if (existingEmptyState) {
            existingEmptyState.remove();
        }

        // Update table with data
        tbody.innerHTML = '';
        budgetProgress.forEach(item => {
            const row = document.createElement('tr');
            const percentUsed = (item.spent / item.adjusted_budget) * 100;
            const remaining = item.adjusted_budget - item.spent;
            
            let statusClass = 'under';
            if (percentUsed >= 100) {
                statusClass = 'over';
            } else if (percentUsed >= 80) {
                statusClass = 'warning';
            }

            row.innerHTML = `
                <td>${item.category_name} (${capitalizeFirstLetter(item.budget_frequency)})</td>
                <td>${formatCurrency(item.adjusted_budget)}</td>
                <td>${formatCurrency(item.spent)}</td>
                <td>${formatCurrency(Math.abs(remaining))}</td>
                <td>
                    <span class="budget-status ${statusClass}">
                        ${Math.round(percentUsed)}% ${statusClass === 'over' ? 'Over' : 'Used'}
                    </span>
                </td>
                <td>${item.transaction_count}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error updating budget tracking:', error);
    }
}

// Export a function to mark initialization as complete
export function markReportsInitialized() {
  isInitialized = true;
}

// Update the recurring calculations in fetchTotalBalance
function calculateRecurringForMonth(recurring, year, month) {
    const referenceDate = new Date(year, month, 1);
    return calculateRecurringForPeriod(recurring, 'month', referenceDate);
}

// Add this helper function at the top
function getRecurringAmountForMonth(recurring, year, month) {
    const referenceDate = new Date(year, month, 1);
    return calculateRecurringForPeriod(recurring, 'month', referenceDate);
}


