export async function updateEmptyStates() {
    try {
        const { data: emptyStates } = await window.databaseApi.checkEmptyStates();
        
        if (emptyStates) {
            // Dashboard uses accounts data
            toggleEmptyState('dashboard-empty-state', emptyStates.accounts);
            toggleContent('dashboard-content', !emptyStates.accounts);
  
            // Other sections
            toggleEmptyState('accounts-empty-state', emptyStates.accounts);
            toggleContent('accounts-content', !emptyStates.accounts);
  
            toggleEmptyState('transactions-empty-state', emptyStates.transactions);
            toggleContent('transactions-content', !emptyStates.transactions);
            document.querySelector('.entry-tools').style.display = !emptyStates.categories ? 'block' : 'none';
  
            toggleEmptyState('categories-empty-state', emptyStates.categories);
            toggleContent('categories-content', !emptyStates.categories);
  
            toggleEmptyState('recurring-empty-state', emptyStates.recurring);
            toggleContent('recurring-content', !emptyStates.recurring);

            toggleEmptyState('projects-empty-state', emptyStates.projects);
            toggleContent('projects-content', !emptyStates.projects);
        }

    } catch (error) {
        console.error('Error updating em    pty states:', error);
    }
  }

export function toggleEmptyState(elementId, isEmpty) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = isEmpty ? 'flex' : 'none';
    }
  }
  
export function toggleContent(elementId, show) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = show ? 'block' : 'none';
    }
}