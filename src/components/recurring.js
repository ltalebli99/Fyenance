import { formatCurrency, capitalizeFirstLetter, getAmountValue, formatInitialAmount, initializeAmountInput } from '../utils/formatters.js';
import { openModal, closeModal, showError } from '../utils/utils.js';
import { populateAccountDropdowns, populateCategoryDropdowns, populateProjectDropdowns } from '../utils/dropdownHelpers.js';
import { fetchRecurring } from '../services/recurringService.js';
import { showCreateFirstModal, showDeleteConfirmationModal } from '../utils/modals.js';
import { debounce } from '../utils/filters.js';
import { refreshData } from '../utils/refresh.js';
import { resetFormAndInputs } from '../utils/initInputs.js';
import { TablePagination } from '../utils/pagination.js';

const addRecurringForm = document.getElementById('add-recurring-form');
const editRecurringForm = document.getElementById('edit-recurring-form');

let recurringPagination; // Add at the top of the file

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
    
        // Populate all dropdowns including projects
        await Promise.all([
            populateAccountDropdowns(),
            populateCategoryDropdowns(),
            populateProjectDropdowns(true)
        ]);
        
        openModal('add-recurring-modal');
    } catch (error) {
        console.error('Error checking accounts/categories:', error);
        showError('An error occurred. Please try again.');
    }
});

export async function toggleRecurringStatus(id, newStatus, item) {
    try {
        const status = newStatus ? 1 : 0;
        const updateData = {
            account_id: item.account_id,
            name: item.name,
            amount: item.amount,
            category_id: item.category_id,
            start_date: item.start_date,
            end_date: item.end_date,
            frequency: item.frequency,
            description: item.description || '',
            is_active: status,
            type: item.type
        };
        
        const { error } = await window.databaseApi.updateRecurring(id, updateData);
        if (error) throw error;

        await refreshData({
            all: true
        });
    } catch (error) {
        console.error('Error toggling recurring status:', error);
        showError('Failed to update recurring status');
    }
}


