import { capitalizeFirstLetter } from '../utils/formatters.js';
import { showEditCategoryForm, handleDeleteCategory } from '../components/categories.js';
import { updateEmptyStates } from '../utils/emptyStates.js';
import { populateCategoryDropdowns } from '../utils/dropdownHelpers.js';
import { formatCurrency } from '../utils/formatters.js';
import { TablePagination } from '../utils/pagination.js';

let categoriesPagination;

// Fetch and populate categories in Transaction and Recurring Forms
export async function fetchCategories(filters = {}) {
  try {
    // Initialize pagination if not already done
    if (!categoriesPagination) {
      categoriesPagination = new TablePagination('categories-table-body', {
        itemsPerPage: 10
      });
      categoriesPagination.onPageChange = (page) => {
        fetchCategories(filters);
      };
    }

    const { data: categories } = await window.databaseApi.fetchCategories({
      ...filters,
      limit: categoriesPagination.itemsPerPage,
      offset: (categoriesPagination.currentPage - 1) * categoriesPagination.itemsPerPage
    });

    let filteredData = categories ? [...categories] : [];

    // Apply filters
    if (filteredData.length > 0) {
      // Type filter
      if (filters.type && filters.type !== 'all') {
        filteredData = filteredData.filter(c => c.type === filters.type);
      }

      // Usage filter
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

      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredData = filteredData.filter(c => 
          c.name.toLowerCase().includes(searchTerm) ||
          c.type.toLowerCase().includes(searchTerm)
        );
      }

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
    }

    const tableBody = document.getElementById('categories-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    // Update pagination with total count
    const totalCount = categories[0]?.total_count || 0;
    categoriesPagination.updatePagination(totalCount);

    if (filteredData.length > 0) {
      filteredData.forEach(category => {
        const row = createCategoryRow(category);
        tableBody.appendChild(row);
      });
    } else {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">No categories found</td>
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
    <td>${category.budget_amount ? '$' + formatCurrency(category.budget_amount) : '-'}</td>
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