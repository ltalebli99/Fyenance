import { formatCurrency } from '../utils/formatters.js';
import { openSection, openModal, closeModal } from '../utils/utils.js';
import { fetchTotalBalance } from '../services/reportsService.js';
import { renderDashboardCharts } from '../services/chartsService.js';
import { fetchTransactions } from '../services/transactionsService.js';
import { fetchRecurring } from '../services/recurringService.js';
import { fetchAccounts } from '../services/accountsService.js';
import { refreshData } from '../utils/refresh.js';

// Add event listeners for account selectors
export function initializeAccountSelectors() {
    const dashboardSelector = document.getElementById('dashboard-account-selector');
    const transactionsSelector = document.getElementById('transactions-account-selector');
    const recurringSelector = document.getElementById('recurring-account-selector');
    
    dashboardSelector?.addEventListener('change', async () => {
      await fetchTotalBalance(dashboardSelector.value);
      await renderDashboardCharts(dashboardSelector.value);
    });
  
    transactionsSelector?.addEventListener('change', async () => {
      await fetchTransactions(transactionsSelector.value);
      // Auto-set the account in the add transaction form
      const transactionAccountSelect = document.getElementById('transaction-account');
      if (transactionAccountSelect && transactionsSelector.value !== 'all') {
        transactionAccountSelect.value = transactionsSelector.value;
      }
    });
  
    recurringSelector?.addEventListener('change', async () => {
      await fetchRecurring(recurringSelector.value);
      const recurringAccountSelect = document.getElementById('recurring-account');
      if (recurringAccountSelect && recurringSelector.value !== 'all') {
        recurringAccountSelect.value = recurringSelector.value;
      }
    });
  
}


// Accounts

// Add event listener for the first account button
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('add-first-account-btn')?.addEventListener('click', (e) => {
        // Find the Accounts tab button
        const accountsTab = document.querySelector('button[data-section="Accounts"]');
        if (accountsTab) {
          // Call openSection with the event and section name
          openSection({ currentTarget: accountsTab }, 'Accounts');
          // Then trigger the add account modal
          document.getElementById('show-add-account')?.click();
        }
    });

    // Modal event listeners
    document.getElementById('show-add-account')?.addEventListener('click', () => {
        openModal('add-account-modal');
    });

    document.getElementById('close-add-account')?.addEventListener('click', () => {
        closeModal('add-account-modal');
    });

    document.getElementById('cancel-add-account')?.addEventListener('click', () => {
        closeModal('add-account-modal');
    });

    // Add Account Form Submission
    const addAccountForm = document.getElementById('add-account-form');
    if (addAccountForm) {
        addAccountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('account-name').value;
            const balance = parseFloat(document.getElementById('account-balance').value);

            const { error } = await window.databaseApi.addAccount({
              name,
              balance
            });

            if (error) {
              console.error('Error adding account:', error);
            } else {
              // Close the modal instead of hiding the card
              closeModal('add-account-modal');
              // Refresh data
              await refreshData({
                all: true
              });
              // Clear form
              e.target.reset();
            }
        });
    }

    // Initialize accounts table
    await fetchAccounts();
});

export async function deleteAccount(id) {
    try {
        const { error } = await window.databaseApi.deleteAccount(id);
        if (error) throw error;
        await refreshData({ all: true });
    } catch (error) {
        console.error('Error deleting account:', error);
        showError('Failed to delete account');
    }
}