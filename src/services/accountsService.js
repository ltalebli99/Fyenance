import { formatCurrency } from '../utils/formatters.js';
import { fetchTotalBalance } from './reportsService.js';
import { populateAccountDropdowns } from '../utils/dropdownHelpers.js';
import { fetchTransactions } from './transactionsService.js';
import { renderDashboardCharts } from './chartsService.js';
import { fetchRecurring } from './recurringService.js';
import { updateEmptyStates } from '../utils/emptyStates.js';
import { showError } from '../utils/utils.js';
import { showDeleteConfirmationModal } from '../utils/modals.js';

// Add at the top of the file
let currentlyEditingAccountId = null;

document.addEventListener('click', (e) => {
  if (currentlyEditingAccountId) {
    const editRow = document.querySelector(`[data-account-id="${currentlyEditingAccountId}"]`)?.closest('tr');
    if (editRow && !editRow.contains(e.target)) {
      const nameDisplay = editRow.querySelector('.name-display');
      const nameEdit = editRow.querySelector('.name-edit');
      const balanceDisplay = editRow.querySelector('.balance-display');
      const balanceEdit = editRow.querySelector('.balance-edit');
      const editBtn = editRow.querySelector('.edit-btn');
      const saveBtn = editRow.querySelector('.save-btn');

      // Switch back to display mode
      nameDisplay.style.display = 'inline';
      nameEdit.style.display = 'none';
      balanceDisplay.style.display = 'inline';
      balanceEdit.style.display = 'none';
      editBtn.style.display = 'inline';
      saveBtn.style.display = 'none';

      currentlyEditingAccountId = null;
    }
  }
});

// Add this new function
async function calculateCurrentBalance(accountId) {
  try {
    // Get all transactions for this account using new method
    const { data: transactions, error: txError } = await window.databaseApi.getAllTransactions(accountId);
    if (txError) throw txError;

    // Get recurring transactions using new method
    const { data: recurring, error: recError } = await window.databaseApi.getAllRecurring(accountId);
    if (recError) throw recError;

    // Calculate transaction totals
    const transactionTotal = transactions.reduce((sum, tx) => {
      return sum + (tx.type === 'income' ? tx.amount : -tx.amount);
    }, 0);

    // Calculate recurring totals
    const currentDate = new Date();
    
    const recurringTotal = recurring
      .filter(r => {
        if (!r.is_active) return false;
        if (r.end_date && new Date(r.end_date) < currentDate) return false;
        
        const startDate = new Date(r.start_date);
        if (startDate > currentDate) return false;

        // Check if this recurring item should be counted based on frequency
        switch(r.frequency) {
          case 'daily':
            return true;
          case 'weekly':
            const daysSinceStart = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
            return daysSinceStart % 7 === 0;
          case 'monthly':
            return startDate.getDate() === currentDate.getDate();
          case 'yearly':
            return startDate.getDate() === currentDate.getDate() && 
                   startDate.getMonth() === currentDate.getMonth();
          default:
            return false;
        }
      })
      .reduce((sum, r) => {
        return sum + (r.type === 'income' ? r.amount : -r.amount);
      }, 0);

    return transactionTotal + recurringTotal;
  } catch (error) {
    console.error('Error calculating current balance:', error);
    return 0;
  }
}

// Add these helper functions
function getMonthlyChange(transactions) {
  if (!transactions || !Array.isArray(transactions)) return 0;
  
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  return transactions
    .filter(tx => new Date(tx.date) >= firstDayOfMonth)
    .reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0);
}

function getLastTransaction(transactions) {
  if (!transactions || !Array.isArray(transactions) || !transactions.length) return null;
  
  const sorted = [...transactions].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );
  return sorted[0];
}

function getActivityStatus(transactions) {
  if (!transactions || !Array.isArray(transactions) || !transactions.length) return 'inactive';
  
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );
  
  const lastTxDate = new Date(sortedTransactions[0].date);
  const now = new Date();
  const daysSinceLastTx = Math.floor((now - lastTxDate) / (1000 * 60 * 60 * 24));
  
  if (daysSinceLastTx <= 7) return 'active';
  if (daysSinceLastTx <= 30) return 'semi-active';
  return 'inactive';
}

