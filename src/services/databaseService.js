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
        category_id INTEGER,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount DECIMAL(10,2) NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        is_transfer INTEGER DEFAULT 0,
        transfer_pair_id INTEGER,
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

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_recurring_account_id ON recurring(account_id);
      CREATE INDEX IF NOT EXISTS idx_project_transactions_project_id ON project_transactions(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_transactions_transaction_id ON project_transactions(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_project_recurring_project_id ON project_recurring(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_recurring_recurring_id ON project_recurring(recurring_id);
    `);

    this.db.exec(`
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
    // console.log('DatabaseService updateAccount called with:', { id, balance, name });
    
    try {
        const stmt = this.db.prepare('UPDATE accounts SET balance = ?, name = ? WHERE id = ?');
        // console.log('SQL Statement:', stmt.source);
        // console.log('Parameters:', [balance, name, id]);
        
        const result = stmt.run(balance, name, id);
        // console.log('Update result:', result);
        
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
  getTransactions(accountIds = ['all'], options = {}) {
    // Normalize accountIds to ensure it's always an array
    const normalizedAccountIds = Array.isArray(accountIds) ? accountIds : ['all'];
    
    const { offset, limit } = options;
    let query = `
      SELECT t.*, 
             c.name as category_name, 
             a.name as account_name,
             ta.name as transfer_account_name,
           (SELECT COUNT(*) FROM transactions ${!normalizedAccountIds.includes('all') ? 'WHERE account_id IN (' + normalizedAccountIds.map(() => '?').join(',') + ')' : ''}) as total_count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN accounts ta ON (
        CASE 
          WHEN t.is_transfer AND t.type = 'expense' THEN (
            SELECT account_id FROM transactions WHERE id = t.transfer_pair_id
          )
          WHEN t.is_transfer AND t.type = 'income' THEN (
            SELECT account_id FROM transactions WHERE transfer_pair_id = t.id
          )
          ELSE NULL
        END
      ) = ta.id
  `;
  
  const params = [];
  
  if (!normalizedAccountIds.includes('all')) {
    const placeholders = normalizedAccountIds.map(() => '?').join(',');
    query += ` WHERE t.account_id IN (${placeholders})`;
    params.push(...normalizedAccountIds);
    
    if (normalizedAccountIds.length > 0) {
      params.push(...normalizedAccountIds); // Add again for the subquery COUNT
    }
  }
  
  query += ` ORDER BY t.date DESC`; // Add ORDER BY
  
  if (limit !== undefined) {
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset || 0);
  }
  
  return this.db.prepare(query).all(...params);
}

  addTransaction(transaction) {
    try {
        // Enhanced debug logging
        console.log('Adding transaction - Raw input:', transaction);
        console.log('Account ID type:', typeof transaction.account_id);
        console.log('Account ID value:', transaction.account_id);

        // Validate required fields
        if (!transaction.account_id && transaction.account_id !== 0) {
            throw new Error('account_id is required');
        }

        // Ensure account_id is an integer
        const accountId = typeof transaction.account_id === 'string' 
            ? parseInt(transaction.account_id, 10) 
            : transaction.account_id;

        console.log('Processed Account ID:', accountId);

        // Validate the account exists
        const accountExists = this.db.prepare('SELECT id FROM accounts WHERE id = ?').get(accountId);
        if (!accountExists) {
            throw new Error(`Account with ID ${accountId} does not exist`);
        }

        const stmt = this.db.prepare(`
            INSERT INTO transactions (
                account_id, category_id, type, amount, date, description, is_transfer, transfer_pair_id
            ) VALUES (?, ?, ?, ?, datetime(? || 'T00:00:00Z'), ?, ?, ?)
        `);
        
        const params = [
            accountId,
            transaction.category_id,
            transaction.type,
            transaction.amount,
            transaction.date,
            transaction.description,
            transaction.is_transfer || 0,
            transaction.transfer_pair_id || null
        ];

        console.log('SQL Parameters:', params);

        const result = stmt.run(...params);
        console.log('Insert result:', result);

        return { data: result.lastInsertRowid, error: null };
    } catch (error) {
        console.error('Database error:', error);
        return { error };
    }
}

  updateTransaction(id, updates) {
    try {
        // Build the update query dynamically based on provided fields
        const updateFields = [];
        const params = [];
        
        if (updates.account_id !== undefined) {
            updateFields.push('account_id = ?');
            params.push(updates.account_id);
        }
        if (updates.category_id !== undefined) {
            updateFields.push('category_id = ?');
            params.push(updates.category_id);
        }
        if (updates.type !== undefined) {
            updateFields.push('type = ?');
            params.push(updates.type);
        }
        if (updates.amount !== undefined) {
            updateFields.push('amount = ?');
            params.push(updates.amount);
        }
        if (updates.date !== undefined) {
            updateFields.push('date = datetime(? || \'T00:00:00Z\')');
            params.push(updates.date);
        }
        if (updates.description !== undefined) {
            updateFields.push('description = ?');
            params.push(updates.description);
        }
        if (updates.is_transfer !== undefined) {
            updateFields.push('is_transfer = ?');
            params.push(updates.is_transfer);
        }
        if (updates.transfer_pair_id !== undefined) {
            updateFields.push('transfer_pair_id = ?');
            params.push(updates.transfer_pair_id);
        }

        // Add the ID to params
        params.push(id);

        // Only proceed if there are fields to update
        if (updateFields.length === 0) {
            return { data: 0, error: 'No fields to update' };
        }

        const query = `
            UPDATE transactions 
            SET ${updateFields.join(', ')}
            WHERE id = ?
        `;

        const result = this.db.prepare(query).run(...params);
        return { data: result.changes, error: null };
    } catch (error) {
        console.error('Error updating transaction:', error);
        return { error: error.message };
    }
}

deleteTransaction(id) {
  try {
      const deleteTransactions = this.db.transaction((id) => {
          // Delete both the transaction and its pair (if it exists)
          this.db.prepare(`
              DELETE FROM transactions 
              WHERE id = ? 
              OR id IN (SELECT id FROM transactions WHERE transfer_pair_id = ?)
              OR transfer_pair_id = ?
          `).run(id, id, id);
      });

      deleteTransactions(id);
      return { success: true, error: null };
  } catch (error) {
      console.error('Error deleting transaction:', error);
      return { error: error.message };
  }
}

  updateTransferPairId(transactionId, pairId) {
    const stmt = this.db.prepare(`
      UPDATE transactions 
      SET transfer_pair_id = ? 
      WHERE id = ?
    `);
    return stmt.run(pairId, transactionId);
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
    
    const params = [];
    if (accountId && accountId !== 'all') {
      query += ' WHERE r.account_id = ?';
      params.push(accountId);
      
      if (limit !== undefined) {
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset || 0);
      }
    } else if (limit !== undefined) {
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset || 0);
    }
    
    return this.db.prepare(query).all(...params);
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
    
    const params = [];
    if (accountId && accountId !== 'all') {
      query += ' WHERE t.account_id = ?';
      params.push(accountId);
    }
    
    return this.db.prepare(query).all(...params);
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

  getTopSpendingCategories(accountId = 'all', period = 'month') {
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
          ${accountId !== 'all' ? 'AND t.account_id = ?' : ''}
        
        UNION ALL
        
        -- Recurring expenses/subscriptions
        SELECT 
          category_id,
          amount
        FROM recurring r
        WHERE r.type = 'expense'
          AND r.is_active = 1
          ${accountId !== 'all' ? 'AND r.account_id = ?' : ''}
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

    const params = accountId !== 'all' ? [accountId, accountId] : [];

    // console.log('Top spending categories query:', query);
    const result = this.db.prepare(query).all(...params);
    // console.log('Top spending categories result:', result);
    return result;
  }

  getExpenseCategoriesData(accountId = 'all', period = 'month') {
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
          ${accountId !== 'all' ? 'AND t.account_id = ?' : ''}
        
        UNION ALL
        
        -- Recurring expenses/subscriptions
        SELECT 
          category_id,
          amount
        FROM recurring r
        WHERE r.type = 'expense'
          AND r.is_active = 1
          ${accountId !== 'all' ? 'AND r.account_id = ?' : ''}
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

    const params = accountId !== 'all' ? [accountId, accountId] : [];

    const result = this.db.prepare(query).all(...params);
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

    if (currentVersion < 4) this.runMigrationV4();
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
    this.db.exec('DROP TABLE IF EXISTS transactions_new');
    
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

runMigrationV4() {
    console.log('Running migration V4: Updating transactions table schema');
    
    try {
        this.db.prepare('BEGIN TRANSACTION').run();

        // Drop the view first
        this.db.prepare('DROP VIEW IF EXISTS category_usage').run();

        this.db.exec('DROP TABLE IF EXISTS transactions_new');

        // Create new table with correct schema
        this.db.prepare(`
            CREATE TABLE transactions_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                category_id INTEGER,
                type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
                amount DECIMAL(10,2) NOT NULL,
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                description TEXT,
                is_transfer INTEGER DEFAULT 0,
                transfer_pair_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id),
                FOREIGN KEY (category_id) REFERENCES categories(id),
                FOREIGN KEY (transfer_pair_id) REFERENCES transactions(id)
            )
        `).run();

        // Copy existing data
        this.db.prepare(`
            INSERT INTO transactions_new 
            SELECT 
                id,
                account_id,
                category_id,
                type,
                amount,
                date,
                description,
                0 as is_transfer,
                NULL as transfer_pair_id,
                created_at
            FROM transactions
        `).run();

        // Drop old table
        this.db.prepare('DROP TABLE transactions').run();

        // Rename new table
        this.db.prepare('ALTER TABLE transactions_new RENAME TO transactions').run();

        // Recreate indexes
        this.db.prepare('CREATE INDEX idx_transactions_account_id ON transactions(account_id)').run();
        this.db.prepare('CREATE INDEX idx_transactions_category_id ON transactions(category_id)').run();
        this.db.prepare('CREATE INDEX idx_transactions_date ON transactions(date)').run();

        // Recreate the view
        this.db.prepare(`
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
            GROUP BY category_id
        `).run();

        // Update schema version
        this.db.prepare('INSERT INTO schema_versions (version) VALUES (4)').run();

        // Commit transaction
        this.db.prepare('COMMIT').run();
        console.log('Migration V4 complete');
    } catch (error) {
        // Rollback on error
        this.db.prepare('ROLLBACK').run();
        console.error('Migration failed:', error);
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
    // Handle 'all' period
    if (period === 'all') {
        const query = `
            WITH combined_expenses AS (
                SELECT 
                    t.category_id,
                    SUM(t.amount) as amount,
                    COUNT(*) as count,
                    MIN(date) as first_transaction,
                    MAX(date) as last_transaction
                FROM transactions t
                WHERE t.type = 'expense'
                GROUP BY t.category_id
            )
            SELECT 
                c.name as category_name,
                c.budget_amount,
                c.budget_frequency,
                CASE c.budget_frequency
                    WHEN 'yearly' THEN c.budget_amount
                    WHEN 'monthly' THEN c.budget_amount * 12
                    WHEN 'weekly' THEN c.budget_amount * 52
                    WHEN 'daily' THEN c.budget_amount * 365
                END as adjusted_budget,
                COALESCE(ce.amount, 0) as spent,
                COALESCE(ce.count, 0) as transaction_count
            FROM categories c
            LEFT JOIN combined_expenses ce ON c.id = ce.category_id
            WHERE c.budget_amount IS NOT NULL
                AND c.budget_frequency IS NOT NULL
                AND c.budget_amount > 0
            ORDER BY spent DESC`;

        return this.db.prepare(query).all();
    }

    // Regular period handling
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
        default:
            dateFilter = "strftime('%Y-%m', date) = strftime('%Y-%m', 'now')";
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
        ORDER BY spent DESC`;

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
  // Normalize accountId to handle both string and number inputs
  const normalizedAccountId = accountId === 'all' ? null : 
    (accountId ? parseInt(accountId, 10) : null);

  let query = `
    SELECT r.*, 
           c.name as category_name, 
           a.name as account_name
    FROM recurring r
    LEFT JOIN categories c ON r.category_id = c.id
    LEFT JOIN accounts a ON r.account_id = a.id
  `;
  
  if (normalizedAccountId) {
    query += ' WHERE r.account_id = ?';
    return this.db.prepare(query).all(normalizedAccountId);
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
        WITH RECURSIVE 
        date_range AS (
            -- Generate date series from earliest start date to latest end date
            SELECT MIN(COALESCE(t.date, r.start_date)) as date
            FROM transactions t
            LEFT JOIN project_transactions pt ON t.id = pt.transaction_id
            LEFT JOIN recurring r ON r.is_active = 1
            LEFT JOIN project_recurring pr ON r.id = pr.recurring_id
            
            UNION ALL
            
            SELECT date(date, '+1 day')
            FROM date_range
            WHERE date < (
                SELECT MAX(COALESCE(t.date, COALESCE(r.end_date, date('now'))))
                FROM transactions t
                LEFT JOIN project_transactions pt ON t.id = pt.transaction_id
                LEFT JOIN recurring r ON r.is_active = 1
                LEFT JOIN project_recurring pr ON r.id = pr.recurring_id
            )
        ),
        recurring_daily AS (
            -- Calculate daily amounts for recurring transactions
            SELECT 
                pr.project_id,
                r.type,
                CASE r.frequency
                    WHEN 'daily' THEN r.amount
                    WHEN 'weekly' THEN r.amount / 7.0
                    WHEN 'monthly' THEN r.amount / 30.0
                    WHEN 'yearly' THEN r.amount / 365.0
                END as daily_amount,
                r.start_date,
                COALESCE(r.end_date, date('now')) as end_date
            FROM recurring r
            JOIN project_recurring pr ON r.id = pr.recurring_id
            WHERE r.is_active = 1
        ),
        project_totals AS (
            -- Regular transactions
            SELECT 
                pt.project_id,
                t.type,
                t.amount,
                'transaction' as source
            FROM project_transactions pt
            JOIN transactions t ON pt.transaction_id = t.id
            
            UNION ALL
            
            -- Recurring transactions calculated daily
            SELECT 
                rd.project_id,
                rd.type,
                SUM(rd.daily_amount) as amount,
                'recurring' as source
            FROM recurring_daily rd
            JOIN date_range d ON d.date BETWEEN rd.start_date AND rd.end_date
            GROUP BY rd.project_id, rd.type
        )
        SELECT 
            p.*,
            (SELECT COUNT(*) FROM project_transactions WHERE project_id = p.id) as transaction_count,
            (SELECT COUNT(*) FROM project_recurring pr 
             JOIN recurring r ON pr.recurring_id = r.id 
             WHERE pr.project_id = p.id AND r.is_active = 1
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
        WITH RECURSIVE 
        date_range AS (
            -- Generate date series from earliest start date to latest end date
            SELECT MIN(COALESCE(t.date, r.start_date)) as date
            FROM transactions t
            LEFT JOIN project_transactions pt ON t.id = pt.transaction_id AND pt.project_id = ?
            LEFT JOIN recurring r ON r.is_active = 1
            LEFT JOIN project_recurring pr ON r.id = pr.recurring_id AND pr.project_id = ?
            
            UNION ALL
            
            SELECT date(date, '+1 day')
            FROM date_range
            WHERE date < (
                SELECT MAX(COALESCE(t.date, COALESCE(r.end_date, date('now'))))
                FROM transactions t
                LEFT JOIN project_transactions pt ON t.id = pt.transaction_id AND pt.project_id = ?
                LEFT JOIN recurring r ON r.is_active = 1
                LEFT JOIN project_recurring pr ON r.id = pr.recurring_id AND pr.project_id = ?
            )
        ),
        recurring_daily AS (
            -- Calculate daily amounts for recurring transactions
            SELECT 
                r.id,
                r.type,
                r.name,
                r.description,
                r.category_id,
                c.name as category_name,
                r.frequency,
                r.start_date,
                COALESCE(r.end_date, date('now')) as end_date,
                CASE r.frequency
                    WHEN 'daily' THEN r.amount
                    WHEN 'weekly' THEN r.amount / 7.0
                    WHEN 'monthly' THEN r.amount / 30.0
                    WHEN 'yearly' THEN r.amount / 365.0
                END as daily_amount,
                (
                    SELECT COUNT(*)
                    FROM date_range d
                    WHERE d.date <= date('now')
                    AND d.date BETWEEN r.start_date AND COALESCE(r.end_date, date('now'))
                    AND CASE r.frequency
                        WHEN 'daily' THEN 1
                        WHEN 'weekly' THEN strftime('%w', d.date) = strftime('%w', r.start_date)
                        WHEN 'monthly' THEN strftime('%d', d.date) = strftime('%d', r.start_date)
                        WHEN 'yearly' THEN strftime('%m-%d', d.date) = strftime('%m-%d', r.start_date)
                    END
                ) as occurrence_count,
                (
                    SELECT MAX(d.date)
                    FROM date_range d
                    WHERE d.date <= date('now')
                    AND d.date BETWEEN r.start_date AND COALESCE(r.end_date, date('now'))
                    AND CASE r.frequency
                        WHEN 'daily' THEN 1
                        WHEN 'weekly' THEN strftime('%w', d.date) = strftime('%w', r.start_date)
                        WHEN 'monthly' THEN strftime('%d', d.date) = strftime('%d', r.start_date)
                        WHEN 'yearly' THEN strftime('%m-%d', d.date) = strftime('%m-%d', r.start_date)
                    END
                ) as last_occurrence,
                (
                    SELECT MIN(d.date)
                    FROM date_range d
                    WHERE d.date > date('now')
                    AND d.date BETWEEN r.start_date AND COALESCE(r.end_date, date('now'))
                    AND CASE r.frequency
                        WHEN 'daily' THEN 1
                        WHEN 'weekly' THEN strftime('%w', d.date) = strftime('%w', r.start_date)
                        WHEN 'monthly' THEN strftime('%d', d.date) = strftime('%d', r.start_date)
                        WHEN 'yearly' THEN strftime('%m-%d', d.date) = strftime('%m-%d', r.start_date)
                    END
                ) as next_occurrence
            FROM recurring r
            JOIN project_recurring pr ON r.id = pr.recurring_id
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE r.is_active = 1 AND pr.project_id = ?
        ),
        project_totals AS (
            -- Regular transactions
            SELECT 
                t.id,
                t.type,
                t.amount,
                t.date,
                t.description,
                t.category_id,
                c.name as category_name,
                NULL as frequency,
                NULL as occurrence_count,
                NULL as last_occurrence,
                NULL as next_occurrence,
                'transaction' as source
            FROM transactions t
            JOIN project_transactions pt ON t.id = pt.transaction_id
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE pt.project_id = ?
            
            UNION ALL
            
            -- Recurring transactions part
            SELECT 
                rd.id,
                rd.type,
                SUM(rd.daily_amount) as amount,
                rd.start_date as date,
                rd.name as description,
                rd.category_id,
                rd.category_name,
                rd.frequency,
                rd.occurrence_count,
                rd.last_occurrence,
                rd.next_occurrence,
                'recurring' as source
            FROM recurring_daily rd
            JOIN date_range d ON d.date BETWEEN rd.start_date AND rd.end_date
            GROUP BY rd.id
        )
        SELECT 
            p.*,
            json_group_array(
                CASE WHEN t.id IS NOT NULL AND t.source = 'transaction' THEN
                    json_object(
                        'id', t.id,
                        'type', t.type,
                        'amount', t.amount,
                        'date', t.date,
                        'description', t.description,
                        'category_id', t.category_id,
                        'category_name', t.category_name,
                        'source', t.source
                    )
                ELSE NULL END
            ) FILTER (WHERE t.id IS NOT NULL AND t.source = 'transaction') as transactions,
            json_group_array(
                CASE WHEN t.id IS NOT NULL AND t.source = 'recurring' THEN
                    json_object(
                        'id', t.id,
                        'type', t.type,
                        'amount', t.amount,
                        'date', t.date,
                        'description', t.description,
                        'category_id', t.category_id,
                        'category_name', t.category_name,
                        'frequency', t.frequency,
                        'occurrence_count', t.occurrence_count,
                        'last_occurrence', t.last_occurrence,
                        'next_occurrence', t.next_occurrence,
                        'source', t.source
                    )
                ELSE NULL END
            ) FILTER (WHERE t.id IS NOT NULL AND t.source = 'recurring') as recurring,
            (SELECT COUNT(*) FROM project_transactions WHERE project_id = p.id) as transaction_count,
            (SELECT COUNT(*) FROM project_recurring pr 
             JOIN recurring r ON pr.recurring_id = r.id 
             WHERE pr.project_id = p.id AND r.is_active = 1
            ) as recurring_count,
            COALESCE(SUM(CASE 
                WHEN t.type = 'expense' THEN t.amount
                ELSE 0 
            END), 0) as total_spent,
            COALESCE(SUM(CASE 
                WHEN t.type = 'income' THEN t.amount
                ELSE 0 
            END), 0) as total_income
        FROM projects p
        LEFT JOIN project_totals t ON 1=1
        WHERE p.id = ?
        GROUP BY p.id
    `;

    const result = this.db.prepare(query).get(id, id, id, id, id, id, id);
    
    // Parse both JSON strings into arrays
    if (result) {
        try {
            result.transactions = JSON.parse(result.transactions || '[]')
                .filter(t => t !== null);
            result.recurring = JSON.parse(result.recurring || '[]')
                .filter(r => r !== null);
        } catch (e) {
            console.error('Error parsing JSON:', e);
            result.transactions = [];
            result.recurring = [];
        }
    }
    
    return result;
}

removeTransactionFromProject(transactionId, projectId) {
  try {
      this.db.prepare(`
          DELETE FROM project_transactions 
          WHERE transaction_id = ? AND project_id = ?
      `).run(transactionId, projectId);
      
      return { success: true };
  } catch (error) {
      console.error('Database error:', error);
      return { error };
  }
}

removeRecurringFromProject(recurringId, projectId) {
  try {
      this.db.prepare(`
          DELETE FROM project_recurring 
          WHERE recurring_id = ? AND project_id = ?
      `).run(recurringId, projectId);
      
      return { success: true };
  } catch (error) {
      console.error('Database error:', error);
      return { error };
  }
}

addTransactionProjects(transactionId, projectIds) {
    if (!transactionId || !Array.isArray(projectIds)) {
        throw new Error('Invalid parameters for addTransactionProjects');
    }

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
  this.db.prepare('DELETE FROM project_transactions WHERE transaction_id = ?').run(transactionId);

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

getNetWorth(accountId = 'all') {
  let query = `
    SELECT SUM(balance) as net_worth
    FROM accounts
    ${accountId !== 'all' ? 'WHERE id = ?' : ''}
  `;
  const params = accountId !== 'all' ? [accountId] : [];
  const result = this.db.prepare(query).get(...params);
  return result;
}

getMonthlyComparison(accountId = 'all') {
    // console.log('DATABASE SERVICE: Monthly comparison called');
    
    // First get transactions for current and previous month
    const query = `
        WITH monthly_transactions AS (
            SELECT 
                strftime('%Y-%m', date) as month,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense_amount
            FROM transactions
            WHERE strftime('%Y-%m', date) IN (
                strftime('%Y-%m', 'now'),
                strftime('%Y-%m', 'now', '-1 month')
            )
            ${accountId !== 'all' ? 'AND account_id = ?' : ''}
            GROUP BY strftime('%Y-%m', date)
        )
        SELECT 
            month,
            COALESCE(expense_amount, 0) as expense_amount
        FROM monthly_transactions
        ORDER BY month DESC
    `;

    const params = accountId !== 'all' ? [accountId] : [];
    const transactionResults = this.db.prepare(query).all(...params);
    
    // After getting transaction results
    // console.log('Transaction Results:', transactionResults);
    
    // Get recurring items
    const recurringQuery = `
        SELECT *
        FROM recurring
        WHERE type = 'expense'
        ${accountId !== 'all' ? 'AND account_id = ?' : ''}
    `;
    const recurring = this.db.prepare(recurringQuery).all(...params);
    
    // After getting recurring items
    // console.log('Recurring Items:', recurring);
    
    // Calculate dates for current and previous month
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthYear = lastMonth.getFullYear();
    const lastMonthNum = lastMonth.getMonth();
    
    // After calculating dates
    // console.log('Current Month/Year:', currentMonth, currentYear);
    // console.log('Last Month/Year:', lastMonthNum, lastMonthYear);
    
    // Calculate recurring amounts for both months
    const currentMonthRecurring = recurring
        .filter(r => r.is_active)
        .reduce((sum, r) => {
            const startDate = new Date(r.start_date);
            startDate.setUTCHours(0, 0, 0, 0);
            
            const currentMonthStart = new Date(currentYear, currentMonth, 1);
            currentMonthStart.setUTCHours(0, 0, 0, 0);
            
            if (startDate > now || (r.end_date && new Date(r.end_date) < currentMonthStart)) {
                return sum;
            }

            let occurrences = 0;
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
            const currentDate = now.getDate();

            switch(r.frequency) {
                case 'daily':
                    occurrences = Math.min(currentDate, daysInMonth);
                    if (startDate > currentMonthStart) {
                        const daysFromStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24)) + 1;
                        occurrences = Math.min(occurrences, daysFromStart);
                    }
                    break;
                case 'weekly':
                    const firstOccurrence = startDate > currentMonthStart ? startDate : currentMonthStart;
                    const weeksFromStart = Math.floor((now - firstOccurrence) / (1000 * 60 * 60 * 24 * 7));
                    occurrences = weeksFromStart + (now.getDay() >= startDate.getDay() ? 1 : 0);
                    break;
                case 'monthly':
                    if (currentDate >= startDate.getDate() || 
                        (startDate.getDate() > daysInMonth && currentDate === daysInMonth)) {
                        occurrences = 1;
                    }
                    break;
                case 'yearly':
                    if (currentMonth === startDate.getMonth() && 
                        (currentDate >= startDate.getDate() || 
                         (startDate.getDate() > daysInMonth && currentDate === daysInMonth))) {
                        occurrences = 1;
                    }
                    break;
            }

            return sum + (parseFloat(r.amount) * Math.max(0, occurrences));
        }, 0);
    
    // After calculating current month recurring
    // console.log('Current Month Recurring:', currentMonthRecurring);
    
    const lastMonthRecurring = recurring
        .filter(r => r.is_active)
        .reduce((sum, r) => {
            const startDate = new Date(r.start_date);
            startDate.setUTCHours(0, 0, 0, 0);
            
            const lastMonthStart = new Date(lastMonthYear, lastMonthNum, 1);
            lastMonthStart.setUTCHours(0, 0, 0, 0);
            
            const lastMonthEnd = new Date(lastMonthYear, lastMonthNum + 1, 0);
            lastMonthEnd.setUTCHours(23, 59, 59, 999);
            
            if (startDate > lastMonthEnd || (r.end_date && new Date(r.end_date) < lastMonthStart)) {
                return sum;
            }

            let occurrences = 0;
            const daysInLastMonth = new Date(lastMonthYear, lastMonthNum + 1, 0).getDate();

            switch(r.frequency) {
                case 'daily':
                    if (startDate <= lastMonthStart) {
                        occurrences = daysInLastMonth;
                    } else {
                        occurrences = Math.floor((lastMonthEnd - startDate) / (1000 * 60 * 60 * 24)) + 1;
                    }
                    break;
                case 'weekly':
                    const firstOccurrence = startDate > lastMonthStart ? startDate : lastMonthStart;
                    const weeksInMonth = Math.ceil((lastMonthEnd - firstOccurrence) / (1000 * 60 * 60 * 24 * 7));
                    occurrences = weeksInMonth;
                    break;
                case 'monthly':
                    if (startDate <= lastMonthEnd) {
                        occurrences = 1;
                    }
                    break;
                case 'yearly':
                    if (lastMonthNum === startDate.getMonth() && startDate <= lastMonthEnd) {
                        occurrences = 1;
                    }
                    break;
            }

            return sum + (parseFloat(r.amount) * Math.max(0, occurrences));
        }, 0);
    
    // After calculating last month recurring
    // console.log('Last Month Recurring:', lastMonthRecurring);
    
    // Get transaction amounts
    const currentMonthTx = transactionResults.find(r => 
        r.month === now.toISOString().substring(0, 7))?.expense_amount || 0;
    const lastMonthTx = transactionResults.find(r => 
        r.month === lastMonth.toISOString().substring(0, 7))?.expense_amount || 0;
    
    // After getting transaction amounts
    // console.log('Current Month Tx:', currentMonthTx);
    // console.log('Last Month Tx:', lastMonthTx);
    
    // Calculate totals
    const thisMonthTotal = currentMonthTx + currentMonthRecurring;
    const lastMonthTotal = lastMonthTx + lastMonthRecurring;
    
    // Final totals
    // console.log('This Month Total:', thisMonthTotal);
    // console.log('Last Month Total:', lastMonthTotal);
    
    // Calculate percentage change
    const percentChange = lastMonthTotal ? 
        ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
    
    // console.log('Percent Change:', percentChange);

    return {
        percentChange,
        trend: percentChange >= 0 ? 'higher' : 'lower',
        this_month_amount: thisMonthTotal,
        last_month_amount: lastMonthTotal
    };
}

getUpcomingPayments(accountId = 'all') {
  let query = `
    SELECT COUNT(*) as upcomingCount
    FROM recurring r
    WHERE r.is_active = 1
      AND r.type = 'expense'
      AND (
        -- Check if start_date is within the next 5 days
        (
          date(r.start_date) >= date('now', 'localtime')
          AND date(r.start_date) <= date('now', 'localtime', '+4 days')
        )
        OR
        -- For existing recurring items, check their next occurrence
        (
          date(r.start_date) <= date('now', 'localtime')
          AND (r.end_date IS NULL OR date(r.end_date) >= date('now', 'localtime'))
          AND (
            CASE r.frequency
              WHEN 'daily' THEN 1
              WHEN 'weekly' THEN (
                strftime('%w', r.start_date) = strftime('%w', date('now', 'localtime', '+0 days'))
                OR strftime('%w', r.start_date) = strftime('%w', date('now', 'localtime', '+1 days'))
                OR strftime('%w', r.start_date) = strftime('%w', date('now', 'localtime', '+2 days'))
                OR strftime('%w', r.start_date) = strftime('%w', date('now', 'localtime', '+3 days'))
                OR strftime('%w', r.start_date) = strftime('%w', date('now', 'localtime', '+4 days'))
              )
              WHEN 'monthly' THEN (
                strftime('%d', r.start_date) = strftime('%d', date('now', 'localtime', '+0 days'))
                OR strftime('%d', r.start_date) = strftime('%d', date('now', 'localtime', '+1 days'))
                OR strftime('%d', r.start_date) = strftime('%d', date('now', 'localtime', '+2 days'))
                OR strftime('%d', r.start_date) = strftime('%d', date('now', 'localtime', '+3 days'))
                OR strftime('%d', r.start_date) = strftime('%d', date('now', 'localtime', '+4 days'))
              )
              WHEN 'yearly' THEN (
                strftime('%m-%d', r.start_date) = strftime('%m-%d', date('now', 'localtime', '+0 days'))
                OR strftime('%m-%d', r.start_date) = strftime('%m-%d', date('now', 'localtime', '+1 days'))
                OR strftime('%m-%d', r.start_date) = strftime('%m-%d', date('now', 'localtime', '+2 days'))
                OR strftime('%m-%d', r.start_date) = strftime('%m-%d', date('now', 'localtime', '+3 days'))
                OR strftime('%m-%d', r.start_date) = strftime('%m-%d', date('now', 'localtime', '+4 days'))
              )
            END
          )
        )
      )
      ${accountId !== 'all' ? 'AND r.account_id = ?' : ''}
  `;
  
  const params = accountId !== 'all' ? [accountId] : [];
  const result = this.db.prepare(query).get(...params);
  return { data: result.upcomingCount, error: null };
}
}

module.exports = DatabaseService;
