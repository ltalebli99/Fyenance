import { formatCurrency, getAmountValue } from '../utils/formatters.js';
import { openSection, openModal, closeModal } from '../utils/utils.js';
import { fetchTotalBalance } from '../services/reportsService.js';
import { renderDashboardCharts } from '../services/chartsService.js';
import { fetchTransactions } from '../services/transactionsService.js';
import { fetchRecurring } from '../services/recurringService.js';
import { fetchAccounts } from '../services/accountsService.js';
import { refreshData } from '../utils/refresh.js';
import { resetFormAndInputs } from '../utils/initInputs.js';
import { updateBannerData } from '../components/dashboard.js';

// Add event listeners for account selectors
export function initializeAccountSelectors() {
    const dashboardSelector = document.getElementById('dashboard-account-selector');
    const transactionsSelector = document.getElementById('transactions-account-selector');
    const recurringSelector = document.getElementById('recurring-account-selector');
    
    if (dashboardSelector) {
        // Add direct event listener without cloning
        dashboardSelector.addEventListener('change', async () => {
            try {
                const selectedAccount = dashboardSelector.value;
                
                // Use Promise.all to run these in parallel
                await Promise.all([
                    fetchTotalBalance(selectedAccount),
                    updateBannerData(selectedAccount),
                    renderDashboardCharts(selectedAccount)
                ]);
            } catch (error) {
                console.error('Error updating dashboard:', error);
            }
        });
    }

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

// Initialize account selectors on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initializeAccountSelectors);

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
            const balance = parseFloat(getAmountValue(document.getElementById('account-balance')));

            const { error } = await window.databaseApi.addAccount({
              name,
              balance
            });

            if (error) {
              console.error('Error adding account:', error);
            } else {
              resetFormAndInputs(addAccountForm);
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

// Add this function to populate account tabs
async function populateAccountTabs(containerId, activeAccountId = 'all') {
  try {
    const { data: accounts } = await window.databaseApi.fetchAccounts();
    const container = document.getElementById(containerId);
    if (!container) return;

    // Start with "All Accounts" option
    let html = `
      <li class="${activeAccountId === 'all' ? 'active' : ''}" data-account-id="all">
        <div>All Accounts</div>
        <div class="account-balance"></div>
      </li>
    `;

    // Add each account
    for (const account of accounts) {
      html += `
        <li class="${activeAccountId === account.id ? 'active' : ''}" data-account-id="${account.id}">
          <div>${account.name}</div>
          <div class="account-balance">${formatCurrency(account.balance)}</div>
        </li>
      `;
    }

    container.innerHTML = html;

    // Add click handlers
    container.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', async () => {
        container.querySelectorAll('li').forEach(el => el.classList.remove('active'));
        li.classList.add('active');
        const accountId = li.dataset.accountId;
        
        // Update the relevant section based on the container ID
        if (containerId === 'transaction-accounts-list') {
          const filters = {
            type: document.getElementById('transaction-type-filter')?.value || 'all',
            category: document.getElementById('transaction-category-filter')?.value || 'all',
            sort: document.getElementById('transaction-sort')?.value || 'date-desc',
            search: document.querySelector('#Transactions .search-input')?.value || ''
          };
          
          await fetchTransactions(accountId === 'all' ? null : accountId, filters);
        } else if (containerId === 'recurring-accounts-list') {
          const filters = {
            type: document.getElementById('recurring-type-filter')?.value || 'all',
            category: document.getElementById('recurring-category-filter')?.value || 'all',
            sort: document.getElementById('recurring-sort')?.value || 'name-asc',
            search: document.querySelector('#Recurring .search-input')?.value || ''
          };
          
          await fetchRecurring(accountId === 'all' ? null : accountId, filters);
        }
      });
    });
  } catch (error) {
    console.error('Error populating account tabs:', error);
  }
}

// Export the function
export { populateAccountTabs };