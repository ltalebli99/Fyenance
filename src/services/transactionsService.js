import { formatCurrency, capitalizeFirstLetter } from '../utils/formatters.js';
import { showEditTransactionForm } from '../components/transactions.js';
import { confirmDelete } from '../utils/utils.js';
import { showError } from '../utils/utils.js';
import { refreshData } from '../utils/refresh.js';

// Fetch and display transactions
export async function fetchTransactions(filters = {}) {
  try {
    const { data: transactions, error } = await window.databaseApi.fetchTransactions();
    if (error) throw error;
    
    let filteredData = transactions ? [...transactions] : [];
    
    if (filteredData.length > 0) {
      // Apply filters first
      if (filters.type && filters.type !== 'all') {
        filteredData = filteredData.filter(t => t.type === filters.type);
      }
      
      if (filters.category && filters.category !== 'all') {
        filteredData = filteredData.filter(t => t.category_id === parseInt(filters.category));
      }
      
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredData = filteredData.filter(t => {
          // Format date for searching
          const formattedDate = new Date(t.date).toLocaleDateString();
          // Format amount for searching
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
      if (filters.sort) {
        const [field, direction] = filters.sort.split('-');
        filteredData.sort((a, b) => {
          let comparison = 0;
          switch (field) {
            case 'date':
              comparison = new Date(a.date) - new Date(b.date);
              break;
            case 'amount':
              comparison = parseFloat(a.amount) - parseFloat(b.amount);
              break;
            default:
              comparison = 0;
          }
          return direction === 'asc' ? comparison : -comparison;
        });
      } else {
        // Default sort by date descending
        filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));
      }

      // Store total count before pagination
      const totalCount = filteredData.length;
      
      // Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit || filteredData.length;
      
      filteredData = filteredData.slice(offset, offset + limit);
      
      // Add total count to the first item for pagination
      if (filteredData.length > 0) {
        filteredData[0].total_count = totalCount;
      }
    }

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

  // Extract type from category_name
  const transactionType = transaction.category_name?.split('-')[0]?.trim().toLowerCase() || 'expense';

  const row = document.createElement('tr');
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
    const confirmed = await confirmDelete('transaction');
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
    const confirmed = await confirmDelete('transaction');
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