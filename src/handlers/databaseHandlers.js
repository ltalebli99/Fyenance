const { safeIpcHandle } = require('../core/ipcSafety');

function setupDatabaseHandlers(database, backupService) {

  // Account Operations
  safeIpcHandle('db:getAccounts', async () => {
    try {
      const accounts = database.getAccounts();
      return { data: accounts, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:addAccount', async (event, account) => {
    try {
      const result = database.addAccount(account);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:updateAccount', async (event, data) => {
    try {
      console.log('IPC Handler received:', data);  // Debug log
      const result = database.updateAccount(data.id, data.balance, data.name);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:deleteAccount', async (event, id) => {
    try {
      const result = database.deleteAccount(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  // Transaction Operations
  safeIpcHandle('db:getTransactions', async (event, accountId, options = {}) => {
    try {
      // Normalize accountId input
      const normalizedAccountIds = normalizeAccountIds(accountId);
      
      // If 'all' is included or no accounts specified, return all transactions
      if (normalizedAccountIds.includes('all')) {
        return { data: database.getTransactions(null, options), error: null };
      }
      
      // For multiple specific accounts, fetch and combine transactions
      if (normalizedAccountIds.length > 1) {
        const allTransactions = [...new Set(
          normalizedAccountIds.flatMap(id => database.getTransactions(id, options))
        )];
        
        // Sort combined transactions by date (newest first)
        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Apply pagination if options are provided
        if (options.limit !== undefined) {
          const start = options.offset || 0;
          const end = start + options.limit;
          return {
            data: allTransactions.slice(start, end),
            total_count: allTransactions.length,
            error: null
          };
        }
        
        return { data: allTransactions, error: null };
      }
      
      // Single account
      return { 
        data: database.getTransactions(normalizedAccountIds[0], options),
        error: null 
      };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  // Helper function to normalize account IDs
  function normalizeAccountIds(accountId) {
    if (!accountId) return ['all'];
    if (typeof accountId === 'string') return [accountId];
    if (Array.isArray(accountId)) {
      return accountId.length === 0 ? ['all'] : accountId;
    }
    return ['all'];
  }

  safeIpcHandle('db:addTransaction', async (event, transaction) => {
    try {
      const result = database.addTransaction(transaction);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:updateTransaction', async (event, id, data) => {
    try {
      const result = database.updateTransaction(id, data);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:deleteTransaction', async (event, id) => {
    try {
      const result = database.deleteTransaction(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  // Category Operations
  safeIpcHandle('db:getCategories', async (event, filters) => {
    try {
      const categories = database.getCategories(filters);
      return { data: categories, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:addCategory', async (event, category) => {
    try {
      // Parse budget amount to number if it exists
      const budgetAmount = category.budget_amount ? parseFloat(category.budget_amount) : null;
      
      // Only validate if budget_amount is non-zero
      if (budgetAmount && budgetAmount > 0) {
        // Validate budget frequency only for non-zero budgets
        if (!['daily', 'weekly', 'monthly', 'yearly'].includes(category.budget_frequency)) {
          throw new Error('Budget frequency is required when setting a budget amount');
        }
      } else {
        // If budget is 0 or null, set both budget fields to null
        category.budget_amount = null;
        category.budget_frequency = null;
      }
      
      const result = database.addCategory(category);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:updateCategory', async (event, id, data) => {
    try {
      // Parse budget amount to number if it exists
      const budgetAmount = data.budget_amount ? parseFloat(data.budget_amount) : null;
      
      // Only validate if budget_amount is non-zero
      if (budgetAmount && budgetAmount > 0) {
        // Validate budget frequency only for non-zero budgets
        if (!['daily', 'weekly', 'monthly', 'yearly'].includes(data.budget_frequency)) {
          throw new Error('Budget frequency is required when setting a budget amount');
        }
      }
      
      const result = database.updateCategory(id, data);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:deleteCategory', async (event, id) => {
    try {
      const result = database.deleteCategory(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  // Recurring Operations
  safeIpcHandle('db:getRecurring', async (event, accountId) => {
    try {
      // Normalize accountId input using the existing helper
      const normalizedAccountIds = normalizeAccountIds(accountId);
      
      // If 'all' is included or no accounts specified, return all recurring items
      if (normalizedAccountIds.includes('all')) {
        return { data: database.getRecurring(), error: null };
      }
      
      // For multiple specific accounts, fetch and combine recurring items
      if (normalizedAccountIds.length > 1) {
        const allRecurring = [...new Set(
          normalizedAccountIds.flatMap(id => database.getRecurring(id))
        )];
        return { data: allRecurring, error: null };
      }
      
      // Single account
      return { data: database.getRecurring(normalizedAccountIds[0]), error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:addRecurring', async (event, recurring) => {
    try {
      // Extract project IDs from the recurring object
      const { projectIds, ...recurringData } = recurring;
      
      // Add the recurring transaction
      const result = database.addRecurring(recurringData);
      
      // If there are project IDs, add the associations
      if (projectIds && projectIds.length > 0) {
        database.addRecurringProjects(result.lastInsertRowid, projectIds);
      }
      
      return { data: result.lastInsertRowid, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:updateRecurring', async (event, id, data) => {
    try {
      // Extract project IDs from the data object
      const { projectIds, ...recurringData } = data;
      
      // Update the recurring transaction
      const result = database.updateRecurring(id, recurringData);
      
      // Update project associations
      database.updateRecurringProjects(id, projectIds || []);
      
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:deleteRecurring', async (event, id) => {
    try {
      const result = database.deleteRecurring(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  // Database Management Operations
  safeIpcHandle('db:export', async (event, filePath) => {
    try {
      database.exportDatabase(filePath);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  safeIpcHandle('db:import', async (event, filePath) => {
    try {
      database.importDatabase(filePath);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  safeIpcHandle('db:delete', async () => {
    try {
      database.deleteDatabase();
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Template Operations
  safeIpcHandle('db:getTemplates', () => {
    try {
      return { data: database.getTemplates(), error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:addTemplate', (event, template) => {
    try {
      return { data: database.addTemplate(template), error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:deleteTemplate', (event, id) => {
    try {
      return { data: database.deleteTemplate(id), error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  // Utility Operations
  safeIpcHandle('db:checkEmptyStates', async () => {
    try {
      const emptyStates = {
        accounts: database.getAccounts().length === 0,
        transactions: database.getTransactions().length === 0,
        categories: database.getCategories().length === 0,
        recurring: database.getRecurring().length === 0,
        projects: database.getProjects().length === 0
      };
      return { data: emptyStates, error: null };
    } catch (error) {
      console.error('Error checking empty states:', error);
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:exportCSV', async (event, folderPath) => {
    try {
      const data = database.exportToCSV();
      const fs = require('fs');
      const path = require('path');

      // Create CSV content for each table
      Object.entries(data).forEach(([tableName, tableData]) => {
        if (tableData.length === 0) return;

        const headers = Object.keys(tableData[0]).join(',');
        const rows = tableData.map(row => 
          Object.values(row).map(value => 
            `"${String(value).replace(/"/g, '""')}"`
          ).join(',')
        );
        const csvContent = [headers, ...rows].join('\n');

        const filePath = path.join(folderPath, `fyenance_${tableName}.csv`);
        fs.writeFileSync(filePath, csvContent, 'utf-8');
      });

      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  safeIpcHandle('db:getCashFlowData', async (event, accountIds, period) => {
    try {
      const data = database.getCashFlowData(accountIds, period);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  // Budget Operations
  safeIpcHandle('db:getBudgetProgress', async (event, categoryId, period) => {
    try {
      const result = database.getBudgetProgress(categoryId, period);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getAllBudgetProgress', async (event, period) => {
    try {
      const result = database.getAllBudgetProgress(period);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getAllTransactions', async (event, accountId = 'all') => {
    try {
      const transactions = database.getAllTransactions(accountId);
      return { data: transactions || [], error: null };
    } catch (error) {
      return { data: [], error: error.message };
    }
  });

  safeIpcHandle('db:getAllRecurring', async (event, accountId = 'all') => {
    try {
      const recurring = database.getAllRecurring(accountId);
      return { data: recurring || [], error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getProjects', async () => {
    try {
      const projects = database.getProjects();
      return { data: projects, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:createProject', async (event, project) => {
    try {
      const result = database.createProject(project);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:updateProject', async (event, id, project) => {
    try {
      const result = database.updateProject(id, project);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:deleteProject', async (event, id) => {
    try {
      const result = database.deleteProject(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getProjectDetails', async (event, id) => {
    try {
      const result = database.getProjectDetails(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getTransactionProjects', async (event, transactionId) => {
    try {
      const projects = database.getTransactionProjects(transactionId);
      return { data: projects.map(p => p.id), error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getRecurringProjects', async (event, recurringId) => {
    try {
      const projects = database.getRecurringProjects(recurringId);
      return { data: projects.map(p => p.id), error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:addTransactionProjects', async (event, { transactionId, projectIds }) => {
    try {
      database.addTransactionProjects(transactionId, projectIds);
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:updateTransactionProjects', async (event, { transactionId, projectIds }) => {
    try {
      database.updateTransactionProjects(transactionId, projectIds);
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:updateRecurringProjects', async (event, { recurringId, projectIds }) => {
    try {
        database.updateRecurringProjects(recurringId, projectIds);
        return { data: true, error: null };
    } catch (error) {
        return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getTransactionsForReports', async (event, accountIds) => {
    try {
      const normalizedAccountIds = normalizeAccountIds(accountIds);
      const transactions = database.fetchTransactionsForReports(normalizedAccountIds);
      return { data: transactions, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getRecurringForReports', async (event, accountIds) => {
    try {
      const normalizedAccountIds = normalizeAccountIds(accountIds);
      const recurring = database.fetchRecurringForReports(normalizedAccountIds);
      return { data: recurring, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('db:getBackups', async () => {
    try {
      const backups = await backupService.getBackups();
      return { data: backups, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });
  
  safeIpcHandle('db:restoreBackup', async (event, backupPath) => {
    try {
      const result = await backupService.restoreBackup(backupPath);
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  safeIpcHandle('db:createBackup', async (event, reason) => {
    try {
        const result = await backupService.createBackup(reason);
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
  });

  safeIpcHandle('db:deleteBackup', async (event, backupPath) => {
    try {
        const result = await backupService.deleteBackup(backupPath);
        return result;
    } catch (error) {
        return { success: false, error: error.message };
    }
  });
}

module.exports = { setupDatabaseHandlers };