import { fetchTotalBalance, updateReports } from '../services/reportsService.js';
import { fetchAccounts } from '../services/accountsService.js';
import { fetchCategories } from '../services/categoriesService.js';
import { fetchTransactions } from '../services/transactionsService.js';
import { fetchRecurring } from '../services/recurringService.js';
import { fetchProjects } from '../services/projectsService.js';
import { renderDashboardCharts } from '../services/chartsService.js';
import { updateEmptyStates } from '../utils/emptyStates.js';
import { populateAccountDropdowns, populateCategoryDropdowns, populateProjectDropdowns } from '../utils/dropdownHelpers.js';
import { loadTransactions } from '../components/transactions.js';
import { updateBannerData } from '../components/dashboard.js';

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

        if (options.all || options.projects) {
            // Make projects refresh a priority
            await fetchProjects();
        }

        if (options.all || options.accounts) {
            refreshTasks.push(
                fetchAccounts(),
                fetchTotalBalance()
            );
        }

        if (options.all || options.transactions) {
            refreshTasks.push(
                fetchTransactions().then(() => {
                    loadTransactions();
                })
            );
        }

        if (options.all || options.categories) {
            refreshTasks.push(fetchCategories());
        }

        if (options.all || options.recurring) {
            refreshTasks.push(fetchRecurring());
        }

        if (options.all || options.charts) {
            refreshTasks.push(renderDashboardCharts());
        }

        if (options.all || options.reports) {
            refreshTasks.push(updateReports());
        }
        
        if (options.all || options.dropdowns) {
            await Promise.all([
                populateAccountDropdowns(),
                populateCategoryDropdowns(),
                populateProjectDropdowns()
            ]);
        }

        // Wait for remaining tasks to complete
        if (refreshTasks.length > 0) {
            await Promise.all(refreshTasks);
        }

        // Always update empty states and banner last
        await updateEmptyStates();
        await updateBannerData();
    } catch (error) {
        console.error('Error during global refresh:', error);
        throw error;
    }
}