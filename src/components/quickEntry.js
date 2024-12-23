import { TransactionParser } from '../utils/transactionParser.js';
import { refreshData } from '../utils/refresh.js';
import { showError } from '../utils/utils.js';
import { getAmountValue } from '../utils/formatters.js';

// Quick Entry Handler
export function initializeQuickEntry() {
    const quickEntryInput = document.getElementById('quick-entry-input');
    
    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'quick-entry-tooltip';
    tooltip.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <div class="tooltip-content">
            <h4>Quick Entry Format:</h4>
            <p>amount description [account] [category] [date]</p>
            
            <h5>Smart Features:</h5>
            <ul>
                <li>Basic Math: 
                    <ul>
                        <li>12.99 + 4.50 groceries</li>
                        <li>3 * 5.99 coffee</li>
                        <li>100 - 15.50 shopping</li>
                    </ul>
                </li>
                <li>Smart Categorization:
                    <ul>
                        <li>Intelligently matches categories</li>
                        <li>Analyzes transaction descriptions</li>
                        <li>Uses pattern recognition</li>
                    </ul>
                </li>
                <li>Account Detection:
                    <ul>
                        <li>25.99 groceries chase</li>
                        <li>1000 salary wells fargo</li>
                        <li>50 gas amex</li>
                    </ul>
                </li>
                <li>Date Detection:
                    <ul>
                        <li>12.49 sunglasses January 5</li>
                        <li>1000 salary Jan 5th</li>
                        <li>50 gas 1/5/24</li>
                    </ul>
                </li>
            </ul>

            <p class="tooltip-note">💡 Tip: Use natural language to describe your transactions - our smart algorithm will handle the rest!</p>
        </div>
    `;
    
    // Insert tooltip after input
    quickEntryInput.parentNode.insertBefore(tooltip, quickEntryInput.nextSibling);
    
    quickEntryInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            try {
                // Get all accounts first
                const { data: accounts } = await window.databaseApi.fetchAccounts();
                if (!accounts || accounts.length === 0) {
                    showError('Please add an account first');
                    return;
                }

                // Parse the input
                const parsed = await TransactionParser.parse(e.target.value);
                if (!parsed) {
                    showError('Invalid format. Please use "amount description"');
                    return;
                }

                // Try to find account in the description
                let accountId = null;
                const description = parsed.description;
                const wordsLower = description.toLowerCase().split(' ');
                const words = description.split(' ');
                
                // Find any account name matches
                for (const account of accounts) {
                    const accountName = account.name.toLowerCase();
                    if (wordsLower.some(word => accountName.includes(word) || word.includes(accountName))) {
                        accountId = account.id;
                        // Remove account name from description but preserve case of remaining words
                        const filteredWords = words.filter((word, index) => 
                            !accountName.includes(wordsLower[index]) && 
                            !wordsLower[index].includes(accountName)
                        );
                        parsed.description = filteredWords.join(' ');
                        break;
                    }
                }

                // If no account found, use most recently used account
                if (!accountId) {
                    const sortedAccounts = accounts.sort((a, b) => {
                        const aDate = a.last_used ? new Date(a.last_used) : new Date(0);
                        const bDate = b.last_used ? new Date(b.last_used) : new Date(0);
                        return bDate - aDate;
                    });
                    accountId = sortedAccounts[0].id;
                }

                // If we have a category_id, use its type, otherwise use the parsed type
                let transactionType = parsed.type;
                if (parsed.category_id) {
                    const { data: categories } = await window.databaseApi.fetchCategories();
                    const matchedCategory = categories.find(c => c.id === parsed.category_id);
                    if (matchedCategory) {
                        transactionType = matchedCategory.type;
                    }
                }

                // Create transaction with the parsed data
                const transaction = {
                    account_id: accountId,
                    category_id: parsed.category_id,
                    type: transactionType,
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