// Add recurring form handler
document.getElementById('add-recurring-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
  
    // Get all required form elements
    const accountSelect = document.getElementById('add-recurring-account');
    const nameInput = document.getElementById('add-recurring-name');
    const amountInput = document.getElementById('add-recurring-amount');
    const categorySelect = document.getElementById('add-recurring-category');
    const startDateInput = document.getElementById('add-recurring-start-date');
    const endDateInput = document.getElementById('add-recurring-end-date');
    const frequencySelect = document.getElementById('add-recurring-frequency');
    const descriptionInput = document.getElementById('add-recurring-description');
  
    // Validate that all required elements exist
    if (!accountSelect || !nameInput || !amountInput || !categorySelect || 
        !startDateInput || !frequencySelect) {
      console.error('Required form elements not found');
      return;
    }
  
    // Get category type from selected option
    const selectedOption = categorySelect.options[categorySelect.selectedIndex];
    const categoryText = selectedOption?.textContent || '';
    const type = categoryText.split('-')[0].trim().toLowerCase();
    
    // Validate the type
    if (type !== 'income' && type !== 'expense') {
      console.error('Invalid category type:', type);
      return;
    }

    // Validate dates
    const startDate = startDateInput.value;
    const endDate = endDateInput.value || null;
    
    if (endDate && new Date(startDate) > new Date(endDate)) {
        showError('End date must be after start date');
        return;
    }
  
    try {
      // Create dates in UTC
      const startDateObj = new Date(startDate + 'T00:00:00Z');
      
      let endDateObj = null;
      if (endDate) {
        endDateObj = new Date(endDate + 'T00:00:00Z');
      }

      const recurring = {
        account_id: parseInt(accountSelect.value, 10),
        name: nameInput.value.trim(),
        amount: parseFloat(getAmountValue(amountInput)),
        category_id: parseInt(categorySelect.value, 10),
        start_date: startDateObj.toISOString().split('T')[0],
        end_date: endDateObj ? endDateObj.toISOString().split('T')[0] : null,
        frequency: frequencySelect.value,
        description: (descriptionInput?.value || '').trim(),
        type,
        is_active: 1
      };
  
      // Validate the data types
      if (isNaN(recurring.account_id) || isNaN(recurring.amount) || 
          isNaN(recurring.category_id)) {
        console.error('Invalid numeric values in form');
        return;
      }
  
      const projectIds = Array.from(document.getElementById('add-recurring-projects').selectedOptions)
          .map(option => parseInt(option.value))
          .filter(id => !isNaN(id));
  
      const { data: recurringId, error } = await window.databaseApi.addRecurring({
        ...recurring,
        projectIds
      });
      if (error) throw error;

      resetFormAndInputs(addRecurringForm);
      closeModal('add-recurring-modal');
  
      refreshData({
        all: true
      });
  
    } catch (err) {
      console.error('Error adding recurring transaction:', err);
      showError('Failed to create recurring transaction');
    }
  });
  
  // Add recurring account selector
  const recurringSelector = document.getElementById('recurring-account-selector');
  if (recurringSelector) {
    recurringSelector.addEventListener('change', async () => {
      await fetchRecurring(recurringSelector.value);
    });
  }


  function formatDateForInput(dateString) {
    if (!dateString) return '';
    // Create date and adjust for timezone
    const date = new Date(dateString);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date.toISOString().split('T')[0];
}

  export async function showEditRecurringForm(recurring) {
    try {
        // Populate all dropdowns first
        await Promise.all([
            populateAccountDropdowns(),
            populateCategoryDropdowns(),
            populateProjectDropdowns(true)
        ]);

        // Get form elements
        const form = document.getElementById('edit-recurring-form');
        const accountSelect = document.getElementById('edit-recurring-account');
        const nameInput = document.getElementById('edit-recurring-name');
        const amountInput = document.getElementById('edit-recurring-amount');
        const categorySelect = document.getElementById('edit-recurring-category');
        const frequencySelect = document.getElementById('edit-recurring-frequency');
        const startDateInput = document.getElementById('edit-recurring-start-date');
        const endDateInput = document.getElementById('edit-recurring-end-date');
        const descriptionInput = document.getElementById('edit-recurring-description');
        const projectSelect = document.getElementById('edit-recurring-projects');

        // Validate that all required elements exist
        if (!form || !accountSelect || !nameInput || !amountInput || !categorySelect || 
            !frequencySelect || !startDateInput || !endDateInput || !descriptionInput || !projectSelect) {
            throw new Error('Required form elements not found');
        }

        // Set form data
        form.dataset.recurringId = recurring.id;
        accountSelect.value = recurring.account_id;
        nameInput.value = recurring.name;
        amountInput.value = formatInitialAmount(recurring.amount);
        initializeAmountInput(document.getElementById('edit-recurring-amount'));
        categorySelect.value = recurring.category_id;
        frequencySelect.value = recurring.frequency || 'monthly';
        startDateInput.value = formatDateForInput(recurring.start_date);
        endDateInput.value = recurring.end_date ? formatDateForInput(recurring.end_date) : '';
        descriptionInput.value = recurring.description || '';

        // Get and set selected projects
        const { data: projectIds, error: projectError } = await window.databaseApi.getRecurringProjects(recurring.id);
        if (projectError) throw projectError;

        // Clear existing selections
        Array.from(projectSelect.options).forEach(option => {
            option.selected = false;
        });

        // Set new selections
        if (projectIds && projectIds.length > 0) {
            Array.from(projectSelect.options).forEach(option => {
                option.selected = projectIds.includes(parseInt(option.value));
            });
        }

        openModal('edit-recurring-modal');
    } catch (error) {
        console.error('Error showing edit form:', error);
        showError('Failed to show edit form');
    }
  }
  
  document.getElementById('cancel-edit-recurring').addEventListener('click', () => {
    closeModal('edit-recurring-modal');
  });
  
  document.getElementById('close-edit-recurring').addEventListener('click', () => {
    closeModal('edit-recurring-modal');
  });

  // Edit recurring form handler
