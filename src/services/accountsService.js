import { formatCurrency } from '../utils/formatters.js';
import { fetchTotalBalance } from './reportsService.js';
import { populateAccountDropdowns } from '../utils/dropdownHelpers.js';
import { fetchTransactions } from './transactionsService.js';
import { renderDashboardCharts } from './chartsService.js';
import { fetchRecurring } from './recurringService.js';
import { updateEmptyStates } from '../utils/emptyStates.js';
import { showError } from '../utils/utils.js';

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

    // Calculate recurring totals for current month
    const currentDate = new Date();
    const currentDay = currentDate.getDate();
    
    const recurringTotal = recurring
      .filter(r => r.is_active && r.billing_date <= currentDay)
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
          // Hide displays, show edit inputs
          nameDisplay.style.display = 'none';
          nameEdit.style.display = 'inline';
          balanceDisplay.style.display = 'none';
          balanceEdit.style.display = 'inline';
          editBtn.style.display = 'none';
          saveBtn.style.display = 'inline';
        });
        
        saveBtn.addEventListener('click', async () => {
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
          
          console.log('Sending update data:', updateData);  // Debug log
          
          const { error: updateError } = await window.databaseApi.updateAccount(updateData);
          
          if (updateError) {
            console.error('Error updating account:', updateError);
            showError('Failed to update account');
            return;
          }
          
          // Update displays
          nameDisplay.textContent = newName;
          balanceDisplay.textContent = `${formatCurrency(newBalance)}`;
          
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
        });
        
        // Add delete button event listener
        const deleteBtn = row.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', async () => {
          if (confirm(`Are you sure you want to delete account "${account.name}"? This will also delete all associated transactions.`)) {
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
          }
        });
        
        accountsTableBody.appendChild(row);
      }
      
      return data;
    } catch (err) {
      console.error('Error fetching accounts:', err);
      throw err;
    }
  }