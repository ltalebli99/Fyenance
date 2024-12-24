import { fetchTransactions } from '../services/transactionsService.js';
import { fetchRecurring } from '../services/recurringService.js';
import { fetchCategories } from '../services/categoriesService.js';
import { debounce, positionFilterPanel } from '../utils/filters.js';

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


  

export function sortData(data, sortBy) {
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


// Update window resize handler
window.addEventListener('resize', () => {
  const activePanel = document.querySelector('.advanced-filters-panel.active');
  if (activePanel) {
    const button = document.querySelector(`[data-target="${activePanel.id}"]`);
    if (button) {
      positionFilterPanel(button, activePanel);
    }
  }
});

// Update scroll handler
window.addEventListener('scroll', () => {
  const activePanel = document.querySelector('.advanced-filters-panel.active');
  if (activePanel) {
    const button = document.querySelector(`[data-target="${activePanel.id}"]`);
    if (button) {
      positionFilterPanel(button, activePanel);
    }
  }
}, { passive: true });
  
  // Filtering function (updated to include search)
  export function filterData(data, filters) {
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
  export function resetFilters(section) {
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
  export function applyFilters(section) {
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
  export function handleTransactionFiltersChange() {
    const filters = {
      type: document.getElementById('transaction-type-filter')?.value || 'all',
      category: document.getElementById('transaction-category-filter')?.value || 'all',
      sort: document.getElementById('transaction-sort')?.value || 'date-desc',
      search: document.querySelector('#Transactions .search-input')?.value || ''
    };
    fetchTransactions(filters);
  }
  
  export function handleRecurringFiltersChange() {
    const accountId = document.getElementById('recurring-account-selector')?.value || 'all';
    const type = document.getElementById('recurring-type-filter')?.value || 'all';
    const category = document.getElementById('recurring-category-filter')?.value || 'all';
    const status = document.getElementById('recurring-status-filter')?.value || 'all';
    const sort = document.getElementById('recurring-sort')?.value || 'name-asc';
    const searchTerm = document.querySelector('#Recurring .search-input')?.value || '';

    const filters = {
      type,
      category,
      status,
      sort,
      search: searchTerm
    };

    fetchRecurring(accountId === 'all' ? null : accountId, filters);
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

export function initializeFilters() {
  const filterButtons = document.querySelectorAll('.advanced-filters-btn');
  const filterPanels = document.querySelectorAll('.advanced-filters-panel');

  // Initialize filter buttons and panels
  filterButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const targetPanelId = button.dataset.target;
      const targetPanel = document.getElementById(targetPanelId);
      
      if (targetPanel) {
        positionFilterPanel(button, targetPanel);
        
        filterPanels.forEach(panel => {
          if (panel.id !== targetPanelId) {
            panel.classList.remove('active');
          }
        });
        
        targetPanel.classList.toggle('active');
      }
    });
  });

  // Close panels when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.advanced-filters-panel') && 
        !e.target.closest('.advanced-filters-btn')) {
      filterPanels.forEach(panel => {
        panel.classList.remove('active');
      });
    }
  });

  // Only handle recurring and categories filters here
  ['recurring-type-filter', 'recurring-category-filter', 'recurring-sort'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', handleRecurringFiltersChange);
  });
  
  ['category-type-filter', 'category-sort'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', fetchCategories);
  });
}
