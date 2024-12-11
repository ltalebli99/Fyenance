// Add these chart instances at the top with other chart variables
let balanceChartInstance;
let incomeExpenseChartInstance;
let monthlyComparisonChartInstance;
let expenseCategoriesChartInstance;
let trendChartInstance;

async function initializeApp() {
  // Start with loader visible, license overlay hidden
  const licenseOverlay = document.getElementById('license-overlay');
  if (licenseOverlay) {
    licenseOverlay.style.display = 'none';
  }

  // Theme initialization
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }

  // Remove preload class
  setTimeout(() => {
    document.body.classList.remove('preload');
  }, 100);

  // Check license while loader is showing
  const hasLicense = await window.licenseApi.checkLicense();
  console.log('License check result:', hasLicense);

  // Handle loader animation
  setTimeout(async () => {
    const loader = document.querySelector('.app-loader');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.remove();
        
        // After loader is gone, show license screen if needed
        if (!hasLicense) {
          console.log('No valid license found, showing overlay');
          licenseOverlay.style.display = 'flex';
          setupLicenseHandlers();
          return; // Stop initialization here if no license
        }
        
        // Continue with app initialization if license is valid
        initializeMainApp();
      }, 0);
    }
  }, 2000);
}

// Separate function for main app initialization
async function initializeMainApp() {
  try {
    // Check if database API is available
    if (!window.databaseApi) {
      throw new Error('Database API not available');
    }

    // Initialize each component with proper error handling
    await Promise.all([
      updateLicenseInfo().catch(err => console.error('Failed to update license info:', err)),
      fetchTotalBalance().catch(err => console.error('Failed to fetch balance:', err)),
      fetchAccounts().catch(err => console.error('Failed to fetch accounts:', err)),
      fetchCategories().catch(err => console.error('Failed to fetch categories:', err)),
      populateAccountDropdowns().catch(err => console.error('Failed to populate dropdowns:', err)),
      populateCategoryDropdowns().catch(err => console.error('Failed to populate category dropdowns:', err)),
      fetchTransactions().catch(err => console.error('Failed to fetch transactions:', err)),
      renderDashboardCharts().catch(err => console.error('Failed to render charts:', err)),
      fetchRecurring().catch(err => console.error('Failed to fetch recurring:', err)),
      updateReports('month', 'all').catch(err => console.error('Failed to update reports:', err)),
      updateBannerData().catch(err => console.error('Failed to update banner data:', err)),
      updateEmptyStates()
    ]);

    const tutorial = new Tutorial();
    await tutorial.start();

  } catch (error) {
    console.error('Failed to initialize app:', error);
    document.body.innerHTML = `
      <div style="padding: 20px; color: red;">
        Error initializing application: ${error.message}<br>
        Please check your database configuration and restart the application.
      </div>
    `;
  }
}


window.onload = () => {
  initializeQuickEntry();
  initializeBulkEntry();
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

    // Calculate base balance from accounts
    let accountBalance;
    if (accountId === 'all') {
      accountBalance = accounts.reduce((acc, account) => acc + parseFloat(account.balance), 0);
    } else {
      const account = accounts.find(acc => acc.id === accountId);
      accountBalance = account ? parseFloat(account.balance) : 0;
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
    const thisMonthsRecurringIncome = recurring
      .filter(r => r.is_active && r.type === 'income')
      .reduce((total, r) => total + parseFloat(r.amount), 0);

    const thisMonthsRecurringExpenses = recurring
      .filter(r => r.is_active && r.type === 'expense')
      .reduce((total, r) => total + parseFloat(r.amount), 0);

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
          <div class="action-buttons">
            <button class="action-btn edit-btn" data-account-id="${account.id}" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
            <button class="action-btn save-btn" data-account-id="${account.id}" style="display: none" title="Save">
              <i class="fas fa-check"></i>
            </button>
            <button class="action-btn delete-btn" data-account-id="${account.id}" title="Delete">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
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
      await updateEmptyStates();
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
      await updateEmptyStates();
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
  const modal = document.getElementById(modalId);
  modal.classList.add('show');
  
  // Disable validation on other forms while this modal is open
  document.querySelectorAll('form').forEach(form => {
    const formModal = form.closest('.modal');
    if (formModal && formModal.id !== modalId) {
      form.setAttribute('novalidate', '');
    }
  });
}


// Function to close modal
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('show');
  
  // Reset form if it exists
  const form = modal.querySelector('form');
  if (form) {
    form.reset();
  }
  
  // Re-enable validation on all forms
  document.querySelectorAll('form').forEach(form => {
    form.removeAttribute('novalidate');
  });
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
        // Fix date parsing by ensuring we use local timezone
        const date = new Date(transaction.date);
        const formattedDate = date.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric',
          timeZone: 'UTC' 
        });

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
            <div class="action-buttons">
              <button class="action-btn edit-btn" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="action-btn delete-btn" title="Delete">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
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
    const usageFilter = document.getElementById('category-usage-filter')?.value || 'all';
    const sortBy = document.getElementById('category-sort')?.value || 'name-asc';
    
    const { data: categories, error } = await window.databaseApi.fetchCategories();
    if (error) throw error;

    // Apply filters
    let filteredData = categories;
    
    if (typeFilter !== 'all') {
      filteredData = filteredData.filter(c => c.type === typeFilter);
    }

    if (usageFilter !== 'all') {
      switch (usageFilter) {
        case 'active':
          filteredData = filteredData.filter(c => c.usage_count > 0);
          break;
        case 'unused':
          filteredData = filteredData.filter(c => c.usage_count === 0);
          break;
      }
    }

    // Apply sorting with proper date handling
    const [field, direction] = sortBy.split('-');
    filteredData.sort((a, b) => {
      let comparison = 0;
      switch (field) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'usage':
          comparison = (a.usage_count || 0) - (b.usage_count || 0);
          break;
        case 'last_used':
          // Handle null/undefined dates and ensure UTC parsing
          const dateA = a.last_used ? new Date(a.last_used) : new Date(0);
          const dateB = b.last_used ? new Date(b.last_used) : new Date(0);
          comparison = dateA - dateB;
          break;
      }
      return direction === 'asc' ? comparison : -comparison;
    });

    const categoriesTableBody = document.getElementById('categories-table-body');
    if (!categoriesTableBody) return;

    categoriesTableBody.innerHTML = '';

    if (filteredData && filteredData.length > 0) {
      filteredData.forEach(category => {
        // Format the date properly for display
        const lastUsedDate = category.last_used 
          ? new Date(category.last_used).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'UTC'
            })
          : 'Never';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${category.name}</td>
          <td>${capitalizeFirstLetter(category.type)}</td>
          <td>${category.usage_count || 0}</td>
          <td>${lastUsedDate}</td>
          <td>
            <div class="action-buttons">
              <button class="action-btn edit-btn" data-category-id="${category.id}" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="action-btn delete-btn" data-category-id="${category.id}" title="Delete">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
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
              fetchCategories(),
              populateCategoryDropdowns(),
              updateEmptyStates()
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
    } else {
      categoriesTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">No categories found</td>
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
    await updateEmptyStates();
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
    await updateEmptyStates();
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
      await updateEmptyStates();
    }
  }
}