// Fetch and display accounts
export async function fetchAccounts() {
    try {
      const { data, error } = await window.databaseApi.fetchAccounts();
      
      if (error) throw error;
      
      const accountsTableBody = document.getElementById('accounts-table-body');
      accountsTableBody.innerHTML = '';
      
      for (const account of data) {
        // Get transactions for this account
        const { data: transactions = [] } = await window.databaseApi.getAllTransactions(account.id);
        
        // Calculate current balance
        const currentBalanceChange = await calculateCurrentBalance(account.id);
        const currentBalance = parseFloat(account.balance) + currentBalanceChange;
        
        // Calculate monthly change
        const monthlyChange = getMonthlyChange(transactions);
        
        // Get last transaction
        const lastTx = getLastTransaction(transactions);
        
        // Get activity status
        const activityStatus = getActivityStatus(transactions);
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>
            <span class="name-display">${account.name}</span>
            <input type="text" class="name-edit" style="display: none" value="${account.name}">
          </td>
          <td>
            <span class="balance-display">${formatCurrency(account.balance)}</span>
            <input type="number" class="balance-edit" style="display: none" value="${account.balance}" step="0.01">
          </td>
          <td>
            <span class="current-balance">${formatCurrency(currentBalance)}</span>
          </td>
          <td class="${monthlyChange > 0 ? 'positive' : monthlyChange < 0 ? 'negative' : ''}">
            ${monthlyChange > 0 ? '+' : ''}${formatCurrency(Math.abs(monthlyChange))}
          </td>
          <td>
            ${lastTx ? `
              <div class="last-tx-info">
                <span class="last-tx-date">${new Date(lastTx.date).toLocaleDateString()}</span>
                <span class="last-tx-amount ${lastTx.type === 'income' ? 'positive' : 'negative'}">
                  ${lastTx.type === 'income' ? '+' : '-'}${formatCurrency(lastTx.amount)}
                </span>
              </div>
            ` : '-'}
          </td>
          <td>
            <div class="status-indicator ${activityStatus}">
              ${activityStatus === 'active' ? 'Active' : 
                activityStatus === 'semi-active' ? 'Semi-Active' : 'Inactive'}
            </div>
          </td>
          <td>
            <div class="action-buttons">
              <button class="action-btn edit-btn" data-account-id="${account.id}" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="action-btn save-btn" data-account-id="${account.id}" style="display: none" title="Save">
                <i class="fas fa-check"></i>
              </button>
              <button class="action-btn delete-btn" data-account-id="${account.id}" title="Delete">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </td>
        `;
        
        // Add event listeners for edit/save buttons
        const editBtn = row.querySelector('.edit-btn');
        const saveBtn = row.querySelector('.save-btn');
        const nameDisplay = row.querySelector('.name-display');
        const nameEdit = row.querySelector('.name-edit');
        const balanceDisplay = row.querySelector('.balance-display');
        const balanceEdit = row.querySelector('.balance-edit');
        
        editBtn.addEventListener('click', () => {
          // If another row is being edited, save it first
          if (currentlyEditingAccountId && currentlyEditingAccountId !== account.id) {
            const previousRow = document.querySelector(`[data-account-id="${currentlyEditingAccountId}"]`)?.closest('tr');
            if (previousRow) {
              const saveBtn = previousRow.querySelector('.save-btn');
              saveBtn?.click();
            }
          }

          // Set current editing account
          currentlyEditingAccountId = account.id;

          // Hide displays, show edit inputs
          nameDisplay.style.display = 'none';
          nameEdit.style.display = 'inline';
          balanceDisplay.style.display = 'none';
          balanceEdit.style.display = 'inline';
          editBtn.style.display = 'none';
          saveBtn.style.display = 'inline';
        });
        
        saveBtn.addEventListener('click', async () => {
          try {
            const newName = nameEdit.value.trim();
            const newBalance = parseFloat(balanceEdit.value);
            
            if (!newName) {
              showError('Account name cannot be empty');
              return;
            }
            
            const updateData = {
              id: account.id,
              balance: newBalance,
              name: newName
            };
            
            const { error: updateError } = await window.databaseApi.updateAccount(updateData);
            
            if (updateError) {
              console.error('Error updating account:', updateError);
              showError('Failed to update account');
              return;
            }
            
            // Clear currently editing state
            currentlyEditingAccountId = null;
            
            // Update displays
            nameDisplay.textContent = newName;
            balanceDisplay.textContent = formatCurrency(newBalance);
            
            // Switch back to display mode
            nameDisplay.style.display = 'inline';
            nameEdit.style.display = 'none';
            balanceDisplay.style.display = 'inline';
            balanceEdit.style.display = 'none';
            editBtn.style.display = 'inline';
            saveBtn.style.display = 'none';
            
            // Refresh related data
            await Promise.all([
              fetchTotalBalance(),
              fetchAccounts(),
              fetchTransactions(),
              fetchRecurring(),
              renderDashboardCharts(),
              populateAccountDropdowns()
            ]);
          } catch (error) {
            console.error('Error in save button handler:', error);
            showError('Failed to update account');
          }
        });
        
        // Add delete button event listener
        const deleteBtn = row.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async () => {
          showDeleteConfirmationModal({
            title: 'Delete Account', 
            message: `Are you sure you want to delete account "${account.name}"? This will also delete all associated transactions.`,
            onConfirm: async () => {
              try {
                const { error: deleteError } = await window.databaseApi.deleteAccount(account.id);
                
                if (deleteError) {
                  console.error('Error deleting account:', deleteError);
                  showError('Failed to delete account');
                  return;
                }
                
                // Refresh everything
                await Promise.all([
                  fetchAccounts(),
                  fetchTotalBalance(),
                  populateAccountDropdowns(),
                  fetchTransactions(),
                  renderDashboardCharts(),
                  updateEmptyStates()
                ]);
              } catch (error) {
                console.error('Error deleting account:', error);
                showError('Failed to delete account');
              }
            }
          });
        });
        
        accountsTableBody.appendChild(row);
      }
      
      return data;
    } catch (err) {
      console.error('Error fetching accounts:', err);
      throw err; 
    }
  }