document.getElementById('edit-recurring-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const form = e.target;
        const recurringId = parseInt(form.dataset.recurringId);
        
        if (!form.dataset.recurringId || isNaN(recurringId)) {
            throw new Error('Invalid recurring ID');
        }

        const accountSelect = document.getElementById('edit-recurring-account');
        const nameInput = document.getElementById('edit-recurring-name');
        const amountInput = document.getElementById('edit-recurring-amount');
        const categorySelect = document.getElementById('edit-recurring-category');
        const startDateInput = document.getElementById('edit-recurring-start-date');
        const endDateInput = document.getElementById('edit-recurring-end-date');
        const frequencySelect = document.getElementById('edit-recurring-frequency');
        const descriptionInput = document.getElementById('edit-recurring-description');
        const projectSelect = document.getElementById('edit-recurring-projects');

        // Validate that all required elements exist
        if (!accountSelect || !nameInput || !amountInput || !categorySelect || 
            !startDateInput || !frequencySelect) {
            throw new Error('Required form elements not found');
        }

        // Get category type from selected option
        const selectedOption = categorySelect.options[categorySelect.selectedIndex];
        const categoryText = selectedOption?.textContent || '';
        const type = categoryText.split('-')[0].trim().toLowerCase();

        // Validate the type
        if (type !== 'income' && type !== 'expense') {
            throw new Error('Invalid category type');
        }

        const updateData = {
            account_id: parseInt(accountSelect.value),
            name: nameInput.value.trim(),
            amount: parseFloat(getAmountValue(amountInput)),
            category_id: parseInt(categorySelect.value),
            type: type,
            start_date: startDateInput.value,
            end_date: endDateInput.value || null,
            frequency: frequencySelect.value,
            description: descriptionInput?.value?.trim() || '',
            is_active: 1
        };

        // Get selected project IDs
        const projectIds = Array.from(projectSelect.selectedOptions)
            .map(option => parseInt(option.value))
            .filter(id => !isNaN(id));

        // Update recurring with project IDs
        const { error: updateError } = await window.databaseApi.updateRecurring(recurringId, {
            ...updateData,
            projectIds
        });
        if (updateError) throw updateError;

        resetFormAndInputs(editRecurringForm);
        closeModal('edit-recurring-modal');
        await refreshData({
            all: true
        });
    } catch (error) {
        console.error('Error updating recurring transaction:', error);
        showError('Failed to update recurring transaction');
    }
});

  
// Add cancel button event listener for edit form
document.getElementById('cancel-edit-recurring')?.addEventListener('click', () => {
    document.getElementById('edit-recurring-card').style.display = 'none';
    resetFormAndInputs(editRecurringForm);
  });

// Add filter panel positioning for recurring
function positionFilterPanel(button, panel) {
  if (!button || !panel) return;
  
  const buttonRect = button.getBoundingClientRect();
  const recurringSection = document.getElementById('Recurring');
  const sectionScroll = recurringSection ? recurringSection.scrollTop : 0;
  
  // Reset any previous positioning
  panel.style.position = 'fixed';
  panel.style.top = '';
  panel.style.bottom = '';
  
  const spaceBelow = window.innerHeight - buttonRect.bottom;
  const spaceAbove = buttonRect.top;
  
  // Position panel below or above button depending on available space
  if (spaceBelow >= panel.offsetHeight || spaceBelow > spaceAbove) {
    panel.style.top = `${buttonRect.bottom - sectionScroll}px`;
  } else {
    panel.style.bottom = `${window.innerHeight - buttonRect.top + sectionScroll}px`;
  }
  
  // Align horizontally - align right sides
  const right = window.innerWidth - buttonRect.right;
  panel.style.right = `${right}px`;
  panel.style.left = 'auto'; // Remove left positioning
}

