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
    // Get all transactions for this account
    const { data: transactions, error: txError } = await window.databaseApi.getAllTransactions(accountId);
    if (txError) throw txError;

    // Get recurring transactions
    const { data: recurring, error: recError } = await window.databaseApi.getAllRecurring(accountId);
    if (recError) throw recError;

    // Calculate transaction totals
    const transactionTotal = transactions.reduce((sum, tx) => {
      return sum + (tx.type === 'income' ? tx.amount : -tx.amount);
    }, 0);

    // Calculate recurring totals up to current date
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const recurringTotal = recurring
      .filter(r => {
        if (!r.is_active) return false;
        
        // Normalize start date to UTC midnight
        const startDate = new Date(r.start_date);
        startDate.setUTCHours(0, 0, 0, 0);
        
        // Normalize current date to UTC midnight
        const utcCurrentDate = new Date();
        utcCurrentDate.setUTCHours(0, 0, 0, 0);
        
        // Don't include if it hasn't started yet
        if (startDate > utcCurrentDate) return false;
        
        // Don't include if it has ended (normalize end date too)
        if (r.end_date) {
          const endDate = new Date(r.end_date);
          endDate.setUTCHours(0, 0, 0, 0);
          if (endDate < utcCurrentDate) return false;
        }
        
        return true;
      })
      .reduce((sum, r) => {
        // Normalize start date to UTC midnight
        const startDate = new Date(r.start_date);
        startDate.setUTCHours(0, 0, 0, 0);
        
        // Calculate up to yesterday in UTC
        const utcYesterday = new Date();
        utcYesterday.setUTCHours(0, 0, 0, 0);
        utcYesterday.setUTCDate(utcYesterday.getUTCDate() - 1);
        
        let occurrences = 0;
        const daysDiff = Math.floor((utcYesterday - startDate) / (1000 * 60 * 60 * 24));
        
        switch(r.frequency) {
          case 'daily':
            occurrences = daysDiff + 1;
            break;
          case 'weekly':
            occurrences = Math.floor(daysDiff / 7);
            // Add one more if we've passed the day of week
            if (utcYesterday.getUTCDay() >= startDate.getUTCDay()) occurrences++;
            break;
          case 'monthly':
            occurrences = (utcYesterday.getUTCFullYear() - startDate.getUTCFullYear()) * 12 
              + (utcYesterday.getUTCMonth() - startDate.getUTCMonth());
            // Add one more if we've passed the day of month
            if (utcYesterday.getUTCDate() >= startDate.getUTCDate()) occurrences++;
            break;
          case 'yearly':
            occurrences = utcYesterday.getUTCFullYear() - startDate.getUTCFullYear();
            // Add one more if we've passed the month and day
            if (utcYesterday.getUTCMonth() > startDate.getUTCMonth() || 
               (utcYesterday.getUTCMonth() === startDate.getUTCMonth() && 
                utcYesterday.getUTCDate() >= startDate.getUTCDate())) {
              occurrences++;
            }
            break;
        }

        const amount = parseFloat(r.amount);
        return sum + (r.type === 'income' ? amount : -amount) * Math.max(0, occurrences);
      }, 0);

    return transactionTotal + recurringTotal;
  } catch (error) {
    console.error('Error calculating current balance:', error);
    return 0;
  }
}