// Add Category button click handler
document.getElementById('show-add-category')?.addEventListener('click', () => {
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

  // Calculate daily spending with proper UTC date handling
  const daysInMonth = endDate.getDate();
  const dailyData = new Array(daysInMonth).fill(0);
  
  transactions
    .filter(tx => {
      // Parse date with UTC midnight
      const txDate = new Date(tx.date);
      return txDate >= startDate && 
             txDate <= endDate && 
             tx.type === 'expense';
    })
    .forEach(tx => {
      // Parse date with UTC midnight to get correct day
      const txDate = new Date(tx.date);
      const day = txDate.getUTCDate() - 1;
      dailyData[day] += parseFloat(tx.amount);
    });

  // Check if we have any data
  const hasData = dailyData.some(amount => amount > 0);
  
  // Format date labels in local timezone
  const dateLabels = Array.from({length: dailyData.length}, (_, i) => {
    const date = new Date(startDate.getFullYear(), startDate.getMonth(), i + 1);
    return date.getDate();
  });

  const ctx = canvas.getContext('2d');
  if (balanceChartInstance) balanceChartInstance.destroy();

  balanceChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dateLabels,
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
    const nextMonth = (currentMonth + 1) % 12;
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();

    // Filter recurring expenses that are active and are expenses
    return recurring.filter(expense => {
      if (!expense.is_active || expense.type !== 'expense') return false;

      // If the billing date has already passed this month,
      // we should look at next month's billing date instead
      const expenseMonth = expense.billing_date < currentDay ? nextMonth : currentMonth;
      const expenseYear = expenseMonth === 11 && currentMonth === 0 ? currentYear - 1 : currentYear;
      
      const expenseDate = new Date(expenseYear, expenseMonth, expense.billing_date);
      
      // Get the week boundaries (5 days from today)
      const startOfWeek = new Date(today);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + 4);
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
        return expense.billing_date === currentDate.getDate();
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

async function updateBannerData() {
  try {
    // Get net worth
    const { data: netWorth } = await window.databaseApi.getNetWorth();
    console.log('Net Worth:', netWorth);
    document.getElementById('total-net-worth').textContent = formatCurrency(netWorth || 0);

    // Get monthly comparison
    const { data: monthlyComparison } = await window.databaseApi.getMonthlyComparison();
    console.log('Monthly Comparison:', monthlyComparison);
    
    if (monthlyComparison && typeof monthlyComparison.percentChange === 'number') {
      const trendText = monthlyComparison.trend === 'lower' ? 'lower' : 'higher';
      document.getElementById('monthly-trend').textContent = 
        `Your spending is ${Math.abs(monthlyComparison.percentChange).toFixed(1)}% ${trendText} than last month`;
    } else {
      document.getElementById('monthly-trend').textContent = 
        'No spending comparison available yet';
    }

    // Get upcoming payments
    const { data: upcomingCount } = await window.databaseApi.getUpcomingPayments();
    console.log('Upcoming Payments:', upcomingCount);
    
    if (typeof upcomingCount === 'number') {
      const paymentText = upcomingCount === 1 ? 'payment' : 'payments';
      document.getElementById('upcoming-payments').textContent = 
        `${upcomingCount} recurring ${paymentText} due this week`;
    } else {
      document.getElementById('upcoming-payments').textContent = 
        'No upcoming payments this week';
    }

  } catch (error) {
    console.error('Error updating banner data:', error);
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
    'edit-recurring-account',
    'bulk-entry-account'
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


document.getElementById('add-transaction-btn')?.addEventListener('click', async () => {
  try {
    // Check for accounts first
    const { data: accounts, error: accountsError } = await window.databaseApi.fetchAccounts();
    if (accountsError) throw accountsError;
    
    if (!accounts || accounts.length === 0) {
      showCreateFirstModal('account');
      return;
    }

    // Then check for categories
    const { data: categories, error: categoriesError } = await window.databaseApi.fetchCategories();
    if (categoriesError) throw categoriesError;
    
    if (!categories || categories.length === 0) {
      showCreateFirstModal('category');
      return;
    }

    // If we have both, populate dropdowns and show modal
    await populateAccountDropdowns();
    await populateCategoryDropdowns();
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('add-transaction-date').value = today;
    
    openModal('add-transaction-modal');
  } catch (error) {
    console.error('Error checking accounts/categories:', error);
    showError('An error occurred. Please try again.');
  }
});

function showCreateFirstModal(type) {
  // Close the transaction modal if it's open
  closeModal('add-transaction-modal');
  
  const messages = {
    account: {
      title: 'No Accounts Found',
      message: 'You need to create an account before adding transactions.',
      action: 'Create Account',
      section: 'Accounts',
      icon: 'fa-wallet'
    },
    category: {
      title: 'No Categories Found',
      message: 'You need to create some categories before adding transactions.',
      action: 'Create Category',
      section: 'Categories',
      icon: 'fa-tags'
    }
  };

  const modal = document.createElement('div');
  modal.className = 'modal show first-item-modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <div class="modal-icon">
        <i class="fas ${messages[type].icon}"></i>
      </div>
      <h3>${messages[type].title}</h3>
      <p>${messages[type].message}</p>
      <div class="form-actions">
        <button type="button" class="primary-btn" id="goto-${type}-btn">
          <i class="fas fa-plus"></i>
          ${messages[type].action}
        </button>
        <button type="button" class="secondary-btn" id="cancel-first-${type}">
          Cancel
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Rest of the event listeners remain the same...
  modal.querySelector(`#goto-${type}-btn`).addEventListener('click', () => {
    document.body.removeChild(modal);
    
    const tabButton = document.querySelector(`button[data-section="${messages[type].section}"]`);
    if (tabButton) {
      const syntheticEvent = { currentTarget: tabButton };
      openSection(syntheticEvent, messages[type].section);
      if (type === 'account') {
        document.getElementById('show-add-account').click();
      } else if (type === 'category') {
        document.getElementById('show-add-category').click();
      }
    }
  });

  modal.querySelector(`#cancel-first-${type}`).addEventListener('click', () => {
    document.body.removeChild(modal);
  });
}

// Add event listener for the first account button
document.getElementById('add-first-account-btn')?.addEventListener('click', (e) => {
  // Find the Accounts tab button
  const accountsTab = document.querySelector('button[data-section="Accounts"]');
  if (accountsTab) {
    // Call openSection with the event and section name
    openSection({ currentTarget: accountsTab }, 'Accounts');
    // Then trigger the add account modal
    document.getElementById('show-add-account')?.click();
  }
});

document.getElementById('add-recurring-btn')?.addEventListener('click', async () => {
  try {
    // Check for accounts first
    const { data: accounts, error: accountsError } = await window.databaseApi.fetchAccounts();
    if (accountsError) throw accountsError;
    
    if (!accounts || accounts.length === 0) {
      showCreateFirstModal('account');
      return;
    }

    // Then check for categories
    const { data: categories, error: categoriesError } = await window.databaseApi.fetchCategories();
    if (categoriesError) throw categoriesError;
    
    if (!categories || categories.length === 0) {
      showCreateFirstModal('category');
      return;
    }

    // If we have both, populate dropdowns and show modal
    await populateAccountDropdowns();
    await populateCategoryDropdowns();
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('add-recurring-billing-date').value = today;
    
    openModal('add-recurring-modal');
  } catch (error) {
    console.error('Error checking accounts/categories:', error);
    showError('An error occurred. Please try again.');
  }
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
  
  // Also update the type dropdown to show the correct value
  const typeSelect = document.getElementById('edit-category-type');
  typeSelect.value = category.type;
  
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
      'edit-recurring-category',
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

async function populateBulkEntryDropdowns() {
  const { data: categories } = await window.databaseApi.fetchCategories();
  // Populate bulk entry dropdown
  const bulkEntryCategories = document.querySelectorAll('.category-select');
  bulkEntryCategories.forEach(dropdown => {
    dropdown.innerHTML = `
      <option value="">Select Category</option>
      ${categories.map(category => 
        `<option value="${category.id}">${capitalizeFirstLetter(category.type)} - ${category.name}</option>`
      ).join('')}
    `;
  });
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
            <div class="action-buttons">
              <button class="action-btn edit-btn" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="action-btn delete-btn" title="Delete">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
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
    await updateEmptyStates();
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
    await updateEmptyStates();
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
    await updateEmptyStates();

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
    fetchCategories(),
    populateCategoryDropdowns(),
    updateEmptyStates()
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
      fetchCategories(),
      populateCategoryDropdowns(),
      updateEmptyStates()
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

    console.log('All transactions:', transactions);

    // Filter transactions based on selected period
    const filteredTransactions = filterTransactionsByPeriod(transactions, period);
    console.log('Filtered transactions for period:', filteredTransactions);
    
    // Get active recurring items
    const activeRecurring = recurring.filter(r => r.is_active);
    console.log('Active recurring items:', activeRecurring);
    
    // Calculate one-time transactions
    const expenseTransactions = filteredTransactions.filter(tx => tx.type === 'expense');
    console.log('Expense transactions:', expenseTransactions);
    
    const oneTimeIncome = filteredTransactions
      .filter(tx => tx.type === 'income')
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    const oneTimeExpenses = expenseTransactions
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
    
    console.log('One-time expenses calculation:', {
      expenseTransactions: expenseTransactions.map(tx => ({
        amount: tx.amount,
        date: tx.date,
        type: tx.type
      })),
      total: oneTimeExpenses
    });
    
    // Calculate recurring amounts for the period
    const recurringExpenses = calculateRecurringForPeriod(
      activeRecurring.filter(r => r.type === 'expense'),
      period
    );
    const recurringIncome = calculateRecurringForPeriod(
      activeRecurring.filter(r => r.type === 'income'),
      period
    );

    console.log('Detailed Report Calculations:', {
      oneTimeIncome,
      recurringIncome,
      oneTimeExpenses,
      recurringExpenses,
      period,
      accountId
    });
    
    // Calculate total income and expenses including both one-time and recurring
    const totalIncome = oneTimeIncome + recurringIncome;
    const totalExpenses = oneTimeExpenses + recurringExpenses;
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
  
  // Set the type value
  const typeSelect = document.getElementById('edit-recurring-type');
  if (typeSelect) {
    typeSelect.value = item.type;
  }

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
    await updateEmptyStates();

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
  let endDate = new Date();
  
  switch (period) {
    case 'month':
      startDate.setMonth(now.getMonth(), 1); // First day of current month
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
      break;
    case 'quarter':
      startDate.setMonth(now.getMonth() - 3);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear(), 0, 1); // First day of current year
      endDate.setFullYear(now.getFullYear(), 11, 31); // Last day of current year
      break;
    case 'all':
      return transactions;
    default:
      startDate.setMonth(now.getMonth(), 1); // Default to current month
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  
  return transactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate >= startDate && txDate <= endDate;
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
    await fetchCategories();
    await fetchAccounts();
    await renderDashboardCharts();
    await updateEmptyStates();
    e.target.reset();
  }
});

// Add cancel button event listener for edit form
document.getElementById('cancel-edit-transaction')?.addEventListener('click', () => {
  document.getElementById('edit-transaction-card').style.display = 'none';
  document.getElementById('edit-transaction-form').reset();
});

// Advanced Filters Panel Functionality
// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Get all filter buttons and panels
  const filterButtons = document.querySelectorAll('.advanced-filters-btn');
  const filterPanels = document.querySelectorAll('.advanced-filters-panel');

  // Update filter button click handlers
  filterButtons.forEach(button => {
      button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const targetPanelId = button.dataset.target;
          const targetPanel = document.getElementById(targetPanelId);
          
          if (targetPanel) {
              // Position panel before showing it
              positionFilterPanel(button, targetPanel);
              
              // Close other panels
              filterPanels.forEach(panel => {
                  if (panel.id !== targetPanelId) {
                      panel.classList.remove('active');
                  }
              });
              
              // Toggle target panel
              targetPanel.classList.toggle('active');
          }
      });
  });

  // Add window resize handler
  window.addEventListener('resize', () => {
      // Reposition any visible panels
      filterPanels.forEach(panel => {
          if (panel.classList.contains('active')) {
              // Find the associated button
              const buttonId = panel.id.replace('-filters', '');
              const button = document.querySelector(`[data-target="${panel.id}"]`);
              if (button) {
                  positionFilterPanel(button, panel);
              }
          }
      });
  });

  // Handle clicking outside panels to close them
  document.addEventListener('click', (e) => {
      if (!e.target.closest('.advanced-filters-panel') && 
          !e.target.closest('.advanced-filters-btn')) {
          filterPanels.forEach(panel => {
              panel.classList.remove('active');
          });
      }
  });

  // Close panel when close button is clicked
  document.querySelectorAll('.close-filters').forEach(button => {
      button.addEventListener('click', () => {
          const panel = button.closest('.advanced-filters-panel');
          if (panel) {
              panel.classList.remove('active');
          }
      });
  });
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

function positionFilterPanel(button, panel) {
  const buttonRect = button.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  
  // Calculate left position
  let leftPosition = buttonRect.right - 300; // Default position (300px is panel width)
  
  // Check if panel would go off-screen to the left
  if (leftPosition < 10) {
      leftPosition = 10;
  }
  
  // Check if panel would go off-screen to the right
  if (leftPosition + 300 > windowWidth - 10) {
      leftPosition = windowWidth - 310; // 300px width + 10px margin
  }
  
  // Position panel
  panel.style.top = `${buttonRect.bottom + 5}px`;
  panel.style.left = `${leftPosition}px`;
}

// Filtering function (updated to include search)
function filterData(data, filters) {
  return data.filter(item => {
      let matches = true;
      
      // Type filter
      if (filters.type && filters.type !== 'all') {
          matches = matches && item.type === filters.type;
      }
      
      // Category filter
      if (filters.category && filters.category !== 'all') {
          matches = matches && item.category_id === parseInt(filters.category);
      }
      
      // Search filter
      if (filters.search) {
          const searchTerm = filters.search.toLowerCase();
          const searchableFields = [
              item.name,
              item.description,
              item.type,
              item.amount.toString()
          ].filter(Boolean); // Remove null/undefined values
          
          matches = matches && searchableFields.some(field => 
              field.toLowerCase().includes(searchTerm)
          );
      }
      
      return matches;
  });
}

// Reset filters function
function resetFilters(section) {
  const panel = document.getElementById(`${section}-filters`);
  const selects = panel.querySelectorAll('select');
  
  // Reset all select elements to their first option
  selects.forEach(select => {
      select.selectedIndex = 0;
  });

  // Reset search input
  const searchInput = document.querySelector(`#${section} .search-input`);
  if (searchInput) {
      searchInput.value = '';
  }

  // Trigger appropriate fetch based on section
  switch(section) {
      case 'transactions':
          handleTransactionFiltersChange();
          break;
      case 'recurring':
          handleRecurringFiltersChange();
          break;
      case 'categories':
          fetchCategories();
          break;
  }
}

// Apply filters function
function applyFilters(section) {
  const panel = document.getElementById(`${section}-filters`);
  
  // Close the filter panel
  panel.classList.remove('active');

  // Trigger appropriate fetch based on section
  switch(section) {
      case 'transactions':
          handleTransactionFiltersChange();
          break;
      case 'recurring':
          handleRecurringFiltersChange();
          break;
      case 'categories':
          fetchCategories();
          break;
  }
}

// Add debounced search functionality
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
      const later = () => {
          clearTimeout(timeout);
          func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
  };
}

// Add search event listeners
document.querySelectorAll('.search-input').forEach(input => {
  const section = input.closest('.section').id.toLowerCase();
  input.addEventListener('input', debounce(() => {
      switch(section) {
          case 'transactions':
              handleTransactionFiltersChange();
              break;
          case 'recurring':
              handleRecurringFiltersChange();
              break;
          case 'categories':
              fetchCategories();
              break;
      }
  }, 300)); // 300ms debounce delay
});


// Update existing handler functions to include search term
function handleTransactionFiltersChange() {
  const accountId = document.getElementById('transaction-account-selector')?.value || 'all';
  const searchTerm = document.querySelector('#Transactions .search-input')?.value || '';
  fetchTransactions(accountId === 'all' ? null : accountId, searchTerm);
}

function handleRecurringFiltersChange() {
  const accountId = document.getElementById('recurring-account-selector')?.value || 'all';
  const searchTerm = document.querySelector('#Recurring .search-input')?.value || '';
  fetchRecurring(accountId === 'all' ? null : accountId, searchTerm);
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
      try {
          const { success, error } = await window.databaseApi.importDatabase(filePaths[0]);
          if (success) {
              alert('Database imported successfully! The application will now restart.');
              window.electronAPI.relaunchApp();
          } else {
              console.error('Error importing database:', error);
              alert(`Error importing database: ${error.message || error}`);
          }
      } catch (err) {
          console.error('Unexpected error during import:', err);
          alert(`Unexpected error during import: ${err.message || err}`);
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


// Update-related code
async function checkForUpdates() {
  const updateStatus = document.getElementById('update-status');
  const checkUpdatesBtn = document.getElementById('check-updates-btn');
  const startUpdateBtn = document.getElementById('start-update-btn');
  
  if (!updateStatus || !checkUpdatesBtn) return;

  try {
      // Disable button and show checking status
      checkUpdatesBtn.disabled = true;
      updateStatus.textContent = 'Checking for updates...';
      startUpdateBtn.style.display = 'none';
      
      // Check for updates
      const currentVersion = await window.versions.app();
      const updateCheck = await window.updateApi.checkForUpdates();
      
      // Re-enable button
      checkUpdatesBtn.disabled = false;

      if (!updateCheck) {
          updateStatus.textContent = 'You are using the latest version.';
      }
  } catch (error) {
      console.error('Error checking for updates:', error);
      updateStatus.textContent = 'Error checking for updates. Please try again later.';
      checkUpdatesBtn.disabled = false;
  }
}

// Handle update available
window.updateApi.onUpdateAvailable((info) => {
  const updateStatus = document.getElementById('update-status');
  const startUpdateBtn = document.getElementById('start-update-btn');
  
  if (updateStatus && startUpdateBtn) {
      updateStatus.textContent = `New version ${info.version} available!`;
      startUpdateBtn.style.display = 'block';
  }
});

// Handle update messages
window.updateApi.onUpdateMessage((message) => {
  const updateStatus = document.getElementById('update-status');
  if (updateStatus) {
      updateStatus.textContent = message;
  }
});

// Start update process
async function startUpdate() {
  const updateStatus = document.getElementById('update-status');
  const startUpdateBtn = document.getElementById('start-update-btn');
  
  if (!updateStatus || !startUpdateBtn) return;

  try {
      updateStatus.textContent = 'Starting download...';
      startUpdateBtn.style.display = 'none';
      await window.updateApi.startUpdate();
  } catch (error) {
      console.error('Error starting update:', error);
      updateStatus.textContent = 'Error downloading update. Please try again later.';
      startUpdateBtn.style.display = 'block';
  }
}

// Initialize version control
function initializeVersionControl() {
  // Set version number
  window.versions.app().then(version => {
      const versionElement = document.getElementById('app-version');
      if (versionElement) {
          versionElement.textContent = version;
      }
  }).catch(err => {
      console.error('Error getting app version:', err);
      const versionElement = document.getElementById('app-version');
      if (versionElement) {
          versionElement.textContent = 'Unknown';
      }
  });

  // Add event listeners
  const checkUpdatesBtn = document.getElementById('check-updates-btn');
  const startUpdateBtn = document.getElementById('start-update-btn');

  if (checkUpdatesBtn) {
      checkUpdatesBtn.addEventListener('click', checkForUpdates);
  }

  if (startUpdateBtn) {
      startUpdateBtn.addEventListener('click', startUpdate);
  }

  // Check for updates after a delay
  setTimeout(checkForUpdates, 5000);
}

// Call this in your existing DOMContentLoaded or tab switch handler
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('Settings').classList.contains('active')) {
      initializeVersionControl();
  }
});

// Add this to your tab switching logic
function onTabChange(activeSection) {
  if (activeSection === 'Settings') {
      initializeVersionControl();
  }
}



function setupLicenseHandlers() {
  const activateBtn = document.getElementById('activate-btn');
  const licenseInput = document.getElementById('license-key-input');
  const purchaseLink = document.getElementById('purchase-link');

  if (activateBtn) {
    activateBtn.addEventListener('click', async () => {
      const licenseKey = licenseInput.value.trim().toUpperCase();
      if (!licenseKey) {
        showLicenseMessage('Please enter a license key', 'error');
        return;
      }
  
      try {
        activateBtn.disabled = true;
        activateBtn.textContent = 'Validating...';
        
        const result = await window.licenseApi.validateLicense(licenseKey);
        
        if (result.valid) {
          showLicenseMessage('License activated successfully!', 'success');
          setTimeout(() => {
            document.getElementById('license-overlay').style.display = 'none';
            // Force a complete page reload
            window.location.reload();
          }, 1500);
        } else {
          showLicenseMessage(result.error || 'Invalid license key', 'error');
        }
      } catch (error) {
        showLicenseMessage('Error validating license', 'error');
      } finally {
        activateBtn.disabled = false;
        activateBtn.textContent = 'Activate License';
      }
    });
  }

  if (purchaseLink) {
    purchaseLink.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Purchase link clicked');
      
      // Debug logs
      console.log('electronAPI available:', !!window.electronAPI);
      console.log('openExternal available:', !!window.electronAPI?.openExternal);
      
      try {
        await window.electronAPI.openExternal('https://www.fyenanceapp.com/buy');
        console.log('Link opened successfully');
      } catch (error) {
        console.error('Error opening link:', error);
      }
    });
  }

  // Format license key input
  if (licenseInput) {
    licenseInput.addEventListener('input', (e) => {
      // Allow both letters and numbers, convert to uppercase
      let value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (value.length > 16) value = value.slice(0, 16);
      
      // Add dashes
      const parts = [];
      for (let i = 0; i < value.length; i += 4) {
        parts.push(value.slice(i, i + 4));
      }
      e.target.value = parts.join('-');
    });
  }



  // Format license key input
  licenseInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase();
    if (value.length > 16) value = value.slice(0, 16);
    
    // Add dashes
    const parts = [];
    for (let i = 0; i < value.length; i += 4) {
      parts.push(value.slice(i, i + 4));
    }
    e.target.value = parts.join('-');
  });
}

