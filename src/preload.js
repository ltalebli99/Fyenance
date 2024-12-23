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
    getAllTransactions: (accountId) => ipcRenderer.invoke('db:getAllTransactions', accountId),
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
    getAllRecurring: (accountId) => ipcRenderer.invoke('db:getAllRecurring', accountId),
    addRecurring: (recurring) => ipcRenderer.invoke('db:addRecurring', recurring),
    updateRecurring: (id, data) => ipcRenderer.invoke('db:updateRecurring', id, data),
    deleteRecurring: (id) => ipcRenderer.invoke('db:deleteRecurring', id),
    
    // Reports and other functions
    getTransactionsByDateRange: (startDate, endDate, accountId) => 
        ipcRenderer.invoke('db:getTransactionsByDateRange', startDate, endDate, accountId),
    getTransactionsForChart: (accountId) => 
        ipcRenderer.invoke('db:getTransactionsForChart', accountId),
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
    deleteDatabase: () => ipcRenderer.invoke('db:delete'),
    getNetWorth: () => ipcRenderer.invoke('db:getNetWorth'),
    getMonthlyComparison: () => ipcRenderer.invoke('db:getMonthlyComparison'),
    getUpcomingPayments: () => ipcRenderer.invoke('db:getUpcomingPayments'),
    exportCSV: (folderPath) => ipcRenderer.invoke('db:exportCSV', folderPath),
    fetchTemplates: () => ipcRenderer.invoke('db:getTemplates'),
    addTemplate: (template) => ipcRenderer.invoke('db:addTemplate', template),
    deleteTemplate: (id) => ipcRenderer.invoke('db:deleteTemplate', id),
    checkEmptyStates: () => ipcRenderer.invoke('db:checkEmptyStates'),
    getCashFlowData: async (accountIds, period) => {
        return await ipcRenderer.invoke('db:getCashFlowData', accountIds, period);
    },
    // New budget-specific methods
    getBudgetProgress: (categoryId, period) => 
        ipcRenderer.invoke('db:getBudgetProgress', categoryId, period),
    getAllBudgetProgress: (period) => 
        ipcRenderer.invoke('db:getAllBudgetProgress', period),
    // Projects
    getProjects: () => ipcRenderer.invoke('db:getProjects'),
    createProject: (project) => ipcRenderer.invoke('db:createProject', project),
    updateProject: (id, project) => ipcRenderer.invoke('db:updateProject', id, project),
    deleteProject: (id) => ipcRenderer.invoke('db:deleteProject', id),
    getProjectDetails: (id) => ipcRenderer.invoke('db:getProjectDetails', id),
    getTransactionProjects: (transactionId) => 
        ipcRenderer.invoke('db:getTransactionProjects', transactionId),
    getRecurringProjects: (recurringId) => 
        ipcRenderer.invoke('db:getRecurringProjects', recurringId),
    addTransactionProjects: (transactionId, projectIds) => 
        ipcRenderer.invoke('db:addTransactionProjects', { transactionId, projectIds }),
    updateTransactionProjects: (transactionId, projectIds) => 
        ipcRenderer.invoke('db:updateTransactionProjects', { transactionId, projectIds }),
    updateRecurringProjects: (recurringId, projectIds) => 
        ipcRenderer.invoke('db:updateRecurringProjects', { recurringId, projectIds }),
    fetchTransactionsForReports: (accountIds) => 
        ipcRenderer.invoke('db:getTransactionsForReports', accountIds),
    fetchRecurringForReports: (accountIds) => 
        ipcRenderer.invoke('db:getRecurringForReports', accountIds),
    getBackups: () => ipcRenderer.invoke('db:getBackups'),
    restoreBackup: (backupPath) => ipcRenderer.invoke('db:restoreBackup', backupPath),
    createBackup: (reason) => ipcRenderer.invoke('db:createBackup', reason),
    deleteBackup: (backupPath) => ipcRenderer.invoke('db:deleteBackup', backupPath),
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
    relaunchApp: () => ipcRenderer.send('relaunch-app'),
    showFolderDialog: () => ipcRenderer.invoke('dialog:showFolderDialog'),
    onWindowStateChange: (callback) => {
        ipcRenderer.on('window-state-change', (_, { isMaximized }) => {
            callback(isMaximized);
        });
    }
});

contextBridge.exposeInMainWorld('licenseApi', {
    checkLicenseExists: () => ipcRenderer.invoke('checkLicenseExists'),
    getLicenseInfo: () => ipcRenderer.invoke('getLicenseInfo'),
    validateLicense: (key) => ipcRenderer.invoke('validateLicense', key),
    clearLicense: () => ipcRenderer.invoke('clearLicense'),
    isValidKeyFormat: (key) => ipcRenderer.invoke('isValidKeyFormat', key),
    saveLicense: (key) => ipcRenderer.invoke('saveLicense', key),
    activateLicense: (key) => ipcRenderer.invoke('activateLicense', key)
});

contextBridge.exposeInMainWorld('tutorialAPI', {
    getTutorialStatus: () => ipcRenderer.invoke('tutorial:getStatus'),
    setTutorialComplete: () => ipcRenderer.invoke('tutorial:complete'),
    resetTutorial: () => ipcRenderer.invoke('tutorial:reset')
});

contextBridge.exposeInMainWorld('dialogApi', {
    showSaveDialog: () => ipcRenderer.invoke('dialog:showSaveDialog'),
    showOpenDialog: () => ipcRenderer.invoke('dialog:showOpenDialog'),
    showFolderDialog: () => ipcRenderer.invoke('dialog:showFolderDialog')
});

contextBridge.exposeInMainWorld('importApi', {
    parsePDF: (buffer) => ipcRenderer.invoke('parse:pdf', buffer),
    parseCSV: (text) => ipcRenderer.invoke('parse:csv', text),
    detectDuplicates: (transactions) => ipcRenderer.invoke('import:detectDuplicates', transactions),
    bulkImport: ({ transactions, accountId }) => ipcRenderer.invoke('import:bulkTransactions', { transactions, accountId })
});
