
// Add these chart instances at the top with other chart variables
let balanceChartInstance;
let incomeExpenseChartInstance;
let monthlyComparisonChartInstance;
let expenseCategoriesChartInstance;
let trendChartInstance;

async function initializeApp() {


  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }

  setTimeout(() => {
    document.body.classList.remove('preload');
  }, 100);

  setTimeout(() => {
    const loader = document.querySelector('.app-loader');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.remove();
      }, 500); 
    }
  }, 2000); 

    try {
      // Check if database API is available
      if (!window.databaseApi) {
        throw new Error('Database API not available');
      }
  
      // Initialize each component with proper error handling
      await Promise.all([
        fetchTotalBalance().catch(err => console.error('Failed to fetch balance:', err)),
        fetchAccounts().catch(err => console.error('Failed to fetch accounts:', err)),
        fetchCategories().catch(err => console.error('Failed to fetch categories:', err)),
        populateAccountDropdowns().catch(err => console.error('Failed to populate dropdowns:', err)),
        populateCategoryDropdowns().catch(err => console.error('Failed to populate category dropdowns:', err)),
        fetchTransactions().catch(err => console.error('Failed to fetch transactions:', err)),
        renderDashboardCharts().catch(err => console.error('Failed to render charts:', err)),
        fetchRecurring().catch(err => console.error('Failed to fetch recurring:', err)),
        fetchAndDisplayCategories().catch(err => console.error('Failed to fetch categories:', err)),
        updateReports('month', 'all').catch(err => console.error('Failed to update reports:', err))
      ]);
  
    } catch (error) {
      console.error('Failed to initialize app:', error);
      // Display error to user
      document.body.innerHTML = `
        <div style="padding: 20px; color: red;">
          Error initializing application: ${error.message}<br>
          Please check your database configuration and restart the application.
        </div>
      `;
    }
  }

window.onload = () => {
  initializeNavigation();
  initializeAccountSelectors();
  initializeVersionControl();
  initializeApp();
};
// Utility function to format numbers as currency
function formatCurrency(amount) {
  return parseFloat(amount).toFixed(2);
}

// Navigation Function
function openSection(evt, sectionName) {
  // Hide all sections
  const sections = document.getElementsByClassName('section');
  for (let i = 0; i < sections.length; i++) {
    sections[i].classList.remove('active');
  }

  // Remove active class from all buttons
  const tabs = document.getElementsByClassName('tablink');
  for (let i = 0; i < tabs.length; i++) {
    tabs[i].classList.remove('active');
  }

  // Show the current section and add an "active" class to the button
  document.getElementById(sectionName).classList.add('active');
  evt.currentTarget.classList.add('active');
}

// Add this new function to calculate monthly recurring totals
async function calculateMonthlyRecurring(accountId = 'all') {
  const { data: recurring, error } = await window.databaseApi.fetchRecurring(accountId);
  
  if (error) {
    console.error('Error fetching recurring:', error);
    return 0;
  }

  // Only count active recurring
  return recurring
    .filter(recur => recur.is_active)
    .reduce((total, recur) => total + parseFloat(recur.amount), 0);
}

// Update the existing fetchTotalBalance function to include monthly calculations
async function fetchTotalBalance(accountId = 'all') {
  try {
    // Fetch accounts data
    const { data: accounts, error: accountsError } = await window.databaseApi.fetchAccounts();
    if (accountsError) throw accountsError;

    // Fetch transactions for the current month
    const { data: transactions, error: transactionsError } = await window.databaseApi.fetchTransactions(accountId);
    if (transactionsError) throw transactionsError;

    // Fetch recurring transactions
    const { data: recurring, error: recurringError } = await window.databaseApi.fetchRecurring(accountId);
    if (recurringError) throw recurringError;

    // Calculate total balance
    let totalBalance;
    if (accountId === 'all') {
      totalBalance = accounts.reduce((acc, account) => acc + parseFloat(account.balance), 0);
    } else {
      const account = accounts.find(acc => acc.id === accountId);
      totalBalance = account ? parseFloat(account.balance) : 0;
    }

    // Get current month's transactions
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const monthlyTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    });

    // Calculate monthly income and expenses from transactions
    const monthlyIncomeFromTransactions = monthlyTransactions
      .filter(tx => tx.type === 'income')
      .reduce((total, tx) => total + parseFloat(tx.amount), 0);

    const monthlyExpensesFromTransactions = monthlyTransactions
      .filter(tx => tx.type === 'expense')
      .reduce((total, tx) => total + parseFloat(tx.amount), 0);

    // Calculate recurring income and expenses
    const monthlyRecurringIncome = recurring
      .filter(r => r.is_active && r.type === 'income')
      .reduce((total, r) => total + parseFloat(r.amount), 0);

    const monthlyRecurringExpenses = recurring
      .filter(r => r.is_active && r.type === 'expense')
      .reduce((total, r) => total + parseFloat(r.amount), 0);

    // Update dashboard displays
    document.getElementById('total-balance').innerText = formatCurrency(totalBalance);
    document.getElementById('monthly-income').innerText = 
      formatCurrency(monthlyIncomeFromTransactions + monthlyRecurringIncome);
    document.getElementById('monthly-expenses').innerText = 
      formatCurrency(monthlyExpensesFromTransactions + monthlyRecurringExpenses);

  } catch (error) {
    console.error('Failed to fetch total balance:', error);
  }
}

// Fetch and display accounts
async function fetchAccounts() {
  try {
    const { data, error } = await window.databaseApi.fetchAccounts();
    
    if (error) throw error;
    
    const accountsTableBody = document.getElementById('accounts-table-body');
    accountsTableBody.innerHTML = '';
    
    data.forEach(account => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${account.name}</td>
        <td>
          <span class="balance-display">$${formatCurrency(account.balance)}</span>
          <input type="number" class="balance-edit" style="display: none" value="${account.balance}" step="0.01">
        </td>
        <td>
          <button class="edit-btn" data-account-id="${account.id}">Edit</button>
          <button class="save-btn" data-account-id="${account.id}" style="display: none">Save</button>
          <button class="delete-btn" data-account-id="${account.id}">Delete</button>
        </td>
      `;
      
      // Add event listeners for edit/save buttons
      const editBtn = row.querySelector('.edit-btn');
      const saveBtn = row.querySelector('.save-btn');
      const balanceDisplay = row.querySelector('.balance-display');
      const balanceEdit = row.querySelector('.balance-edit');
      
      editBtn.addEventListener('click', () => {
        balanceDisplay.style.display = 'none';
        balanceEdit.style.display = 'inline';
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline';
      });
      
      saveBtn.addEventListener('click', async () => {
        const newBalance = parseFloat(balanceEdit.value);
        const { error: updateError } = await window.databaseApi.updateAccount(account.id, newBalance);
        
        if (updateError) {
          console.error('Error updating account:', updateError);
          return;
        }
        
        balanceDisplay.textContent = `$${formatCurrency(newBalance)}`;
        balanceDisplay.style.display = 'inline';
        balanceEdit.style.display = 'none';
        editBtn.style.display = 'inline';
        saveBtn.style.display = 'none';
        
        // Refresh total balance
        fetchTotalBalance();
      });
      
      // Add delete button event listener
      const deleteBtn = row.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete account "${account.name}"? This will also delete all associated transactions.`)) {
          const { error: deleteError } = await window.databaseApi.deleteAccount(account.id);
          
          if (deleteError) {
            console.error('Error deleting account:', deleteError);
            return;
          }
          
          // Refresh everything
          await fetchAccounts();
          await fetchTotalBalance();
          await populateAccountDropdowns();
          await fetchTransactions();
          await renderDashboardCharts();
        }
      });
      
      accountsTableBody.appendChild(row);
    });
    
    return data;
  } catch (err) {
    console.error('Error fetching accounts:', err);
    throw err;
  }
}

