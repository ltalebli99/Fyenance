import { stateService } from '../services/stateService.js';

export function initializeNavigation() {
  const tabs = document.querySelectorAll('.tablink');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const section = e.currentTarget.dataset.section;
      
      // Update UI
      tabs.forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      // Hide all sections
      document.querySelectorAll('.section').forEach(s => {
        s.classList.remove('active');
      });
      
      // Show selected section
      document.getElementById(section).classList.add('active');
      
      // Update state
      stateService.setState('currentSection', section);
    });
  });
}