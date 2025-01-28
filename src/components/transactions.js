import { formatCurrency, 
  capitalizeFirstLetter, 
  formatDateForInput, 
  getAmountValue, 
  initializeAmountInput, 
  formatInitialAmount 
} from '../utils/formatters.js';
import { fetchTransactions } from '../services/transactionsService.js';
import { openSection, openModal, closeModal, showError } from '../utils/utils.js';
import { populateAccountDropdowns, populateCategoryDropdowns, populateProjectDropdowns } from '../utils/dropdownHelpers.js';
import { filterData, sortData } from './filters.js';
import { showCreateFirstModal, showDeleteConfirmationModal } from '../utils/modals.js';
import { positionFilterPanel, debounce } from '../utils/filters.js';
import { refreshData } from '../utils/refresh.js';
import { TablePagination } from '../utils/pagination.js';
import { resetFormAndInputs } from '../utils/initInputs.js';
import { populateAccountTabs } from './accounts.js';

export let transactionsPagination;

const editTransactionForm = document.getElementById('edit-transaction-form');
const accountSelector = document.getElementById('transactions-account-selector');

if (accountSelector) {
  accountSelector.querySelector('.select-header').addEventListener('click', () => {
      accountSelector.querySelector('.select-dropdown').classList.toggle('show');
  });

  accountSelector.querySelector('#select-all-transactions-accounts').addEventListener('change', (e) => {
      const checkboxes = accountSelector.querySelectorAll('.options-container input');
      checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
      handleTransactionFiltersChange();
  });

  accountSelector.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox' && e.target !== accountSelector.querySelector('#select-all-transactions-accounts')) {
          handleTransactionFiltersChange();
      }
  });
}

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
    
    try {
        const type = document.getElementById('add-transaction-type')?.value;
        const fromAccountId = document.getElementById('add-transaction-account')?.value;
        const amountInput = document.getElementById('add-transaction-amount');
        const amount = getAmountValue(amountInput);
        const date = document.getElementById('add-transaction-date')?.value;
        const description = document.getElementById('add-transaction-description')?.value;

        // Get selected project IDs, with null check for the select element
        const projectSelect = document.getElementById('transaction-projects');
        const projectIds = projectSelect ? Array.from(projectSelect.selectedOptions)
            .map(option => option.value)
            .filter(id => id !== '') : [];

        // Validate required fields with specific error messages
        const missingFields = [];
        if (!fromAccountId) missingFields.push('Account');
        if (!type) missingFields.push('Type');
        if (!amount) missingFields.push('Amount');
        if (!date) missingFields.push('Date');

        if (missingFields.length > 0) {
            showError(`Missing required fields: ${missingFields.join(', ')}`);
            return;
        }

        if (type === 'transfer') {
            try {
                const toAccountId = document.getElementById('add-transaction-category-or-account')?.value;
                if (!toAccountId) {
                    showError('Please select a target account for the transfer');
                    return;
                }

                // Create withdrawal transaction
                const withdrawalResult = await window.databaseApi.addTransaction({
                    account_id: parseInt(fromAccountId, 10),
                    category_id: null,
                    amount: parseFloat(amount),
                    type: 'expense',
                    date,
                    description: description || '',
                    is_transfer: 1,
                    transfer_pair_id: null
                });

                if (withdrawalResult.error) {
                    console.error('Withdrawal error:', withdrawalResult.error);
                    throw new Error(withdrawalResult.error);
                }

                const withdrawalId = withdrawalResult.data;

                // Create deposit transaction
                const depositResult = await window.databaseApi.addTransaction({
                    account_id: parseInt(toAccountId, 10),
                    category_id: null,
                    amount: parseFloat(amount),
                    type: 'income',
                    date,
                    description: description || '',
                    is_transfer: 1,
                    transfer_pair_id: withdrawalId
                });

                if (depositResult.error) {
                    console.error('Deposit error:', depositResult.error);
                    throw new Error(depositResult.error);
                }

                const depositId = depositResult.data;

                // Update withdrawal with deposit's ID
                const { error: updateError } = await window.databaseApi.updateTransaction(withdrawalId, {
                    transfer_pair_id: parseInt(depositId, 10)
                });
                if (updateError) throw updateError;

                // Add project associations if any projects were selected
                if (projectIds.length > 0) {
                    // Add to withdrawal
                    const { error: projectError1 } = await window.databaseApi.addTransactionProjects(
                        withdrawalId,
                        projectIds.map(id => parseInt(id, 10))
                    );
                    if (projectError1) throw projectError1;

                    // Add to deposit
                    const { error: projectError2 } = await window.databaseApi.addTransactionProjects(
                        depositId,
                        projectIds.map(id => parseInt(id, 10))
                    );
                    if (projectError2) throw projectError2;
                }

            } catch (error) {
                console.error('Transfer error:', error);
                showError(error.message || 'Failed to create transfer');
                return;
            }
        } else {
            // Handle regular transaction (existing logic)
            const categoryId = document.getElementById('add-transaction-category-or-account')?.value;
            if (!categoryId) {
                showError('Please select a category');
                return;
            }

            const { data: transactionId, error } = await window.databaseApi.addTransaction({
                account_id: parseInt(fromAccountId, 10),
                category_id: parseInt(categoryId, 10),
                type,
                amount: parseFloat(amount),
                date,
                description: description || '',
                is_transfer: 0,
                transfer_pair_id: null
            });

            if (error) throw error;

            // Add project associations if any projects were selected
            if (projectIds.length > 0) {
                const { error: projectError } = await window.databaseApi.addTransactionProjects(
                    transactionId,
                    projectIds.map(id => parseInt(id, 10))
                );
                if (projectError) throw projectError;
            }
        }

        resetFormAndInputs(addTransactionForm);
        closeModal('add-transaction-modal');

        if (transactionsPagination) {
            transactionsPagination.currentPage = 1;
            transactionsPagination.updatePagination(transactionsPagination.totalItems);
        }

        await refreshData({
            all: true
        });

        await loadTransactions({
            offset: 0,
            limit: transactionsPagination?.getLimit() || 10
        });

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
        
        // First remove the row from the table
        const row = document.querySelector(`tr[data-transaction-id="${id}"]`);
        if (row) row.remove();
        
        // Then refresh the data
        await refreshData({
            all: true
        });

        return { success: true };
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showError('Failed to delete transaction');
        return { success: false, error: error.message };
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
        const typeSelect = document.getElementById('edit-transaction-type');
        const categorySelect = document.getElementById('edit-transaction-category');
        
        if (!form || !projectSelect || !typeSelect || !categorySelect) {
            console.error('Edit transaction form elements not found');
            throw new Error('Form elements not found');
        }

        // Populate form fields
        document.getElementById('edit-transaction-id').value = transaction.id;
        document.getElementById('edit-transaction-account').value = transaction.account_id;
        document.getElementById('edit-transaction-amount').value = formatInitialAmount(transaction.amount);
        initializeAmountInput(document.getElementById('edit-transaction-amount'));
        document.getElementById('edit-transaction-date').value = formatDateForInput(transaction.date);
        document.getElementById('edit-transaction-description').value = transaction.description || '';

        // Set transaction type and update categories
        typeSelect.value = transaction.type;
        await updateEditCategoryDropdown(transaction.type, transaction.category_id);

        // Get and set selected projects
        const { data: projectIds, error: projectError } = await window.databaseApi.getTransactionProjects(transaction.id);
        if (projectError) throw projectError;

        if (projectIds && projectIds.length > 0) {
            Array.from(projectSelect.options).forEach(option => {
                option.selected = projectIds.includes(parseInt(option.value));
            });
        } else {
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

// Add this helper function to update category dropdown based on type
async function updateEditCategoryDropdown(type, selectedCategoryId = null) {
    const categorySelect = document.getElementById('edit-transaction-category');
    categorySelect.disabled = !type;
    
    if (!type) {
        categorySelect.innerHTML = '<option value="">Select Category</option>';
        return;
    }

    try {
        const { data: categories } = await window.databaseApi.fetchCategories();
        
        categorySelect.innerHTML = '<option value="" disabled selected>Select Category</option>';
        categories
            .filter(cat => cat.type === type)
            .forEach(cat => {
                const option = new Option(cat.name, cat.id);
                option.selected = cat.id === parseInt(selectedCategoryId);
                categorySelect.add(option);
            });
    } catch (error) {
        console.error('Error updating categories:', error);
        categorySelect.innerHTML = '<option value="">Error loading categories</option>';
    }
}

// Add event listener for type change
document.getElementById('edit-transaction-type')?.addEventListener('change', async (e) => {
    await updateEditCategoryDropdown(e.target.value);
});
  
  // Add event listener for the edit transaction form
  if (editTransactionForm) {
    editTransactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const transactionId = document.getElementById('edit-transaction-id').value;
            const type = document.getElementById('edit-transaction-type').value;
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
            
            // Get selected project IDs
            const projectIds = Array.from(document.getElementById('edit-transaction-projects').selectedOptions)
                .map(option => option.value)
                .filter(id => id !== '');

            // Update the transaction
            const { error } = await window.databaseApi.updateTransaction(transactionId, updateData);
            if (error) throw error;

            // Update project associations
            const { error: projectError } = await window.databaseApi.updateTransactionProjects(
                transactionId,
                projectIds
            );
            if (projectError) throw projectError;

            resetFormAndInputs(editTransactionForm);
            closeModal('edit-transaction-modal');
            
            await refreshData({
                all: true
            });

            if (transactionsPagination) {
                transactionsPagination.currentPage = 1;
                transactionsPagination.updatePagination(transactionsPagination.totalItems);
            }

            await loadTransactions({
                offset: 0,
                limit: transactionsPagination?.getLimit() || 10
            });

        } catch (error) {
            console.error('Error updating transaction:', error);
            showError('Failed to update transaction');
        }
    });
  }
  
  // Add cancel button event listener for edit form
  document.getElementById('cancel-edit-transaction')?.addEventListener('click', () => {
    document.getElementById('edit-transaction-card').style.display = 'none';
    resetFormAndInputs(editTransactionForm);
  });

