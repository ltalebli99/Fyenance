const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { initializeDatabase } = require('../src/services/initDatabase');

// Set app name first, before any other operations
app.setName('Fyenance');
process.env.NODE_ENV = 'production';

const WINDOW_WIDTH = 1400;
const WINDOW_HEIGHT = 800;

async function captureScreenshots() {
  // Initialize database with the correct user data path
  const userDataPath = app.getPath('userData');
  console.log('Using database from:', userDataPath);
  
  const database = initializeDatabase();
  
  // Log some data to verify we're connected correctly
  try {
    const accounts = database.getAccounts();
    const transactions = database.getTransactions();
    console.log('Found accounts:', accounts.length);
    console.log('Found transactions:', transactions.length);
  } catch (error) {
    console.error('Database connection error:', error);
  }

  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'src', 'preload.js')
    }
  });

  // Inject CSS to hide scrollbars
  window.webContents.on('did-finish-load', () => {
    window.webContents.insertCSS(`
      ::-webkit-scrollbar {
        display: none !important;
      }
      * {
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
      }
    `);
  });

  // Register ALL IPC handlers including the new ones
  ipcMain.handle('db:getNetWorth', async () => {
    try {
      const accounts = database.getAccounts();
      const netWorth = accounts.reduce((total, account) => total + account.balance, 0);
      return { data: netWorth, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getMonthlyComparison', async () => {
    try {
      const currentMonth = new Date();
      const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
      
      const currentMonthData = database.getIncomeExpenseData('all', 'month');
      const lastMonthData = database.getIncomeExpenseData('all', 'lastMonth');
      
      const currentExpenses = currentMonthData.expenses || 0;
      const lastExpenses = lastMonthData.expenses || 0;
      
      const percentChange = lastExpenses ? ((lastExpenses - currentExpenses) / lastExpenses) * 100 : 0;
      
      return { data: { percentChange, trend: percentChange >= 0 ? 'lower' : 'higher' }, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getUpcomingPayments', async () => {
    try {
      const recurring = database.getRecurring();
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const upcoming = recurring.filter(item => {
        const nextDate = new Date(item.nextDate);
        return nextDate >= now && nextDate <= weekFromNow;
      });
      
      return { data: upcoming.length, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  // Add all other existing handlers
  ipcMain.handle('db:getCategories', async (event, filters) => {
    try {
      const categories = database.getCategories(filters);
      return { data: categories, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:addCategory', async (event, category) => {
    try {
      const result = database.addCategory(category);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:updateCategory', async (event, id, data) => {
    try {
      const result = database.updateCategory(id, data);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:deleteCategory', async (event, id) => {
    try {
      const result = database.deleteCategory(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getRecurring', async (event, accountId) => {
    try {
      const recurring = database.getRecurring(accountId);
      return { data: recurring, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:addRecurring', async (event, recurring) => {
    try {
      const result = database.addRecurring(recurring);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:updateRecurring', async (event, id, data) => {
    try {
      const result = database.updateRecurring(id, data);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:deleteRecurring', async (event, id) => {
    try {
      const result = database.deleteRecurring(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:addTransaction', async (event, transaction) => {
    try {
      const result = database.addTransaction(transaction);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:updateTransaction', async (event, id, data) => {
    try {
      const result = database.updateTransaction(id, data);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:deleteTransaction', async (event, id) => {
    try {
      const result = database.deleteTransaction(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getTransactions', async (event, accountId) => {
    try {
      const transactions = database.getTransactions(accountId);
      return { data: transactions, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getExpenseCategoriesData', async (event, accountId, period) => {
    try {
      const categories = database.getExpenseCategoriesData(accountId, period);
      return { data: categories, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getTopSpendingCategories', async (event, accountId, period) => {
    try {
      const categories = database.getTopSpendingCategories(accountId, period);
      return { data: categories, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getIncomeExpenseData', async (event, accountId, period) => {
    try {
      const data = database.getIncomeExpenseData(accountId, period);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getTransactionsForChart', async (event, accountId) => {
    try {
      const transactions = database.getTransactionsForChart(accountId);
      return { data: transactions, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:getAccounts', async () => {
    try {
      const accounts = database.getAccounts();
      return { data: accounts, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:addAccount', async (event, account) => {
    try {
      const result = database.addAccount(account);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:updateAccount', async (event, id, balance) => {
    try {
      const result = database.updateAccount(id, balance);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  ipcMain.handle('db:deleteAccount', async (event, id) => {
    try {
      const result = database.deleteAccount(id);
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  // Other necessary IPC handlers
  ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
  });

  ipcMain.handle('license:check', async () => {
    return { valid: true };
  });

  ipcMain.handle('license:info', async () => {
    return { valid: true, key: 'DEMO-KEY', activatedAt: new Date().toISOString() };
  });

  ipcMain.handle('get-user-data-path', async () => {
    return app.getPath('userData');
  });

  ipcMain.handle('check-for-updates', async () => {
    return { updateAvailable: false };
  });

  // Load the app
  const indexPath = path.join(__dirname, '..', 'src', 'index.html');
  console.log('Loading file from:', indexPath);
  
  try {
    await window.loadFile(indexPath);
    await new Promise(resolve => setTimeout(resolve, 7000));

    const screenshotsDir = path.join(__dirname, '..', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir);
    }

    const sections = [
      { name: 'dashboard', tabSelector: '[data-section="Dashboard"]' },
      { name: 'accounts', tabSelector: '[data-section="Accounts"]' },
      { name: 'transactions', tabSelector: '[data-section="Transactions"]' },
      { name: 'recurring', tabSelector: '[data-section="Recurring"]' },
      { name: 'reports', tabSelector: '[data-section="Reports"]' },
      { name: 'categories', tabSelector: '[data-section="Categories"]' }
    ];

    for (const section of sections) {
      console.log(`Capturing ${section.name}...`);
      
      try {
        await window.webContents.executeJavaScript(`
          (async () => {
            const element = document.querySelector('${section.tabSelector}');
            if (element) {
              element.click();
              await new Promise(resolve => setTimeout(resolve, 2000));
              return true;
            } else {
              throw new Error('Element not found: ${section.tabSelector}');
            }
          })()
        `);

        await new Promise(resolve => setTimeout(resolve, 2000));

        const image = await window.webContents.capturePage();
        const pngBuffer = image.toPNG();
        
        const screenshotPath = path.join(screenshotsDir, `${section.name}.png`);
        fs.writeFileSync(screenshotPath, pngBuffer);
        console.log(`Saved screenshot: ${screenshotPath}`);
      } catch (error) {
        console.error(`Error capturing ${section.name}:`, error);
      }
    }

    console.log('Screenshots completed. Press Ctrl+C to exit.');
  } catch (error) {
    console.error('Error:', error);
    if (window && !window.isDestroyed()) {
      window.webContents.openDevTools();
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

app.whenReady().then(captureScreenshots);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});