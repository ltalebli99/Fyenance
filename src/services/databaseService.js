const Database = require('better-sqlite3');
const path = require('path');

class DatabaseService {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = new Database(this.dbPath);
    this.initDatabase();
    this.checkAndRunMigrations();
  }

  static initialize(userDataPath) {
    const dbPath = path.join(userDataPath, 'fyenance.db');
    return new DatabaseService(dbPath);
  }

  initDatabase() {
    // Add schema_versions table first
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_versions (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create tables with updated schema
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
        budget_amount DECIMAL(10,2) DEFAULT 0.00,
        budget_frequency TEXT CHECK(budget_frequency IN ('daily', 'weekly', 'monthly', 'yearly', null)),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount DECIMAL(10,2) NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      CREATE TABLE IF NOT EXISTS recurring (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        category_id INTEGER,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount DECIMAL(10,2) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        frequency TEXT DEFAULT 'monthly' CHECK(
          frequency IN ('daily', 'weekly', 'monthly', 'yearly')
        ),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        account_id INTEGER,
        type TEXT NOT NULL,
        category_id INTEGER,
        amount REAL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_recurring_account_id ON recurring(account_id);
      CREATE INDEX IF NOT EXISTS idx_project_transactions_project_id ON project_transactions(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_transactions_transaction_id ON project_transactions(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_project_recurring_project_id ON project_recurring(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_recurring_recurring_id ON project_recurring(recurring_id);

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

      -- Projects table
      CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          budget REAL,
          start_date TEXT,
          end_date TEXT,
          status TEXT DEFAULT 'active',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      -- Junction table for projects and transactions
      CREATE TABLE IF NOT EXISTS project_transactions (
          project_id INTEGER,
          transaction_id INTEGER,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
          PRIMARY KEY (project_id, transaction_id)
      );

      -- Junction table for projects and recurring items
      CREATE TABLE IF NOT EXISTS project_recurring (
          project_id INTEGER,
          recurring_id INTEGER,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (recurring_id) REFERENCES recurring(id) ON DELETE CASCADE,
          PRIMARY KEY (project_id, recurring_id)
      );
    `);
  }

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

  updateAccount(id, balance, name) {
    console.log('DatabaseService updateAccount called with:', { id, balance, name });
    
    try {
        const stmt = this.db.prepare('UPDATE accounts SET balance = ?, name = ? WHERE id = ?');
        console.log('SQL Statement:', stmt.source);
        console.log('Parameters:', [balance, name, id]);
        
        const result = stmt.run(balance, name, id);
        console.log('Update result:', result);
        
        return result;
    } catch (error) {
        console.error('Database update error:', error);
        console.error('Stack trace:', error.stack);
        throw error;
    }
  }

  deleteAccount(id) {
    const stmt = this.db.prepare('DELETE FROM accounts WHERE id = ?');
    return stmt.run(id);
  }

  // Transactions
  getTransactions(accountId = null, options = {}) {
    const { offset, limit } = options;
    let query = `
      SELECT t.*, 
             c.name as category_name, 
             a.name as account_name,
             (SELECT COUNT(*) FROM transactions ${accountId && accountId !== 'all' ? 'WHERE account_id = ?' : ''}) as total_count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
    `;
    
    if (accountId && accountId !== 'all') {
      query += ' WHERE t.account_id = ?';
      
      if (limit !== undefined) {
        query += ' LIMIT ? OFFSET ?';
        return this.db.prepare(query).all(accountId, accountId, limit, offset || 0);
      }
      return this.db.prepare(query).all(accountId);
    }
    
    if (limit !== undefined) {
      query += ' LIMIT ? OFFSET ?';
      return this.db.prepare(query).all(limit, offset || 0);
    }
    return this.db.prepare(query).all();
  }

  addTransaction(transaction) {
    const stmt = this.db.prepare(`
      INSERT INTO transactions (
        account_id, category_id, type, amount, date, description
      ) VALUES (?, ?, ?, ?, datetime(? || 'T00:00:00Z'), ?)
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

  updateTransaction(id, transaction) {
    const stmt = this.db.prepare(`
      UPDATE transactions 
      SET account_id = ?,
          category_id = ?,
          type = ?,
          amount = ?,
          date = datetime(? || 'T00:00:00Z'),
          description = ?
      WHERE id = ?
    `);
    
    return stmt.run(
      transaction.account_id,
      transaction.category_id,
      transaction.type,
      transaction.amount,
      transaction.date,
      transaction.description,
      id
    );
  }

  deleteTransaction(id) {
    const stmt = this.db.prepare('DELETE FROM transactions WHERE id = ?');
    return stmt.run(id);
  }

  // Categories
  getCategories(options = {}) {
    const { offset, limit } = options;
    let query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM categories) as total_count,
        COALESCE(cu.total_uses, 0) as usage_count,
        cu.last_used,
        c.budget_amount,
        c.budget_frequency
      FROM categories c
      LEFT JOIN category_usage cu ON c.id = cu.category_id
    `;

    if (limit !== undefined) {
      query += ` LIMIT ? OFFSET ?`;
      return this.db.prepare(query).all(limit, offset || 0);
    }

    return this.db.prepare(query).all();
  }

  addCategory(category) {
    const stmt = this.db.prepare(`
      INSERT INTO categories (
        name, 
        type, 
        budget_amount, 
        budget_frequency
      ) VALUES (?, ?, ?, ?)`
    );
    
    return stmt.run(
      category.name, 
      category.type, 
      category.budget_amount || null, 
      category.budget_frequency || null
    );
  }

  updateCategory(id, data) {
    const stmt = this.db.prepare(`
      UPDATE categories 
      SET name = ?, 
          type = ?, 
          budget_amount = ?, 
          budget_frequency = ? 
      WHERE id = ?`
    );
    
    return stmt.run(
      data.name, 
      data.type, 
      data.budget_amount || null, 
      data.budget_frequency || null, 
      id
    );
  }

  deleteCategory(id) {
    const stmt = this.db.prepare('DELETE FROM categories WHERE id = ?');
    return stmt.run(id);
  }

  // Recurring
  getRecurring(accountId = null, options = {}) {
    const { offset, limit } = options;
    let query = `
      SELECT r.*, 
             c.name as category_name, 
             a.name as account_name,
             (SELECT COUNT(*) FROM recurring ${accountId && accountId !== 'all' ? 'WHERE account_id = ?' : ''}) as total_count
      FROM recurring r
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN accounts a ON r.account_id = a.id
    `;
    
    if (accountId && accountId !== 'all') {
      query += ' WHERE r.account_id = ?';
      
      if (limit !== undefined) {
        query += ' LIMIT ? OFFSET ?';
        return this.db.prepare(query).all(accountId, accountId, limit, offset || 0);
      }
      return this.db.prepare(query).all(accountId);
    }
    
    if (limit !== undefined) {
      query += ' LIMIT ? OFFSET ?';
      return this.db.prepare(query).all(limit, offset || 0);
    }
    return this.db.prepare(query).all();
  }

  addRecurring(recurring) {
    const stmt = this.db.prepare(`
      INSERT INTO recurring (
        account_id, category_id, name, amount, type,
        start_date, end_date, frequency, description, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    return stmt.run(
      recurring.account_id,
      recurring.category_id,
      recurring.name,
      recurring.amount,
      recurring.type,
      recurring.start_date,
      recurring.end_date || null,
      recurring.frequency || 'monthly',
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
          start_date = ?, 
          end_date = ?,
          frequency = ?,
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
      data.start_date,
      data.end_date || null,
      data.frequency || 'monthly',
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
      SELECT t.*, 
             c.name as category_name, 
             a.name as account_name,
             strftime('%Y-%m-%d', t.date) as formatted_date
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE t.date BETWEEN datetime(? || 'T00:00:00Z') AND datetime(? || 'T23:59:59Z')
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
        recurring: this.db.prepare('SELECT * FROM recurring').all(),
        projects: this.db.prepare('SELECT * FROM projects').all(),
        project_transactions: this.db.prepare('SELECT * FROM project_transactions').all(),
        project_recurring: this.db.prepare('SELECT * FROM project_recurring').all(),
        templates: this.db.prepare('SELECT * FROM templates').all(),
        app_settings: this.db.prepare('SELECT * FROM app_settings').all(),
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
        const data = JSON.parse(require('fs').readFileSync(filePath, 'utf8'));
        
        console.log('Import file structure:', {
            accounts: data.accounts?.length || 0,
            categories: data.categories?.length || 0,
            transactions: data.transactions?.length || 0,
            recurring: data.recurring?.length || 0
        });
        
        this.db.prepare('BEGIN TRANSACTION').run();
        
        try {
            // Drop views first
            this.db.exec('DROP VIEW IF EXISTS category_usage');
            
            // Clear existing data
            this.db.prepare('DELETE FROM project_transactions').run();
            this.db.prepare('DELETE FROM project_recurring').run();
            this.db.prepare('DELETE FROM projects').run();
            this.db.prepare('DELETE FROM templates').run();
            this.db.prepare('DELETE FROM recurring').run();
            this.db.prepare('DELETE FROM transactions').run();
            this.db.prepare('DELETE FROM categories').run();
            this.db.prepare('DELETE FROM accounts').run();
            this.db.prepare('DELETE FROM app_settings').run();
            this.db.prepare('DELETE FROM schema_versions').run();
            this.db.prepare('DELETE FROM sqlite_sequence').run();

            // Import accounts (relatively unchanged across versions)
            if (data.accounts) {
                const stmt = this.db.prepare(`
                    INSERT INTO accounts (id, name, balance, created_at) 
                    VALUES (?, ?, ?, ?)
                `);
                data.accounts.forEach(account => {
                    stmt.run(
                        account.id,
                        account.name,
                        account.balance,
                        account.created_at || new Date().toISOString()
                    );
                });
            }

            // Import categories with V2 schema support
            if (data.categories) {
                const stmt = this.db.prepare(`
                    INSERT INTO categories (
                        id, name, type, budget_amount, budget_frequency, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `);
                data.categories.forEach(category => {
                    stmt.run(
                        category.id,
                        category.name,
                        category.type || 'expense',
                        category.budget_amount || null,  // V2 addition
                        category.budget_frequency || null, // V2 addition
                        category.created_at || new Date().toISOString()
                    );
                });
            }

            // Import transactions with proper date format handling
            if (data.transactions) {
                const stmt = this.db.prepare(`
                    INSERT INTO transactions (
                        id, account_id, category_id, type, amount, 
                        date, description, created_at
                    ) VALUES (?, ?, ?, ?, ?, date(?), ?, datetime(?))
                `);
                
                data.transactions.forEach(tx => {
                    try {
                        // Handle various date formats
                        let dateStr = tx.date;
                        let createdStr = tx.created_at;

                        // Handle old timestamp format (numeric)
                        if (typeof dateStr === 'number') {
                            dateStr = new Date(dateStr).toISOString().split('T')[0];
                        }

                        // Handle ISO string format
                        if (dateStr && dateStr.includes('T')) {
                            dateStr = dateStr.split('T')[0];
                        }

                        // Handle created_at
                        if (typeof createdStr === 'number') {
                            createdStr = new Date(createdStr).toISOString();
                        } else if (createdStr && !createdStr.includes('T')) {
                            createdStr = `${createdStr.split(' ')[0]}T${createdStr.split(' ')[1] || '00:00:00'}Z`;
                        }

                        // Ensure we have valid dates
                        if (!dateStr || !Date.parse(dateStr)) {
                            console.warn('Invalid date for transaction:', tx);
                            dateStr = new Date().toISOString().split('T')[0];
                        }
                        if (!createdStr || !Date.parse(createdStr)) {
                            createdStr = new Date().toISOString();
                        }

                        console.log('Importing transaction with date:', {
                            original: tx.date,
                            converted: dateStr,
                            created: createdStr
                        });

                        stmt.run(
                            tx.id,
                            tx.account_id,
                            tx.category_id,
                            tx.type || 'expense',
                            tx.amount,
                            dateStr,
                            tx.description || '',
                            createdStr
                        );
                    } catch (err) {
                        console.warn(`Error importing transaction:`, {
                            transaction: tx,
                            error: err.message,
                            stack: err.stack
                        });
                    }
                });
            }

            // Import recurring with V3 schema support
            if (data.recurring) {
                const stmt = this.db.prepare(`
                    INSERT INTO recurring (
                        id, account_id, category_id, name, type, amount,
                        start_date, end_date, description, is_active,
                        frequency, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, date(?), date(?), ?, ?, ?, datetime(?))
                `);

                data.recurring.forEach(rec => {
                    try {
                        // Handle V3 migration from billing_date to start_date
                        let startDate;
                        if (rec.billing_date !== undefined && rec.billing_date !== null) {
                            // Convert billing_date to proper start_date
                            startDate = this.db.prepare(`
                                SELECT date('now', 'start of month', '+' || ? || ' days', '-1 month') as date
                            `).get(rec.billing_date - 1)['date'];
                        } else {
                            startDate = rec.start_date || rec.created_at || new Date().toISOString();
                        }

                        // Ensure startDate is a string before using includes
                        startDate = String(startDate);
                        if (!startDate.includes('T')) {
                            startDate = startDate.replace(' ', 'T');
                        }

                        // Handle end_date if it exists
                        let endDate = rec.end_date;
                        if (endDate) {
                            endDate = String(endDate);
                            if (!endDate.includes('T')) {
                                endDate = endDate.replace(' ', 'T');
                            }
                        }

                        // Handle created_at
                        let createdAt = rec.created_at || new Date().toISOString();
                        createdAt = String(createdAt);
                        if (!createdAt.includes('T')) {
                            createdAt = createdAt.replace(' ', 'T');
                        }

                        stmt.run(
                            rec.id,
                            rec.account_id,
                            rec.category_id,
                            rec.name,
                            rec.type || 'expense',
                            Math.abs(parseFloat(rec.amount)),
                            startDate,
                            endDate || null,
                            rec.description || '',
                            rec.is_active ?? 1,
                            rec.frequency || 'monthly',
                            createdAt
                        );
                    } catch (err) {
                        console.warn(`Error importing recurring transaction:`, {
                            recurring: rec,
                            error: err.message,
                            stack: err.stack
                        });
                    }
                });
            }

            // Insert projects
            if (data.projects) {
                const stmt = this.db.prepare(`
                    INSERT INTO projects (
                        id, name, description, budget, start_date, 
                        end_date, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);
                data.projects.forEach(project => {
                    stmt.run(
                        project.id,
                        project.name,
                        project.description,
                        project.budget,
                        project.start_date,
                        project.end_date,
                        project.status,
                        project.created_at
                    );
                });
            }

            // Insert project relationships
            if (data.project_transactions) {
                const stmt = this.db.prepare(`
                    INSERT INTO project_transactions (project_id, transaction_id)
                    VALUES (?, ?)
                `);
                data.project_transactions.forEach(pt => {
                    stmt.run(pt.project_id, pt.transaction_id);
                });
            }

            if (data.project_recurring) {
                const stmt = this.db.prepare(`
                    INSERT INTO project_recurring (project_id, recurring_id)
                    VALUES (?, ?)
                `);
                data.project_recurring.forEach(pr => {
                    stmt.run(pr.project_id, pr.recurring_id);
                });
            }

            // Insert templates
            if (data.templates) {
                const stmt = this.db.prepare(`
                    INSERT INTO templates (
                        id, name, account_id, type, category_id, 
                        amount, description, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);
                data.templates.forEach(template => {
                    stmt.run(
                        template.id,
                        template.name,
                        template.account_id,
                        template.type,
                        template.category_id,
                        template.amount,
                        template.description,
                        template.created_at
                    );
                });
            }

            // Recreate views
            this.db.exec(`
                CREATE VIEW IF NOT EXISTS category_usage AS
                WITH usage_data AS (
                    SELECT category_id,
                           COUNT(*) as use_count,
                           MAX(date) as last_used
                    FROM transactions
                    WHERE category_id IS NOT NULL
                    GROUP BY category_id
                    
                    UNION ALL
                    
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
                GROUP BY category_id
            `);

            // Set schema version to current
            this.db.prepare('INSERT INTO schema_versions (version) VALUES (3)').run();
            
            this.db.prepare('COMMIT').run();
            return { success: true, error: null };
        } catch (error) {
            this.db.prepare('ROLLBACK').run();
            console.error('Import error during transaction:', error);
            return { success: false, error };
        }
    } catch (error) {
        console.error('File reading/parsing error:', error);
        return { success: false, error };
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
        // Drop the view first
        this.db.exec('DROP VIEW IF EXISTS category_usage');

        // Delete all data from tables in reverse order of dependencies
        this.db.prepare('DELETE FROM templates').run();
        this.db.prepare('DELETE FROM recurring').run();
        this.db.prepare('DELETE FROM transactions').run();
        this.db.prepare('DELETE FROM categories').run();
        this.db.prepare('DELETE FROM accounts').run();
        this.db.prepare('DELETE FROM app_settings').run();
        this.db.prepare('DELETE FROM schema_versions').run();
        this.db.prepare('DELETE FROM project_transactions').run();
        this.db.prepare('DELETE FROM project_recurring').run();
        this.db.prepare('DELETE FROM projects').run();

        // Reset all auto-increment counters
        this.db.prepare('DELETE FROM sqlite_sequence').run();

        this.db.prepare('COMMIT').run();

        // Re-initialize the database structure
        this.initDatabase();

        return { success: true, error: null };
      } catch (error) {
        this.db.prepare('ROLLBACK').run();
        return { success: false, error };
      }
    } catch (error) {
      console.error('Delete database error:', error);
      return { success: false, error };
    }
  }

  exportToCSV() {
    try {
      const data = {
        accounts: this.db.prepare('SELECT * FROM accounts').all(),
        categories: this.db.prepare('SELECT * FROM categories').all(),
        transactions: this.db.prepare(`
          SELECT 
            t.*,
            a.name as account_name,
            c.name as category_name
          FROM transactions t
          LEFT JOIN accounts a ON t.account_id = a.id
          LEFT JOIN categories c ON t.category_id = c.id
        `).all(),
        recurring: this.db.prepare(`
          SELECT 
            r.*,
            a.name as account_name,
            c.name as category_name
          FROM recurring r
          LEFT JOIN accounts a ON r.account_id = a.id
          LEFT JOIN categories c ON r.category_id = c.id
        `).all()
      };

      return data;
    } catch (error) {
      console.error('Export CSV error:', error);
      throw error;
    }
  }

// Add to DatabaseService class
getTemplates() {
  return this.db.prepare(`
    SELECT templates.*, categories.name as category_name, accounts.name as account_name
    FROM templates
    LEFT JOIN categories ON templates.category_id = categories.id
    LEFT JOIN accounts ON templates.account_id = accounts.id
  `).all();
}

addTemplate(template) {
  const stmt = this.db.prepare(`
    INSERT INTO templates (name, account_id, type, category_id, amount, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    template.name,
    template.account_id,
    template.type,
    template.category_id,
    template.amount,
    template.description
  );
}

deleteTemplate(id) {
  return this.db.prepare('DELETE FROM templates WHERE id = ?').run(id);
  }

getTutorialStatus() {
  const result = this.db.prepare(
    'SELECT value FROM app_settings WHERE key = ?'
  ).get('tutorial-completed');
  return result ? result.value === 'true' : false;
}

setTutorialComplete() {
  const stmt = this.db.prepare(`
    INSERT OR REPLACE INTO app_settings (key, value, updated_at) 
    VALUES ('tutorial-completed', 'true', CURRENT_TIMESTAMP)
  `);
  return stmt.run();
}

resetTutorialStatus() {
  const stmt = this.db.prepare(`
    DELETE FROM app_settings WHERE key = 'tutorial-completed'
  `);
  return stmt.run();
}

getCurrentSchemaVersion() {
  const result = this.db.prepare('SELECT MAX(version) as version FROM schema_versions').get();
  return result?.version || 0;
}

checkAndRunMigrations() {
  const currentVersion = this.getCurrentSchemaVersion();
  console.log('Current database version:', currentVersion);

  try {
    if (currentVersion < 1) this.runMigrationV1();
    if (currentVersion < 2) this.runMigrationV2();
    if (currentVersion < 3) this.runMigrationV3();
    // Remove any V4 version entries if they exist
    if (currentVersion === 4) {
      this.db.prepare('DELETE FROM schema_versions WHERE version = 4').run();
      console.log('Reverted to database version 3');
    }
    // Add future migrations here
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

runMigrationV1() {
  console.log('Running migration v1: Converting transaction dates to timestamps...');
  
  try {
    // Start a single transaction for the entire migration
    this.db.prepare('BEGIN TRANSACTION').run();
    
    // First drop the view and index
    this.db.exec('DROP VIEW IF EXISTS category_usage');
    this.db.exec('DROP INDEX IF EXISTS idx_transactions_date');
    
    // Create new table with desired schema
    this.db.exec(`
      CREATE TABLE transactions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        category_id INTEGER,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount DECIMAL(10,2) NOT NULL,
        date TIMESTAMP NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );

      -- Copy data with converted dates
      INSERT INTO transactions_new 
        SELECT 
          id,
          account_id,
          category_id,
          type,
          amount,
          datetime(date || 'T00:00:00Z'),
          description,
          created_at
        FROM transactions;

      -- Drop old table and rename new one
      DROP TABLE transactions;
      ALTER TABLE transactions_new RENAME TO transactions;
    `);

    // Recreate the index
    this.db.exec('CREATE INDEX idx_transactions_date ON transactions(date)');

    // Recreate the view with TIMESTAMP handling
    this.db.exec(`
      CREATE VIEW category_usage AS
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

    // Record the migration
    this.db.prepare('INSERT INTO schema_versions (version) VALUES (1)').run();
    
    // Commit the transaction
    this.db.prepare('COMMIT').run();
    console.log('Migration v1 completed successfully');
  } catch (error) {
    // Rollback on error
    this.db.prepare('ROLLBACK').run();
    console.error('Migration v1 failed:', error);
    throw error;
  }
}

runMigrationV2() {
  console.log('Running migration v2: Adding budget fields to categories...');
  
  try {
    this.db.prepare('BEGIN TRANSACTION').run();
    
    // Check if columns exist first
    const tableInfo = this.db.prepare("PRAGMA table_info(categories)").all();
    const columns = tableInfo.map(col => col.name);
    
    // Only add columns if they don't exist
    if (!columns.includes('budget_amount')) {
      this.db.exec(`ALTER TABLE categories ADD COLUMN budget_amount DECIMAL(10,2);`);
    }
    
    if (!columns.includes('budget_frequency')) {
      this.db.exec(`
        ALTER TABLE categories ADD COLUMN budget_frequency TEXT CHECK(
          budget_frequency IN ('daily', 'weekly', 'monthly', 'yearly', null)
        );
      `);
    }

    // Update existing frequency constraints if column exists
    this.db.exec(`
      UPDATE categories 
      SET budget_frequency = NULL 
      WHERE budget_frequency NOT IN ('daily', 'weekly', 'monthly', 'yearly', NULL);
    `);

    // Record the migration if not already recorded
    const migrationExists = this.db.prepare('SELECT 1 FROM schema_versions WHERE version = 2').get();
    if (!migrationExists) {
      this.db.prepare('INSERT INTO schema_versions (version) VALUES (2)').run();
    }
    
    this.db.prepare('COMMIT').run();
    console.log('Migration v2 completed successfully');
  } catch (error) {
    this.db.prepare('ROLLBACK').run();
    console.error('Migration v2 failed:', error);
    throw error;
  }
}

runMigrationV3() {
  console.log('Running migration v3: Converting recurring billing_date to start_date/end_date...');
  
  try {
    this.db.prepare('BEGIN TRANSACTION').run();
    
    // First drop the view since it depends on the recurring table
    this.db.exec('DROP VIEW IF EXISTS category_usage');
    
    // Check if billing_date exists
    const tableInfo = this.db.prepare("PRAGMA table_info(recurring)").all();
    const hasBillingDate = tableInfo.some(col => col.name === 'billing_date');
    
    // Create new table with desired schema
    this.db.exec(`
      CREATE TABLE recurring_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        category_id INTEGER,
        name TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        start_date DATE NOT NULL,
        end_date DATE,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        frequency TEXT DEFAULT 'monthly' CHECK(
          frequency IN ('daily', 'weekly', 'monthly', 'yearly')
        ),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      );
    `);

    // Copy data with appropriate date handling
    if (hasBillingDate) {
      // Use billing_date if it exists
      this.db.exec(`
        INSERT INTO recurring_new 
        SELECT 
          id,
          account_id,
          category_id,
          name,
          amount,
          type,
          date('now', 'start of month', '+' || (billing_date - 1) || ' days') as start_date,
          NULL as end_date,
          description,
          is_active,
          'monthly' as frequency,
          created_at
        FROM recurring;
      `);
    } else {
      // For fresh installs, use current date as start_date
      this.db.exec(`
        INSERT INTO recurring_new 
        SELECT 
          id,
          account_id,
          category_id,
          name,
          amount,
          type,
          date('now') as start_date,
          NULL as end_date,
          description,
          is_active,
          'monthly' as frequency,
          created_at
        FROM recurring;
      `);
    }

    // Drop old table and rename new one
    this.db.exec(`
      DROP TABLE recurring;
      ALTER TABLE recurring_new RENAME TO recurring;
    `);

    // Recreate the category_usage view
    this.db.exec(`
      CREATE VIEW category_usage AS
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

    // Record the migration
    this.db.prepare('INSERT INTO schema_versions (version) VALUES (3)').run();
    
    this.db.prepare('COMMIT').run();
    console.log('Migration v3 completed successfully');
  } catch (error) {
    this.db.prepare('ROLLBACK').run();
    console.error('Migration v3 failed:', error);
    throw error;
  }
}

getCashFlowData(accountIds, period = 'month') {
  let dateFilter;
  switch(period) {
    case 'year':
      dateFilter = "date >= date('now', '-1 year')";
      break;
    case 'quarter':
      dateFilter = "date >= date('now', '-3 months')";
      break;
    default: // month
      dateFilter = "date >= date('now', '-1 month')";
  }

  let query = `
    WITH RECURSIVE dates(date) AS (
      SELECT date('now', '-1 month')
      UNION ALL
      SELECT date(date, '+1 day')
      FROM dates
      WHERE date < date('now')
    ),
    daily_transactions AS (
      SELECT 
        strftime('%Y-%m-%d', t.date) as date,
        SUM(CASE WHEN t.type = 'income' THEN amount ELSE -amount END) as net_amount
      FROM transactions t
      WHERE ${dateFilter}
      ${accountIds.includes('all') ? '' : 'AND t.account_id IN (' + accountIds.join(',') + ')'}
      GROUP BY strftime('%Y-%m-%d', t.date)
    )
    SELECT 
      d.date,
      COALESCE(dt.net_amount, 0) as net_amount,
      SUM(COALESCE(dt.net_amount, 0)) OVER (ORDER BY d.date) as running_balance
    FROM dates d
    LEFT JOIN daily_transactions dt ON d.date = dt.date
    ORDER BY d.date;
  `;

  return this.db.prepare(query).all();
}

getAllBudgetProgress(period = 'month') {
    let dateFilter;
    switch(period) {
        case 'year':
            dateFilter = "strftime('%Y', date) = strftime('%Y', 'now')";
            break;
        case 'quarter':
            dateFilter = "date >= date('now', '-3 months')";
            break;
        case 'month':
            dateFilter = "strftime('%Y-%m', date) = strftime('%Y-%m', 'now')";
            break;
        case 'week':
            dateFilter = "date >= date('now', '-7 days')";
            break;
        case 'day':
            dateFilter = "date = date('now')";
            break;
    }

    const query = `
        WITH combined_expenses AS (
            SELECT 
                t.category_id,
                t.amount,
                t.date
            FROM transactions t
            WHERE ${dateFilter}
                AND t.type = 'expense'
            
            UNION ALL
            
            SELECT 
                r.category_id,
                r.amount,
                date('now') as date
            FROM recurring r
            WHERE r.type = 'expense'
                AND r.is_active = 1
        )
        SELECT 
            c.name as category_name,
            c.budget_amount,
            c.budget_frequency,
            CASE c.budget_frequency
                WHEN 'yearly' THEN c.budget_amount / 365.0 * 
                    CASE '${period}'
                        WHEN 'year' THEN 365
                        WHEN 'quarter' THEN 90
                        WHEN 'month' THEN 30
                        WHEN 'week' THEN 7
                        WHEN 'day' THEN 1
                    END
                WHEN 'monthly' THEN c.budget_amount / 30.0 * 
                    CASE '${period}'
                        WHEN 'year' THEN 365
                        WHEN 'quarter' THEN 90
                        WHEN 'month' THEN 30
                        WHEN 'week' THEN 7
                        WHEN 'day' THEN 1
                    END
                WHEN 'weekly' THEN c.budget_amount / 7.0 * 
                    CASE '${period}'
                        WHEN 'year' THEN 365
                        WHEN 'quarter' THEN 90
                        WHEN 'month' THEN 30
                        WHEN 'week' THEN 7
                        WHEN 'day' THEN 1
                    END
                WHEN 'daily' THEN c.budget_amount * 
                    CASE '${period}'
                        WHEN 'year' THEN 365
                        WHEN 'quarter' THEN 90
                        WHEN 'month' THEN 30
                        WHEN 'week' THEN 7
                        WHEN 'day' THEN 1
                    END
            END as adjusted_budget,
            SUM(COALESCE(ce.amount, 0)) as spent,
            COUNT(ce.amount) as transaction_count
        FROM categories c
        LEFT JOIN combined_expenses ce ON c.id = ce.category_id
        WHERE c.budget_amount IS NOT NULL
            AND c.budget_frequency IS NOT NULL
            AND c.budget_amount > 0
        GROUP BY c.id, c.name
        ORDER BY (COALESCE(SUM(ce.amount), 0) / 
            CASE c.budget_frequency
                WHEN 'yearly' THEN c.budget_amount / 365.0 * 
                    CASE '${period}'
                        WHEN 'year' THEN 365
                        WHEN 'quarter' THEN 90
                        WHEN 'month' THEN 30
                        WHEN 'week' THEN 7
                        WHEN 'day' THEN 1
                    END
                WHEN 'monthly' THEN c.budget_amount / 30.0 * 
                    CASE '${period}'
                        WHEN 'year' THEN 365
                        WHEN 'quarter' THEN 90
                        WHEN 'month' THEN 30
                        WHEN 'week' THEN 7
                        WHEN 'day' THEN 1
                    END
                WHEN 'weekly' THEN c.budget_amount / 7.0 * 
                    CASE '${period}'
                        WHEN 'year' THEN 365
                        WHEN 'quarter' THEN 90
                        WHEN 'month' THEN 30
                        WHEN 'week' THEN 7
                        WHEN 'day' THEN 1
                    END
                WHEN 'daily' THEN c.budget_amount * 
                    CASE '${period}'
                        WHEN 'year' THEN 365
                        WHEN 'quarter' THEN 90
                        WHEN 'month' THEN 30
                        WHEN 'week' THEN 7
                        WHEN 'day' THEN 1
                    END
            END) DESC`;

    return this.db.prepare(query).all();
}

// Add this new method for fetching all transactions without pagination
getAllTransactions(accountId = null) {
  let query = `
    SELECT t.*, 
           c.name as category_name, 
           a.name as account_name
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

// Add this new method for fetching all recurring without pagination
getAllRecurring(accountId = null) {
  let query = `
    SELECT r.*, 
           c.name as category_name, 
           a.name as account_name
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

createProject(project) {
  const stmt = this.db.prepare(`
    INSERT INTO projects (name, description, budget, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    project.name,
    project.description,
    project.budget,
    project.start_date,
    project.end_date,
    project.status || 'active'
  );
}

updateProject(id, project) {
  const stmt = this.db.prepare(`
    UPDATE projects 
    SET name = ?, description = ?, budget = ?, 
        start_date = ?, end_date = ?, status = ?
    WHERE id = ?
  `);
  
  return stmt.run(
    project.name,
    project.description,
    project.budget,
    project.start_date,
    project.end_date,
    project.status,
    id
  );
}

deleteProject(id) {
  const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
  return stmt.run(id);
}

getProjects() {
    const query = `
        WITH project_totals AS (
            -- Regular transactions
            SELECT 
                pt.project_id,
                t.type,
                t.amount,
                'transaction' as source
            FROM project_transactions pt
            JOIN transactions t ON pt.transaction_id = t.id
            
            UNION ALL
            
            -- Recurring transactions
            SELECT 
                pr.project_id,
                r.type,
                r.amount,
                'recurring' as source
            FROM project_recurring pr
            JOIN recurring r ON pr.recurring_id = r.id
            WHERE r.is_active = 1
        )
        SELECT 
            p.*,
            (SELECT COUNT(*) FROM project_transactions WHERE project_id = p.id) as transaction_count,
            (SELECT COUNT(*) FROM project_recurring WHERE project_id = p.id AND 
             EXISTS (SELECT 1 FROM recurring r WHERE r.id = recurring_id AND r.is_active = 1)
            ) as recurring_count,
            COALESCE(SUM(CASE 
                WHEN totals.type = 'expense' THEN totals.amount
                ELSE 0 
            END), 0) as total_spent,
            COALESCE(SUM(CASE 
                WHEN totals.type = 'income' THEN totals.amount
                ELSE 0 
            END), 0) as total_income
        FROM projects p
        LEFT JOIN project_totals totals ON p.id = totals.project_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
    `;
    
    return this.db.prepare(query).all();
}

getProjectDetails(id) {
    const query = `
        WITH combined_transactions AS (
            -- Regular transactions
            SELECT 
                t.id,
                t.type,
                t.amount,
                t.date,
                t.description,
                t.category_id,
                c.name as category_name,
                'transaction' as source
            FROM transactions t
            JOIN project_transactions pt ON t.id = pt.transaction_id
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE pt.project_id = ?

            UNION ALL

            -- Recurring transactions
            SELECT 
                r.id,
                r.type,
                r.amount,
                r.start_date as date,
                r.name as description,
                r.category_id,
                c.name as category_name,
                'recurring' as source
            FROM recurring r
            JOIN project_recurring pr ON r.id = pr.recurring_id
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE pr.project_id = ? AND r.is_active = 1
        )
        SELECT 
            p.*,
            (SELECT COUNT(*) FROM project_transactions WHERE project_id = p.id) as transaction_count,
            (SELECT COUNT(*) FROM project_recurring WHERE project_id = p.id) as recurring_count,
            COALESCE(SUM(CASE 
                WHEN type = 'expense' THEN amount
                ELSE 0 
            END), 0) as total_spent,
            COALESCE(SUM(CASE 
                WHEN type = 'income' THEN amount
                ELSE 0 
            END), 0) as total_income
        FROM projects p
        LEFT JOIN combined_transactions ct ON 1=1
        WHERE p.id = ?
        GROUP BY p.id;
    `;
    
    const project = this.db.prepare(query).get(id, id, id);
    
    if (!project) return null;

    // Get associated transactions
    const transactionsQuery = `
        SELECT t.*, c.name as category_name
        FROM transactions t
        JOIN project_transactions pt ON t.id = pt.transaction_id
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE pt.project_id = ?
        ORDER BY t.date DESC
    `;

    // Get associated recurring transactions
    const recurringQuery = `
        SELECT r.*, c.name as category_name
        FROM recurring r
        JOIN project_recurring pr ON r.id = pr.recurring_id
        LEFT JOIN categories c ON r.category_id = c.id
        WHERE pr.project_id = ? AND r.is_active = 1
        ORDER BY r.start_date DESC
    `;
    
    project.transactions = this.db.prepare(transactionsQuery).all(id);
    project.recurring = this.db.prepare(recurringQuery).all(id);
    
    return project;
}

addTransactionProjects(transactionId, projectIds) {
  const stmt = this.db.prepare(`
    INSERT INTO project_transactions (project_id, transaction_id)
    VALUES (?, ?)
  `);

  projectIds.forEach(projectId => {
    stmt.run(projectId, transactionId);
  });
}

updateTransactionProjects(transactionId, projectIds) {
  // First delete existing associations
  this.db.prepare('DELETE FROM project_transactions WHERE transaction_id = ?')
    .run(transactionId);

  // Then add new ones
  if (projectIds.length > 0) {
    this.addTransactionProjects(transactionId, projectIds);
  }
}

addRecurringProjects(recurringId, projectIds) {
  const stmt = this.db.prepare(`
    INSERT INTO project_recurring (project_id, recurring_id)
    VALUES (?, ?)
  `);

  projectIds.forEach(projectId => {
    stmt.run(projectId, recurringId);
  });
}

updateRecurringProjects(recurringId, projectIds) {
  // First delete existing associations
  this.db.prepare('DELETE FROM project_recurring WHERE recurring_id = ?')
    .run(recurringId);

  // Then add new ones
  if (projectIds.length > 0) {
    this.addRecurringProjects(recurringId, projectIds);
  }
  
  return true;
}

getTransactionProjects(transactionId) {
  return this.db.prepare(`
    SELECT p.id, p.name 
    FROM projects p
    JOIN project_transactions pt ON p.id = pt.project_id
    WHERE pt.transaction_id = ?
  `).all(transactionId);
}

getRecurringProjects(recurringId) {
  return this.db.prepare(`
    SELECT p.id, p.name 
    FROM projects p
    JOIN project_recurring pr ON p.id = pr.project_id
    WHERE pr.recurring_id = ?
  `).all(recurringId);
}

fetchTransactionsForReports(accountIds) {
  if (!accountIds || !Array.isArray(accountIds)) {
    throw new Error('Account IDs must be an array');
  }

  // If 'all' is included, fetch all transactions
  if (accountIds.includes('all')) {
    return this.db.prepare(`
      SELECT t.*, c.name as category_name, a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
    `).all();
  }

  // Otherwise, use IN clause for specific accounts
  const placeholders = accountIds.map(() => '?').join(',');
  const query = `
    SELECT t.*, c.name as category_name, a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.account_id IN (${placeholders})
  `;

  return this.db.prepare(query).all(accountIds);
}

fetchRecurringForReports(accountIds) {
  if (!accountIds || !Array.isArray(accountIds)) {
    throw new Error('Account IDs must be an array');
  }

  // If 'all' is included, fetch all recurring
  if (accountIds.includes('all')) {
    return this.db.prepare(`
      SELECT r.*, c.name as category_name, a.name as account_name
      FROM recurring r
      LEFT JOIN categories c ON r.category_id = c.id
      LEFT JOIN accounts a ON r.account_id = a.id
    `).all();
  }

  // Otherwise, use IN clause for specific accounts
  const placeholders = accountIds.map(() => '?').join(',');
  const query = `
    SELECT r.*, c.name as category_name, a.name as account_name
    FROM recurring r
    LEFT JOIN categories c ON r.category_id = c.id
    LEFT JOIN accounts a ON r.account_id = a.id
    WHERE r.account_id IN (${placeholders})
  `;

  return this.db.prepare(query).all(accountIds);
}
}

module.exports = DatabaseService;