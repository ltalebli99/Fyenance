import { capitalizeFirstLetter } from '../utils/formatters.js';
import { openModal, closeModal, showError } from '../utils/utils.js';
import { debounce, positionFilterPanel } from '../utils/filters.js';
import { fetchCategories } from '../services/categoriesService.js';
import { createDefaultCategories } from '../services/categoriesService.js';
import { refreshData } from '../utils/refresh.js';

// Category event handlers
export async function handleAddCategory(e) {
    e.preventDefault();
    const name = document.getElementById('add-category-name').value;
    const type = document.getElementById('add-category-type').value;
    const budgetAmount = document.getElementById('add-category-budget').value;
    const budgetFrequency = document.getElementById('add-category-frequency').value;
  
    const { error } = await window.databaseApi.addCategory({ 
      name, 
      type,
      budget_amount: budgetAmount || null,
      budget_frequency: budgetFrequency || null
    });
    if (error) {
      console.error('Error adding category:', error);
    } else {
      closeModal('add-category-modal');
      await refreshData({
        all: true
      });
      e.target.reset();
    }
  }
  
  export async function handleEditCategory(e) {
    e.preventDefault();
    const id = document.getElementById('edit-category-id').value;
    const name = document.getElementById('edit-category-name').value;
    const type = document.getElementById('edit-category-type').value;
    const budgetAmount = document.getElementById('edit-category-budget').value;
    const budgetFrequency = document.getElementById('edit-category-frequency').value;
  
    const { error } = await window.databaseApi.updateCategory(id, { 
      name, 
      type,
      budget_amount: budgetAmount || null,
      budget_frequency: budgetFrequency || null
    });
  
    if (error) {
      console.error('Error updating category:', error);
      return;
    }
  
    closeModal('edit-category-modal');
    await refreshData({
        all: true
    });
    e.target.reset();
  }
  
  export async function handleDeleteCategory(categoryId) {
    if (confirm('Are you sure you want to delete this category? Associated transactions will become uncategorized.')) {
      const { error } = await window.databaseApi.deleteCategory(categoryId);
      if (error) {
        console.error('Error deleting category:', error);
      } else {
        await refreshData({
            all: true
        });
      }
    }
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
    document.getElementById('edit-category-budget').value = category.budget_amount || '0.00';
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
      budget_amount: document.getElementById('edit-category-budget').value || null,
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
    e.target.reset();
  });
  
  document.getElementById('add-category-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newCategory = {
      name: document.getElementById('add-category-name').value.trim(),
      type: document.getElementById('add-category-type').value,
      budget_amount: document.getElementById('add-category-budget').value || null,
      budget_frequency: document.getElementById('add-category-frequency').value || null
    };
  
    try {
      const { error } = await window.databaseApi.addCategory(newCategory);
      if (error) throw error;
  
      // Close modal and refresh data
      closeModal('add-category-modal');
      await refreshData({
        all: true
      });
      e.target.reset();
    } catch (error) {
      console.error('Error adding category:', error);
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
    await fetchCategories({});
    filtersPanel.classList.remove('show');
  });

  // Search input handler with debounce
  searchInput?.addEventListener('input', debounce(async (e) => {
    const filters = {
      type: document.getElementById('category-type-filter')?.value || 'all',
      usage: document.getElementById('category-usage-filter')?.value || 'all',
      sort: document.getElementById('category-sort')?.value || 'name-asc',
      search: e.target.value
    };
    await fetchCategories(filters);
  }, 300));

  // Individual filter change handlers
  ['category-type-filter', 'category-usage-filter', 'category-sort'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', async () => {
      const filters = {
        type: document.getElementById('category-type-filter')?.value || 'all',
        usage: document.getElementById('category-usage-filter')?.value || 'all',
        sort: document.getElementById('category-sort')?.value || 'name-asc',
        search: searchInput?.value || ''
      };
      await fetchCategories(filters);
    });
  });
}
  
export async function deleteCategory(id) {
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
  