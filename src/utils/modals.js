import { closeModal, openSection } from './utils.js';

export function showCreateFirstModal(type) {
    // Check if modal already exists
    const existingModal = document.querySelector('.first-item-modal');
    if (existingModal) {
        return; // Don't create another modal if one already exists
    }

    // Close the transaction modal if it's open
    closeModal('add-transaction-modal');
    
    const messages = {
      account: {
        title: 'No Accounts Found',
        message: 'You need to create an account before adding transactions.',
        action: 'Create Account',
        section: 'Accounts',
        icon: 'fa-wallet'
      },
      category: {
        title: 'No Categories Found',
        message: 'You need to create some categories before adding transactions.',
        action: 'Create Category',
        section: 'Categories',
        icon: 'fa-tags'
      }
    };
  
    const modal = document.createElement('div');
    modal.className = 'modal show first-item-modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content">
        <div class="modal-icon">
          <i class="fas ${messages[type].icon}"></i>
        </div>
        <h3>${messages[type].title}</h3>
        <p>${messages[type].message}</p>
        <div class="form-actions">
          <button type="button" class="primary-btn" id="goto-${type}-btn">
            <i class="fas fa-plus"></i>
            ${messages[type].action}
          </button>
          <button type="button" class="secondary-btn" id="cancel-first-${type}">
            Cancel
          </button>
        </div>
      </div>
    `;
  
    document.body.appendChild(modal);
  
    // Add click handler for the backdrop
    modal.querySelector('.modal-backdrop').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  
    modal.querySelector(`#goto-${type}-btn`).addEventListener('click', () => {
      const tabButton = document.querySelector(`button[data-section="${messages[type].section}"]`);
      if (tabButton) {
        const syntheticEvent = { currentTarget: tabButton };
        openSection(syntheticEvent, messages[type].section);
        if (type === 'account') {
          document.getElementById('show-add-account').click();
        } else if (type === 'category') {
          openSection({ currentTarget: document.getElementById('show-add-category') }, 'Categories');
        }
      }
      document.body.removeChild(modal);
    });
  
    modal.querySelector(`#cancel-first-${type}`).addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  }

export function showConfirmationModal({ title, message, confirmText, cancelText, onConfirm, isDelete }) {
    // Check if modal already exists
    const existingModal = document.querySelector('.confirmation-modal');
    if (existingModal) {
        return; // Don't create another modal if one already exists
    }

    const modal = document.createElement('div');
    modal.className = `modal show confirmation-modal${isDelete ? ' compact' : ''}`;
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>
                    ${isDelete ? '<i class="fas fa-exclamation-triangle warning-icon"></i>' : ''}
                    ${title}
                </h3>
                <div class="close">×</div>
            </div>
            <div class="modal-body">
                <p>${message}</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="secondary-btn" id="cancel-confirmation">
                    ${cancelText || 'Cancel'}
                </button>
                <button type="button" class="${isDelete ? 'danger-btn' : 'primary-btn'}" id="confirm-action">
                    ${confirmText || 'Confirm'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add click handler for the backdrop and close button
    const closeModal = () => {
        modal.classList.add('hiding');
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 200);
    };

    modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    modal.querySelector('.close').addEventListener('click', closeModal);
    modal.querySelector('#cancel-confirmation').addEventListener('click', closeModal);
    
    // Add confirm handler
    modal.querySelector('#confirm-action').addEventListener('click', () => {
        closeModal();
        if (onConfirm) onConfirm();
    });

    // Add keyboard handlers
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

export function showDeleteConfirmationModal({ title, message, onConfirm }) {
    showConfirmationModal({
        title: title || 'Confirm Delete',
        message: message || 'Are you sure you want to delete this item?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm,
        isDelete: true
    });
}