// Replace the show/hide account form event listeners with these
document.getElementById('show-add-account')?.addEventListener('click', () => {
  openModal('add-account-modal');
});

document.getElementById('close-add-account')?.addEventListener('click', () => {
  closeModal('add-account-modal');
});

document.getElementById('cancel-add-account')?.addEventListener('click', () => {
  closeModal('add-account-modal');
});



// Show/Hide Transaction Form
document.getElementById('show-add-transaction')?.addEventListener('click', () => {
  document.getElementById('add-transaction-card').style.display = 'block';
});

document.getElementById('cancel-add-transaction')?.addEventListener('click', () => {
  document.getElementById('add-transaction-card').style.display = 'none';
  document.getElementById('add-transaction-form').reset();
});

// Update the add account form submission handler
const addAccountForm = document.getElementById('add-account-form');
if (addAccountForm) {
  addAccountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('account-name').value;
    const balance = parseFloat(document.getElementById('account-balance').value);

    const { error } = await window.databaseApi.addAccount({
      name,
      balance
    });

    if (error) {
      console.error('Error adding account:', error);
    } else {
      // Close the modal instead of hiding the card
      closeModal('add-account-modal');
      // Refresh data
      await fetchAccounts();
      await fetchTotalBalance();
      await populateAccountDropdowns();
      // Clear form
      e.target.reset();
    }
  });
}

const addTransactionForm = document.getElementById('add-transaction-form');
if (addTransactionForm) {
  addTransactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form elements using the correct IDs
    const accountId = document.getElementById('add-transaction-account')?.value;
    const type = document.getElementById('add-transaction-type')?.value;
    const categoryId = document.getElementById('add-transaction-category')?.value;
    const amount = document.getElementById('add-transaction-amount')?.value;
    const date = document.getElementById('add-transaction-date')?.value;
    const description = document.getElementById('add-transaction-description')?.value;

    // Validate required fields
    if (!accountId || !type || !categoryId || !amount || !date) {
      console.error('Missing required fields');
      return;
    }

    const { error } = await window.databaseApi.addTransaction({
      account_id: accountId,
      type,
      category_id: categoryId,
      amount: parseFloat(amount),
      date,
      description: description || ''
    });

    if (error) {
      console.error('Error adding transaction:', error);
    } else {
      closeModal('add-transaction-modal');
      // Refresh data
      await fetchTransactions();
      await fetchTotalBalance();
      await fetchAccounts();
      await renderDashboardCharts();
      // Clear form
      e.target.reset();
    }
  });
}

async function confirmDelete(type, id) {
  const result = confirm(`Are you sure you want to delete this ${type}?`);
  if (result) {
    switch (type) {
      case 'transaction':
        await deleteTransaction(id);
        break;
      case 'recurring':
        await deleteRecurring(id);
        break;
      case 'account':
        await deleteAccount(id);
        break;
      case 'category':
        await deleteCategory(id);
        break;
    }
  }
}

// Function to open modal
function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
}

// Function to close modal
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

// Event listener for closing the edit transaction modal
document.getElementById('close-edit-transaction').addEventListener('click', () => {
  closeModal('edit-transaction-modal');
});

// Ensure the cancel button also closes the modal
document.getElementById('cancel-edit-transaction').addEventListener('click', () => {
  closeModal('edit-transaction-modal');
});

