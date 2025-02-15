import { capitalizeFirstLetter, getAmountValue, formatInitialAmount, initializeAmountInput } from '../utils/formatters.js';
import { openModal, closeModal, showError } from '../utils/utils.js';
import { debounce, positionFilterPanel } from '../utils/filters.js';
import { fetchCategories, createDefaultCategories, categoriesPagination } from '../services/categoriesService.js';
import { refreshData } from '../utils/refresh.js';
import { resetFormAndInputs } from '../utils/initInputs.js';
import { showDeleteConfirmationModal } from '../utils/modals.js';

// Add form references
const addCategoryForm = document.getElementById('add-category-form');
const editCategoryForm = document.getElementById('edit-category-form');
  
export async function handleDeleteCategory(categoryId) {
    showDeleteConfirmationModal({
        title: 'Delete Category',
        message: 'Are you sure you want to delete this category? Associated transactions will become uncategorized.',
        onConfirm: async () => {
            try {
                const { error } = await window.databaseApi.deleteCategory(categoryId);
                if (error) {
                    console.error('Error deleting category:', error);
                    showError('Failed to delete category');
                } else {
                    await refreshData({
                        all: true
                    });
                    // First update pagination UI
                    if (categoriesPagination) {
                        categoriesPagination.currentPage = 1;
                        categoriesPagination.updatePagination(categoriesPagination.totalItems);
                    }
                    // Then fetch with correct offset
                    await fetchCategories({
                        offset: 0,
                        limit: categoriesPagination?.getLimit() || 10
                    });
                }
            } catch (error) {
                console.error('Error deleting category:', error);
                showError('Failed to delete category');
            }
        }
    });
}


  // Add Category button click handler
document.getElementById('show-add-category')?.addEventListener('click', () => {
    openModal('add-category-modal');
  });
  

// Update showEditCategoryForm function
export async function showEditCategoryForm(category) {
    document.getElementById('edit-category-id').value = category.id;
    document.getElementById('edit-category-name').value = category.name;
    document.getElementById('edit-category-type').value = category.type;
    document.getElementById('edit-category-budget').value = formatInitialAmount(category.budget_amount) || '0.00';
    initializeAmountInput(document.getElementById('edit-category-budget'));
    document.getElementById('edit-category-frequency').value = category.budget_frequency || 'monthly';
    
    // Also update the type dropdown to show the correct value
    const typeSelect = document.getElementById('edit-category-type');
    typeSelect.value = category.type;
    
    openModal('edit-category-modal');
  }
  
  

  
// Add event listener for the edit category form submission
document.getElementById('edit-category-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const categoryId = document.getElementById('edit-category-id').value;
    const updateData = {
      name: document.getElementById('edit-category-name').value.trim(),
      type: document.getElementById('edit-category-type').value,
      budget_amount: getAmountValue(document.getElementById('edit-category-budget')),
      budget_frequency: document.getElementById('edit-category-frequency').value || null
    };
  
    const { error } = await window.databaseApi.updateCategory(categoryId, updateData);
    if (error) {
      console.error('Error updating category:', error);
      return;
    }
  
    // Close modal and refresh data
    closeModal('edit-category-modal');
    await refreshData({
        all: true
    });

    // First update pagination UI
    if (categoriesPagination) {
      categoriesPagination.currentPage = 1;
      categoriesPagination.updatePagination(categoriesPagination.totalItems);
    }
    // Then fetch with correct offset
    await fetchCategories({
      offset: 0,
      limit: categoriesPagination?.getLimit() || 10
    });
    resetFormAndInputs(editCategoryForm);
  });
  
  document.getElementById('add-category-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newCategory = {
      name: document.getElementById('add-category-name').value.trim(),
      type: document.getElementById('add-category-type').value,
      budget_amount: getAmountValue(document.getElementById('add-category-budget')),
      budget_frequency: document.getElementById('add-category-frequency').value || null
    };
  
    try {
      const { error } = await window.databaseApi.addCategory(newCategory);
      if (error) {
        showError(error.message || 'Failed to add category');
        return;
      }
  
      resetFormAndInputs(addCategoryForm);
      closeModal('add-category-modal');
      await refreshData({
        all: true
      });

      // First update pagination UI
      if (categoriesPagination) {
        categoriesPagination.currentPage = 1;
        categoriesPagination.updatePagination(categoriesPagination.totalItems);
      }
      // Then fetch with correct offset
      await fetchCategories({
        offset: 0,
        limit: categoriesPagination?.getLimit() || 10
      });
    } catch (error) {
      console.error('Error adding category:', error);
      showError('Failed to add category');
    }
  });
  