async function updateLicenseInfo() {
  try {
    console.log('Fetching license info...'); // Debug log
    const licenseInfo = await window.licenseApi.getLicenseInfo();
    console.log('Received license info:', licenseInfo); // Debug log
    
    if (licenseInfo) {
      const statusElement = document.querySelector('.license-status');
      const keyElement = document.getElementById('current-license-key');
      const dateElement = document.getElementById('license-activation-date');
      
      console.log('Updating DOM elements with:', { // Debug log
        status: 'Active',
        key: licenseInfo.key,
        date: licenseInfo.activatedAt
      });
      
      if (statusElement) {
        statusElement.textContent = 'Active';
        statusElement.classList.add('active');
      }
      if (keyElement) keyElement.textContent = licenseInfo.key;
      if (dateElement) {
        const activationDate = new Date(licenseInfo.activatedAt);
        dateElement.textContent = activationDate.toLocaleDateString();
      }
    } else {
      console.log('No license info found'); // Debug log
      const statusElement = document.querySelector('.license-status');
      if (statusElement) {
        statusElement.textContent = 'Inactive';
        statusElement.classList.remove('active');
      }
    }
  } catch (error) {
    console.error('Error updating license info:', error);
  }
}

function showLicenseMessage(message, type) {
  const statusMessage = document.getElementById('license-status-message');
  statusMessage.textContent = message;
  statusMessage.className = type;
}

