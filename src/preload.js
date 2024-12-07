const { contextBridge, ipcRenderer, shell } = require('electron');

// Get version from process arguments
const appVersion = process.argv
    .find(arg => arg.startsWith('--app-version='))
    ?.split('=')[1] || '1.0.0';

// Expose protected APIs
contextBridge.exposeInMainWorld('versions', {
    app: () => ipcRenderer.invoke('get-app-version')
});

// Expose database API to renderer
contextBridge.exposeInMainWorld('databaseApi', {
    // Accounts
    fetchAccounts: () => ipcRenderer.invoke('db:getAccounts'),
    addAccount: (account) => ipcRenderer.invoke('db:addAccount', account),
    updateAccount: (id, balance) => ipcRenderer.invoke('db:updateAccount', id, balance),
    deleteAccount: (id) => ipcRenderer.invoke('db:deleteAccount', id),
    
    // Transactions
    fetchTransactions: (accountId) => ipcRenderer.invoke('db:getTransactions', accountId),
    addTransaction: (transaction) => ipcRenderer.invoke('db:addTransaction', transaction),
    updateTransaction: (id, data) => ipcRenderer.invoke('db:updateTransaction', id, data),
    deleteTransaction: (id) => ipcRenderer.invoke('db:deleteTransaction', id),
    
    // Categories
    fetchCategories: (filters) => ipcRenderer.invoke('db:getCategories', filters),
    addCategory: (category) => ipcRenderer.invoke('db:addCategory', category),
    updateCategory: (id, data) => ipcRenderer.invoke('db:updateCategory', id, data),
    deleteCategory: (id) => ipcRenderer.invoke('db:deleteCategory', id),
    
    // Recurring
    fetchRecurring: (accountId) => ipcRenderer.invoke('db:getRecurring', accountId),
    addRecurring: (recurring) => ipcRenderer.invoke('db:addRecurring', recurring),
    updateRecurring: (id, data) => ipcRenderer.invoke('db:updateRecurring', id, data),
    deleteRecurring: (id) => ipcRenderer.invoke('db:deleteRecurring', id),
    
    // Reports and other functions
    getTransactionsByDateRange: (startDate, endDate, accountId) => 
        ipcRenderer.invoke('db:getTransactionsByDateRange', startDate, endDate, accountId),
    getMonthlyTotals: (year, month, accountId) => 
        ipcRenderer.invoke('db:getMonthlyTotals', year, month, accountId),
    fetchTransactionsForChart: (accountId) => 
        ipcRenderer.invoke('db:getTransactionsForChart', accountId),
    fetchIncomeExpenseData: (accountId, period) => 
        ipcRenderer.invoke('db:getIncomeExpenseData', accountId, period),
    getTopSpendingCategories: (accountId, period) => 
        ipcRenderer.invoke('db:getTopSpendingCategories', accountId, period),
    getExpenseCategoriesData: (accountId, period) => 
        ipcRenderer.invoke('db:getExpenseCategoriesData', accountId, period),
    exportDatabase: (filePath) => ipcRenderer.invoke('db:export', filePath),
    importDatabase: (filePath) => ipcRenderer.invoke('db:import', filePath),
    deleteDatabase: () => ipcRenderer.invoke('db:delete')
});

// Expose update API
contextBridge.exposeInMainWorld('updateApi', {
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    startUpdate: () => ipcRenderer.invoke('start-update'),
    onUpdateMessage: (callback) => {
        ipcRenderer.on('update-message', (_, message) => callback(message));
    },
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update-available', (_, info) => callback(info));
    },
    onUpdateProgress: (callback) => {
        ipcRenderer.on('download-progress', (_, progressObj) => callback(progressObj));
    }
});

// Window controls API
contextBridge.exposeInMainWorld('electronAPI', {
    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    toggleMaximizeWindow: () => ipcRenderer.send('toggle-maximize-window'),
    platform: process.platform,
    showSaveDialog: () => ipcRenderer.invoke('dialog:showSaveDialog'),
    showOpenDialog: () => ipcRenderer.invoke('dialog:showOpenDialog'),
    isWindowMaximized: () => ipcRenderer.invoke('is-window-maximized'),
    getWindowState: () => ipcRenderer.invoke('get-window-state'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    relaunchApp: () => ipcRenderer.send('relaunch-app')
});

contextBridge.exposeInMainWorld('licenseApi', {
    validateLicense: (key) => ipcRenderer.invoke('license:validate', key),
    checkLicense: () => ipcRenderer.invoke('license:check'),
    getLicenseInfo: () => ipcRenderer.invoke('license:info')
});
