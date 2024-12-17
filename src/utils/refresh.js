import { fetchTotalBalance, updateReports } from '../services/reportsService.js';
import { fetchAccounts } from '../services/accountsService.js';
import { fetchCategories } from '../services/categoriesService.js';
import { fetchTransactions } from '../services/transactionsService.js';
import { fetchRecurring } from '../services/recurringService.js';
import { fetchProjects } from '../services/projectsService.js';
import { renderDashboardCharts } from '../services/chartsService.js';
import { updateBannerData } from '../components/dashboard.js';
import { updateEmptyStates } from '../utils/emptyStates.js';
import { populateAccountDropdowns, populateCategoryDropdowns, populateProjectDropdowns } from '../utils/dropdownHelpers.js';
import { loadTransactions } from '../components/transactions.js';

/**
 * Global refresh utility to update all relevant data
 * @param {Object} options - Configuration options for the refresh
 * @param {boolean} options.accounts - Refresh accounts data
 * @param {boolean} options.transactions - Refresh transactions data
 * @param {boolean} options.categories - Refresh categories data
 * @param {boolean} options.recurring - Refresh recurring transactions
 * @param {boolean} options.projects - Refresh projects data
 * @param {boolean} options.charts - Refresh dashboard charts
 * @param {boolean} options.reports - Refresh reports
 * @param {boolean} options.dropdowns - Refresh dropdown menus
 * @param {boolean} options.all - Refresh everything
 */
export async function refreshData(options = { all: true }) {
    try {
        const refreshTasks = [];

        if (options.all || options.accounts) {
            refreshTasks.push(
                fetchAccounts(),
                fetchTotalBalance()
            );
        }

        if (options.all || options.transactions) {
            refreshTasks.push(fetchTransactions());
            loadTransactions();
        }

        if (options.all || options.categories) {
            refreshTasks.push(fetchCategories());
        }

        if (options.all || options.recurring) {
            refreshTasks.push(fetchRecurring());
        }

        if (options.all || options.projects) {
            refreshTasks.push(fetchProjects());
        }

        if (options.all || options.charts) {
            refreshTasks.push(renderDashboardCharts());
        }

        if (options.all || options.reports) {
            refreshTasks.push(
                updateReports(),
                updateBannerData()
            );
        }

        if (options.all || options.dropdowns) {
            refreshTasks.push(
                populateAccountDropdowns(),
                populateCategoryDropdowns(),
                populateProjectDropdowns()
            );
        }

        // Always refresh empty states
        refreshTasks.push(updateEmptyStates());

        await Promise.all(refreshTasks);
    } catch (error) {
        console.error('Error during global refresh:', error);
        throw error;
    }
}