async function clearLicense() {
  try {
    await window.licenseApi.clearLicense();
    window.location.reload(); 
  } catch (error) {
    console.error('Failed to clear license:', error);
  }
}

document.getElementById('clear-license-btn')?.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear the license? This will require reactivation.')) {
    await clearLicense();
  }
});

document.getElementById('close-license-btn').addEventListener('click', () => {
  window.electronAPI.closeWindow();
});


document.getElementById('delete-db-btn').addEventListener('click', () => {
  openModal('delete-db-modal');
});

document.getElementById('close-delete-db').addEventListener('click', () => {
  closeModal('delete-db-modal');
});

document.getElementById('cancel-delete-db').addEventListener('click', () => {
  closeModal('delete-db-modal');
});

// Handle the confirmation input
document.getElementById('delete-db-confirm').addEventListener('input', (e) => {
  const confirmBtn = document.getElementById('confirm-delete-db');
  confirmBtn.disabled = e.target.value !== 'DELETE';
});

// Handle the delete confirmation
document.getElementById('confirm-delete-db').addEventListener('click', async () => {
  try {
      const { success, error } = await window.databaseApi.deleteDatabase();
      if (success) {
          closeModal('delete-db-modal');
          alert('Database has been deleted. The application will now restart.');
          window.electronAPI.relaunchApp();
      } else {
          alert(`Failed to delete database: ${error}`);
      }
  } catch (error) {
      console.error('Error deleting database:', error);
      alert('An error occurred while deleting the database.');
  }
});