// Fetch and display transactions
async function fetchTransactions(accountId = null) {
  try {
    const typeFilter = document.getElementById('transaction-type-filter')?.value || 'all';
    const categoryFilter = document.getElementById('transaction-category-filter')?.value || 'all';
    const sortBy = document.getElementById('transaction-sort')?.value || 'date-desc';
    
    const { data: transactions, error } = await window.databaseApi.fetchTransactions(accountId);
    if (error) throw error;

    // Apply filters
    let filteredData = transactions;
    if (typeFilter !== 'all') {
      filteredData = filteredData.filter(t => t.type === typeFilter);
    }
    if (categoryFilter !== 'all') {
      filteredData = filteredData.filter(t => t.category_id === parseInt(categoryFilter));
    }

    // Apply sorting
    const [field, direction] = sortBy.split('-');
    filteredData.sort((a, b) => {
      let comparison = 0;
      switch (field) {
        case 'date':
          comparison = new Date(a.date) - new Date(b.date);
          break;
        case 'amount':
          comparison = parseFloat(a.amount) - parseFloat(b.amount);
          break;
      }
      return direction === 'asc' ? comparison : -comparison;
    });

    const tableBody = document.getElementById('transactions-table-body');
    tableBody.innerHTML = '';

    if (filteredData && filteredData.length > 0) {
      filteredData.forEach(transaction => {
        const date = new Date(transaction.date);
        const formattedDate = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${formattedDate}</td>
          <td>${capitalizeFirstLetter(transaction.type)}</td>
          <td>${transaction.category_name || 'Uncategorized'}</td>
          <td class="${transaction.type === 'income' ? 'positive' : 'negative'}">
            $${formatCurrency(transaction.amount)}
          </td>
          <td>${transaction.description || '-'}</td>
          <td>
            <button class="icon-btn edit-btn">
              <i class="fas fa-edit"></i>
            </button>
            <button class="icon-btn delete-btn">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;

        // Add event listeners
        row.querySelector('.edit-btn').addEventListener('click', () => {
          showEditTransactionForm(transaction);
        });

        row.querySelector('.delete-btn').addEventListener('click', () => {
          confirmDelete('transaction', transaction.id);
        });

        tableBody.appendChild(row);
      });
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">No transactions found</td>
        </tr>
      `;
    }
  } catch (error) {
    console.error('Error fetching transactions:', error);
  }
}


// Fetch and populate categories in Transaction and Recurring Forms
async function fetchCategories() {
  try {
    const typeFilter = document.getElementById('category-type-filter')?.value || 'all';
    const sortBy = document.getElementById('category-sort')?.value || 'name-asc';
    
    const { data: categories, error } = await window.databaseApi.fetchCategories();
    if (error) throw error;

    // Apply filters
    let filteredData = categories;
    if (typeFilter !== 'all') {
      filteredData = filteredData.filter(c => c.type === typeFilter);
    }

    // Apply sorting
    const [field, direction] = sortBy.split('-');
    filteredData.sort((a, b) => {
      let comparison = 0;
      switch (field) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return direction === 'asc' ? comparison : -comparison;
    });

    const categoriesTableBody = document.getElementById('categories-table-body');
    if (!categoriesTableBody) return;

    if (filteredData && filteredData.length > 0) {
      categoriesTableBody.innerHTML = filteredData.map(category => `
        <tr>
          <td>${category.name}</td>
          <td>${capitalizeFirstLetter(category.type)}</td>
          <td>
            <button class="edit-category-btn" data-category-id="${category.id}">Edit</button>
            <button class="delete-category-btn" data-category-id="${category.id}">Delete</button>
          </td>
        </tr>
      `).join('');

      // Add event listeners for edit and delete buttons
      document.querySelectorAll('.edit-category-btn').forEach(button => {
        button.addEventListener('click', async () => {
          const categoryId = button.dataset.categoryId;
          const category = filteredData.find(c => c.id === parseInt(categoryId));
          if (category) {
            await showEditCategoryForm(category);
          }
        });
      });

      document.querySelectorAll('.delete-category-btn').forEach(button => {
        button.addEventListener('click', () => {
          const categoryId = button.dataset.categoryId;
          handleDeleteCategory(categoryId);
        });
      });
    } else {
      categoriesTableBody.innerHTML = `
        <tr>
          <td colspan="3" class="empty-state">No categories found</td>
        </tr>
      `;
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
  }
}

// Category event handlers
async function handleAddCategory(e) {
  e.preventDefault();
  const name = document.getElementById('add-category-name').value;
  const type = document.getElementById('add-category-type').value;

  const { error } = await window.databaseApi.addCategory({ name, type });
  if (error) {
    console.error('Error adding category:', error);
  } else {
    closeModal('add-category-modal');
    await fetchCategories();
    await populateCategoryDropdowns();
    e.target.reset();
  }
}

async function handleEditCategory(e) {
  e.preventDefault();
  const id = document.getElementById('edit-category-id').value;
  const name = document.getElementById('edit-category-name').value;
  const type = document.getElementById('edit-category-type').value;

  const { error } = await window.databaseApi.updateCategory(id, { name, type });
  if (error) {
    console.error('Error updating category:', error);
  } else {
    closeModal('edit-category-modal');
    await fetchCategories();
    await populateCategoryDropdowns();
    e.target.reset();
  }
}

async function handleDeleteCategory(categoryId) {
  if (confirm('Are you sure you want to delete this category? Associated transactions will become uncategorized.')) {
    const { error } = await window.databaseApi.deleteCategory(categoryId);
    if (error) {
      console.error('Error deleting category:', error);
    } else {
      await fetchCategories();
      await populateCategoryDropdowns();
    }
  }
}

// Add Category button click handler
document.getElementById('add-category-btn')?.addEventListener('click', () => {
  // Reset the form in case it has old data
  document.getElementById('add-category-form').reset();
  openModal('add-category-modal');
});


// Capitalize first letter of a string
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function getChartTheme() {
  const isDarkMode = document.body.classList.contains('dark-mode');
  return {
    color: isDarkMode ? '#fff' : '#1F291F',
    gridColor: isDarkMode ? '#333' : '#E8EBE8',
    tickColor: isDarkMode ? '#999' : '#2F3B2F'
  };
}

async function renderDashboardCharts() {

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

async function renderDailySpendingChart(transactions, startDate, endDate) {
  // Ensure we have the canvas element
  const canvas = document.getElementById('dailySpendingChart');
  if (!canvas) {
    console.error('Daily spending chart canvas not found');
    return;
  }

  // Calculate daily spending
  const daysInMonth = endDate.getDate();
  const dailyData = new Array(daysInMonth).fill(0);
  
  transactions
    .filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= startDate && 
             txDate <= endDate && 
             tx.type === 'expense';
    })
    .forEach(tx => {
      const day = new Date(tx.date).getDate() - 1;
      dailyData[day] += parseFloat(tx.amount);
    });

  // Check if we have any data
  const hasData = dailyData.some(amount => amount > 0);
  
  const ctx = canvas.getContext('2d');
  if (balanceChartInstance) balanceChartInstance.destroy();

  balanceChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({length: dailyData.length}, (_, i) => i + 1),
      datasets: [{
        label: 'Daily Spending',
        data: hasData ? dailyData : [0], // Show 0 if no data
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      aspectRatio: 2,
      maintainAspectRatio: true,
      plugins: {
        title: {
          display: true,
          text: hasData ? 'Daily Spending This Month' : 'No spending recorded this month'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Amount ($)'
          }
        }
      }
    }
  });
}

// Function to get upcoming expenses for the current week
async function getUpcomingExpensesForWeek() {
  try {
    const { data: recurring = [], error } = await window.databaseApi.fetchRecurring();
    if (error) throw error;
    if (!Array.isArray(recurring)) return [];

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Filter recurring expenses that are active and are expenses
    return recurring.filter(expense => {
      if (!expense.is_active || expense.type !== 'expense') return false;

      // Convert billing_date (1-31) to a date object for the current month
      const expenseDate = new Date(currentYear, currentMonth, expense.billing_date);
      
      // Get the week boundaries
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return expenseDate >= startOfWeek && expenseDate <= endOfWeek;
    });
  } catch (error) {
    console.error('Error fetching upcoming expenses:', error);
    return [];
  }
}

async function renderUpcomingExpensesCalendar() {
  try {
    const calendarElement = document.getElementById('upcomingExpensesCalendar');
    if (!calendarElement) return;

    const upcomingExpenses = await getUpcomingExpensesForWeek() || [];
    
    // Clear existing content
    calendarElement.innerHTML = '<h3>Upcoming Expenses</h3>';

    // Create calendar container
    const calendarContainer = document.createElement('div');
    calendarContainer.className = 'calendar-container';

    // Create a 5-day view starting from today
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();

    // Show 5 days starting from today
    for (let i = 0; i < 5; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);
      
      const dayName = daysOfWeek[currentDate.getDay()];
      const isToday = i === 0;
      
      // Filter expenses for this day
      const expensesForDay = upcomingExpenses.filter(expense => {
        const expenseDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          expense.billing_date
        );
        return expenseDate.getDate() === currentDate.getDate();
      });

      const dayElement = document.createElement('div');
      dayElement.className = `calendar-day${isToday ? ' today' : ''}`;
      
      const dateStr = `${dayName} ${currentDate.getDate()}`;
      const expensesStr = expensesForDay.length > 0 
        ? expensesForDay.map(exp => 
            `<div class="expense-item">
              <span class="expense-amount">$${formatCurrency(exp.amount)}</span>
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



// Add this after your existing code but before the window.onload
function initializeNavigation() {
  const buttons = document.querySelectorAll('.tablink');
  buttons.forEach(button => {
    button.addEventListener('click', (event) => {
      const sectionName = event.currentTarget.dataset.section;
      
      // Hide all sections
      document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
      });
      
      // Remove active class from all buttons
      document.querySelectorAll('.tablink').forEach(tab => {
        tab.classList.remove('active');
      });
      
      // Show the current section and activate the button
      document.getElementById(sectionName).classList.add('active');
      event.currentTarget.classList.add('active');
    });
  });
}

// Add this function to populate account dropdowns
async function populateAccountDropdowns() {
  const { data, error } = await window.databaseApi.fetchAccounts();
  
  if (error) {
    console.error('Error fetching accounts:', error);
    return;
  }
  
  // Get all account selector elements
  const selectors = [
    'dashboard-account-selector',
    'transactions-account-selector',
    'transaction-account',
    'recurring-account-selector',
    'recurring-account',
    'reports-account-selector',
    'reports-account',
    'add-transaction-account',
    'edit-transaction-account',
    'add-recurring-account',
    'edit-recurring-account'
  ].map(id => document.getElementById(id));
  
  // Populate each selector
  selectors.forEach(selector => {
    if (!selector) return;
    
    // Clear existing options
    const isFilterSelector = selector.id.includes('selector');
    selector.innerHTML = isFilterSelector ? 
      '<option value="all">All Accounts</option>' : 
      '<option value="" disabled selected>Select Account</option>';
    
    // Add account options
    data.forEach(account => {
      const option = document.createElement('option');
      option.value = account.id;
      option.text = account.name;
      selector.appendChild(option);
    });
  });
}


// Add event listeners for opening modals
document.getElementById('add-transaction-btn')?.addEventListener('click', async () => {
  await populateAccountDropdowns();
  await populateCategoryDropdowns();
  openModal('add-transaction-modal');
});

document.getElementById('add-recurring-btn')?.addEventListener('click', async () => {
  await populateAccountDropdowns();
  await populateCategoryDropdowns();
  openModal('add-recurring-modal');
});

// Add event listeners for closing modals
['add-transaction', 'add-recurring', 'add-category', 'edit-category'].forEach(modalType => {
  document.getElementById(`close-${modalType}`)?.addEventListener('click', () => {
    closeModal(`${modalType}-modal`);
  });

  document.getElementById(`cancel-${modalType}`)?.addEventListener('click', () => {
    closeModal(`${modalType}-modal`);
  });
});

// Update showEditCategoryForm function
async function showEditCategoryForm(category) {
  document.getElementById('edit-category-id').value = category.id;
  document.getElementById('edit-category-name').value = category.name;
  document.getElementById('edit-category-type').value = category.type;
  openModal('edit-category-modal');
}

// Function to populate category dropdowns
async function populateCategoryDropdowns() {
  try {
    const { data: categories } = await window.databaseApi.fetchCategories();
    
    // Regular dropdowns (for forms)
    const formDropdowns = [
      'add-transaction-category',
      'edit-transaction-category',
      'add-recurring-category',
      'edit-recurring-category'
    ];

    // Filter dropdowns (need "All Categories" option)
    const filterDropdowns = [
      'transaction-category-filter',
      'recurring-category-filter'
    ];

    // Populate form dropdowns
    formDropdowns.forEach(dropdownId => {
      const dropdown = document.getElementById(dropdownId);
      if (dropdown) {
        dropdown.innerHTML = categories.map(category => 
          `<option value="${category.id}">${capitalizeFirstLetter(category.type)} - ${category.name}</option>`
        ).join('');
      }
    });

    // Populate filter dropdowns with "All Categories" option
    filterDropdowns.forEach(dropdownId => {
      const dropdown = document.getElementById(dropdownId);
      if (dropdown) {
        dropdown.innerHTML = `
          <option value="all">All Categories</option>
          ${categories.map(category => 
            `<option value="${category.id}">${capitalizeFirstLetter(category.type)} - ${category.name}</option>`
          ).join('')}
        `;
      }
    });
  } catch (error) {
    console.error('Error populating category dropdowns:', error);
  }
}

// Add event listeners for account selectors
function initializeAccountSelectors() {
  const dashboardSelector = document.getElementById('dashboard-account-selector');
  const transactionsSelector = document.getElementById('transactions-account-selector');
  const recurringSelector = document.getElementById('recurring-account-selector');
  
  dashboardSelector?.addEventListener('change', async () => {
    await fetchTotalBalance(dashboardSelector.value);
    await renderDashboardCharts(dashboardSelector.value);
  });

  transactionsSelector?.addEventListener('change', async () => {
    await fetchTransactions(transactionsSelector.value);
    // Auto-set the account in the add transaction form
    const transactionAccountSelect = document.getElementById('transaction-account');
    if (transactionAccountSelect && transactionsSelector.value !== 'all') {
      transactionAccountSelect.value = transactionsSelector.value;
    }
  });

  recurringSelector?.addEventListener('change', async () => {
    await fetchRecurring(recurringSelector.value);

    const recurringAccountSelect = document.getElementById('recurring-account');
    if (recurringAccountSelect && recurringSelector.value !== 'all') {
      recurringAccountSelect.value = recurringSelector.value;
    }
  });
}

// Window Controls
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add(`platform-${window.electronAPI.platform}`);
  
  const minimizeButton = document.getElementById('minimizeButton');
  const closeButton = document.getElementById('closeButton');
  
  minimizeButton?.addEventListener('click', () => {
    window.electronAPI.minimizeWindow();
  });

  closeButton?.addEventListener('click', () => {
    window.electronAPI.closeWindow();
  });

});

