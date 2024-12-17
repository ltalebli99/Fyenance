// src/components/settings.js
import { toggleTheme, loadThemePreference } from '../services/themeService.js';
import { toggleNavigationStyle, loadNavigationPreference } from '../services/navigationService.js';
import { openModal } from '../utils/utils.js';
import { initializeSmartImport } from './smartImport.js';
import { showCreateFirstModal } from '../utils/modals.js';
import { showError } from '../utils/utils.js';
import { updateLicenseInfo } from './license.js';
import { getAllCurrencies, setCurrencyPreference, getCurrencyPreference } from '../services/currencyService.js';
import { refreshData } from '../utils/refresh.js';

export function initializeSettings() {
    // Theme Toggle
    document.getElementById('toggle-theme-btn')?.addEventListener('click', toggleTheme);
    loadThemePreference();

    // Navigation Style Toggle
    document.getElementById('toggle-nav-style-btn')?.addEventListener('click', toggleNavigationStyle);
    loadNavigationPreference();

    // Data Management Buttons
    document.getElementById('export-btn')?.addEventListener('click', async () => {
        const result = await window.dialogApi.showSaveDialog();
        if (!result.canceled && result.filePath) {
            const { success, error } = await window.databaseApi.exportDatabase(result.filePath);
            if (success) {
                alert('Database exported successfully!');
            } else {
                console.error('Error exporting database:', error);
                alert('Failed to export database. Please check the console for details.');
            }
        }
    });

    document.getElementById('export-csv-btn')?.addEventListener('click', async () => {
        const result = await window.dialogApi.showFolderDialog();
        if (!result.canceled && result.filePaths[0]) {
            const { success, error } = await window.databaseApi.exportCSV(result.filePaths[0]);
            if (success) {
                alert('Data exported successfully to CSV files!');
            } else {
                console.error('Error exporting CSV:', error);
                alert('Failed to export CSV files. Please check the console for details.');
            }
        }
    });

    document.getElementById('import-btn')?.addEventListener('click', async () => {
        const result = await window.dialogApi.showOpenDialog();
        if (!result.canceled && result.filePaths[0]) {
            try {
                const { success, error } = await window.databaseApi.importDatabase(result.filePaths[0]);
                if (success) {
                    alert('Database imported successfully! The application will now restart.');
                    window.electronAPI.relaunchApp();
                } else {
                    console.error('Error importing database:', error);
                    alert(`Error importing database: ${error}`);
                }
            } catch (err) {
                console.error('Error during import:', err);
                alert('An error occurred during import.');
            }
        }
    });

    document.getElementById('delete-db-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('delete-db-modal');
        if (modal) modal.style.display = 'flex';
    });

    // Updates
    document.getElementById('check-updates-btn')?.addEventListener('click', async () => {
        const updateStatus = document.getElementById('update-status');
        updateStatus.textContent = 'Checking for updates...';
        
        try {
            const result = await window.ipcRenderer.invoke('check-for-updates');
            updateStatus.textContent = result.updateAvailable ? 
                'Update available!' : 
                'You are running the latest version.';
        } catch (error) {
            updateStatus.textContent = 'Error checking for updates.';
        }
    });

    // Initialize Smart Import
    document.getElementById('smart-import-btn')?.addEventListener('click', async () => {
        try {
            // Check for accounts first
            const { data: accounts, error: accountsError } = await window.databaseApi.fetchAccounts();
            if (accountsError) throw accountsError;
            
            if (!accounts || accounts.length === 0) {
                showCreateFirstModal('account');
                return;
            }
        
            // Then check for categories
            const { data: categories, error: categoriesError } = await window.databaseApi.fetchCategories();
            if (categoriesError) throw categoriesError;
            
            if (!categories || categories.length === 0) {
                showCreateFirstModal('category');
                return;
            }
        
            // If we have both, show the import modal
            openModal('smart-import-modal');
            initializeSmartImport();
        } catch (error) {
            console.error('Error checking accounts/categories:', error);
            showError('An error occurred. Please try again.');
        }
    });

    // Add license info update
    updateLicenseInfo().catch(err => {
        console.error('Failed to update license info:', err);
    });

    // Add currency preference settings
    const currencySelect = document.getElementById('currency-preference-setting');
    if (currencySelect) {
        // Populate currency options
        const currencies = getAllCurrencies();
        currencySelect.innerHTML = currencies.map(c => `
            <option value="${c.code}">${c.name} (${c.symbol})</option>
        `).join('');
        
        // Set current preference
        currencySelect.value = getCurrencyPreference();
        
        // Add change handler
        currencySelect.addEventListener('change', async (e) => {
            setCurrencyPreference(e.target.value);
            // Refresh all displays to show new currency
            await refreshData({ all: true });
        });
    }
}

// Add event listener for settings tab activation
document.addEventListener('tabchange', (event) => {
    if (event.detail.tab === 'Settings') {
        updateLicenseInfo().catch(err => {
            console.error('Failed to update license info in tab change:', err);
        });
    }
});

