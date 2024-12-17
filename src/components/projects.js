import { openModal, closeModal, showError } from '../utils/utils.js';
import { fetchProjects } from '../services/projectsService.js';
import { refreshData } from '../utils/refresh.js';
import { formatCurrency, formatDate, getAmountValue } from '../utils/formatters.js';

export function initializeProjects() {
    // Add Project Button
    document.getElementById('add-project-btn')?.addEventListener('click', () => {
        openModal('add-project-modal');
    });

    // Close/Cancel Add Project
    ['close-add-project', 'cancel-add-project'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => {
            closeModal('add-project-modal');
        });
    });

    // Close/Cancel Edit Project
    ['close-edit-project', 'cancel-edit-project'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => {
            closeModal('edit-project-modal');
        });
    });

    // Add Project Form Submit
    document.getElementById('add-project-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const project = {
            name: document.getElementById('project-name').value,
            description: document.getElementById('project-description').value,
            budget: parseFloat(getAmountValue(document.getElementById('project-budget'))) || null,
            status: document.getElementById('project-status').value,
            start_date: document.getElementById('project-start-date').value || null,
            end_date: document.getElementById('project-end-date').value || null
        };

        try {
            const { error } = await window.databaseApi.createProject(project);
            if (error) throw error;

            closeModal('add-project-modal');
            e.target.reset();
            await refreshData({ projects: true });
        } catch (err) {
            console.error('Error creating project:', err);
            showError('Failed to create project');
        }
    });

    // Edit Project Form Submit
    document.getElementById('edit-project-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const projectId = e.target.dataset.projectId;
        const project = {
            name: document.getElementById('edit-project-name').value,
            description: document.getElementById('edit-project-description').value,
            budget: parseFloat(getAmountValue(document.getElementById('edit-project-budget'))) || null,
            status: document.getElementById('edit-project-status').value,
            start_date: document.getElementById('edit-project-start-date').value || null,
            end_date: document.getElementById('edit-project-end-date').value || null
        };

        try {
            const { error } = await window.databaseApi.updateProject(projectId, project);
            if (error) throw error;

            closeModal('edit-project-modal');
            await refreshData({ projects: true });
        } catch (err) {
            console.error('Error updating project:', err);
            showError('Failed to update project');
        }
    });

    // Close project details modal
    document.getElementById('close-project-details')?.addEventListener('click', () => {
        closeModal('project-details-modal');
    });

    // Initialize date validation for edit form
    const startDateEdit = document.getElementById('edit-project-start-date');
    const endDateEdit = document.getElementById('edit-project-end-date');
    
    startDateEdit?.addEventListener('change', () => {
        endDateEdit.min = startDateEdit.value;
    });
    
    endDateEdit?.addEventListener('change', () => {
        startDateEdit.max = endDateEdit.value;
    });

    // Add event listener for project details close button
    document.getElementById('close-project-details-btn')?.addEventListener('click', () => {
        closeModal('project-details-modal');
    });

    // Add event listener for edit project button
    document.getElementById('edit-project-btn')?.addEventListener('click', async (e) => {
        const projectId = e.currentTarget.dataset.projectId;
        try {
            const { data: project, error } = await window.databaseApi.getProjectDetails(projectId);
            if (error) throw error;
            
            populateEditProjectForm(project);
            closeModal('project-details-modal');
            openModal('edit-project-modal');
        } catch (err) {
            console.error('Error loading project for edit:', err);
            showError('Failed to load project details');
        }
    });

    // Add event listener for delete project button
    document.getElementById('delete-project-btn')?.addEventListener('click', async (e) => {
        if (!confirm('Are you sure you want to delete this project?')) return;
        
        const projectId = e.currentTarget.dataset.projectId;
        try {
            const { error } = await window.databaseApi.deleteProject(projectId);
            if (error) throw error;
            
            closeModal('project-details-modal');
            await refreshData({ projects: true });
        } catch (err) {
            console.error('Error deleting project:', err);
            showError('Failed to delete project');
        }
    });

    // Initialize date validation for add form
    const startDate = document.getElementById('project-start-date');
    const endDate = document.getElementById('project-end-date');
    
    startDate?.addEventListener('change', () => {
        endDate.min = startDate.value;
    });
    
    endDate?.addEventListener('change', () => {
        startDate.max = endDate.value;
    });
}

export function populateEditProjectForm(project) {
    const form = document.getElementById('edit-project-form');
    form.dataset.projectId = project.id;
    
    document.getElementById('edit-project-name').value = project.name;
    document.getElementById('edit-project-description').value = project.description || '';
    document.getElementById('edit-project-budget').value = project.budget || '';
    document.getElementById('edit-project-status').value = project.status;
    document.getElementById('edit-project-start-date').value = project.start_date || '';
    document.getElementById('edit-project-end-date').value = project.end_date || '';
}