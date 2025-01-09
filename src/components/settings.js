// src/components/settings.js
import { toggleTheme, loadThemePreference } from '../services/themeService.js';
import { toggleNavigationStyle, loadNavigationPreference } from '../services/navigationService.js';
import { openModal } from '../utils/utils.js';
import { initializeSmartImport } from './smartImport.js';
import { showCreateFirstModal } from '../utils/modals.js';
import { showError } from '../utils/utils.js';
import { updateLicenseInfo } from './license.js';
import { getAllCurrencies, setCurrencyPreference, getCurrencyPreference, convertCurrency } from '../services/currencyService.js';
import { refreshData } from '../utils/refresh.js';
import { showConfirmationModal } from '../utils/modals.js';

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

    // Initialize backup list
    updateBackupsList();
    
    // Update backup list every minute
    setInterval(updateBackupsList, 60 * 1000);

    // Add create backup button
    document.getElementById('create-backup-btn')?.addEventListener('click', async () => {
        try {
            const { success, error } = await window.databaseApi.createBackup('manual');
            if (success) {
                alert('Backup created successfully!');
                updateBackupsList();
            } else {
                throw new Error(error || 'Failed to create backup');
            }
        } catch (error) {
            console.error('Error creating backup:', error);
            alert('Failed to create backup: ' + error.message);
        }
    });

    // Help & Support Links
    document.getElementById('docs-link')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await window.electronAPI.openExternal('https://fyenanceapp.com/help');
    });

    document.getElementById('issues-link')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await window.electronAPI.openExternal('https://fyenanceapp.com/hub');
    });

    // Support email uses default mailto: behavior

    // Initialize exchange rate calculator
    initializeExchangeCalculator();
}

// Add event listener for settings tab activation
document.addEventListener('tabchange', (event) => {
    if (event.detail.tab === 'Settings') {
        updateLicenseInfo().catch(err => {
            console.error('Failed to update license info in tab change:', err);
        });
    }
});

