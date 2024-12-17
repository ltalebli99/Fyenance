import { formatCurrency, capitalizeFirstLetter } from '../utils/formatters.js';
import { openModal, closeModal } from '../utils/utils.js';
import { refreshData } from '../utils/refresh.js';

export async function populateBulkEntryDropdowns() {
    const { data: categories } = await window.databaseApi.fetchCategories();
    // Populate bulk entry dropdown
    const bulkEntryCategories = document.querySelectorAll('.category-select');
    bulkEntryCategories.forEach(dropdown => {
      dropdown.innerHTML = `
        <option value="">Select Category</option>
        ${categories.map(category => 
          `<option value="${category.id}">${capitalizeFirstLetter(category.name)}</option>`
        ).join('')}
      `;
    });
  }


  // Bulk Entry Handler
export function initializeBulkEntry() {
    const showBulkEntryBtn = document.getElementById('show-bulk-entry');
    const bulkEntryModal = document.getElementById('bulk-entry-modal');
    const closeBulkEntry = document.getElementById('close-bulk-entry');
    const addRowBtn = document.getElementById('bulk-entry-add-row');
    const submitBtn = document.getElementById('bulk-entry-submit');
    const tbody = document.getElementById('bulk-entry-tbody');
    
    showBulkEntryBtn.addEventListener('click', () => {
      openModal('bulk-entry-modal');
      addBulkEntryRow(); // Add first row automatically
    });
    
    closeBulkEntry.addEventListener('click', () => {
      closeModal('bulk-entry-modal');
      tbody.innerHTML = '';
    });
    
    addRowBtn.addEventListener('click', addBulkEntryRow);
    
    submitBtn.addEventListener('click', async () => {
      const rows = tbody.querySelectorAll('tr');
      const transactions = [];
      
      for (const row of rows) {
        const inputs = row.querySelectorAll('input, select');
        const transaction = {
          date: inputs[0].value,
          amount: parseFloat(inputs[1].value),
          type: inputs[2].value,
          category_id: inputs[3].value,
          description: inputs[4].value,
          account_id: document.getElementById('bulk-entry-account').value
        };
        
        if (transaction.date && transaction.amount && !isNaN(transaction.amount)) {
          transactions.push(transaction);
        }
      }
      
      // Add all transactions
      for (const transaction of transactions) {
        await window.databaseApi.addTransaction(transaction);
      }
      
      // Refresh everything
      await refreshData({
        all: true
      });
      
      closeModal('bulk-entry-modal');
      tbody.innerHTML = '';
    });
  }
  
  function addBulkEntryRow() {
    const tbody = document.getElementById('bulk-entry-tbody');
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td><input type="date" value="${new Date().toISOString().split('T')[0]}"></td>
      <td><input type="number" step="0.01" placeholder="0.00"></td>
      <td>
        <select>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </td>
      <td>
        <select class="category-select" id="bulk-entry-category">
          <!-- Categories will be populated dynamically -->
        </select>
      </td>
      <td><input type="text" placeholder="Description"></td>
      <td>
        <button class="action-btn delete-btn" onclick="this.closest('tr').remove()">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    `;
    
    tbody.appendChild(row);
    populateBulkEntryDropdowns();
  }