// Initialize categories functionality
export function initializeCategories() {
  return new Promise((resolve, reject) => {
    try {
      // Add Category button
      document.getElementById('show-add-category')?.addEventListener('click', () => {
        openModal('add-category-modal');
      });

      // Initialize filters
      initializeCategoryFilters();

      // Add scroll event listener for the Categories section
      const categoriesSection = document.getElementById('Categories');
      if (categoriesSection) {
        categoriesSection.addEventListener('scroll', () => {
          const filtersPanel = document.getElementById('categories-filters');
          const filtersBtn = document.querySelector('[data-target="categories-filters"]');
          
          if (filtersPanel && filtersPanel.classList.contains('show')) {
            positionFilterPanel(filtersBtn, filtersPanel);
          }
        }, { passive: true });
      }

      // Add window resize handler for categories filters
      window.addEventListener('resize', () => {
        const filtersPanel = document.getElementById('categories-filters');
        const filtersBtn = document.querySelector('[data-target="categories-filters"]');
        
        if (filtersPanel && filtersPanel.classList.contains('show')) {
          positionFilterPanel(filtersBtn, filtersPanel);
        }
      });

      // Add event listener for default categories button
      const createDefaultCategoriesBtn = document.getElementById('create-default-categories');
      if (createDefaultCategoriesBtn) {
        createDefaultCategoriesBtn.addEventListener('click', async () => {
          try {
            createDefaultCategoriesBtn.disabled = true;
            createDefaultCategoriesBtn.textContent = 'Creating Categories...';
            
            await createDefaultCategories();
            
            // Success! The UI will be updated by createDefaultCategories
          } catch (error) {
            console.error('Error creating default categories:', error);
            showError('Failed to create default categories');
          } finally {
            createDefaultCategoriesBtn.disabled = false;
            createDefaultCategoriesBtn.textContent = 'Use Recommended Categories';
          }
        });
      }

      resolve(); // Successfully initialized
    } catch (error) {
      reject(error); // Something went wrong during initialization
    }
  });
}

function initializeCategoryFilters() {
  const filtersBtn = document.querySelector('[data-target="categories-filters"]');
  const filtersPanel = document.getElementById('categories-filters');
  const searchInput = document.querySelector('#Categories .search-input');

  if (!filtersBtn || !filtersPanel) {
    console.error('Category filter elements not found');
    return;
  }

  // Filter button click handler
  filtersBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    filtersPanel.classList.toggle('show');
    if (filtersPanel.classList.contains('show')) {
      positionFilterPanel(filtersBtn, filtersPanel);
    }
  });

  // Close filters when clicking outside
  document.addEventListener('click', (e) => {
    if (!filtersPanel.contains(e.target) && !filtersBtn.contains(e.target)) {
      filtersPanel.classList.remove('show');
    }
  });

  // Close button handler
  const closeBtn = filtersPanel.querySelector('.close-filters');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      filtersPanel.classList.remove('show');
    });
  }

  // Apply filters button handler
  document.getElementById('apply-category-filters')?.addEventListener('click', async () => {
    const filters = {
      type: document.getElementById('category-type-filter')?.value || 'all',
      usage: document.getElementById('category-usage-filter')?.value || 'all',
      sort: document.getElementById('category-sort')?.value || 'name-asc',
      search: searchInput?.value || ''
    };
    await fetchCategories(filters);
    filtersPanel.classList.remove('show');
  });

  // Reset filters button handler
  document.getElementById('reset-category-filters')?.addEventListener('click', async () => {
    // Reset all filter inputs
    if (document.getElementById('category-type-filter')) {
        document.getElementById('category-type-filter').value = 'all';
    }
    if (document.getElementById('category-usage-filter')) {
        document.getElementById('category-usage-filter').value = 'all';
    }
    if (document.getElementById('category-sort')) {
        document.getElementById('category-sort').value = 'name-asc';
    }
    if (searchInput) {
        searchInput.value = '';
    }

    // Reset pagination to first page
    if (categoriesPagination) {
        categoriesPagination.currentPage = 1;
    }

    // Fetch with reset filters and pagination
    await fetchCategories({
        offset: 0,
        limit: categoriesPagination?.getLimit() || 10
    });
    
    filtersPanel.classList.remove('show');
  });

  // Search input handler with debounce
  searchInput?.addEventListener('input', debounce(async () => {
    await handleCategoriesFilterChange();
  }, 300));

  // Individual filter change handlers
  ['category-type-filter', 'category-usage-filter', 'category-sort'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', async () => {
      await handleCategoriesFilterChange();
    });
  });
}
  
export async function deleteCategory(id) {
    showDeleteConfirmationModal({
        title: 'Delete Category',
        message: 'Are you sure you want to delete this category? Associated transactions will become uncategorized.',
        onConfirm: async () => {
            try {
                const { error } = await window.databaseApi.deleteCategory(id);
                if (error) throw error;
                
                await refreshData({
                    all: true
                });
            } catch (error) {
                console.error('Error deleting category:', error);
                showError('Failed to delete category');
            }
        }
    });
}
  
export async function handleCategoriesFilterChange() {
  // Initialize pagination if not already done
  if (!categoriesPagination) {
    categoriesPagination = new TablePagination('categories-table-body', {
      itemsPerPage: 10,
      onPageChange: async (page) => {
        const filters = getCurrentFilters();
        await fetchCategories(filters);
      }
    });
  }

  // Reset to first page when filters change AND update UI
  categoriesPagination.currentPage = 1;
  categoriesPagination.updatePagination(categoriesPagination.totalItems);

  const filters = getCurrentFilters();
  filters.offset = 0; // Reset offset when filters change
  
  await fetchCategories(filters);
}

// Add helper function to get current filters
function getCurrentFilters() {
  return {
    type: document.getElementById('category-type-filter')?.value || 'all',
    usage: document.getElementById('category-usage-filter')?.value || 'all',
    sort: document.getElementById('category-sort')?.value || 'name-asc',
    search: document.querySelector('#Categories .search-input')?.value || '',
    limit: categoriesPagination?.getLimit() || 10,
    offset: categoriesPagination?.getOffset() || 0
  };
}
  