const Database = require('better-sqlite3');
const path = require('path');

class DatabaseService {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = new Database(this.dbPath);
    this.initDatabase();
  }

  static initialize(userDataPath) {
    const dbPath = path.join(userDataPath, 'fyenance.db');
    return new DatabaseService(dbPath);
  }

  initDatabase() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        category_id INTEGER,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount DECIMAL(10,2) NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS recurring (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        category_id INTEGER,
        name TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        billing_date INTEGER NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_recurring_account_id ON recurring(account_id);

      -- Create a view for category usage statistics
      CREATE VIEW IF NOT EXISTS category_usage AS
      WITH usage_data AS (
          -- Count from transactions
          SELECT category_id,
                 COUNT(*) as use_count,
                 MAX(date) as last_used
          FROM transactions
          WHERE category_id IS NOT NULL
          GROUP BY category_id
          
          UNION ALL
          
          -- Count from recurring transactions
          SELECT category_id,
                 COUNT(*) as use_count,
                 MAX(created_at) as last_used
          FROM recurring
          WHERE category_id IS NOT NULL
          GROUP BY category_id
      )
      SELECT 
          category_id,
          SUM(use_count) as total_uses,
          MAX(last_used) as last_used
      FROM usage_data
      GROUP BY category_id;
    `);
  }

  // Accounts
  getAccounts() {
    return this.db.prepare('SELECT * FROM accounts ORDER BY name').all();
  }

  getAccount(id) {
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  }

  addAccount(account) {
    const stmt = this.db.prepare('INSERT INTO accounts (name, balance) VALUES (?, ?)');
    return stmt.run(account.name, account.balance);
  }

  updateAccount(id, balance) {
    const stmt = this.db.prepare('UPDATE accounts SET balance = ? WHERE id = ?');
    return stmt.run(balance, id);
  }

  deleteAccount(id) {
    const stmt = this.db.prepare('DELETE FROM accounts WHERE id = ?');
    return stmt.run(id);
  }

  // Transactions
  getTransactions(accountId = null) {
    let query = `
      SELECT t.*, c.name as category_name, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
    `;
    
    if (accountId && accountId !== 'all') {
      query += ' WHERE t.account_id = ?';
      return this.db.prepare(query).all(accountId);
    }
    
    return this.db.prepare(query).all();
  }

  addTransaction(transaction) {
    const stmt = this.db.prepare(`
      INSERT INTO transactions (
        account_id, category_id, type, amount, date, description
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      transaction.account_id,
      transaction.category_id,
      transaction.type,
      transaction.amount,
      transaction.date,
      transaction.description
    );
  }

  updateTransaction(id, data) {
    const stmt = this.db.prepare(`
      UPDATE transactions 
      SET account_id = ?, category_id = ?, type = ?, 
          amount = ?, date = ?, description = ?
      WHERE id = ?
    `);
    
    return stmt.run(
      data.account_id,
      data.category_id,
      data.type,
      data.amount,
      data.date,
      data.description,
      id
    );
  }

  deleteTransaction(id) {
    const stmt = this.db.prepare('DELETE FROM transactions WHERE id = ?');
    return stmt.run(id);
  }

  // Categories
  getCategories() {
    return this.db.prepare(`
      SELECT 
        c.*,
        COALESCE(cu.total_uses, 0) as usage_count,
        cu.last_used
      FROM categories c
      LEFT JOIN category_usage cu ON c.id = cu.category_id
      ORDER BY c.type, c.name
    `).all();
  }

  addCategory(category) {
    const stmt = this.db.prepare('INSERT INTO categories (name, type) VALUES (?, ?)');
    return stmt.run(category.name, category.type);
  }

  updateCategory(id, data) {
    const stmt = this.db.prepare('UPDATE categories SET name = ?, type = ? WHERE id = ?');
    return stmt.run(data.name, data.type, id);
  }

  deleteCategory(id) {
    const stmt = this.db.prepare('DELETE FROM categories WHERE id = ?');
    return stmt.run(id);
  }

  // Recurring
  getRecurring(accountId = null) {
    let query = `
      SELECT r.*, c.name as category_name, a.name as account_name
      FROM recurring r
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN accounts a ON r.account_id = a.id
    `;
    
    if (accountId && accountId !== 'all') {
      query += ' WHERE r.account_id = ?';
      return this.db.prepare(query).all(accountId);
    }
    
    return this.db.prepare(query).all();
  }

  addRecurring(recurring) {
    const stmt = this.db.prepare(`
      INSERT INTO recurring (
        account_id, category_id, name, amount, type,
        billing_date, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      recurring.account_id,
      recurring.category_id,
      recurring.name,
      recurring.amount,
      recurring.type,
      recurring.billing_date,
      recurring.description,
      recurring.is_active
    );
  }

  updateRecurring(id, data) {
    const stmt = this.db.prepare(`
      UPDATE recurring 
      SET account_id = ?, 
          category_id = ?, 
          name = ?, 
          amount = ?, 
          type = ?,
          billing_date = ?, 
          description = ?,
          is_active = ?
      WHERE id = ?
    `);
    
    return stmt.run(
      data.account_id,
      data.category_id,
      data.name,
      data.amount,
      data.type,
      data.billing_date,
      data.description,
      data.is_active,
      id
    );
  }

  deleteRecurring(id) {
    const stmt = this.db.prepare('DELETE FROM recurring WHERE id = ?');
    return stmt.run(id);
  }

  // Reports and Analytics
  getTransactionsByDateRange(startDate, endDate, accountId = null) {
    let query = `
      SELECT t.*, c.name as category_name, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.date BETWEEN ? AND ?
    `;
    
    if (accountId) {
      query += ' AND t.account_id = ?';
      return this.db.prepare(query).all(startDate, endDate, accountId);
    }
    
    return this.db.prepare(query).all(startDate, endDate);
  }

  getMonthlyTotals(year, month, accountId = null) {
    let query = `
      SELECT 
        type,
        SUM(amount) as total
      FROM transactions
      WHERE strftime('%Y', date) = ? 
      AND strftime('%m', date) = ?
    `;
    
    if (accountId) {
      query += ' AND account_id = ?';
      query += ' GROUP BY type';
      return this.db.prepare(query).all(year, month, accountId);
    }
    
    query += ' GROUP BY type';
    return this.db.prepare(query).all(year, month);
  }

  getTransactionsForChart(accountId = null) {
    let query = `
      SELECT t.*, c.name as category_name, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
    `;
    
    if (accountId && accountId !== 'all') {
      query += ' WHERE t.account_id = ?';
      return this.db.prepare(query).all(accountId);
    }
    
    return this.db.prepare(query).all();
  }

  getIncomeExpenseData(accountId = null, period = 'month') {
    let dateFilter;
    switch(period) {
      case 'year':
        dateFilter = "strftime('%Y', date) = strftime('%Y', 'now')";
        break;
      case 'quarter':
        dateFilter = "date >= date('now', '-3 months')";
        break;
      default: // month
        dateFilter = "strftime('%Y-%m', date) = strftime('%Y-%m', 'now')";
    }

    let query = `
      SELECT 
        type,
        strftime('%Y-%m', date) as month,
        SUM(amount) as total
      FROM transactions
      WHERE ${dateFilter}
    `;
    
    if (accountId && accountId !== 'all') {
      query += ' AND account_id = ?';
    }
    
    query += ' GROUP BY type, month ORDER BY month, type';
    
    return accountId && accountId !== 'all' ? 
      this.db.prepare(query).all(accountId) : 
      this.db.prepare(query).all();
  }

  getTopSpendingCategories(accountId = null, period = 'month') {
    let dateFilter;
    switch(period) {
      case 'year':
        dateFilter = "strftime('%Y', date) = strftime('%Y', 'now')";
        break;
      case 'quarter':
        dateFilter = "date >= date('now', '-3 months')";
        break;
      default: // month
        dateFilter = "strftime('%Y-%m', date) = strftime('%Y-%m', 'now')";
    }

    let query = `
      WITH combined_expenses AS (
        -- Regular transactions
        SELECT 
          category_id,
          amount
        FROM transactions t
        WHERE ${dateFilter}
          AND t.type = 'expense'
          ${accountId && accountId !== 'all' ? 'AND t.account_id = ?' : ''}
        
        UNION ALL
        
        -- Recurring expenses/subscriptions
        SELECT 
          category_id,
          amount
        FROM recurring r
        WHERE r.type = 'expense'
          AND r.is_active = 1
          ${accountId && accountId !== 'all' ? 'AND r.account_id = ?' : ''}
      )
      SELECT 
        COALESCE(c.name, 'Uncategorized') as category_name,
        SUM(ce.amount) as total
      FROM combined_expenses ce
      LEFT JOIN categories c ON ce.category_id = c.id
      GROUP BY COALESCE(c.name, 'Uncategorized')
      HAVING total > 0
      ORDER BY total DESC
    `;

    console.log('Top spending categories query:', query);
    const result = accountId && accountId !== 'all' ? 
      this.db.prepare(query).all(accountId, accountId) : // Pass accountId twice for both UNION parts
      this.db.prepare(query).all();
    console.log('Top spending categories result:', result);
    return result;
  }

  getExpenseCategoriesData(accountId = null, period = 'month') {
    let dateFilter;
    switch(period) {
      case 'year':
        dateFilter = "strftime('%Y', date) = strftime('%Y', 'now')";
        break;
      case 'quarter':
        dateFilter = "date >= date('now', '-3 months')";
        break;
      default: // month
        dateFilter = "strftime('%Y-%m', date) = strftime('%Y-%m', 'now')";
    }

    let query = `
      WITH combined_expenses AS (
        -- Regular transactions
        SELECT 
          category_id,
          amount
        FROM transactions t
        WHERE ${dateFilter}
          AND t.type = 'expense'
          ${accountId && accountId !== 'all' ? 'AND t.account_id = ?' : ''}
        
        UNION ALL
        
        -- Recurring expenses/subscriptions
        SELECT 
          category_id,
          amount
        FROM recurring r
        WHERE r.type = 'expense'
          AND r.is_active = 1
          ${accountId && accountId !== 'all' ? 'AND r.account_id = ?' : ''}
      )
      SELECT 
        COALESCE(c.name, 'Uncategorized') as category_name,
        SUM(ce.amount) as total,
        COUNT(*) as transaction_count
      FROM combined_expenses ce
      LEFT JOIN categories c ON ce.category_id = c.id
      GROUP BY COALESCE(c.name, 'Uncategorized')
      HAVING total > 0
      ORDER BY total DESC
    `;

    const result = accountId && accountId !== 'all' ? 
      this.db.prepare(query).all(accountId, accountId) : 
      this.db.prepare(query).all();
    
    return result;
  }

  exportDatabase(filePath) {
    try {
      // Get all data from tables
      const data = {
        accounts: this.db.prepare('SELECT * FROM accounts').all(),
        categories: this.db.prepare('SELECT * FROM categories').all(),
        transactions: this.db.prepare('SELECT * FROM transactions').all(),
        recurring: this.db.prepare('SELECT * FROM recurring').all()
      };

      // Write to file as JSON
      require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  importDatabase(filePath) {
    try {
      // Read and parse the JSON file
      const data = JSON.parse(require('fs').readFileSync(filePath, 'utf8'));

      // Begin transaction
      this.db.prepare('BEGIN TRANSACTION').run();

      try {
        // Clear existing data
        this.db.prepare('DELETE FROM recurring').run();
        this.db.prepare('DELETE FROM transactions').run();
        this.db.prepare('DELETE FROM categories').run();
        this.db.prepare('DELETE FROM accounts').run();

        // Insert accounts
        const insertAccount = this.db.prepare('INSERT INTO accounts (id, name, balance, created_at) VALUES (?, ?, ?, ?)');
        data.accounts.forEach(account => {
          insertAccount.run(account.id, account.name, account.balance, account.created_at);
        });

        // Insert categories
        const insertCategory = this.db.prepare('INSERT INTO categories (id, name, type, created_at) VALUES (?, ?, ?, ?)');
        data.categories.forEach(category => {
          insertCategory.run(category.id, category.name, category.type, category.created_at);
        });

        // Insert transactions
        const insertTransaction = this.db.prepare(`
          INSERT INTO transactions (id, account_id, category_id, type, amount, date, description, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.transactions.forEach(tx => {
          insertTransaction.run(
            tx.id, tx.account_id, tx.category_id, tx.type,
            tx.amount, tx.date, tx.description, tx.created_at
          );
        });

        // Insert recurring
        const insertRecurring = this.db.prepare(`
          INSERT INTO recurring (id, account_id, category_id, name, amount, type, billing_date, description, is_active, created_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.recurring.forEach(rec => {
          insertRecurring.run(
            rec.id, rec.account_id, rec.category_id, rec.name,
            rec.amount, rec.type, rec.billing_date, rec.description,
            rec.is_active, rec.created_at
          );
        });

        // Commit transaction
        this.db.prepare('COMMIT').run();
        return true;
      } catch (error) {
        // Rollback on error
        this.db.prepare('ROLLBACK').run();
        throw error;
      }
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
  }

  deleteDatabase() {
    try {
      // Close the current database connection
      this.db.close();

      // Clear all data
      this.db = new Database(this.dbPath);
      this.db.prepare('BEGIN TRANSACTION').run();

      try {
        // Delete all data from tables in reverse order of dependencies
        this.db.prepare('DELETE FROM recurring').run();
        this.db.prepare('DELETE FROM transactions').run();
        this.db.prepare('DELETE FROM categories').run();
        this.db.prepare('DELETE FROM accounts').run();

        // Reset all auto-increment counters
        this.db.prepare('DELETE FROM sqlite_sequence').run();

        this.db.prepare('COMMIT').run();

        // Re-initialize the database structure
        this.initDatabase();

        return true;
      } catch (error) {
        this.db.prepare('ROLLBACK').run();
        throw error;
      }
    } catch (error) {
      console.error('Delete database error:', error);
      throw error;
    }
  }
}

module.exports = DatabaseService;