// Fetch and display recurring
async function fetchRecurring(accountId = null) {
  try {
    const typeFilter = document.getElementById('recurring-type-filter')?.value || 'all';
    const categoryFilter = document.getElementById('recurring-category-filter')?.value || 'all';
    const sortBy = document.getElementById('recurring-sort')?.value || 'name-asc';
    
    const { data: recurring, error } = await window.databaseApi.fetchRecurring(accountId);
    if (error) throw error;

    // Apply filters
    let filteredData = recurring;
    if (typeFilter !== 'all') {
      filteredData = filteredData.filter(r => r.type === typeFilter);
    }
    if (categoryFilter !== 'all') {
      filteredData = filteredData.filter(r => r.category_id === parseInt(categoryFilter));
    }

    // Apply sorting
    const [field, direction] = sortBy.split('-');
    filteredData.sort((a, b) => {
      let comparison = 0;
      switch (field) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'amount':
          comparison = parseFloat(a.amount) - parseFloat(b.amount);
          break;
        case 'date':
          comparison = a.billing_date - b.billing_date;
          break;
      }
      return direction === 'asc' ? comparison : -comparison;
    });

    const tableBody = document.getElementById('recurring-table-body');
    tableBody.innerHTML = '';

    if (filteredData && filteredData.length > 0) {
      filteredData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.name}</td>
          <td class="${item.type === 'income' ? 'positive' : 'negative'}">
            $${formatCurrency(item.amount)}
          </td>
          <td>${capitalizeFirstLetter(item.type)}</td>
          <td>${item.category_name || 'Uncategorized'}</td>
          <td>${item.billing_date}</td>
          <td>${item.description || '-'}</td>
          <td>
            <div class="status-btn ${item.is_active ? 'active' : 'inactive'}">
              ${item.is_active ? 'Active' : 'Inactive'}
            </div>
          </td>
          <td>
            <button class="icon-btn edit-btn">
              <i class="fas fa-edit"></i>
            </button>
            <button class="icon-btn delete-btn">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        `;

        // Add event listeners
        row.querySelector('.status-btn').addEventListener('click', () => {
          toggleRecurringStatus(item.id, !item.is_active, item);
        });

        row.querySelector('.edit-btn').addEventListener('click', () => {
          showEditRecurringForm(item);
        });

        row.querySelector('.delete-btn').addEventListener('click', () => {
          confirmDelete('recurring', item.id);
        });

        tableBody.appendChild(row);
      });
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="empty-state">No recurring items found</td>
        </tr>
      `;
    }
  } catch (error) {
    console.error('Error fetching recurring items:', error);
  }
}

