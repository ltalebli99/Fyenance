import { deleteTransaction } from '../components/transactions.js';
import { deleteCategory } from '../components/categories.js';
import { deleteAccount } from '../components/accounts.js';
import { deleteRecurring } from '../components/recurring.js';

// Navigation Function
export function openSection(evt, sectionName) {
    // Hide all sections
    const sections = document.getElementsByClassName('section');
    for (let i = 0; i < sections.length; i++) {
      sections[i].classList.remove('active');
    }
  
    // Remove active class from all buttons
    const tabs = document.getElementsByClassName('tablink');
    for (let i = 0; i < tabs.length; i++) {
      tabs[i].classList.remove('active');
    }
  
    // Show the current section
    document.getElementById(sectionName).classList.add('active');
    
    // Only try to add active class if evt.currentTarget exists
    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add('active');
    }
}

  // Confirm Delete Function
  export function confirmDelete(type, id) {
    if (confirm(`Are you sure you want to delete this ${type}?`)) {
      switch (type) {
        case 'transaction':
          deleteTransaction(id);
          break;
        case 'category':
          deleteCategory(id);
          break;
        case 'account':
          deleteAccount(id);
          break;
        case 'recurring':
          deleteRecurring(id);
          break;
      }
    }
  }


// Function to open modal
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('show');
    
    // Disable validation on other forms while this modal is open
    document.querySelectorAll('form').forEach(form => {
      const formModal = form.closest('.modal');
      if (formModal && formModal.id !== modalId) {
        form.setAttribute('novalidate', '');
      }
    });
}

// Function to close modal
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('show');
    
    // Reset form if it exists
    const form = modal.querySelector('form');
    if (form) {
      form.reset();
    }
    
    // Re-enable validation on all forms
    document.querySelectorAll('form').forEach(form => {
      form.removeAttribute('novalidate');
    });
  }
  


  // Get Chart Theme
  export function getChartTheme() {
    const isDarkMode = document.body.classList.contains('dark-mode');
    return {
      color: isDarkMode ? '#fff' : '#1F291F',
      gridColor: isDarkMode ? '#333' : '#E8EBE8',
      tickColor: isDarkMode ? '#999' : '#2F3B2F'
    };
  }

  

  // Add event listeners for closing modals
['add-transaction', 'add-recurring', 'add-category', 'edit-category'].forEach(modalType => {
    document.getElementById(`close-${modalType}`)?.addEventListener('click', () => {
      closeModal(`${modalType}-modal`);
    });
  
    document.getElementById(`cancel-${modalType}`)?.addEventListener('click', () => {
      closeModal(`${modalType}-modal`);
    });
  });
  

  // Function to handle clicking outside modal
  export function handleModalOutsideClick(event) {
    // Only close if clicking specifically on the backdrop
    if (event.target.classList.contains('modal-backdrop')) {
      const modalId = event.target.closest('.modal').id;
      closeModal(modalId);
    }
  }
  
  // Update event listeners to target backdrop specifically
  document.addEventListener('DOMContentLoaded', () => {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      const backdrop = modal.querySelector('.modal-backdrop');
      if (backdrop) {
        backdrop.addEventListener('click', handleModalOutsideClick);
      }
    });
  });


  export function showError(message) {
    // Create temporary popup element
    const popup = document.createElement('div');
    popup.className = 'error-popup';
    popup.textContent = message;
  
    // Add to document
    document.body.appendChild(popup);
  
    // Show with animation
    setTimeout(() => popup.classList.add('show'), 10);
  
    // Remove after delay
    setTimeout(() => {
      popup.classList.remove('show');
      setTimeout(() => document.body.removeChild(popup), 300);
    }, 3000);
  }

  export function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-popup';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    // Add show class after a small delay for animation
    setTimeout(() => successDiv.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        successDiv.classList.remove('show');
        setTimeout(() => successDiv.remove(), 300);
    }, 3000);
  }


