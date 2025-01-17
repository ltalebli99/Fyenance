import { formatCurrency, capitalizeFirstLetter } from '../utils/formatters.js';
import { showEditTransactionForm } from '../components/transactions.js';
import { showDeleteConfirmationModal } from '../utils/modals.js';
import { showError } from '../utils/utils.js';
import { refreshData } from '../utils/refresh.js';
import { parseSearchDate, isSameDay } from '../utils/dateSearch.js';

// Fetch and display transactions
export async function fetchTransactions(filters = {}) {
  try {
    const safeFilters = {
      type: filters.type || 'all',
      category: filters.category || 'all',
      sort: filters.sort || 'date-desc',
      search: filters.search || '',
      accounts: filters.accounts || ['all'],
      limit: filters.limit || 10,
      offset: filters.offset || 0
    };

    // Fetch transactions from database
    const { data: transactions, error } = await window.databaseApi.fetchTransactions(safeFilters.accounts, {
      type: safeFilters.type,
      category: safeFilters.category,
      sort: safeFilters.sort,
      search: safeFilters.search
    });
    
    if (error) throw error;

    let filteredData = [...transactions];

    // Apply filters
    if (safeFilters.type !== 'all') {
      filteredData = filteredData.filter(t => t.type === safeFilters.type);
    }
    if (safeFilters.category !== 'all') {
      filteredData = filteredData.filter(t => t.category_id === parseInt(safeFilters.category));
    }
    if (safeFilters.search) {
      const searchLower = safeFilters.search.toLowerCase();
      filteredData = filteredData.filter(t => 
        t.description?.toLowerCase().includes(searchLower) ||
        t.category_name?.toLowerCase().includes(searchLower) ||
        t.account_name?.toLowerCase().includes(searchLower)
      );
    }
    // Add account filtering
    if (!safeFilters.accounts.includes('all')) {
      filteredData = filteredData.filter(t => safeFilters.accounts.includes(t.account_id.toString()));
    }

    // Store total count AFTER filtering but BEFORE pagination
    const totalCount = filteredData.length;

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
        default:
          comparison = 0;
      }
      return direction === 'asc' ? comparison : -comparison;
    });

    // Apply pagination
    const start = safeFilters.offset;
    const end = start + safeFilters.limit;
    filteredData = filteredData.slice(start, end);

    // Add total_count to all items
    filteredData = filteredData.map(item => ({
      ...item,
      total_count: totalCount
    }));

    return { data: filteredData, error: null };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return { data: null, error: error.message };
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

  const transactionType = transaction.category_name?.split('-')[0]?.trim().toLowerCase() || 'expense';

  const row = document.createElement('tr');
  row.dataset.transactionId = transaction.id;
  row.innerHTML = `
    <td>${formattedDate}</td>
    <td>${transaction.account_name || 'Unknown Account'}</td>
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