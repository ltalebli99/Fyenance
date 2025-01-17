import { capitalizeFirstLetter } from '../utils/formatters.js';
import { showEditCategoryForm, handleDeleteCategory } from '../components/categories.js';
import { updateEmptyStates } from '../utils/emptyStates.js';
import { populateCategoryDropdowns } from '../utils/dropdownHelpers.js';
import { formatCurrency } from '../utils/formatters.js';
import { TablePagination } from '../utils/pagination.js';

export let categoriesPagination;

// Fetch and populate categories in Transaction and Recurring Forms
export async function fetchCategories(filters = {}) {
  try {
    // Initialize pagination if not already done
    if (!categoriesPagination) {
      categoriesPagination = new TablePagination('categories-table-body', {
        itemsPerPage: 10,
        onPageChange: async (page) => {
          // Get current filters and update offset based on new page
          const currentFilters = {
            type: document.getElementById('category-type-filter')?.value || 'all',
            usage: document.getElementById('category-usage-filter')?.value || 'all',
            sort: document.getElementById('category-sort')?.value || 'name-asc',
            search: document.querySelector('#Categories .search-input')?.value || '',
            limit: categoriesPagination.getLimit(),
            offset: (page - 1) * categoriesPagination.getLimit()
          };
          await fetchCategories(currentFilters);
        }
      });
    }

    // Only reset pagination if it's a new filter (not a page change)
    if (!filters.hasOwnProperty('offset') && (filters.search || filters.type || filters.usage)) {
      categoriesPagination.currentPage = 1;
      filters.offset = 0;
    }

    const { data: categories } = await window.databaseApi.fetchCategories();
    let filteredData = categories ? [...categories] : [];

    // Apply type filter
    if (filters.type && filters.type !== 'all') {
      filteredData = filteredData.filter(c => c.type === filters.type);
    }

    // Apply usage filter
    if (filters.usage && filters.usage !== 'all') {
      switch (filters.usage) {
        case 'active':
          filteredData = filteredData.filter(c => c.usage_count > 0);
          break;
        case 'unused':
          filteredData = filteredData.filter(c => c.usage_count === 0);
          break;
      }
    }

    // Apply search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredData = filteredData.filter(c => {
        // Format budget amount for searching
        const budgetAmount = c.budget_amount ? c.budget_amount.toString() : '';
        // Format last used date for searching
        const lastUsed = c.last_used ? new Date(c.last_used).toLocaleDateString() : '';
        
        return [
          c.name?.toLowerCase(),
          c.type?.toLowerCase(),
          budgetAmount,
          c.budget_frequency?.toLowerCase(),
          lastUsed,
          c.description?.toLowerCase()
        ].some(field => field && field.includes(searchTerm));
      });
    }

    // Get total count before sorting and pagination
    const totalCount = filteredData.length;

    // Apply sorting
    if (filters.sort) {
      const [field, direction] = filters.sort.split('-');
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
            const dateA = a.last_used ? new Date(a.last_used) : new Date(0);
            const dateB = b.last_used ? new Date(b.last_used) : new Date(0);
            comparison = dateA - dateB;
            break;
        }
        return direction === 'asc' ? comparison : -comparison;
      });
    }

    // Apply pagination
    const start = filters.offset || 0;
    const end = start + (filters.limit || categoriesPagination?.getLimit() || 10);
    filteredData = filteredData.slice(start, end);

    const tableBody = document.getElementById('categories-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    // Update pagination with total count and current page
    if (categoriesPagination) {
      categoriesPagination.totalItems = totalCount;
      if (filters.offset !== undefined) {
        categoriesPagination.currentPage = Math.floor(filters.offset / categoriesPagination.getLimit()) + 1;
      }
      categoriesPagination.updatePagination(totalCount);
    }

    if (filteredData.length > 0) {
      filteredData.forEach(category => {
        const row = createCategoryRow(category);
        tableBody.appendChild(row);
      });
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="table-empty-state">No categories found</td>
        </tr>
      `;
    }

    return filteredData;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
}

function createCategoryRow(category) {
  const lastUsedDate = category.last_used 
    ? new Date(category.last_used).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      })
    : 'Never';

  const budgetDisplay = category.budget_amount 
    ? `${formatCurrency(category.budget_amount)} ${category.budget_frequency}`
    : 'No budget';

  const row = document.createElement('tr');
  row.innerHTML = `
    <td>${category.name}</td>
    <td>${capitalizeFirstLetter(category.type)}</td>
    <td>${category.usage_count || 0}</td>
    <td>${lastUsedDate}</td>
    <td>${category.budget_amount ? formatCurrency(category.budget_amount) : '-'}</td>
    <td>${category.budget_frequency ? capitalizeFirstLetter(category.budget_frequency) : '-'}</td>
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

  // Add event listeners
  row.querySelector('.edit-btn').addEventListener('click', () => {
    showEditCategoryForm(category);
  });

  row.querySelector('.delete-btn').addEventListener('click', () => {
    handleDeleteCategory(category.id);
  });

  return row;
}

export async function createDefaultCategories() {
    const defaultCategories = [
        { name: 'Dining Out', type: 'expense' },
        { name: 'Groceries', type: 'expense' },
        { name: 'Entertainment', type: 'expense' },
        { name: 'Transportation', type: 'expense' },
        { name: 'Utilities', type: 'expense' },
        { name: 'Rent', type: 'expense' },
        { name: 'Shopping', type: 'expense' },
        { name: 'Healthcare', type: 'expense' },
        { name: 'Coffee', type: 'expense' },
        { name: 'Salary', type: 'income' },
        { name: 'Investments', type: 'income' },
        { name: 'Gifts', type: 'income' },
        { name: 'Refunds', type: 'income' }
    ];

    try {
        for (const category of defaultCategories) {
            await window.databaseApi.addCategory(category);
        }

        // Refresh the UI
        await Promise.all([
            fetchCategories(),
            populateCategoryDropdowns(),
            updateEmptyStates()
        ]);

    } catch (error) {
        console.error('Error creating default categories:', error);
        throw error;
    }
}