// Add this function to handle CSV export
async function handleCSVExport() {
  try {
      const { filePaths, canceled } = await window.electronAPI.showFolderDialog();
      
      if (canceled || !filePaths[0]) return;

      const { success, error } = await window.databaseApi.exportCSV(filePaths[0]);
      
      if (success) {
          alert('Data exported successfully to CSV files!');
      } else {
          console.error('Error exporting CSV:', error);
          alert('Failed to export CSV files. Please check the console for details.');
      }
  } catch (error) {
      console.error('CSV export error:', error);
      alert('An error occurred while exporting CSV files.');
  }
}

// Add event listener for the CSV export button
document.getElementById('export-csv-btn').addEventListener('click', handleCSVExport);


// Add template-related functions
async function saveAsTemplate() {
  const accountId = document.getElementById('add-transaction-account').value;
  const type = document.getElementById('add-transaction-type').value;
  const categoryId = document.getElementById('add-transaction-category').value;
  const amount = document.getElementById('add-transaction-amount').value;
  const description = document.getElementById('add-transaction-description').value;

  if (!accountId || !type || !categoryId) {
    showError('Please fill in the required fields first');
    return;
  }

  // Show template name modal
  openModal('save-template-modal');
  
  // Set up one-time event listener for the save button
  const handleSave = async () => {
    const templateName = document.getElementById('template-name-input').value.trim();
    if (!templateName) {
      showError('Please enter a template name');
      return;
    }

    try {
      const { error } = await window.databaseApi.addTemplate({
        name: templateName,
        account_id: accountId,
        type,
        category_id: categoryId,
        amount: amount || null,
        description: description || ''
      });

      if (error) throw error;
      
      closeModal('save-template-modal');
      document.getElementById('template-name-input').value = '';
      await loadTemplates();
      showSuccess('Template saved successfully!');
    } catch (error) {
      console.error('Error saving template:', error);
      showError('Failed to save template');
    }
  };

  // Set up event listeners for the template name modal
  const saveBtn = document.getElementById('save-template-confirm');
  const cancelBtn = document.getElementById('cancel-save-template');
  const closeBtn = document.getElementById('close-save-template');

  saveBtn.onclick = handleSave;
  cancelBtn.onclick = () => closeModal('save-template-modal');
  closeBtn.onclick = () => closeModal('save-template-modal');
}

