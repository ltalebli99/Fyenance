const { migrateFromSupabase } = require('./migration');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function runMigration() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('Missing Supabase credentials in environment variables');
    process.exit(1);
  }

  console.log('Starting migration from Supabase to SQLite...');
  
  const { success, error } = await migrateFromSupabase(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  if (success) {
    console.log('Migration completed successfully!');
    process.exit(0);
  } else {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();