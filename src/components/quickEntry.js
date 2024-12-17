import { TransactionParser } from '../utils/transactionParser.js';
import { refreshData } from '../utils/refresh.js';
import { showError } from '../utils/utils.js';


// Quick Entry Handler
export function initializeQuickEntry() {
    const quickEntryInput = document.getElementById('quick-entry-input');
    
    quickEntryInput.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        try {
          // Wait for the parser to complete
          const parsed = await TransactionParser.parse(e.target.value);
          
          if (!parsed) {
            showError('Invalid format. Please use "amount description"');
            return;
          }
          
          // Get the first available account
          const { data: accounts } = await window.databaseApi.fetchAccounts();
          if (!accounts || accounts.length === 0) {
            showError('Please add an account first');
            return;
          }
          
          // Create transaction with the parsed data
          const transaction = {
            account_id: accounts[0].id,
            category_id: parsed.category_id, // Use the category_id from parser
            type: parsed.type,
            amount: parsed.amount,
            date: parsed.date,
            description: parsed.description
          };
          
          const { error } = await window.databaseApi.addTransaction(transaction);
          
          if (error) {
            showError('Failed to add transaction');
            return;
          }
          
          // Clear input and refresh
          e.target.value = '';
          await refreshData({
            all: true 
          });
        } catch (error) {
          console.error('Quick entry error:', error);
          showError('Failed to process quick entry');
        }
      }
    });
}