async function loadTemplates() {
  try {
    const { data: templates, error } = await window.databaseApi.fetchTemplates();
    if (error) throw error;

    const templatesList = document.getElementById('templates-list');
    templatesList.innerHTML = '';

    if (!templates || templates.length === 0) {
      templatesList.innerHTML = '<div class="empty-state">No saved templates</div>';
      return;
    }

    templates.forEach(template => {
      const item = document.createElement('div');
      item.className = 'template-item';
      item.innerHTML = `
        <span class="template-name">${template.name}</span>
        <div class="template-actions">
          <button class="use-template" title="Use Template">
            <i class="fas fa-play"></i>
          </button>
          <button class="delete-template" title="Delete Template">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;

      item.querySelector('.use-template').addEventListener('click', () => {
        useTemplate(template);
      });

      item.querySelector('.delete-template').addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this template?')) {
          const { error } = await window.databaseApi.deleteTemplate(template.id);
          if (error) {
            showError('Failed to delete template');
          } else {
            await loadTemplates();
            showSuccess('Template deleted');
          }
        }
      });

      templatesList.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading templates:', error);
    showError('Failed to load templates');
  }
}

function useTemplate(template) {
  // Fill in the transaction form with template data
  document.getElementById('add-transaction-account').value = template.account_id;
  document.getElementById('add-transaction-type').value = template.type;
  document.getElementById('add-transaction-category').value = template.category_id;
  if (template.amount) {
    document.getElementById('add-transaction-amount').value = template.amount;
  }
  if (template.description) {
    document.getElementById('add-transaction-description').value = template.description;
  }
}

// Add to your initialization code
document.getElementById('save-as-template')?.addEventListener('click', saveAsTemplate);
document.addEventListener('DOMContentLoaded', () => {
  loadTemplates();
});


async function updateEmptyStates() {
  try {
      const { data: emptyStates } = await window.databaseApi.checkEmptyStates();
      
      if (emptyStates) {
          // Dashboard uses accounts data
          toggleEmptyState('dashboard-empty-state', emptyStates.accounts);
          toggleContent('dashboard-content', !emptyStates.accounts);

          // Other sections
          toggleEmptyState('accounts-empty-state', emptyStates.accounts);
          toggleContent('accounts-content', !emptyStates.accounts);

          toggleEmptyState('transactions-empty-state', emptyStates.transactions);
          toggleContent('transactions-content', !emptyStates.transactions);

          toggleEmptyState('categories-empty-state', emptyStates.categories);
          toggleContent('categories-content', !emptyStates.categories);

          toggleEmptyState('recurring-empty-state', emptyStates.recurring);
          toggleContent('recurring-content', !emptyStates.recurring);
      }
  } catch (error) {
      console.error('Error updating empty states:', error);
  }
}

function toggleEmptyState(elementId, isEmpty) {
  const element = document.getElementById(elementId);
  if (element) {
      element.style.display = isEmpty ? 'flex' : 'none';
  }
}

function toggleContent(elementId, show) {
  const element = document.getElementById(elementId);
  if (element) {
      element.style.display = show ? 'block' : 'none';
  }
}

function showError(message) {
  // Create temporary popup element
  const popup = document.createElement('div');
  popup.className = 'error-popup';
  popup.textContent = message;

  // Add to document
  document.body.appendChild(popup);

  // Show with animation
  setTimeout(() => popup.classList.add('show'), 10);

  // Remove after delay
  setTimeout(() => {
    popup.classList.remove('show');
    setTimeout(() => document.body.removeChild(popup), 300);
  }, 3000);
}


// Natural Language Parser
class TransactionParser {
  static parse(input) {
    const regex = /^(\d+\.?\d*|\.\d+)\s+(.+)$/;
    const match = input.trim().match(regex);
    
    if (!match) return null;
    
    const [_, amount, description] = match;
    const parsedAmount = parseFloat(amount);
    
    // Default to expense type
    const type = 'expense';
    
    return {
      amount: parsedAmount,
      description: description.trim(),
      type,
      date: new Date().toISOString().split('T')[0]
    };
  }
}

// Quick Entry Handler
function initializeQuickEntry() {
  const quickEntryInput = document.getElementById('quick-entry-input');
  
  quickEntryInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const parsed = TransactionParser.parse(e.target.value);
      if (!parsed) {
        showError('Invalid format. Please use "amount description"');
        return;
      }
      
      // Get the first available account
      const { data: accounts } = await window.databaseApi.fetchAccounts();
      if (!accounts || accounts.length === 0) {
        showError('Please add an account first');
        return;
      }
      
      // Try to match category based on description
      const { data: categories } = await window.databaseApi.fetchCategories();
      const matchedCategory = categories.find(cat => 
        parsed.description.toLowerCase().includes(cat.name.toLowerCase())
      );
      
      const transaction = {
        account_id: accounts[0].id,
        category_id: matchedCategory?.id || null,
        type: parsed.type,
        amount: parsed.amount,
        date: parsed.date,
        description: parsed.description
      };
      
      const { error } = await window.databaseApi.addTransaction(transaction);
      
      if (error) {
        showError('Failed to add transaction');
        return;
      }
      
      // Clear input and refresh
      e.target.value = '';
      await fetchTransactions();
      await fetchTotalBalance();
      await renderDashboardCharts();
      await updateEmptyStates();
    }
  });
}

// Bulk Entry Handler
function initializeBulkEntry() {
  const showBulkEntryBtn = document.getElementById('show-bulk-entry');
  const bulkEntryModal = document.getElementById('bulk-entry-modal');
  const closeBulkEntry = document.getElementById('close-bulk-entry');
  const addRowBtn = document.getElementById('bulk-entry-add-row');
  const submitBtn = document.getElementById('bulk-entry-submit');
  const tbody = document.getElementById('bulk-entry-tbody');
  
  showBulkEntryBtn.addEventListener('click', () => {
    openModal('bulk-entry-modal');
    addBulkEntryRow(); // Add first row automatically
  });
  
  closeBulkEntry.addEventListener('click', () => {
    closeModal('bulk-entry-modal');
    tbody.innerHTML = '';
  });
  
  addRowBtn.addEventListener('click', addBulkEntryRow);
  
  submitBtn.addEventListener('click', async () => {
    const rows = tbody.querySelectorAll('tr');
    const transactions = [];
    
    for (const row of rows) {
      const inputs = row.querySelectorAll('input, select');
      const transaction = {
        date: inputs[0].value,
        amount: parseFloat(inputs[1].value),
        type: inputs[2].value,
        category_id: inputs[3].value,
        description: inputs[4].value,
        account_id: document.getElementById('bulk-entry-account').value
      };
      
      if (transaction.date && transaction.amount && !isNaN(transaction.amount)) {
        transactions.push(transaction);
      }
    }
    
    // Add all transactions
    for (const transaction of transactions) {
      await window.databaseApi.addTransaction(transaction);
    }
    
    // Refresh everything
    await fetchTransactions();
    await fetchTotalBalance();
    await renderDashboardCharts();
    await updateEmptyStates();
    
    closeModal('bulk-entry-modal');
    tbody.innerHTML = '';
  });
}

function addBulkEntryRow() {
  const tbody = document.getElementById('bulk-entry-tbody');
  const row = document.createElement('tr');
  
  row.innerHTML = `
    <td><input type="date" value="${new Date().toISOString().split('T')[0]}"></td>
    <td><input type="number" step="0.01" placeholder="0.00"></td>
    <td>
      <select>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </select>
    </td>
    <td>
      <select class="category-select" id="bulk-entry-category">
        <!-- Categories will be populated dynamically -->
      </select>
    </td>
    <td><input type="text" placeholder="Description"></td>
    <td>
      <button class="action-btn delete-btn" onclick="this.closest('tr').remove()">
        <i class="fas fa-trash-alt"></i>
      </button>
    </td>
  `;
  
  tbody.appendChild(row);
  populateBulkEntryDropdowns();
}
