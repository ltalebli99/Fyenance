import { formatCurrency, capitalizeFirstLetter, formatDateForInput, getAmountValue } from '../utils/formatters.js';
import { fetchTransactions } from '../services/transactionsService.js';
import { openSection, openModal, closeModal, showError } from '../utils/utils.js';
import { populateAccountDropdowns, populateCategoryDropdowns, populateProjectDropdowns } from '../utils/dropdownHelpers.js';
import { filterData, sortData } from './filters.js';
import { showCreateFirstModal } from '../utils/modals.js';
import { positionFilterPanel, debounce } from '../utils/filters.js';
import { refreshData } from '../utils/refresh.js';
import { TablePagination } from '../utils/pagination.js';

let transactionsPagination;

// Show/Hide Transaction Form
document.getElementById('show-add-transaction')?.addEventListener('click', () => {
    document.getElementById('add-transaction-card').style.display = 'block';
  });
  
  document.getElementById('cancel-add-transaction')?.addEventListener('click', () => {
    document.getElementById('add-transaction-card').style.display = 'none';
    document.getElementById('add-transaction-form').reset();
  });

  // Event listener for closing the edit transaction modal
document.getElementById('close-edit-transaction').addEventListener('click', () => {
    closeModal('edit-transaction-modal');
  });
  
  // Ensure the cancel button also closes the modal
  document.getElementById('cancel-edit-transaction').addEventListener('click', () => {
    closeModal('edit-transaction-modal');
  });
  

// Add Transaction Form Submission
export const addTransactionForm = document.getElementById('add-transaction-form');
if (addTransactionForm) {
  addTransactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get form elements using the correct IDs
    const accountId = document.getElementById('add-transaction-account')?.value;
    const categoryId = document.getElementById('add-transaction-category')?.value;
    const amountInput = document.getElementById('add-transaction-amount');
    const amount = getAmountValue(amountInput);
    const date = document.getElementById('add-transaction-date')?.value;
    const description = document.getElementById('add-transaction-description')?.value;

    // Get category type from selected option
    const categorySelect = document.getElementById('add-transaction-category');
    const selectedOption = categorySelect?.options[categorySelect.selectedIndex];
    const categoryText = selectedOption?.textContent || '';
    
    // The category format is "Type - Name", so we split and get the type
    const type = categoryText.split('-')[0].trim().toLowerCase();

    // Validate required fields
    if (!accountId || !categoryId || !amount || !date) {
      console.error('Missing required fields');
      return;
    }

    const projectIds = Array.from(document.getElementById('transaction-projects').selectedOptions)
        .map(option => parseInt(option.value))
        .filter(id => !isNaN(id));

    try {
        const { data: transactionId, error } = await window.databaseApi.addTransaction({
            account_id: accountId,
            category_id: categoryId,
            type,
            amount: parseFloat(amount),
            date,
            description: description || ''
        });

        if (error) throw error;

        if (projectIds.length > 0) {
            const { error: projectError } = await window.databaseApi.addTransactionProjects(transactionId, projectIds);
            if (projectError) throw projectError;
        }

        closeModal('add-transaction-modal');
        e.target.reset();
        await refreshData({ all: true });
    } catch (err) {
        console.error('Error adding transaction:', err);
        showError('Failed to create transaction');
    }
  });
}

  export async function deleteTransaction(id) {
    try {
        const { error } = await window.databaseApi.deleteTransaction(id);
        if (error) throw error;
        await refreshData({
            transactions: true,
            charts: true,
            reports: true
        });
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showError('Failed to delete transaction');
    }
  }
  
  document.getElementById('cancel-add-recurring')?.addEventListener('click', () => {
    document.getElementById('add-recurring-card').style.display = 'none';
    document.getElementById('add-recurring-form').reset();
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


  // Add the showEditTransactionForm function
export async function showEditTransactionForm(transaction) {
    try {
        // Populate dropdowns first
        await Promise.all([
            populateAccountDropdowns(),
            populateCategoryDropdowns(),
            populateProjectDropdowns(true)
        ]);

        // Ensure all form elements exist
        const form = document.getElementById('edit-transaction-form');
        const projectSelect = document.getElementById('edit-transaction-projects');
        
        if (!form || !projectSelect) {
            console.error('Edit transaction form elements not found');
            throw new Error('Form elements not found');
        }

        // Populate form fields
        document.getElementById('edit-transaction-id').value = transaction.id;
        document.getElementById('edit-transaction-account').value = transaction.account_id;
        document.getElementById('edit-transaction-category').value = transaction.category_id;
        document.getElementById('edit-transaction-amount').value = Math.abs(transaction.amount);
        document.getElementById('edit-transaction-date').value = formatDateForInput(transaction.date);
        document.getElementById('edit-transaction-description').value = transaction.description || '';

        // Get and set selected projects
        const { data: projectIds, error: projectError } = await window.databaseApi.getTransactionProjects(transaction.id);
        if (projectError) throw projectError;

        if (projectIds && projectIds.length > 0) {
            Array.from(projectSelect.options).forEach(option => {
                option.selected = projectIds.includes(parseInt(option.value));
            });
        } else {
            // Clear any existing selections
            Array.from(projectSelect.options).forEach(option => {
                option.selected = false;
            });
        }

        openModal('edit-transaction-modal');
    } catch (error) {
        console.error('Error showing edit form:', error);
        showError('Failed to load transaction details');
    }
}
  
  // Add event listener for the edit transaction form
  document.getElementById('edit-transaction-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const transactionId = document.getElementById('edit-transaction-id').value;
    
    // Get category type from selected option
    const categorySelect = document.getElementById('edit-transaction-category');
    const selectedOption = categorySelect?.options[categorySelect.selectedIndex];
    const categoryText = selectedOption?.textContent || '';
    const type = categoryText.split('-')[0].trim().toLowerCase();

    const amountInput = document.getElementById('edit-transaction-amount');
    const amount = getAmountValue(amountInput);

    const updateData = {
      account_id: document.getElementById('edit-transaction-account').value,
      category_id: document.getElementById('edit-transaction-category').value,
      type,
      amount: parseFloat(amount),
      date: document.getElementById('edit-transaction-date').value,
      description: document.getElementById('edit-transaction-description').value
    };
    
    const projectIds = Array.from(document.getElementById('edit-transaction-projects').selectedOptions)
        .map(option => option.value);

    const { error } = await window.databaseApi.updateTransaction(transactionId, updateData);
    if (error) {
      console.error('Error updating transaction:', error);
    } else {
      closeModal('edit-transaction-modal');
      await refreshData({
        all: true
      });
      e.target.reset();

      if (projectIds.length > 0) {
          await window.databaseApi.updateTransactionProjects(transactionId, projectIds);
      }
    }
  });
  
  // Add cancel button event listener for edit form
  document.getElementById('cancel-edit-transaction')?.addEventListener('click', () => {
    document.getElementById('edit-transaction-card').style.display = 'none';
    document.getElementById('edit-transaction-form').reset();
  });

export function initializeTransactions() {
  try {
    // Initialize filters first
    initializeTransactionFilters();

    // Add transaction button handler
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
        await Promise.all([
          populateAccountDropdowns(),
          populateCategoryDropdowns(),
          populateProjectDropdowns(true)
        ]);
        
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('add-transaction-date').value = today;
        
        openModal('add-transaction-modal');
      } catch (error) {
        console.error('Error initializing transaction form:', error);
        showError('An error occurred. Please try again.');
      }
    });

    // Add scroll event listener for the Transactions section
    const transactionsSection = document.getElementById('Transactions');
    if (transactionsSection) {
      transactionsSection.addEventListener('scroll', () => {
        const filtersPanel = document.getElementById('transactions-filters');
        const filtersBtn = document.querySelector('[data-target="transactions-filters"]');
        
        if (filtersPanel && (filtersPanel.classList.contains('show') || filtersPanel.classList.contains('active'))) {
          positionFilterPanel(filtersBtn, filtersPanel);
        }
      }, { passive: true });
    }

  } catch (error) {
    console.error('Failed to initialize transactions:', error);
    showError('Failed to load transactions');
  }
}

