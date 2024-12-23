import { formatCurrency, capitalizeFirstLetter } from '../utils/formatters.js';
import { showEditTransactionForm } from '../components/transactions.js';
import { showDeleteConfirmationModal } from '../utils/modals.js';
import { showError } from '../utils/utils.js';
import { refreshData } from '../utils/refresh.js';

// Fetch and display transactions
export async function fetchTransactions(accountId = null, filters = {}) {
  try {
    // Ensure filters object has all required properties with default values
    const safeFilters = {
      search: filters.search || '',
      type: filters.type || 'all',
      category: filters.category || 'all',
      sort: filters.sort || 'date-desc',
      limit: filters.limit,
      offset: filters.offset,
      ...filters
    };

    // Pass accountId to the database API call
    const { data: transactions, error } = await window.databaseApi.fetchTransactions(accountId);
    if (error) throw error;
    
    let filteredData = transactions ? [...transactions] : [];
    
    if (filteredData.length > 0) {
      // Apply filters first
      if (safeFilters.type && safeFilters.type !== 'all') {
        filteredData = filteredData.filter(t => t.type === safeFilters.type);
      }
      
      if (safeFilters.category && safeFilters.category !== 'all') {
        filteredData = filteredData.filter(t => t.category_id === parseInt(safeFilters.category));
      }
      
      if (safeFilters.search) {
        const searchTerm = safeFilters.search.toLowerCase();
        filteredData = filteredData.filter(t => {
          const formattedDate = new Date(t.date).toLocaleDateString();
          const formattedAmount = t.amount.toString();
          
          return [
            t.description?.toLowerCase(),
            t.category_name?.toLowerCase(),
            formattedDate.toLowerCase(),
            formattedAmount,
            t.type?.toLowerCase()
          ].some(field => field && field.includes(searchTerm));
        });
      }

      // Apply sorting
      const [field, direction] = safeFilters.sort.split('-');
      filteredData.sort((a, b) => {
        let comparison = 0;
        switch (field) {
          case 'date':
            comparison = new Date(a.date) - new Date(b.date);
            break;
          case 'amount':
            comparison = parseFloat(a.amount) - parseFloat(b.amount);
            break;
          case 'description':
            comparison = (a.description || '').localeCompare(b.description || '');
            break;
          case 'category':
            comparison = (a.category_name || '').localeCompare(b.category_name || '');
            break;
          case 'type':
            comparison = a.type.localeCompare(b.type);
            break;
          default:
            comparison = 0;
        }
        return direction === 'asc' ? comparison : -comparison;
      });

      // Store total count before pagination
      const totalCount = filteredData.length;
      
      // Apply pagination if limit is provided
      if (safeFilters.limit) {
        const offset = safeFilters.offset || 0;
        filteredData = filteredData.slice(offset, offset + safeFilters.limit);
      }

      // Update the transactions table
      const tableBody = document.getElementById('transactions-table-body');
      if (tableBody) {
        tableBody.innerHTML = filteredData.length ? 
          filteredData.map(transaction => createTransactionRow(transaction)).join('') :
          '<tr><td colspan="6" class="empty-table">No transactions found</td></tr>';
      }

      return {
        data: filteredData,
        totalCount
      };
    }

    return {
      data: [],
      totalCount: 0
    };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    throw error;
  }
}

// Create transaction row
export function createTransactionRow(transaction) {
  const date = new Date(transaction.date);
  const formattedDate = date.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric',
    timeZone: 'UTC' 
  });

  // Extract type from category_name
  const transactionType = transaction.category_name?.split('-')[0]?.trim().toLowerCase() || 'expense';

  const row = document.createElement('tr');
  row.dataset.transactionId = transaction.id;
  row.innerHTML = `
    <td>${formattedDate}</td>
    <td>${capitalizeFirstLetter(transactionType)}</td>
    <td>${transaction.category_name?.split('-')[1]?.trim() || 'Uncategorized'}</td>
    <td class="${transactionType === 'income' ? 'positive' : 'negative'}">
      ${transactionType === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}
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

  row.querySelector('.delete-btn').addEventListener('click', async () => {
    const confirmed = await showDeleteConfirmationModal({
        title: 'Delete Transaction',
        message: 'Are you sure you want to delete this transaction?',
        onConfirm: async () => {
            await deleteTransaction(transaction.id);
        }
    });
    if (confirmed) {
      try {
        const { error } = await window.databaseApi.deleteTransaction(transaction.id);
        if (error) throw error;
        
        // Refresh the transactions list
        refreshData();
        
        // Remove the row from the table
        row.remove();
      } catch (error) {
        console.error('Error deleting transaction:', error);
        showError('Failed to delete transaction');
      }
    }
  });

  return row;
}

// Delete transaction
export async function deleteTransaction(id) {
  try {
    // Show confirmation dialog
    const confirmed = await showDeleteConfirmationModal({
        title: 'Delete Transaction',
        message: 'Are you sure you want to delete this transaction?',
        onConfirm: async () => {
            await deleteTransaction(id);
        }
    });
    if (!confirmed) return { success: false };

    // Delete from database
    const { error } = await window.databaseApi.deleteTransaction(id);
    if (error) throw error;
    
    // Refresh all relevant data
    await Promise.all([
      refreshData()
    ]);

    return { success: true };
  } catch (error) {
    console.error('Error deleting transaction:', error);
    showError('Failed to delete transaction');
    return { success: false, error: error.message };
  }
} 