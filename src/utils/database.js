import { openModal, closeModal } from './utils.js';

export function initializeDatabaseControls() {
    // Delete database button
    const deleteDbBtn = document.getElementById('delete-db-btn');
    const deleteDbConfirm = document.getElementById('delete-db-confirm');
    const confirmDeleteBtn = document.getElementById('confirm-delete-db');
    const closeDeleteBtn = document.getElementById('close-delete-db');
    const cancelDeleteBtn = document.getElementById('cancel-delete-db');
    const deleteDbModal = document.getElementById('delete-db-modal');

    if (!deleteDbBtn || !deleteDbConfirm || !confirmDeleteBtn || !closeDeleteBtn || !cancelDeleteBtn || !deleteDbModal) {
        console.error('Database control elements not found');
        return;
    }

    // Delete database button
    deleteDbBtn.addEventListener('click', () => {
        deleteDbModal.style.display = 'flex';
    });

    // Close modal buttons - both close and cancel buttons should work the same way
    const closeModal = () => {
        deleteDbModal.style.display = 'none';
        deleteDbConfirm.value = '';
        confirmDeleteBtn.disabled = true;
    };

    closeDeleteBtn.addEventListener('click', closeModal);
    cancelDeleteBtn.addEventListener('click', closeModal);

    // Handle the confirmation input
    deleteDbConfirm.addEventListener('input', (e) => {
        confirmDeleteBtn.disabled = e.target.value !== 'DELETE';
    });

    // Handle the delete confirmation
    confirmDeleteBtn.addEventListener('click', async () => {
        try {
            if (deleteDbConfirm.value !== 'DELETE') {
                return;
            }

            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = 'Deleting...';

            const { success, error } = await window.databaseApi.deleteDatabase();
            
            if (success) {
                closeModal();
                alert('Database has been deleted successfully. The application will now restart.');
                window.electronAPI.relaunchApp();
            } else {
                throw new Error(error || 'Failed to delete database');
            }
        } catch (error) {
            console.error('Error deleting database:', error);
            alert('An error occurred while deleting the database.');
        } finally {
            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = 'Delete Database';
        }
    });
}