// Initialize transactions when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initializeTransactions();
  } catch (error) {
    console.error('Failed to initialize transactions:', error);
    showError('Failed to load transactions');
  }
});

// Listen for tab changes
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tablink').forEach(tab => {
    tab.addEventListener('click', async (e) => {
      if (e.currentTarget.dataset.section === 'Transactions') {
        await loadTransactions();
      }
    });
  });
});

// Update the loadTransactions function
export async function loadTransactions(filters = {}) {
  try {
    // Initialize pagination if not already done
    if (!transactionsPagination) {
      transactionsPagination = new TablePagination('transactions-table-body', {
        itemsPerPage: 10,
        onPageChange: async (page) => {
          const filters = {
            type: document.getElementById('transaction-type-filter')?.value || 'all',
            category: document.getElementById('transaction-category-filter')?.value || 'all',
            sort: document.getElementById('transaction-sort')?.value || 'date-desc',
            search: document.querySelector('#Transactions .search-input')?.value || '',
            limit: transactionsPagination.getLimit(),
            offset: transactionsPagination.getOffset()
          };
          await loadTransactions(filters);
        }
      });
    }

    const { data: transactions, error } = await fetchTransactions({
      ...filters,
      limit: transactionsPagination.getLimit(),
      offset: transactionsPagination.getOffset()
    });

    if (error) throw error;

    const tbody = document.getElementById('transactions-table-body');
    tbody.innerHTML = '';

    // Update pagination with total count from first transaction
    const totalCount = transactions[0]?.total_count || 0;
    transactionsPagination.updatePagination(totalCount);

    if (!transactions || transactions.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="6" class="empty-state-cell">
          <div class="table-empty-state">
            <p>No transactions found</p>
          </div>
        </td>
      `;
      tbody.appendChild(emptyRow);
      return;
    }

    // Render transactions
    transactions.forEach(transaction => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(transaction.date).toLocaleDateString()}</td>
        <td>${capitalizeFirstLetter(transaction.type)}</td>
        <td>${transaction.category_name || 'Uncategorized'}</td>
        <td class="${transaction.type === 'expense' ? 'negative' : 'positive'}">
          ${transaction.type === 'expense' ? '-' : '+'}${formatCurrency(transaction.amount)}
        </td>
        <td>${transaction.description || ''}</td>
        <td class="action-buttons text-right">
          <button class="action-btn edit-btn" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="action-btn delete-btn" title="Delete">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;

      // Add event listeners
      const editBtn = row.querySelector('.edit-btn');
      const deleteBtn = row.querySelector('.delete-btn');

      editBtn?.addEventListener('click', () => showEditTransactionForm(transaction));
      deleteBtn?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this transaction?')) {
          try {
            await deleteTransaction(transaction.id);
            await loadTransactions(filters); // Reload the transactions with current filters
          } catch (error) {
            console.error('Error deleting transaction:', error);
            showError('Failed to delete transaction');
          }
        }
      });

      tbody.appendChild(row);
    });

  } catch (error) {
    console.error('Error loading transactions:', error);
    showError('Failed to load transactions');
  }
}

// Replace your existing handleTransactionFiltersChange function
export async function handleTransactionFiltersChange() {
  if (transactionsPagination) {
    transactionsPagination.currentPage = 1;
  }

  const filters = {
    type: document.getElementById('transaction-type-filter')?.value || 'all',
    category: document.getElementById('transaction-category-filter')?.value || 'all',
    sort: document.getElementById('transaction-sort')?.value || 'date-desc',
    search: document.querySelector('#Transactions .search-input')?.value || '',
    limit: transactionsPagination?.getLimit(),
    offset: 0  // Force offset to 0 for first page
  };

  await loadTransactions(filters);
}

// Update the search input handler
document.querySelector('#Transactions .search-input')?.addEventListener('input', debounce(async (e) => {
  if (transactionsPagination) {
    // Set the page to 1 directly
    transactionsPagination.currentPage = 1;
  }
  
  const filters = {
    type: document.getElementById('transaction-type-filter')?.value || 'all',
    category: document.getElementById('transaction-category-filter')?.value || 'all',
    sort: document.getElementById('transaction-sort')?.value || 'date-desc',
    search: e.target.value,
    limit: transactionsPagination?.getLimit(),
    offset: 0
  };
  
  await loadTransactions(filters);
}, 300));

// Update filter change listeners
['transaction-type-filter', 'transaction-category-filter', 'transaction-sort'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', handleTransactionFiltersChange);
});

function initializeTransactionFilters() {
  const filtersBtn = document.querySelector('[data-target="transactions-filters"]');
  const filtersPanel = document.getElementById('transactions-filters');
  const searchInput = document.querySelector('#Transactions .search-input');
  
  if (!filtersBtn || !filtersPanel) {
    console.error('Transaction filter elements not found');
    return;
  }

  // Remove any existing event listeners
  const newBtn = filtersBtn.cloneNode(true);
  filtersBtn.parentNode.replaceChild(newBtn, filtersBtn);
  
  // Filter button click handler
  newBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    filtersPanel.classList.toggle('show');
    
    if (filtersPanel.classList.contains('show')) {
      positionFilterPanel(newBtn, filtersPanel);
    }
  });

  // Close filters when clicking outside
  const handleOutsideClick = (e) => {
    if (!filtersPanel.contains(e.target) && !newBtn.contains(e.target)) {
      filtersPanel.classList.remove('show');
    }
  };
  
  // Remove any existing click handlers and add new one
  document.removeEventListener('click', handleOutsideClick);
  document.addEventListener('click', handleOutsideClick);

  // Close button handler
  const closeBtn = filtersPanel.querySelector('.close-filters');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      filtersPanel.classList.remove('show');
    });
  }

  // Reset filters button handler
  document.getElementById('reset-transaction-filters')?.addEventListener('click', async () => {
    // Reset all filter values
    if (document.getElementById('transaction-type-filter')) {
      document.getElementById('transaction-type-filter').value = 'all';
    }
    if (document.getElementById('transaction-category-filter')) {
      document.getElementById('transaction-category-filter').value = 'all';
    }
    if (document.getElementById('transaction-sort')) {
      document.getElementById('transaction-sort').value = 'date-desc';
    }
    if (searchInput) {
      searchInput.value = '';
    }

    // Apply the filter changes
    await handleTransactionFiltersChange();
    
    // Close the panel
    filtersPanel.classList.remove('show');
    filtersPanel.classList.remove('active'); // Remove both classes for consistency
  });

  // Search input handler with debounce
  if (searchInput) {
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    newInput.addEventListener('input', debounce(async () => {
      await handleTransactionFiltersChange();
    }, 300));
  }

  // Individual filter change handlers
  ['transaction-type-filter', 'transaction-category-filter', 'transaction-sort'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      const newElement = element.cloneNode(true);
      element.parentNode.replaceChild(newElement, element);
      newElement.addEventListener('change', async () => {
        await handleTransactionFiltersChange();
      });
    }
  });
}