// Add event listeners for recurring filters
document.addEventListener('DOMContentLoaded', () => {
  const filtersBtn = document.querySelector('[data-target="recurring-filters"]');
  const filtersPanel = document.getElementById('recurring-filters');
  const closeBtn = filtersPanel?.querySelector('.close-filters');
  const clearBtn = document.getElementById('reset-recurring-filters');
  const recurringSection = document.getElementById('Recurring');

  // Toggle filters panel
  filtersBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    filtersPanel.classList.toggle('show');
    if (filtersPanel.classList.contains('show')) {
      positionFilterPanel(filtersBtn, filtersPanel);
    }
  });

  // Close panel
  closeBtn?.addEventListener('click', () => {
    filtersPanel.classList.remove('show');
  });

  // Clear filters
  clearBtn?.addEventListener('click', async () => {
    // Reset all filter values
    if (document.getElementById('recurring-type-filter')) {
      document.getElementById('recurring-type-filter').value = 'all';
    }
    if (document.getElementById('recurring-category-filter')) {
      document.getElementById('recurring-category-filter').value = 'all';
    }
    if (document.getElementById('recurring-status-filter')) {
      document.getElementById('recurring-status-filter').value = 'all';
    }
    if (document.querySelector('#Recurring .search-input')) {
      document.querySelector('#Recurring .search-input').value = '';
    }

    // Apply the filter changes
    await handleRecurringFiltersChange();
    
    // Close the panel
    filtersPanel.classList.remove('show');
    filtersPanel.classList.remove('active');
  });

  // Handle scroll events
  recurringSection?.addEventListener('scroll', () => {
    if (filtersPanel && filtersPanel.classList.contains('show')) {
      positionFilterPanel(filtersBtn, filtersPanel);
    }
  }, { passive: true });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (filtersPanel && filtersPanel.classList.contains('show')) {
      positionFilterPanel(filtersBtn, filtersPanel);
    }
  });

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (filtersPanel && !filtersPanel.contains(e.target) && !filtersBtn.contains(e.target)) {
      filtersPanel.classList.remove('show');
    }
  });

  // Add filter change listeners
  ['recurring-type-filter', 'recurring-category-filter', 'recurring-status-filter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', handleRecurringFiltersChange);
  });
});

// Add the filter handling function
export async function handleRecurringFiltersChange() {
  // Initialize pagination if not already done
  if (!recurringPagination) {
    recurringPagination = new TablePagination('recurring-table-body', {
      itemsPerPage: 10
    });
  }

  const type = document.getElementById('recurring-type-filter')?.value || 'all';
  const category = document.getElementById('recurring-category-filter')?.value || 'all';
  const status = document.getElementById('recurring-status-filter')?.value || 'all';
  const searchTerm = document.querySelector('#Recurring .search-input')?.value || '';
  
  const filters = {
    type: type !== 'all' ? type : null,
    category: category !== 'all' ? category : null,
    status: status !== 'all' ? status : null,
    search: searchTerm,
    limit: recurringPagination.getLimit(),
    offset: recurringPagination.getOffset()
  };

  // Reset to first page when filters change
  recurringPagination.currentPage = 1;
  await fetchRecurring(null, filters);
}

// Add export to the loading function
export async function loadRecurringTransactions(accountId = null) {
    try {
        // Initialize pagination if not already done
        if (!recurringPagination) {
            recurringPagination = new TablePagination('recurring-table-body', {
                itemsPerPage: 10
            });
            recurringPagination.onPageChange = (page) => {
                fetchRecurring(accountId);
            };
        }
        await fetchRecurring(accountId);
    } catch (error) {
        console.error('Error loading recurring transactions:', error);
        showError('Failed to load recurring transactions');
    }
}

// Add the event listener
window.addEventListener('recurring-updated', () => {
    loadRecurringTransactions();
});

// Add this after your existing DOMContentLoaded event listener
document.querySelector('#Recurring .search-input')?.addEventListener('input', 
    debounce(async (e) => {
        // Initialize pagination if not already done
        if (!recurringPagination) {
            recurringPagination = new TablePagination('recurring-table-body', {
                itemsPerPage: 10
            });
        }

        const filters = {
            type: document.getElementById('recurring-type-filter')?.value || 'all',
            category: document.getElementById('recurring-category-filter')?.value || 'all',
            status: document.getElementById('recurring-status-filter')?.value || 'all',
            search: e.target.value,
            limit: recurringPagination.getLimit(),
            offset: recurringPagination.getOffset()
        };
        
        // Reset to first page when search changes
        recurringPagination.currentPage = 1;
        await fetchRecurring(null, filters);
    }, 300)
);

// Add this helper function at the top
function formatDateForDatabase(dateString) {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
}

export async function deleteRecurring(id) {
    try {
        const { error } = await window.databaseApi.deleteRecurring(id);
        if (error) throw error;
        
        await refreshData({
            all: true
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error deleting recurring transaction:', error);
        showError('Failed to delete recurring transaction');
        return { success: false, error: error.message };
    }
}