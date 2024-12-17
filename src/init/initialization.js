import { fetchTotalBalance, updateReports, setupReportsEventListeners, markReportsInitialized } from '../services/reportsService.js';
import { fetchAccounts } from '../services/accountsService.js';
import { fetchCategories } from '../services/categoriesService.js';
import { populateAccountDropdowns, populateCategoryDropdowns } from '../utils/dropdownHelpers.js';
import { fetchTransactions } from '../services/transactionsService.js';
import { renderDashboardCharts } from '../services/chartsService.js';
import { fetchRecurring } from '../services/recurringService.js';
import { updateBannerData } from '../components/dashboard.js';
import { updateEmptyStates } from '../utils/emptyStates.js';
import { setupLicenseHandlers } from '../components/license.js';
import { initializeCategories } from '../components/categories.js';
import { initializeProjects } from '../components/projects.js';
import { fetchProjects } from '../services/projectsService.js';


const checkLicense = () => window.licenseApi.checkLicenseExists();
const updateLicenseInfo = () => window.licenseApi.getLicenseInfo();

export async function initializeApp() {
  const licenseOverlay = document.getElementById('license-overlay');
  if (licenseOverlay) {
    licenseOverlay.style.display = 'none';
  }

  // Remove preload class
  setTimeout(() => {
    document.body.classList.remove('preload');
  }, 100);

  // Check license
  const hasLicense = await checkLicense();
  console.log('License check result:', hasLicense);

  // Handle loader animation
  setTimeout(async () => {
    const loader = document.querySelector('.app-loader');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => {
        loader.remove();
        
        // After loader is gone, show license screen if needed
        if (!hasLicense) {
          console.log('No valid license found, showing overlay');
          licenseOverlay.style.display = 'flex';
          setupLicenseHandlers();
          return; // Stop initialization here if no license
        }
        
        // Continue with app initialization if license is valid
        initializeMainApp();
      }, 0);
    }
  }, 2000);
}

export async function initializeMainApp() {
  try {
    if (!window.databaseApi) {
      throw new Error('Database API not available');
    }

    // Initialize core components first
    await Promise.all([
      updateLicenseInfo().catch(err => console.error('Failed to update license info:', err)),
      initializeCategories().catch(err => console.error('Failed to initialize categories:', err)),
    ]);

    // Then fetch data
    await Promise.all([
      fetchTotalBalance().catch(err => console.error('Failed to fetch balance:', err)),
      fetchAccounts().catch(err => console.error('Failed to fetch accounts:', err)),
      fetchCategories().catch(err => console.error('Failed to fetch categories:', err)),
      populateAccountDropdowns().catch(err => console.error('Failed to populate dropdowns:', err)),
      populateCategoryDropdowns().catch(err => console.error('Failed to populate category dropdowns:', err)),
      fetchTransactions().catch(err => console.error('Failed to fetch transactions:', err)),
      fetchProjects().catch(err => console.error('Failed to fetch projects:', err)),
      fetchRecurring().catch(err => console.error('Failed to fetch recurring:', err)),
    ]);

    // After all data is loaded, update UI components
    await Promise.all([
      renderDashboardCharts().catch(err => console.error('Failed to render charts:', err)),
      updateBannerData().catch(err => console.error('Failed to update banner data:', err))
    ]);

    // Set up reports components
    setupReportsEventListeners();
    markReportsInitialized();
    await updateReports('month', 'all').catch(err => console.error('Failed to update reports:', err));

    // Update UI states last
    await updateEmptyStates().catch(err => console.error('Failed to update empty states:', err));

    if (window.tutorial) {
      await window.tutorial.start();
    } else {
      console.warn('Tutorial not initialized');
    }

  } catch (error) {
    console.error('Failed to initialize app:', error);
    document.body.innerHTML = `
      <div style="padding: 20px; color: red;">
        Error initializing application: ${error.message}<br>
        Please check your database configuration and restart the application.
      </div>
    `;
  }
}