// Add these helper functions
function getMonthlyChange(transactions, recurring = []) {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Calculate transaction changes
  const transactionChange = transactions
    .filter(tx => new Date(tx.date) >= firstDayOfMonth)
    .reduce((sum, tx) => sum + (tx.type === 'income' ? tx.amount : -tx.amount), 0);

  // Calculate recurring changes for this month
  const recurringChange = recurring
    .filter(r => r.is_active)
    .reduce((sum, r) => {
      const startDate = new Date(r.start_date);
      startDate.setUTCHours(0, 0, 0, 0);
      
      // Skip if recurring hasn't started yet
      if (startDate > now) return sum;
      
      // Skip if recurring has ended
      if (r.end_date && new Date(r.end_date) < firstDayOfMonth) return sum;

      let occurrences = 0;
      const currentDate = new Date();
      currentDate.setUTCHours(0, 0, 0, 0);

      switch(r.frequency) {
        case 'daily':
          const daysSinceStart = Math.floor((currentDate - firstDayOfMonth) / (1000 * 60 * 60 * 24)) + 1;
          occurrences = Math.min(daysSinceStart, currentDate.getDate());
          break;
        case 'weekly':
          const weeksSinceStart = Math.floor((currentDate - firstDayOfMonth) / (1000 * 60 * 60 * 24 * 7));
          occurrences = weeksSinceStart + (currentDate.getDay() >= startDate.getDay() ? 1 : 0);
          break;
        case 'monthly':
          occurrences = currentDate.getDate() >= startDate.getDate() ? 1 : 0;
          break;
        case 'yearly':
          occurrences = (currentDate.getMonth() === startDate.getMonth() && 
                        currentDate.getDate() >= startDate.getDate()) ? 1 : 0;
          break;
      }

      const amount = parseFloat(r.amount);
      return sum + (r.type === 'income' ? amount : -amount) * Math.max(0, occurrences);
    }, 0);

  return transactionChange + recurringChange;
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

// Add this new function
async function getLastActivity(accountId) {
  try {
    // Get all transactions for this account
    const { data: transactions, error: txError } = await window.databaseApi.getAllTransactions(accountId);
    if (txError) throw txError;

    // Get recurring transactions
    const { data: recurring, error: recError } = await window.databaseApi.getAllRecurring(accountId);
    if (recError) throw recError;

    const currentDate = new Date();
    currentDate.setUTCHours(0, 0, 0, 0);

    // Get last transaction
    const lastTransaction = transactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

    // Get last recurring activity
    const lastRecurring = recurring
      .filter(r => {
        if (!r.is_active) return false;
        const startDate = new Date(r.start_date);
        startDate.setUTCHours(0, 0, 0, 0);
        if (startDate > currentDate) return false;
        if (r.end_date && new Date(r.end_date) < currentDate) return false;
        return true;
      })
      .map(r => {
        const startDate = new Date(r.start_date);
        startDate.setUTCHours(0, 0, 0, 0);
        let lastOccurrence = null;

        switch(r.frequency) {
          case 'daily':
            lastOccurrence = new Date(currentDate);
            break;
          case 'weekly':
            lastOccurrence = new Date(currentDate);
            while (lastOccurrence.getUTCDay() !== startDate.getUTCDay()) {
              lastOccurrence.setUTCDate(lastOccurrence.getUTCDate() - 1);
            }
            break;
          case 'monthly':
            lastOccurrence = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), startDate.getUTCDate());
            if (lastOccurrence.getMonth() !== currentDate.getMonth()) {
              lastOccurrence = new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 0);
            }
            break;
          case 'yearly':
            lastOccurrence = new Date(currentDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
            if (lastOccurrence > currentDate) {
              lastOccurrence.setUTCFullYear(lastOccurrence.getUTCFullYear() - 1);
            }
            break;
        }

        return {
          date: lastOccurrence,
          name: r.name,
          description: r.description,
          amount: r.amount,
          type: r.type,
          isRecurring: true,
          frequency: r.frequency
        };
      })
      .sort((a, b) => b.date - a.date)[0];

    // Compare and return the most recent activity
    if (!lastTransaction && !lastRecurring) return null;
    if (!lastTransaction) return lastRecurring;
    if (!lastRecurring) return lastTransaction;

    const txDate = new Date(lastTransaction.date);
    return txDate > lastRecurring.date ? 
      { ...lastTransaction, isRecurring: false } : 
      lastRecurring;

  } catch (error) {
    console.error('Error getting last activity:', error);
    return null;
  }
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
        const { data: recurring = [] } = await window.databaseApi.getAllRecurring(account.id);
        
        // Calculate current balance
        const currentBalanceChange = await calculateCurrentBalance(account.id);
        const currentBalance = parseFloat(account.balance) + currentBalanceChange;
        
        // Calculate monthly change including recurring
        const monthlyChange = getMonthlyChange(transactions, recurring);
        
        // Get activity status
        const activityStatus = getActivityStatus(transactions);
        
        const lastActivity = await getLastActivity(account.id);
        
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
          <td class="${currentBalance > 0 ? 'positive' : currentBalance < 0 ? 'negative' : ''}">
            ${currentBalance > 0 ? '+' : '-'}${formatCurrency(Math.abs(currentBalance))}
          </td>
          <td class="${monthlyChange > 0 ? 'positive' : monthlyChange < 0 ? 'negative' : ''}">
            ${monthlyChange > 0 ? '+' : '-'}${formatCurrency(Math.abs(monthlyChange))}
          </td>
          <td>
            ${lastActivity ? `
              <div class="last-activity">
                <div class="tx-date">${new Date(lastActivity.date).toLocaleDateString()}</div>
                <div class="tx-amount ${lastActivity.type === 'income' ? 'positive' : 'negative'}">
                  ${lastActivity.type === 'income' ? '+' : '-'}${formatCurrency(Math.abs(lastActivity.amount))}
                </div>
                <div class="tx-name">
                  ${lastActivity.isRecurring ? 
                    (lastActivity.name || 'Unnamed').charAt(0).toUpperCase() + (lastActivity.name || 'Unnamed').slice(1) :
                    (lastActivity.description ? 
                      lastActivity.description.charAt(0).toUpperCase() + lastActivity.description.slice(1, 15) + (lastActivity.description.length > 15 ? '...' : '') : 
                      'Unnamed'
                    )}
                  ${lastActivity.isRecurring ? `
                    <span class="recurring-text">
                      <i class="fas fa-sync-alt"></i> ${lastActivity.frequency.charAt(0).toUpperCase() + lastActivity.frequency.slice(1)}
                    </span>
                  ` : ''}
                </div>
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