export function initializeCustomMultiSelect(elementId) {
    const multiSelect = document.getElementById(elementId);
    if (!multiSelect) {
      console.error(`Multi-select ${elementId} not found`);
      return null;
    }
  
    const header = multiSelect.querySelector('.select-header');
    const dropdown = multiSelect.querySelector('.select-dropdown');
    const optionsContainer = multiSelect.querySelector('.options-container');
    const selectAllCheckbox = multiSelect.querySelector('input[type="checkbox"]');
    const selectedText = multiSelect.querySelector('.selected-text');
  
    let accounts = [];
    let selectedAccounts = new Set(['all']);
  
    async function initializeOptions() {
      try {
        const { data: fetchedAccounts, error } = await window.databaseApi.fetchAccounts();
        if (error) throw error;
  
        accounts = fetchedAccounts;
        renderOptions();
        updateSelectedText();
        
        triggerChange();
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      }
    }
  
    function renderOptions() {
      optionsContainer.innerHTML = accounts.map(account => `
        <div class="option">
          <input type="checkbox" id="${elementId}-${account.id}" value="${account.id}"
                 ${selectedAccounts.has(account.id) ? 'checked' : ''}>
          <label for="${elementId}-${account.id}">${account.name}</label>
        </div>
      `).join('');
  
      optionsContainer.querySelectorAll('.option input').forEach(checkbox => {
        checkbox.addEventListener('change', handleOptionChange);
      });
    }
  
    function updateSelectedText() {
      if (selectedAccounts.has('all')) {
        selectedText.textContent = 'All Accounts';
      } else if (selectedAccounts.size === 0) {
        selectedText.textContent = 'Select Accounts';
      } else {
        const count = selectedAccounts.size;
        if (count === 1) {
          const accountId = Array.from(selectedAccounts)[0];
          const account = accounts.find(a => a.id.toString() === accountId.toString());
          selectedText.textContent = account ? account.name : 'Select Accounts';
        } else {
          selectedText.textContent = `${count} accounts selected`;
        }
      }
    }
  
    function handleOptionChange(e) {
      const value = e.target.value;
      
      if (value === 'all') {
        selectedAccounts.clear();
        if (e.target.checked) {
          selectedAccounts.add('all');
        }
      } else {
        selectedAccounts.delete('all');
        if (e.target.checked) {
          selectedAccounts.add(value);
        } else {
          selectedAccounts.delete(value);
        }
      }
  
      updateSelectedText();
      triggerChange();
    }
  
    // Toggle dropdown
    header.addEventListener('click', () => {
      const isActive = header.classList.toggle('active');
      dropdown.classList.toggle('show', isActive);
    });
  
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!multiSelect.contains(e.target)) {
        header.classList.remove('active');
        dropdown.classList.remove('show');
      }
    });
  
    // Handle "Select All" option
    selectAllCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedAccounts.clear();
        selectedAccounts.add('all');
      } else {
        selectedAccounts.delete('all');
      }
      renderOptions();
      updateSelectedText();
      triggerChange();
    });
  
    function triggerChange() {
      const event = new CustomEvent('accountschange', {
        detail: Array.from(selectedAccounts)
      });
      multiSelect.dispatchEvent(event);
    }
  
    // Initialize
    initializeOptions();
  
    return {
      getSelectedAccounts: () => Array.from(selectedAccounts),
      setSelectedAccounts: (accounts) => {
        selectedAccounts = new Set(accounts);
        renderOptions();
        updateSelectedText();
      }
    };
  }