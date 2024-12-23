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
            const filters = {
                type: document.getElementById(`${newInput.closest('section').id.toLowerCase()}-type-filter`)?.value || 'all',
                category: document.getElementById(`${newInput.closest('section').id.toLowerCase()}-category-filter`)?.value || 'all',
                sort: document.getElementById(`${newInput.closest('section').id.toLowerCase()}-sort`)?.value || 'date-desc',
                search: e.target.value
            };
            
            if (newInput.closest('#Transactions')) {
                await handleTransactionFiltersChange();
            } else if (newInput.closest('#Recurring')) {
                await handleRecurringFiltersChange();
            } else if (newInput.closest('#Categories')) {
                await fetchCategories(filters);
            }
        }, 300));
    });
}

// Call this after form submissions and modal closes
export function resetFormAndInputs(formElement) {
    formElement.reset();
    reinitializeInputs();
}