async function updateBackupsList() {
    const backupsContainer = document.querySelector('.backups-list');
    if (!backupsContainer) return;

    try {
        const { data: backups, error } = await window.databaseApi.getBackups();
        if (error) throw new Error(error);
        
        const recentContainer = backupsContainer.querySelector('.backups-recent');
        const expandedContainer = backupsContainer.querySelector('.backups-expanded');
        const showMoreBtn = backupsContainer.querySelector('.show-more-btn');
        
        if (!backups || backups.length === 0) {
            recentContainer.innerHTML = `
                <div class="empty-state">
                    <p>No backups available yet</p>
                </div>
            `;
            expandedContainer.classList.add('hidden');
            showMoreBtn.classList.add('hidden');
            return;
        }

        const renderBackup = (backup) => `
            <div class="backup-item">
                <div class="backup-info">
                    <span class="backup-name">${backup.name}</span>
                    <span class="backup-date">${new Date(backup.date).toLocaleString()}</span>
                    <span class="backup-size">${(backup.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div class="backup-actions">
                    <button class="backups-btn" onclick="restoreBackup('${backup.path.replace(/\\/g, '\\\\')}')">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button class="backups-btn danger" onclick="deleteBackup('${backup.path.replace(/\\/g, '\\\\')}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        // Show recent backups
        recentContainer.innerHTML = backups
            .slice(0, 3)
            .map(renderBackup)
            .join('');

        // Handle expanded list
        if (backups.length > 3) {
            expandedContainer.innerHTML = backups
                .slice(3)
                .map(renderBackup)
                .join('');
            showMoreBtn.classList.remove('hidden');
            showMoreBtn.onclick = () => {
                expandedContainer.classList.toggle('hidden');
                const isExpanded = !expandedContainer.classList.contains('hidden');
                showMoreBtn.innerHTML = isExpanded ? 
                    '<i class="fas fa-chevron-up"></i> Show Less' :
                    '<i class="fas fa-chevron-down"></i> Show More';
            };
        } else {
            expandedContainer.classList.add('hidden');
            showMoreBtn.classList.add('hidden');
        }
    } catch (error) {
        console.error('Error fetching backups:', error);
        backupsContainer.innerHTML = `
            <div class="error-state">
                <p>Error loading backups: ${error.message}</p>
            </div>
        `;
    }
}

// Add restore function to window scope
window.restoreBackup = async (backupPath) => {
    showConfirmationModal({
        title: 'Restore Backup',
        message: 'Are you sure you want to restore this backup? Current data will be replaced.',
        confirmText: 'Restore',
        cancelText: 'Cancel',
        onConfirm: async () => {
            try {
                const { success, error } = await window.databaseApi.restoreBackup(backupPath);
                if (success) {
                    alert('Backup restored successfully! The application will now restart.');
                    window.electronAPI.relaunchApp();
                } else {
                    throw new Error(error || 'Failed to restore backup');
                }
            } catch (error) {
                console.error('Error restoring backup:', error);
                alert('Failed to restore backup: ' + error.message);
            }
        }
    });
};

// Add delete function to window scope
window.deleteBackup = async (backupPath) => {
    showConfirmationModal({
        title: 'Delete Backup',
        message: 'Are you sure you want to delete this backup?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm: async () => {
            try {
                const { success, error, debug } = await window.databaseApi.deleteBackup(backupPath);
                if (success) {
                    updateBackupsList();
                } else {
                    console.error('Delete backup failed:', { error, debug });
                    throw new Error(error || 'Failed to delete backup');
                }
            } catch (error) {
                console.error('Error deleting backup:', error);
                alert('Failed to delete backup: ' + error.message);
            }
        }
    });
};

// Initialize exchange rate calculator
function initializeExchangeCalculator() {
    const fromSelect = document.getElementById('from-currency');
    const toSelect = document.getElementById('to-currency');
    const amountInput = document.getElementById('exchange-amount');
    const resultInput = document.getElementById('exchange-result');
    
    let lastValidAmount = '1';
    
    // Format number with currency code
    const formatExchangeAmount = (amount, currencyCode) => {
        const num = parseFloat(amount) || 0;
        return num.toLocaleString(undefined, {
            style: 'currency',
            currency: currencyCode
        });
    };

    // Format number only (no currency)
    const formatNumber = (amount) => {
        const num = parseFloat(amount) || 0;
        return num.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };
    
    // Populate currency dropdowns
    const currencies = getAllCurrencies();
    const options = currencies.map(c => `
        <option value="${c.code}">${c.code} - ${c.name}</option>
    `).join('');
    
    fromSelect.innerHTML = options;
    toSelect.innerHTML = options;
    
    // Set default values
    fromSelect.value = getCurrencyPreference();
    toSelect.value = 'USD';
    
    // Update calculation on any change
    const updateCalculation = () => {
        const amount = parseFloat(lastValidAmount) || 0;
        const converted = convertCurrency(amount, fromSelect.value, toSelect.value);
        resultInput.value = formatExchangeAmount(converted, toSelect.value);
    };
    
    // Add change handlers for currency selection
    [fromSelect, toSelect].forEach(el => 
        el.addEventListener('change', updateCalculation)
    );
    
    // Handle input changes
    amountInput.addEventListener('input', (e) => {
        // Remove any non-numeric characters except decimal point
        const cleanValue = e.target.value.replace(/[^\d.]/g, '');
        // Ensure only one decimal point
        const parts = cleanValue.split('.');
        const newValue = parts[0] + (parts.length > 1 ? '.' + parts[1] : '');
        
        // Store the new value if it's valid
        if (newValue !== '') {
            lastValidAmount = newValue;
            e.target.value = lastValidAmount;
        }
        
        updateCalculation();
    });

    // Add exchange icon click handler to swap currencies
    const swapButton = document.getElementById('swap-currencies');
    if (swapButton) {
        swapButton.addEventListener('click', () => {
            // Get the current converted amount
            const currentAmount = parseFloat(lastValidAmount) || 0;
            const convertedAmount = convertCurrency(currentAmount, fromSelect.value, toSelect.value);
            
            // Swap currencies
            const tempValue = fromSelect.value;
            fromSelect.value = toSelect.value;
            toSelect.value = tempValue;
            
            // Update input with the converted amount
            lastValidAmount = convertedAmount.toString();
            amountInput.value = formatNumber(convertedAmount);
            
            updateCalculation();
        });
    }

    // Initial setup
    amountInput.value = lastValidAmount;
    updateCalculation();
}