async function toggleRecurringStatus(id, newStatus, item) {
  try {
    const status = newStatus ? 1 : 0;
    const updateData = {
      account_id: item.account_id,
      name: item.name,
      amount: item.amount,
      category_id: item.category_id,
      billing_date: item.billing_date,
      description: item.description || '',
      is_active: status,
      type: item.type
    };
    
    const { error } = await window.databaseApi.updateRecurring(id, updateData);
    if (error) throw error;

    // Add null check before accessing value
    const accountSelector = document.getElementById('recurring-account-selector');
    if (!accountSelector) {
      console.error('Account selector element not found');
      return;
    }
    
    await fetchRecurring(accountSelector.value);
    await updateReports();
    await fetchTotalBalance(accountSelector.value);
    await renderDashboardCharts(accountSelector.value);
  } catch (error) {
    console.error('Error toggling recurring status:', error);
  }
}

async function deleteRecurring(id) {
  const accountSelect = document.getElementById('recurring-account-selector');
  try {
    const { error } = await window.databaseApi.deleteRecurring(id);
    if (error) throw error;
    await fetchRecurring(accountSelect.value);
    await updateReports();
    await fetchTotalBalance(accountSelect.value);
    await renderDashboardCharts(accountSelect.value);
  } catch (error) {
    console.error('Error deleting recurring item:', error);
  }
}

async function deleteTransaction(id) {
  try {
    const { error } = await window.databaseApi.deleteTransaction(id);
    if (error) throw error;
    await fetchTransactions();
    await fetchTotalBalance();
    await renderDashboardCharts();
  } catch (error) {
    console.error('Error deleting transaction:', error);
  }
}

// Show/Hide Recurring Form
document.getElementById('show-add-recurring')?.addEventListener('click', () => {
  document.getElementById('add-recurring-card').style.display = 'block';
});

document.getElementById('cancel-add-recurring')?.addEventListener('click', () => {
  document.getElementById('add-recurring-card').style.display = 'none';
  document.getElementById('add-recurring-form').reset();
});

// Add recurring form handler
// Add recurring form submission handler
document.getElementById('add-recurring-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Get all required form elements
  const accountSelect = document.getElementById('add-recurring-account');
  const nameInput = document.getElementById('add-recurring-name');
  const amountInput = document.getElementById('add-recurring-amount');
  const categorySelect = document.getElementById('add-recurring-category');
  const billingDateInput = document.getElementById('add-recurring-billing-date');
  const descriptionInput = document.getElementById('add-recurring-description');
  const typeSelect = document.getElementById('add-recurring-type');

  // Validate that all required elements exist
  if (!accountSelect || !nameInput || !amountInput || !categorySelect || 
      !billingDateInput || !typeSelect) {
    console.error('Required form elements not found');
    return;
  }

  try {
    const recurring = {
      account_id: parseInt(accountSelect.value, 10),  // Convert to integer
      name: nameInput.value.trim(),                   // Ensure string
      amount: parseFloat(amountInput.value),          // Convert to float
      category_id: parseInt(categorySelect.value, 10), // Convert to integer
      billing_date: parseInt(billingDateInput.value, 10), // Convert to integer
      description: (descriptionInput?.value || '').trim(), // Ensure string
      type: typeSelect.value.trim(),                 // Ensure string
      is_active: 1                                   // Use 1 instead of true for SQLite
    };

    // Validate the data types
    if (isNaN(recurring.account_id) || isNaN(recurring.amount) || 
        isNaN(recurring.category_id) || isNaN(recurring.billing_date)) {
      console.error('Invalid numeric values in form');
      return;
    }

    const { error } = await window.databaseApi.addRecurring(recurring);
    
    if (error) {
      console.error('Error adding recurring:', error);
      return;
    }

    // Close modal and reset form
    closeModal('add-recurring-modal');
    e.target.reset();

    // Refresh the recurring transactions list
    await fetchRecurring();
    
    // Update any relevant charts or totals
    await fetchTotalBalance();
    await updateReports();
    await renderDashboardCharts();

  } catch (err) {
    console.error('Error adding recurring transaction:', err);
  }
});

// Add recurring account selector
const recurringSelector = document.getElementById('recurring-account-selector');
if (recurringSelector) {
  recurringSelector.addEventListener('change', async () => {
    await fetchRecurring(recurringSelector.value);
  });
}

