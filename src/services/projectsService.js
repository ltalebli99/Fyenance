import { formatCurrency, capitalizeFirstLetter } from '../utils/formatters.js';
import { updateEmptyStates } from '../utils/emptyStates.js';
import { openModal, closeModal, showError } from '../utils/utils.js';
import { refreshData } from '../utils/refresh.js';
import { populateEditProjectForm } from '../components/projects.js';

export async function fetchProjects() {
    try {
        const { data: projects, error } = await window.databaseApi.getProjects();
        if (error) throw error;

        const projectsGrid = document.querySelector('.projects-grid');
        const emptyState = document.getElementById('projects-empty-state');

        if (!projectsGrid || !emptyState) {
            console.error('Projects grid or empty state elements not found');
            return;
        }

        if (!projects || projects.length === 0) {
            updateEmptyStates(emptyState, true);
            return;
        }

        updateEmptyStates(emptyState, false);

        projectsGrid.innerHTML = projects.map(project => `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-header">
                    <div class="project-title-container">   
                        <h3 class="project-title">${project.name}</h3>
                        <span class="project-status ${project.status}">${capitalizeFirstLetter(project.status)}</span>
                    </div>
                    <button class="card-edit-btn" title="Edit Project">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
                <div class="project-body">
                    <div class="project-stats three-col">
                        <div class="stat-item">
                            <div class="stat-label">Transactions</div>
                            <div class="stat-value">${project.transaction_count || 0}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Recurring</div>
                            <div class="stat-value">${project.recurring_count || 0}</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-label">Total Spent</div>
                            <div class="stat-value expense">
                                ${formatCurrency(project.total_spent || 0)}
                            </div>
                        </div>
                    </div>
                    ${project.budget ? `
                        <div class="project-progress">
                            <div class="progress-label">
                                <span>Budget Usage</span>
                                <span>${Math.round((project.total_spent / project.budget) * 100)}%</span>
                            </div>
                            <div class="progress-bar-container">
                                <div class="progress-bar-fill ${getProgressBarClass(project.total_spent, project.budget)}"
                                     style="width: ${Math.min((project.total_spent / project.budget) * 100, 100)}%">
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.project-card').forEach(card => {
            // Project details click handler
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking edit button
                if (e.target.closest('.edit-btn')) return;
                showProjectDetails(card.dataset.projectId);
            });

            // Edit button handler
            const editBtn = card.querySelector('.edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', async (e) => {
                    e.stopPropagation(); // Prevent project details from opening
                    const projectId = card.dataset.projectId;
                    try {
                        const { data: project, error } = await window.databaseApi.getProjectDetails(projectId);
                        if (error) throw error;
                        if (!project) throw new Error('Project not found');
                        
                        populateEditProjectForm(project);
                        openModal('edit-project-modal');
                    } catch (err) {
                        console.error('Error loading project for edit:', err);
                        showError('Failed to load project details');
                    }
                });
            }
        });

    } catch (err) {
        console.error('Error fetching projects:', err);
        showError('Failed to load projects');
    }
}

export async function showProjectDetails(projectId) {
    try {
        const { data: project, error } = await window.databaseApi.getProjectDetails(projectId);
        if (error) throw error;

        // Update title and status
        document.getElementById('project-details-title').textContent = project.name;
        document.getElementById('project-details-status').textContent = capitalizeFirstLetter(project.status);
        document.getElementById('project-details-status').className = `status-badge ${project.status}`;
        
        // Update financial displays using the database-calculated totals
        document.getElementById('project-details-budget').textContent = project.budget ? 
            `${formatCurrency(project.budget)}` : 'No budget set';
        document.getElementById('project-details-income').textContent = `${formatCurrency(project.total_income)}`;
        document.getElementById('project-details-spent').textContent = `${formatCurrency(project.total_spent)}`;

        // Update duration and description
        document.getElementById('project-details-duration').textContent = formatDuration(project.start_date, project.end_date);
        document.getElementById('project-details-description').textContent = project.description || 'No description provided';

        // Update recurring list
        const recurringList = document.getElementById('project-recurring-list');
        if (project.recurring && project.recurring.length > 0) {
            recurringList.innerHTML = project.recurring.map(rec => `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-name">${rec.name || rec.description}</div>
                        <div class="transaction-details">
                            <span class="category">${rec.category_name || 'Uncategorized'}</span> | 
                            <span class="frequency">${capitalizeFirstLetter(rec.frequency)}</span>
                        </div>
                    </div>
                    <div class="amount ${rec.type}">
                        ${rec.type === 'income' ? '+' : '-'}${formatCurrency(Math.abs(rec.amount))}
                    </div>
                </div>
            `).join('');
        } else {
            recurringList.innerHTML = '<div class="empty-message">No recurring transactions</div>';
        }

        // Update transactions list
        const transactionsList = document.getElementById('project-transactions-list');
        if (project.transactions && project.transactions.length > 0) {
            transactionsList.innerHTML = project.transactions.map(tx => `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-name">${tx.description}</div>
                        <div class="transaction-details">
                            <span class="category">${tx.category_name || 'Uncategorized'}</span> | 
                            <span class="date">${formatDate(tx.date)}</span>
                        </div>
                    </div>
                    <div class="amount ${tx.type}">
                        ${tx.type === 'income' ? '+' : '-'}${formatCurrency(Math.abs(tx.amount))}
                    </div>
                </div>
            `).join('');
        } else {
            transactionsList.innerHTML = '<div class="empty-message">No transactions yet</div>';
        }

        // Set project ID on the edit and delete buttons
        const editBtn = document.getElementById('edit-project-btn');
        const deleteBtn = document.getElementById('delete-project-btn');
        
        if (editBtn) editBtn.dataset.projectId = project.id;
        if (deleteBtn) deleteBtn.dataset.projectId = project.id;

        openModal('project-details-modal');

    } catch (err) {
        console.error('Error showing project details:', err);
        showError('Failed to load project details');
    }
}

function formatDuration(startDate, endDate) {
    if (!startDate && !endDate) return 'No dates set';
    const parts = [];
    if (startDate) parts.push(`From: ${formatDate(startDate)}`);
    if (endDate) parts.push(`To: ${formatDate(endDate)}`);
    return parts.join(' ');
}

function formatDate(dateString) {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
}

function getProgressBarClass(spent, budget) {
    const percentage = (spent / budget) * 100;
    if (percentage >= 90) return 'danger';
    if (percentage >= 75) return 'warning';
    return '';
}

function openEditProjectModal(project) {
    document.getElementById('edit-project-name').value = project.name;
    document.getElementById('edit-project-description').value = project.description || '';
    document.getElementById('edit-project-budget').value = project.budget || '';
    document.getElementById('edit-project-status').value = project.status;
    document.getElementById('edit-project-start-date').value = project.start_date || '';
    document.getElementById('edit-project-end-date').value = project.end_date || '';
    document.getElementById('edit-project-form').dataset.projectId = project.id;
    
    openModal('edit-project-modal');
}