// Add template-related functions
export async function saveAsTemplate() {
    const accountId = document.getElementById('add-transaction-account').value;
    const type = document.getElementById('add-transaction-type').value;
    const categoryId = document.getElementById('add-transaction-category').value;
    const amount = document.getElementById('add-transaction-amount').value;
    const description = document.getElementById('add-transaction-description').value;
  
    if (!accountId || !type || !categoryId) {
      showError('Please fill in the required fields first');
      return;
    }
  
    // Show template name modal
    openModal('save-template-modal');
    
    // Set up one-time event listener for the save button
    const handleSave = async () => {
      const templateName = document.getElementById('template-name-input').value.trim();
      if (!templateName) {
        showError('Please enter a template name');
        return;
      }
  
      try {
        const { error } = await window.databaseApi.addTemplate({
          name: templateName,
          account_id: accountId,
          type,
          category_id: categoryId,
          amount: amount || null,
          description: description || ''
        });
  
        if (error) throw error;
        
        closeModal('save-template-modal');
        document.getElementById('template-name-input').value = '';
        await loadTemplates();
        showSuccess('Template saved successfully!');
      } catch (error) {
        console.error('Error saving template:', error);
        showError('Failed to save template');
      }
    };
  
    // Set up event listeners for the template name modal
    const saveBtn = document.getElementById('save-template-confirm');
    const cancelBtn = document.getElementById('cancel-save-template');
    const closeBtn = document.getElementById('close-save-template');
  
    saveBtn.onclick = handleSave;
    cancelBtn.onclick = () => closeModal('save-template-modal');
    closeBtn.onclick = () => closeModal('save-template-modal');
  }
  
  export async function loadTemplates() {
    try {
      const { data: templates, error } = await window.databaseApi.fetchTemplates();
      if (error) throw error;
  
      const templatesList = document.getElementById('templates-list');
      templatesList.innerHTML = '';
  
      if (!templates || templates.length === 0) {
        templatesList.innerHTML = '<div class="empty-state">No saved templates</div>';
        return;
      }
  
      templates.forEach(template => {
        const item = document.createElement('div');
        item.className = 'template-item';
        item.innerHTML = `
          <span class="template-name">${template.name}</span>
          <div class="template-actions">
            <button class="use-template" title="Use Template">
              <i class="fas fa-play"></i>
            </button>
            <button class="delete-template" title="Delete Template">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;
  
        item.querySelector('.use-template').addEventListener('click', () => {
          useTemplate(template);
        });
  
        item.querySelector('.delete-template').addEventListener('click', async () => {
          if (confirm('Are you sure you want to delete this template?')) {
            const { error } = await window.databaseApi.deleteTemplate(template.id);
            if (error) {
              showError('Failed to delete template');
            } else {
              await loadTemplates();
              showSuccess('Template deleted');
            }
          }
        });
  
        templatesList.appendChild(item);
      });
    } catch (error) {
      console.error('Error loading templates:', error);
      showError('Failed to load templates');
    }
  }
  
  export function useTemplate(template) {
    // Fill in the transaction form with template data
    document.getElementById('add-transaction-account').value = template.account_id;
    document.getElementById('add-transaction-type').value = template.type;
    document.getElementById('add-transaction-category').value = template.category_id;
    if (template.amount) {
      document.getElementById('add-transaction-amount').value = template.amount;
    }
    if (template.description) {
      document.getElementById('add-transaction-description').value = template.description;
    }
  }
  
  // Add to your initialization code
  document.getElementById('save-as-template')?.addEventListener('click', saveAsTemplate);
  document.addEventListener('DOMContentLoaded', () => {
    loadTemplates();
  });