async function fetchAndDisplayCategories() {
  const { data, error } = await window.databaseApi.fetchCategories();

  if (error) {
    console.error('Error fetching categories:', error);
    return;
  }

  const categoriesTableBody = document.getElementById('categories-table-body');
  if (!categoriesTableBody) return;
  
  categoriesTableBody.innerHTML = '';

  data.forEach(category => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${category.name}</td>
      <td>${capitalizeFirstLetter(category.type)}</td>
      <td>
        <button class="edit-btn" data-category-id="${category.id}">Edit</button>
        <button class="delete-btn" data-category-id="${category.id}">Delete</button>
      </td>
    `;

    // Add delete button event listener
    const deleteBtn = row.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this category? Associated transactions will become uncategorized.')) {
        const { error: deleteError } = await window.databaseApi.deleteCategory(category.id);
        
        if (deleteError) {
          console.error('Error deleting category:', deleteError);
          return;
        }
        
        // Refresh categories and dropdowns
        await Promise.all([
          fetchAndDisplayCategories(),
          populateCategoryDropdowns()
        ]);
      }
    });

    // Add edit button event listener
    const editBtn = row.querySelector('.edit-btn');
    editBtn.addEventListener('click', async () => {
      // Populate edit modal with category data
      document.getElementById('edit-category-id').value = category.id;
      document.getElementById('edit-category-name').value = category.name;
      document.getElementById('edit-category-type').value = category.type;
      
      // Open the edit modal
      openModal('edit-category-modal');
    });

    categoriesTableBody.appendChild(row);
  });
}

// Add event listener for the edit category form submission
document.getElementById('edit-category-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const categoryId = document.getElementById('edit-category-id').value;
  const updateData = {
    name: document.getElementById('edit-category-name').value.trim(),
    type: document.getElementById('edit-category-type').value
  };

  const { error } = await window.databaseApi.updateCategory(categoryId, updateData);
  if (error) {
    console.error('Error updating category:', error);
    return;
  }

  // Close modal and refresh data
  closeModal('edit-category-modal');
  await Promise.all([
    fetchAndDisplayCategories(),
    populateCategoryDropdowns()
  ]);
  e.target.reset();
});

document.getElementById('add-category-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const newCategory = {
    name: document.getElementById('add-category-name').value.trim(),
    type: document.getElementById('add-category-type').value
  };

  try {
    const { error } = await window.databaseApi.addCategory(newCategory);
    if (error) throw error;

    // Close modal and refresh data
    closeModal('add-category-modal');
    await Promise.all([
      fetchAndDisplayCategories(),
      populateCategoryDropdowns()
    ]);
    e.target.reset();
  } catch (error) {
    console.error('Error adding category:', error);
  }
});

// Update the updateReports function to include recurring
async function updateReports(period = 'month', accountId = 'all') {
  try {
    // Fetch both transactions and recurring
    const [
      { data: transactions, error: txError },
      { data: recurring, error: recError }
    ] = await Promise.all([
      window.databaseApi.fetchTransactions(accountId),
      window.databaseApi.fetchRecurring(accountId)
    ]);

    if (txError) throw txError;
    if (recError) throw recError;

    // Filter transactions based on selected period
    const filteredTransactions = filterTransactionsByPeriod(transactions, period);
    
    // Calculate recurring amounts for the period
    const activeRecurring = recurring.filter(r => r.is_active);
    const recurringExpenses = calculateRecurringForPeriod(
      activeRecurring.filter(r => r.type === 'expense'),
      period
    );
    const recurringIncome = calculateRecurringForPeriod(
      activeRecurring.filter(r => r.type === 'income'),
      period
    );
    
    // Calculate totals
    const transactionIncome = filteredTransactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    const transactionExpenses = filteredTransactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    // Calculate total income and expenses including recurring
    const totalIncome = transactionIncome + recurringIncome;
    const totalExpenses = transactionExpenses + recurringExpenses;
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    // Update statistics
    document.getElementById('reports-total-income').textContent = formatCurrency(totalIncome);
    document.getElementById('reports-total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('reports-net-savings').textContent = formatCurrency(netSavings);
    document.getElementById('reports-savings-rate').textContent = Math.round(savingsRate);
    
    // Update savings value color
    const savingsValueElement = document.getElementById('reports-savings-value');
    savingsValueElement.className = `value ${netSavings >= 0 ? 'positive' : 'negative'}`;

    // Render charts with combined transaction and recurring data
    await Promise.all([
      renderMonthlyComparisonChart(filteredTransactions, activeRecurring),
      renderExpenseCategoriesChart(filteredTransactions, activeRecurring),
      renderTrendChart(filteredTransactions, activeRecurring),
      updateTopSpendingCategories(accountId, period)
    ]);

  } catch (error) {
    console.error('Error updating reports:', error);
  }
}

function calculateRecurringForPeriod(recurringItems, period) {
  // Get number of months in the period
  let monthsInPeriod;
  switch (period) {
    case 'year':
      monthsInPeriod = 12;
      break;
    case 'quarter':
      monthsInPeriod = 3;
      break;
    case 'month':
    default:
      monthsInPeriod = 1;
      break;
  }

  // Sum up recurring amounts and multiply by months in period
  return recurringItems.reduce((sum, item) => 
    sum + (parseFloat(item.amount) * monthsInPeriod), 0);
}

// Update the renderMonthlyComparisonChart function
async function renderMonthlyComparisonChart(transactions, recurring) {
  const months = Array.from({ length: 12 }, (_, i) => {
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

    // Calculate monthly recurring income and expenses separately
    const monthlyRecurringIncome = recurring
      .filter(rec => rec.is_active && rec.type === 'income')
      .reduce((sum, rec) => sum + parseFloat(rec.amount), 0);

    const monthlyRecurringExpenses = recurring
      .filter(rec => rec.is_active && rec.type === 'expense')
      .reduce((sum, rec) => sum + parseFloat(rec.amount), 0);

    // Calculate total income (transactions + recurring)
    const totalIncome = monthTransactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0) + monthlyRecurringIncome;

    // Calculate total expenses (transactions + recurring)
    const totalExpenses = monthTransactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0) + monthlyRecurringExpenses;

    return {
      income: totalIncome,
      expenses: totalExpenses
    };
  });

  const ctx = document.getElementById('monthlyComparisonChart').getContext('2d');
  
  if (monthlyComparisonChartInstance) {
    monthlyComparisonChartInstance.destroy();
  }

  monthlyComparisonChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.name),
      datasets: [
        {
          label: 'Income',
          data: monthlyData.map(d => d.income),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        },
        {
          label: 'Expenses',
          data: monthlyData.map(d => d.expenses),
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      aspectRatio: 2,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Amount ($)'
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: $${formatCurrency(context.raw)}`;
            }
          }
        }
      }
    }
  });
}

