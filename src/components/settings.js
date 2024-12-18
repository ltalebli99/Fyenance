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
    if (!confirm('Are you sure you want to restore this backup? Current data will be replaced.')) {
        return;
    }

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
};

// Add delete function to window scope
window.deleteBackup = async (backupPath) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
        return;
    }

    console.log('Attempting to delete backup:', backupPath);

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
};

