import { handleTransactionFiltersChange } from '../components/transactions.js';
import { handleRecurringFiltersChange } from '../components/recurring.js';
import { handleCategoriesFilterChange } from '../components/categories.js';
import { debounce } from './debounce.js';

export function reinitializeInputs(container = document) {
    // Store references to all inputs before cloning
    const amountInputs = Array.from(container.querySelectorAll('input[type="text"][class*="amount"]'));
    const searchInputs = Array.from(container.querySelectorAll('.search-input'));
    
    // Process amount inputs
    amountInputs.forEach(input => {
        const value = input.value; // Store current value
        const newInput = input.cloneNode(true);
        newInput.value = value; // Restore value
        input.parentNode.replaceChild(newInput, input);
        initializeAmountInput(newInput);
    });

    // Process search inputs
    searchInputs.forEach(input => {
        const value = input.value; // Store current value
        const newInput = input.cloneNode(true);
        newInput.value = value; // Restore value
        input.parentNode.replaceChild(newInput, input);
        
        newInput.addEventListener('input', debounce(async (e) => {
            // Look for closest div with an ID instead of section
            const container = newInput.closest('div[id]');
            if (!container) return;
            
            const containerId = container.id;
            if (!containerId) return;

            const filters = {
                type: document.getElementById(`${containerId.toLowerCase()}-type-filter`)?.value || 'all',
                category: document.getElementById(`${containerId.toLowerCase()}-category-filter`)?.value || 'all',
                sort: document.getElementById(`${containerId.toLowerCase()}-sort`)?.value || 'date-desc',
                search: e.target.value
            };
            
            // Handle different sections
            switch(containerId) {
                case 'Transactions':
                    await handleTransactionFiltersChange();
                    break;
                case 'Recurring':
                    await handleRecurringFiltersChange();
                    break;
                case 'Categories':
                    await handleCategoriesFilterChange();
                    break;
            }
        }, 300));
    });
}

// Call this after form submissions and modal closes
export function resetFormAndInputs(formElement) {
    formElement.reset();
    reinitializeInputs();
}