async function renderExpenseCategoriesChart() {
  try {
    const { data: categories, error } = await window.databaseApi.getExpenseCategoriesData();
    if (error) throw error;

    const ctx = document.getElementById('expenseCategoriesChart').getContext('2d');
    
    if (expenseCategoriesChartInstance) {
      expenseCategoriesChartInstance.destroy();
    }

    if (!categories || categories.length === 0) {
      ctx.canvas.style.display = 'none';
      return;
    }

    ctx.canvas.style.display = 'block';

    // Generate colors for each category
    const colors = categories.map((_, index) => {
      const hue = (index * 137.508) % 360; // Use golden angle approximation
      return `hsl(${hue}, 70%, 50%)`;
    });

    expenseCategoriesChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: categories.map(cat => cat.category_name),
        datasets: [{
          data: categories.map(cat => cat.total),
          backgroundColor: colors,
          borderColor: 'white',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              generateLabels: function(chart) {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map((label, i) => {
                    const value = data.datasets[0].data[i];
                    const total = data.datasets[0].data.reduce((acc, val) => acc + val, 0);
                    const percentage = ((value / total) * 100).toFixed(1);
                    
                    return {
                      text: `${label} (${percentage}%)`,
                      fillStyle: data.datasets[0].backgroundColor[i],
                      hidden: isNaN(data.datasets[0].data[i]),
                      index: i
                    };
                  });
                }
                return [];
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: $${formatCurrency(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error rendering expense categories chart:', error);
  }
}

async function updateTopSpendingCategories(accountId = 'all') {
  try {
    console.log('Fetching top spending categories for account:', accountId);
    const { data: categories, error } = await window.databaseApi.getTopSpendingCategories(accountId);
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
          <span class="amount negative">$${formatCurrency(Math.abs(category.total))}</span>
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

// Add event listeners for the reports section
document.addEventListener('DOMContentLoaded', () => {
  const reportsAccountSelector = document.getElementById('reports-account-selector');
  const reportsPeriodSelector = document.getElementById('reports-period-selector');

  if (reportsAccountSelector && reportsPeriodSelector) {
    reportsAccountSelector.addEventListener('change', () => {
      updateReports(reportsPeriodSelector.value, reportsAccountSelector.value);
    });

    reportsPeriodSelector.addEventListener('change', () => {
      updateReports(reportsPeriodSelector.value, reportsAccountSelector.value);
    });
  }
});

async function showEditRecurringForm(item) {
  // Populate account dropdown
  const accountSelect = document.getElementById('edit-recurring-account');
  const { data: accounts } = await window.databaseApi.fetchAccounts();
  accountSelect.innerHTML = accounts.map(account => 
    `<option value="${account.id}" ${account.id === item.account_id ? 'selected' : ''}>
      ${account.name}
    </option>`
  ).join('');

  // Populate category dropdown
  const categorySelect = document.getElementById('edit-recurring-category');
  const { data: categories } = await window.databaseApi.fetchCategories();
  categorySelect.innerHTML = categories.map(category => 
    `<option value="${category.id}" ${category.id === item.category_id ? 'selected' : ''}>
      ${capitalizeFirstLetter(category.type)} - ${category.name}
    </option>`
  ).join('');

  // Populate form fields
  document.getElementById('edit-recurring-id').value = item.id;
  document.getElementById('edit-recurring-name').value = item.name;
  document.getElementById('edit-recurring-amount').value = item.amount;
  document.getElementById('edit-recurring-billing-date').value = item.billing_date;
  document.getElementById('edit-recurring-description').value = item.description || '';

  // Open the modal
  openModal('edit-recurring-modal');
}

document.getElementById('cancel-edit-recurring').addEventListener('click', () => {
  closeModal('edit-recurring-modal');
});

document.getElementById('close-edit-recurring').addEventListener('click', () => {
  closeModal('edit-recurring-modal');
});

// Add event listeners for opening modals
document.getElementById('add-transaction-btn').addEventListener('click', () => {
  openModal('add-transaction-modal');
});

// Add event listeners for closing modals
document.getElementById('close-add-transaction').addEventListener('click', () => {
  closeModal('add-transaction-modal');
});

document.getElementById('cancel-add-transaction').addEventListener('click', () => {
  closeModal('add-transaction-modal');
});

// Function to handle clicking outside modal
function handleModalOutsideClick(event) {
  // Only close if clicking specifically on the backdrop
  if (event.target.classList.contains('modal-backdrop')) {
    const modalId = event.target.closest('.modal').id;
    closeModal(modalId);
  }
}

// Update event listeners to target backdrop specifically
document.addEventListener('DOMContentLoaded', () => {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    const backdrop = modal.querySelector('.modal-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', handleModalOutsideClick);
    }
  });
});

// Update form submission handler
document.getElementById('edit-recurring-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Get all required form elements with correct IDs
  const recurringId = document.getElementById('edit-recurring-id')?.value;
  const accountId = document.getElementById('edit-recurring-account')?.value;
  const name = document.getElementById('edit-recurring-name')?.value;
  const amount = document.getElementById('edit-recurring-amount')?.value;
  const categoryId = document.getElementById('edit-recurring-category')?.value;
  const billingDate = document.getElementById('edit-recurring-billing-date')?.value;
  const description = document.getElementById('edit-recurring-description')?.value;

  // Validate required fields
  if (!recurringId || !accountId || !name || !amount || !categoryId || !billingDate) {
    console.error('Missing required fields');
    return;
  }

  // Get category type from selected option - improved parsing
  const categorySelect = document.getElementById('edit-recurring-category');
  const selectedOption = categorySelect?.options[categorySelect.selectedIndex];
  const categoryText = selectedOption?.textContent || '';
  
  // The category format is "Type - Name", so we split and get the type
  const categoryType = categoryText.split('-')[0].trim().toLowerCase();
  
  // Validate that we got a valid type
  if (categoryType !== 'income' && categoryType !== 'expense') {
    console.error('Invalid category type:', categoryType);
    return;
  }
  
  const updateData = {
    account_id: parseInt(accountId),
    name: name.trim(),
    amount: parseFloat(amount),
    category_id: parseInt(categoryId),
    billing_date: parseInt(billingDate),
    description: description?.trim() || '',
    type: categoryType,
    is_active: 1
  };
  
  console.log('Updating recurring with data:', updateData); // Debug log
  
  try {
    const { error } = await window.databaseApi.updateRecurring(recurringId, updateData);
    if (error) throw error;
    
    closeModal('edit-recurring-modal');
    await fetchRecurring(document.getElementById('recurring-account-selector')?.value);
    await updateReports();
    await fetchTotalBalance();
    await renderDashboardCharts();

    e.target.reset();
  } catch (error) {
    console.error('Error updating recurring item:', error);
  }
});

// Add cancel button event listener for edit form
document.getElementById('cancel-edit-recurring')?.addEventListener('click', () => {
  document.getElementById('edit-recurring-card').style.display = 'none';
  document.getElementById('edit-recurring-form').reset();
});

// Add this helper function to filter transactions by period
function filterTransactionsByPeriod(transactions, period) {
  const now = new Date();
  const startDate = new Date();
  
  switch (period) {
    case 'month':
      startDate.setMonth(now.getMonth(), 1);
      break;
    case 'quarter':
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear(), 0, 1);
      break;
    case 'all':
      return transactions;
    default:
      startDate.setMonth(now.getMonth(), 1); // Default to current month
  }
  
  return transactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate >= startDate && txDate <= now;
  });
}

