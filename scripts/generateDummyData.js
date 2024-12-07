const path = require('path');
const os = require('os');
const fs = require('fs');

// Adjust the require path to point to the correct location
const DatabaseService = require(path.join(__dirname, '..', 'src', 'services', 'database'));

async function generateDummyData() {
  // Use the actual app data path that your application uses
  const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Fyenance');
  
  // Ensure the directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  // Initialize database
  console.log('Initializing database...');
  const database = DatabaseService.initialize(userDataPath);

  try {
    const accounts = [
      { name: 'Main Checking', balance: 5420.50 },
      { name: 'Savings', balance: 12750.75 },
      { name: 'Credit Card', balance: -1250.30 },
      { name: 'Investment Account', balance: 8500.00 }
    ];

    const categories = [
      // Income categories
      { name: 'Salary', type: 'income' },
      { name: 'Freelance Work', type: 'income' },
      { name: 'Investments', type: 'income' },
      { name: 'Side Projects', type: 'income' },
      // Expense categories
      { name: 'Rent', type: 'expense' },
      { name: 'Groceries', type: 'expense' },
      { name: 'Utilities', type: 'expense' },
      { name: 'Entertainment', type: 'expense' },
      { name: 'Dining Out', type: 'expense' },
      { name: 'Transportation', type: 'expense' },
      { name: 'Shopping', type: 'expense' },
      { name: 'Healthcare', type: 'expense' },
      { name: 'Travel', type: 'expense' },
      { name: 'Education', type: 'expense' }
    ];

    const recurring = [
      { name: 'Netflix', amount: 15.99, type: 'expense', billing_date: 15, description: 'Streaming subscription' },
      { name: 'Rent', amount: 1200.00, type: 'expense', billing_date: 1, description: 'Monthly rent' },
      { name: 'Gym', amount: 49.99, type: 'expense', billing_date: 5, description: 'Fitness membership' },
      { name: 'Salary', amount: 4500.00, type: 'income', billing_date: 25, description: 'Monthly salary' },
      { name: 'Internet', amount: 79.99, type: 'expense', billing_date: 10, description: 'Internet service' },
      { name: 'Phone', amount: 65.00, type: 'expense', billing_date: 18, description: 'Mobile phone plan' }
    ];

    // Clear existing data
    console.log('Clearing existing data...');
    await database.deleteDatabase();

    console.log('Adding accounts...');
    for (const account of accounts) {
      try {
        database.addAccount(account);
        console.log(`Added account: ${account.name}`);
      } catch (err) {
        console.error(`Failed to add account ${account.name}:`, err);
      }
    }

    const dbAccounts = database.getAccounts();

    console.log('Adding categories...');
    for (const category of categories) {
      try {
        database.addCategory(category);
        console.log(`Added category: ${category.name}`);
      } catch (err) {
        console.error(`Failed to add category ${category.name}:`, err);
      }
    }

    const dbCategories = database.getCategories();

    console.log('Adding recurring transactions...');
    for (const rec of recurring) {
      try {
        const randomAccount = dbAccounts[Math.floor(Math.random() * dbAccounts.length)];
        const matchingCategories = dbCategories.filter(c => c.type === rec.type);
        const randomCategory = matchingCategories[Math.floor(Math.random() * matchingCategories.length)];
        
        database.addRecurring({
          ...rec,
          account_id: randomAccount.id,
          category_id: randomCategory.id,
          is_active: 1
        });
        console.log(`Added recurring transaction: ${rec.name}`);
      } catch (err) {
        console.error(`Failed to add recurring transaction ${rec.name}:`, err);
      }
    }

    console.log('Generating transaction history...');
    // Generate 6 months of transaction history
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);

    const descriptions = {
      income: [
        'Client payment',
        'Consulting fee',
        'Freelance project',
        'Contract work',
        'Investment returns'
      ],
      expense: [
        'Office supplies',
        'Team lunch',
        'Software subscription',
        'Transportation',
        'Equipment purchase',
        'Coffee shop',
        'Restaurant',
        'Grocery store',
        'Gas station',
        'Online shopping'
      ]
    };

    for (let d = new Date(startDate); d <= new Date(); d.setDate(d.getDate() + 1)) {
      // Generate 0-5 transactions per day
      const numTransactions = Math.floor(Math.random() * 6);
      
      for (let i = 0; i < numTransactions; i++) {
        try {
          const type = Math.random() > 0.7 ? 'income' : 'expense';
          const matchingCategories = dbCategories.filter(c => c.type === type);
          const randomCategory = matchingCategories[Math.floor(Math.random() * matchingCategories.length)];
          const randomAccount = dbAccounts[Math.floor(Math.random() * dbAccounts.length)];
          
          const amount = type === 'income' 
            ? Math.random() * 1000 + 100 // Income: $100-$1100
            : Math.random() * 200 + 5;   // Expense: $5-$205

          const descriptions_list = descriptions[type];
          const randomDescription = descriptions_list[Math.floor(Math.random() * descriptions_list.length)];

          database.addTransaction({
            account_id: randomAccount.id,
            category_id: randomCategory.id,
            type: type,
            amount: parseFloat(amount.toFixed(2)),
            date: d.toISOString().split('T')[0],
            description: randomDescription
          });
        } catch (err) {
          console.error(`Failed to add transaction for date ${d.toISOString().split('T')[0]}:`, err);
        }
      }
    }

    console.log('Dummy data generation completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to generate dummy data:', error);
    process.exit(1);
  }
}

// Run the script
generateDummyData().catch(console.error);