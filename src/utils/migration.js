const DatabaseService = require('../services/database');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const os = require('os');

async function migrateFromSupabase(supabaseUrl, supabaseKey) {
  try {
    const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Fyenance');
    const database = DatabaseService.initialize(userDataPath);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Create a mapping of Supabase category IDs to new SQLite category IDs
    const categoryMapping = new Map();
    
    // Migrate Categories first and build the mapping
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('*');
    
    if (categoriesError) throw categoriesError;
    
    for (const category of categories) {
      try {
        const result = database.addCategory({
          name: category.name,
          type: category.type
        });
        // Store the mapping of Supabase ID to new SQLite ID
        categoryMapping.set(category.id, result.lastInsertRowid);
      } catch (err) {
        console.error(`Failed to migrate category ${category.name}:`, err);
      }
    }

    // Migrate Accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*');
    
    if (accountsError) throw accountsError;
    
    const accountMapping = new Map();
    
    for (const account of accounts) {
      try {
        const result = database.addAccount({
          name: account.name,
          balance: account.balance
        });
        accountMapping.set(account.id, result.lastInsertRowid);
      } catch (err) {
        console.error(`Failed to migrate account ${account.name}:`, err);
      }
    }

    // Migrate Transactions with mapped category IDs
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*');
    
    if (transactionsError) throw transactionsError;
    
    for (const transaction of transactions) {
      try {
        const newCategoryId = categoryMapping.get(transaction.category_id);
        const newAccountId = accountMapping.get(transaction.account_id);
        
        database.addTransaction({
          account_id: newAccountId,
          category_id: newCategoryId,
          type: transaction.type,
          amount: transaction.amount,
          date: transaction.date,
          description: transaction.description
        });
      } catch (err) {
        console.error(`Failed to migrate transaction ${transaction.id}:`, err);
      }
    }

    // Migrate Recurring with mapped category IDs
    const { data: recurring, error: recurringError } = await supabase
      .from('recurring')
      .select('*');
    
    if (recurringError) throw recurringError;
    
    for (const item of recurring) {
      try {
        const newCategoryId = categoryMapping.get(item.category_id);
        const newAccountId = accountMapping.get(item.account_id);
        
        database.addRecurring({
          account_id: newAccountId,
          category_id: newCategoryId,
          name: item.name,
          amount: item.amount,
          type: item.type,
          billing_date: item.billing_date,
          description: item.description,
          is_active: item.is_active
        });
      } catch (err) {
        console.error(`Failed to migrate recurring item ${item.name}:`, err);
      }
    }

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports = { migrateFromSupabase };