// Add the renderTrendChart function
async function renderTrendChart(transactions, recurring) {
  // Set date range to last 12 months regardless of transaction history
  const maxDate = new Date();
  const minDate = new Date();
  minDate.setMonth(minDate.getMonth() - 11); // Go back 11 months to show 12 months total
  minDate.setDate(1); // Start from beginning of month

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

  // Calculate monthly recurring amounts
  const monthlyRecurringIncome = recurring
    .filter(rec => rec.is_active && rec.type === 'income')
    .reduce((sum, rec) => sum + parseFloat(rec.amount), 0);

  const monthlyRecurringExpenses = recurring
    .filter(rec => rec.is_active && rec.type === 'expense')
    .reduce((sum, rec) => sum + parseFloat(rec.amount), 0);

  // Calculate cumulative totals for each month
  let cumulativeIncome = 0;
  let cumulativeExpenses = 0;
  
  const cumulativeData = months.map((month) => {
    // Get transactions for this month
    const monthTransactions = transactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate.getMonth() === month.month && 
             txDate.getFullYear() === month.year;
    });

    // Calculate transaction totals for this month
    const monthlyTransactionIncome = monthTransactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    const monthlyTransactionExpenses = monthTransactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    // Add both transaction and recurring amounts to cumulative totals
    cumulativeIncome += (monthlyTransactionIncome + monthlyRecurringIncome);
    cumulativeExpenses += (monthlyTransactionExpenses + monthlyRecurringExpenses);

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
      responsive: true,
      aspectRatio: 2,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Cumulative Amount ($)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Month'
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: $${formatCurrency(context.raw)}`;
            }
          }
        }
      }
    }
  });
}

// Add the generateColors helper function
function generateColors(count) {
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

// Add the showEditTransactionForm function
async function showEditTransactionForm(transaction) {
  // Populate account dropdown
  const accountSelect = document.getElementById('edit-transaction-account');
  const { data: accounts } = await window.databaseApi.fetchAccounts();
  accountSelect.innerHTML = accounts.map(account => 
    `<option value="${account.id}" ${account.id === transaction.account_id ? 'selected' : ''}>
      ${account.name}
    </option>`
  ).join('');

  // Populate category dropdown
  const categorySelect = document.getElementById('edit-transaction-category');
  const { data: categories } = await window.databaseApi.fetchCategories();
  categorySelect.innerHTML = categories.map(category => 
    `<option value="${category.id}" ${category.id === transaction.category_id ? 'selected' : ''}>
      ${capitalizeFirstLetter(category.type)} - ${category.name}
    </option>`
  ).join('');

  // Set transaction type
  document.getElementById('edit-transaction-type').value = transaction.type;

  // Populate form fields
  document.getElementById('edit-transaction-id').value = transaction.id;
  document.getElementById('edit-transaction-amount').value = transaction.amount;
  document.getElementById('edit-transaction-date').value = transaction.date;
  document.getElementById('edit-transaction-description').value = transaction.description || '';

  // Show the edit form
  openModal('edit-transaction-modal');
}

// Add event listener for the edit transaction form
document.getElementById('edit-transaction-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const transactionId = document.getElementById('edit-transaction-id').value;
  const updateData = {
    account_id: document.getElementById('edit-transaction-account').value,
    type: document.getElementById('edit-transaction-type').value,
    category_id: document.getElementById('edit-transaction-category').value,
    amount: parseFloat(document.getElementById('edit-transaction-amount').value),
    date: document.getElementById('edit-transaction-date').value,
    description: document.getElementById('edit-transaction-description').value
  };
  
  const { error } = await window.databaseApi.updateTransaction(transactionId, updateData);
  if (error) {
    console.error('Error updating transaction:', error);
  } else {
    closeModal('edit-transaction-modal'); // Use the modal ID instead of trying to access style directly
    await fetchTransactions();
    await fetchTotalBalance();
    await fetchAccounts();
    await renderDashboardCharts();
    e.target.reset();
  }
});

// Add cancel button event listener for edit form
document.getElementById('cancel-edit-transaction')?.addEventListener('click', () => {
  document.getElementById('edit-transaction-card').style.display = 'none';
  document.getElementById('edit-transaction-form').reset();
});



function sortData(data, sortBy) {
  const [field, direction] = sortBy.split('-');
  return [...data].sort((a, b) => {
    let comparison = 0;
    
    switch (field) {
      case 'date':
        comparison = new Date(a.date) - new Date(b.date);
        break;
      case 'amount':
        comparison = parseFloat(a.amount) - parseFloat(b.amount);
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      default:
        return 0;
    }
    
    return direction === 'asc' ? comparison : -comparison;
  });
}

function filterData(data, filters) {
  return data.filter(item => {
    let matches = true;
    
    if (filters.type && filters.type !== 'all') {
      matches = matches && item.type === filters.type;
    }
    
    if (filters.category && filters.category !== 'all') {
      matches = matches && item.category_id === parseInt(filters.category);
    }
    
    return matches;
  });
}


// Add these functions to handle filter/sort changes
function handleTransactionFiltersChange() {
  const accountId = document.getElementById('transaction-account-selector')?.value || 'all';
  fetchTransactions(accountId === 'all' ? null : accountId);
}

function handleRecurringFiltersChange() {
  const accountId = document.getElementById('recurring-account-selector')?.value || 'all';
  fetchRecurring(accountId === 'all' ? null : accountId);
}

// Update the event listeners in DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Transaction filters and sorts
  ['transaction-type-filter', 'transaction-category-filter', 'transaction-sort'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', handleTransactionFiltersChange);
  });
  
  // Recurring filters and sorts
  ['recurring-type-filter', 'recurring-category-filter', 'recurring-sort'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', handleRecurringFiltersChange);
  });
  
  // Category filters and sorts
  ['category-type-filter', 'category-sort'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', fetchCategories);
  });
});

async function handleExport() {
  const { filePath } = await window.electronAPI.showSaveDialog({
      title: 'Export Database',
      defaultPath: 'fyenance.db',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
  });

  if (filePath) {
      const { success, error } = await window.databaseApi.exportDatabase(filePath);
      if (success) {
          alert('Database exported successfully!');
      } else {
          console.error('Error exporting database:', error);
      }
  }
}

async function handleImport() {
  const { filePaths } = await window.electronAPI.showOpenDialog({
      title: 'Import Database',
      filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      properties: ['openFile']
  });

  if (filePaths && filePaths[0]) {
      const { success, error } = await window.databaseApi.importDatabase(filePaths[0]);
      if (success) {
          alert('Database imported successfully!');
          // Refresh data
          await initializeApp();
      } else {
          console.error('Error importing database:', error);
      }
  }
}

document.getElementById('export-btn').addEventListener('click', handleExport);
document.getElementById('import-btn').addEventListener('click', handleImport);


// Function to toggle theme
function toggleTheme() {
  const isDarkMode = document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

// Event listener for the toggle button
document.getElementById('toggle-theme-btn').addEventListener('click', toggleTheme);

// Load theme preference on startup
function loadThemePreference() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }
}

// Call loadThemePreference on DOMContentLoaded
document.addEventListener('DOMContentLoaded', loadThemePreference);


window.addEventListener('DOMContentLoaded', () => {
  // Update version number
  const versionElement = document.getElementById('app-version');
  if (versionElement) {
      versionElement.textContent = window.versions.app;
  }
});


// Update version check function to handle missing APIs
async function checkForUpdates() {
  const updateStatus = document.getElementById('update-status');
  if (!updateStatus) return;

  updateStatus.textContent = 'Checking for updates...';
  
  if (!window.updateApi) {
      updateStatus.textContent = 'Update checking not available';
      return;
  }
  
  try {
      const result = await window.updateApi.checkForUpdates();
      if (result.status === 'development') {
          updateStatus.textContent = 'Updates disabled in development mode';
          return;
      }
  } catch (error) {
      console.error('Error checking for updates:', error);
      updateStatus.textContent = 'Error checking for updates';
  }
}


// Add update message listener
window.updateApi.onUpdateMessage((message) => {
  const updateStatus = document.getElementById('update-status');
  updateStatus.textContent = message;
});

window.updateApi.onUpdateAvailable((info) => {
  const updateStatus = document.getElementById('update-status');
  updateStatus.innerHTML = `
      New version ${info.version} available! 
      <button class="settings-btn" onclick="startUpdate()">
          <i class="fas fa-download"></i>
          Download Update
      </button>
  `;
});

// Add function to start update
async function startUpdate() {
  const updateStatus = document.getElementById('update-status');
  updateStatus.textContent = 'Downloading update...';
  try {
      await window.updateApi.startUpdate();
  } catch (error) {
      console.error('Error starting update:', error);
      updateStatus.textContent = 'Error downloading update';
  }
}

// Compare version numbers (returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal)
function compareVersions(v1, v2) {
  const v1Parts = v1.split('.').map(Number);
  const v2Parts = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
  }
  return 0;
}

// Auto-check for updates on app start
async function checkUpdatesOnStart() {
  // Wait for app to initialize
  setTimeout(async () => {
      try {
          const hasUpdate = await checkForUpdates();
          if (hasUpdate && window.Notification && Notification.permission === "granted") {
              new Notification('Update Available', {
                  body: 'A new version of Fyenance is available!'
              });
          }
      } catch (error) {
          console.error('Error in checkUpdatesOnStart:', error);
      }
  }, 5000); // 5 second delay
}

// Initialize update listeners only if updateApi is available
function initializeUpdateListeners() {
  if (window.updateApi) {
      window.updateApi.onUpdateMessage((message) => {
          const updateStatus = document.getElementById('update-status');
          if (updateStatus) {
              updateStatus.textContent = message;
          }
      });

      window.updateApi.onUpdateAvailable((info) => {
          const updateStatus = document.getElementById('update-status');
          if (updateStatus) {
              updateStatus.innerHTML = `
                  New version ${info.version} available! 
                  <button class="settings-btn" onclick="startUpdate()">
                      <i class="fas fa-download"></i>
                      Download Update
                  </button>
              `;
          }
      });
  }
}

// Update version control initialization
function initializeVersionControl() {
  // Update version number in settings
  const versionElement = document.getElementById('app-version');
  if (versionElement && window.versions) {
      versionElement.textContent = window.versions.app || '1.0.0';
  }

  // Add event listener for check updates button
  const checkUpdatesBtn = document.getElementById('check-updates-btn');
  if (checkUpdatesBtn) {
      checkUpdatesBtn.addEventListener('click', checkForUpdates);
  }

  // Initialize update listeners
  initializeUpdateListeners();

  // Check for updates on app start (if available)
  if (window.updateApi) {
      checkUpdatesOnStart();
  }
}