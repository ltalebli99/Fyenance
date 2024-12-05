const path = require('path');
const os = require('os');
const DatabaseService = require('../src/services/database');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Helper function to normalize transaction type
function normalizeTransactionType(type) {
  type = String(type).toLowerCase();
  return type === 'income' ? 'income' : 'expense';
}

async function runMigration() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing Supabase credentials in environment variables');
    process.exit(1);
  }

  // Ensure app data directory exists
  const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Fyenance');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  // Initialize database
  const database = DatabaseService.initialize(userDataPath);

  console.log('Starting migration from Supabase to SQLite...');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Create mappings for IDs
    const categoryMapping = new Map();
    const accountMapping = new Map();

    // Migrate Categories
    console.log('Migrating categories...');
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*');
    
    if (categoriesError) throw categoriesError;
    
    for (const category of categories) {
      try {
        const result = database.addCategory({
          name: String(category.name),
          type: normalizeTransactionType(category.type)
        });
        categoryMapping.set(category.id, result.lastInsertRowid);
        console.log(`Migrated category: ${category.name}`);
      } catch (err) {
        console.error(`Failed to migrate category ${category.name}:`, err);
      }
    }

    // Migrate Accounts
    console.log('Migrating accounts...');
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*');
    
    if (accountsError) throw accountsError;
    
    let defaultAccountId = null;
    for (const account of accounts) {
      try {
        const result = database.addAccount({
          name: String(account.name),
          balance: Number(account.balance)
        });
        accountMapping.set(account.id, result.lastInsertRowid);
        if (!defaultAccountId) {
          defaultAccountId = result.lastInsertRowid;
        }
        console.log(`Migrated account: ${account.name}`);
      } catch (err) {
        console.error(`Failed to migrate account ${account.name}:`, err);
      }
    }

    if (!defaultAccountId) {
      console.log('Creating default account...');
      const result = database.addAccount({
        name: 'Default Account',
        balance: 0
      });
      defaultAccountId = result.lastInsertRowid;
    }

    // Migrate Transactions
    console.log('Migrating transactions...');
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*');
    
    if (transactionsError) throw transactionsError;
    
    for (const transaction of transactions) {
      try {
        const newAccountId = accountMapping.get(transaction.account_id) || defaultAccountId;
        const newCategoryId = categoryMapping.get(transaction.category_id);
        
        database.addTransaction({
          account_id: newAccountId,
          category_id: newCategoryId || null,
          type: normalizeTransactionType(transaction.type),
          amount: Number(transaction.amount),
          date: String(transaction.date),
          description: transaction.description ? String(transaction.description) : null
        });
        console.log(`Migrated transaction ID: ${transaction.id}`);
      } catch (err) {
        console.error(`Failed to migrate transaction ${transaction.id}:`, err);
      }
    }

    // Migrate Recurring
    console.log('Migrating recurring transactions...');
    const { data: recurring, error: recurringError } = await supabase
      .from('recurring')
      .select('*');
    
    if (recurringError) throw recurringError;
    
    for (const item of recurring) {
      try {
        const newAccountId = accountMapping.get(item.account_id) || defaultAccountId;
        const newCategoryId = categoryMapping.get(item.category_id);
        
        database.addRecurring({
          account_id: newAccountId,
          category_id: newCategoryId || null,
          name: String(item.name),
          amount: Number(item.amount),
          type: normalizeTransactionType(item.type),
          billing_date: Number(item.billing_date),
          description: item.description ? String(item.description) : null,
          is_active: item.is_active ? 1 : 0
        });
        console.log(`Migrated recurring item: ${item.name}`);
      } catch (err) {
        console.error(`Failed to migrate recurring item ${item.name}:`, err);
      }
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration().catch(console.error);