import { capitalizeFirstLetter } from './formatters.js';

// Add this function to populate account dropdowns
export async function populateAccountDropdowns() {
  const { data, error } = await window.databaseApi.fetchAccounts();
  
  if (error) {
    console.error('Error fetching accounts:', error);
    return;
  }
  
  // Specifically target only dropdown selectors
  const dropdownSelectors = [
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
    'bulk-entry-account',
    'import-account-select'
  ];
  
  dropdownSelectors.forEach(id => {
    const selector = document.getElementById(id);
    if (!selector || selector.tagName !== 'SELECT') return;
    
    // Clear existing options
    const isFilterSelector = id.includes('selector');
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

// Function to populate category dropdowns
export async function populateCategoryDropdowns() {
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

export async function populateProjectDropdowns(multiSelect = false) {
    try {
        const { data: projects, error } = await window.databaseApi.getProjects();
        if (error) throw error;

        const projectSelects = document.querySelectorAll('.project-select');
        projectSelects.forEach(select => {
            select.innerHTML = `
                <option value="">No Project</option>
                ${projects.map(project => `
                    <option value="${project.id}">${project.name}</option>
                `).join('')}
            `;

            if (multiSelect) {
                select.setAttribute('multiple', 'true');
                select.classList.add('multi-select');
            }
        });
    } catch (err) {
        console.error('Error populating project dropdowns:', err);
    }
}

export async function populateAccountFilters() {
  try {
    const { data: accounts, error } = await window.databaseApi.fetchAccounts();
    if (error) throw error;

    const transactionFilter = document.getElementById('transaction-account-filter');
    const recurringFilter = document.getElementById('recurring-account-filter');

    const options = accounts.map(account => 
      `<option value="${account.id}">${account.name}</option>`
    ).join('');

    const defaultOption = '<option value="all">All Accounts</option>';

    if (transactionFilter) {
      transactionFilter.innerHTML = defaultOption + options;
    }

    if (recurringFilter) {
      recurringFilter.innerHTML = defaultOption + options;
    }
  } catch (error) {
    console.error('Error populating account filters:', error);
    showError('Failed to load account filters');
  }
}