export function initializeTransactions() {
  try {
    // Initialize transaction form type handling
    const typeSelect = document.getElementById('add-transaction-type');
    const categoryOrAccountSelect = document.getElementById('add-transaction-category-or-account');
    const categoryOrAccountLabel = categoryOrAccountSelect?.previousElementSibling;
    const fromAccountSelect = document.getElementById('add-transaction-account');

    async function updateTargetDropdown() {
        const selectedType = typeSelect.value;
        const fromAccountId = fromAccountSelect.value;
        const currentValue = categoryOrAccountSelect.value;

        // Disable and reset the target dropdown while loading
        categoryOrAccountSelect.disabled = true;
        categoryOrAccountLabel.textContent = selectedType === 'transfer' ? 'To Account' : 'Category';
        categoryOrAccountSelect.innerHTML = '<option value="">Loading...</option>';

        try {
            if (selectedType === 'transfer') {
                // For transfers, fetch fresh accounts to ensure list is up-to-date
                const { data: accounts } = await window.databaseApi.fetchAccounts();
                
                categoryOrAccountSelect.innerHTML = '<option value="" disabled selected>Select Target Account</option>';
                accounts
                    .filter(account => account.id !== parseInt(fromAccountId, 10)) // Convert to number for strict comparison
                    .forEach(account => {
                        const option = new Option(account.name, account.id);
                        option.selected = account.id === parseInt(currentValue, 10);
                        categoryOrAccountSelect.add(option);
                    });
            } else if (selectedType) {
                // For regular transactions, fetch categories filtered by type
                const { data: categories } = await window.databaseApi.fetchCategories();
                
                categoryOrAccountSelect.innerHTML = '<option value="" disabled selected>Select Category</option>';
                categories
                    .filter(cat => cat.type === selectedType)
                    .forEach(cat => {
                        const option = new Option(cat.name, cat.id);
                        option.selected = cat.id === parseInt(currentValue, 10);
                        categoryOrAccountSelect.add(option);
                    });
            } else {
                categoryOrAccountSelect.innerHTML = '<option value="" disabled selected>Select...</option>';
            }
        } catch (error) {
            console.error('Error updating dropdown:', error);
            categoryOrAccountSelect.innerHTML = '<option value="" disabled>Error loading options</option>';
        } finally {
            categoryOrAccountSelect.disabled = !selectedType;
        }
    }

    // Event listeners
    typeSelect?.addEventListener('change', updateTargetDropdown);
    fromAccountSelect?.addEventListener('change', async (e) => {
        if (typeSelect.value === 'transfer') {
            await updateTargetDropdown();
        }
    });

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
    await populateAccountTabs('transaction-accounts-list');
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
          const currentFilters = {
            ...getTransactionFilters(),
            limit: transactionsPagination.getLimit(),
            offset: (page - 1) * transactionsPagination.getLimit()
          };
          await loadTransactions(currentFilters);
        }
      });
    }

    const { data: transactions, error } = await fetchTransactions(filters);
    if (error) throw error;

    const tbody = document.getElementById('transactions-table-body');
    tbody.innerHTML = '';

    // Update pagination with total count from the first transaction
    if (transactions && transactions.length > 0) {
      transactionsPagination.updatePagination(transactions[0].total_count);
    } else {
      transactionsPagination.updatePagination(0);
    }

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
      
      // Add data attribute for transfers before setting innerHTML
      if (transaction.is_transfer) {
        row.setAttribute('data-transfer-group', 
          transaction.transfer_pair_id ? 
          Math.min(transaction.id, transaction.transfer_pair_id) : 
          transaction.id
        );
      }

      row.innerHTML = `
        <td>${new Date(transaction.date).toLocaleDateString()}</td>
        <td>${transaction.account_name || 'Unknown Account'}</td>
        <td>${
          transaction.is_transfer 
            ? `Transfer`
            : capitalizeFirstLetter(transaction.type)
        }</td>
        <td>${
          transaction.is_transfer 
            ? `${transaction.transfer_account_name}`
            : (transaction.category_name || 'Uncategorized')
        }</td>
        <td class="${transaction.type === 'expense' ? 'negative' : 'positive'}">
          ${transaction.type === 'expense' ? '-' : '+'}${formatCurrency(transaction.amount)}
        </td>
        <td>${transaction.description || ''}</td>
        <td class="action-buttons text-right">
          ${!transaction.is_transfer ? `
            <button class="action-btn edit-btn" title="Edit">
              <i class="fas fa-edit"></i>
            </button>
          ` : ''}
          <button class="action-btn delete-btn" title="Delete">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;

      // Add event listeners and append row
      const editBtn = row.querySelector('.edit-btn');
      const deleteBtn = row.querySelector('.delete-btn');

      editBtn?.addEventListener('click', () => showEditTransactionForm(transaction));
      deleteBtn?.addEventListener('click', () => {
        const isTransfer = transaction.is_transfer;
        const message = isTransfer
          ? 'Are you sure you want to delete this transfer? Both sides of the transfer will be deleted.'
          : 'Are you sure you want to delete this transaction?';

        showDeleteConfirmationModal({
          title: isTransfer ? 'Delete Transfer' : 'Delete Transaction',
          message: message,
          onConfirm: async () => {
            try {
              const result = await deleteTransaction(transaction.id);
              if (!result.success) throw new Error(result.error);
              await loadTransactions(filters);
            } catch (error) {
              console.error('Error deleting transaction:', error);
              showError('Failed to delete transaction');
            }
          }
        });
      });

      tbody.appendChild(row);
    });

  } catch (error) {
    console.error('Error loading transactions:', error);
    showError('Failed to load transactions');
  }
}

// Add this helper function to get current filters
function getTransactionFilters() {
  const accountSelect = document.getElementById('transaction-account-filter');
  const selectedAccount = accountSelect?.value || 'all';

  return {
    type: document.getElementById('transaction-type-filter')?.value || 'all',
    category: document.getElementById('transaction-category-filter')?.value || 'all',
    sort: document.getElementById('transaction-sort')?.value || 'date-desc',
    search: document.querySelector('#Transactions .search-input')?.value || '',
    accounts: selectedAccount === 'all' ? ['all'] : [selectedAccount]
  };
}

// Update handleTransactionFiltersChange to preserve pagination state
export async function handleTransactionFiltersChange() {
  if (!transactionsPagination) {
    transactionsPagination = new TablePagination('transactions-table-body', {
      itemsPerPage: 10
    });
  }

  // Reset to first page when filters change AND update UI
  transactionsPagination.currentPage = 1;
  transactionsPagination.updatePagination(transactionsPagination.totalItems);

  const filters = {
    ...getTransactionFilters(),
    limit: transactionsPagination.getLimit(),
    offset: 0 // Reset offset when filters change
  };

  await loadTransactions(filters);
}

// Update the search input handler
document.querySelector('#Transactions .search-input')?.addEventListener('input', debounce(async (e) => {
  if (transactionsPagination) {
    // Reset to page 1 when searching
    transactionsPagination.currentPage = 1;
  }
  
  const filters = {
    type: document.getElementById('transaction-type-filter')?.value || 'all',
    category: document.getElementById('transaction-category-filter')?.value || 'all',
    sort: document.getElementById('transaction-sort')?.value || 'date-desc',
    search: e.target.value,
    limit: transactionsPagination?.getLimit(),
    offset: 0  // Reset offset to 0 when searching
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
    if (document.getElementById('transaction-account-filter')) {
        document.getElementById('transaction-account-filter').value = 'all';
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
  ['transaction-type-filter', 'transaction-category-filter', 'transaction-sort', 'transaction-account-filter'].forEach(id => {
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

// On DOMContentLoaded or appropriate initialization function
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[type="text"][class*="amount"]').forEach(input => {
        initializeAmountInput(input);
    });
});

document.addEventListener('DOMContentLoaded', () => {
  const table = document.querySelector('#transactions-table-body');
  
  table.addEventListener('mouseover', (e) => {
    const row = e.target.closest('tr[data-transfer-group]');
    if (!row) return;
    
    const transferGroup = row.getAttribute('data-transfer-group');
    const style = document.createElement('style');
    
    style.textContent = `
      tr[data-transfer-group="${transferGroup}"] {
        background-color: var(--gray-50) !important;
      }
    `;
    
    document.head.appendChild(style);
    
    row.addEventListener('mouseleave', () => {
      style.remove();
    }, { once: true });
  });
});