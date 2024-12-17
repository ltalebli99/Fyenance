import { initializeApp } from './init/initialization.js';
import { initializeQuickEntry } from './components/quickEntry.js';
import { initializeBulkEntry } from './components/bulkEntry.js';
import { initializeNavigation } from './components/navigation.js';
import { initializeAccountSelectors } from './components/accounts.js';
import { initializeVersionControl } from './services/updateService.js';
import { initializeTransactions } from './components/transactions.js';
import { initializeFilters } from './components/filters.js';
import { initializeWindowControls } from './services/windowService.js';
import { initializeSettings } from './components/settings.js';
import { initializeDatabaseControls } from './utils/database.js';
import { initializeProjects } from './components/projects.js';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize window controls first
    initializeWindowControls();
    
    // Initialize core functionality
    initializeApp();
    initializeNavigation();
    initializeAccountSelectors();
    initializeVersionControl();
    
    // Initialize transaction-related components
    initializeTransactions();
    initializeQuickEntry();
    initializeBulkEntry();
    initializeProjects();
    
    // Initialize filters
    initializeFilters();
    
    initializeSettings();
    
    initializeDatabaseControls();
    
  } catch (error) {
    console.error('Error during application initialization:', error);
  }
});
