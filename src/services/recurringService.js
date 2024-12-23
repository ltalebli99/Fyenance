import { formatCurrency, capitalizeFirstLetter, formatDateForDisplay } from '../utils/formatters.js';
import { showEditRecurringForm, toggleRecurringStatus } from '../components/recurring.js';
import { showDeleteConfirmationModal } from '../utils/modals.js';
import { TablePagination } from '../utils/pagination.js';

let recurringPagination;

function isRecurringActive(item) {
    const startDate = item.start_date ? new Date(item.start_date) : null;
    const endDate = item.end_date ? new Date(item.end_date) : null;
    const today = new Date();
    
    return (!startDate || startDate <= today) && 
           (!endDate || endDate >= today);
}

// Fetch and display recurring
export async function fetchRecurring(accountId = null, filters = {}) {
    try {
        // Initialize pagination if not already done
        if (!recurringPagination) {
            recurringPagination = new TablePagination('recurring-table-body', {
                itemsPerPage: 10
            });
            recurringPagination.onPageChange = (page) => {
                fetchRecurring(accountId, filters);
            };
        }

        // Get filter values from DOM
        const typeFilter = document.getElementById('recurring-type-filter')?.value || 'all';
        const categoryFilter = document.getElementById('recurring-category-filter')?.value || 'all';
        const sortBy = document.getElementById('recurring-sort')?.value || 'name-asc';
        const searchTerm = document.querySelector('#Recurring .search-input')?.value || '';

        // Get all data first for total count
        const { data: allData } = await window.databaseApi.getAllRecurring(accountId);
        
        // Apply filters to get total filtered count
        let filteredData = [...allData];
        
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredData = filteredData.filter(r => {
                // Format dates for searching
                const startDate = r.start_date ? new Date(r.start_date).toLocaleDateString() : '';
                const endDate = r.end_date ? new Date(r.end_date).toLocaleDateString() : '';
                // Format amount for searching
                const formattedAmount = r.amount.toString();
                
                return [
                    r.name?.toLowerCase(),
                    r.description?.toLowerCase(),
                    r.category_name?.toLowerCase(),
                    startDate.toLowerCase(),
                    endDate.toLowerCase(),
                    formattedAmount,
                    r.type?.toLowerCase(),
                    r.frequency?.toLowerCase()
                ].some(field => field && field.includes(term));
            });
        }
        if (typeFilter !== 'all') {
            filteredData = filteredData.filter(r => r.type === typeFilter);
        }
        if (categoryFilter !== 'all') {
            filteredData = filteredData.filter(r => r.category_id === parseInt(categoryFilter));
        }

        // Apply sorting
        const [field, direction] = sortBy.split('-');
        filteredData.sort((a, b) => {
            let comparison = 0;
            switch (field) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'amount':
                    comparison = parseFloat(a.amount) - parseFloat(b.amount);
                    break;
                case 'date':
                    comparison = new Date(a.start_date) - new Date(b.start_date);
                    break;
            }
            return direction === 'asc' ? comparison : -comparison;
        });

        // Get total count for pagination
        const { data: totalData } = await window.databaseApi.getAllRecurring(accountId);
        const totalCount = totalData.length;

        // Update pagination with total count
        recurringPagination.updatePagination(totalCount);

        const tableBody = document.getElementById('recurring-table-body');
        tableBody.innerHTML = '';

        if (filteredData && filteredData.length > 0) {
            filteredData.forEach(item => {
                const active = isRecurringActive(item);
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.name}</td>
                    <td class="${item.type === 'income' ? 'positive' : 'negative'}">
                        ${formatCurrency(item.amount)}
                    </td>
                    <td>${capitalizeFirstLetter(item.type)}</td>
                    <td>${item.category_name || 'Uncategorized'}</td>
                    <td>
                        ${capitalizeFirstLetter(item.frequency)} starting 
                        ${formatDateForDisplay(item.start_date)}
                        ${item.end_date ? ` until ${formatDateForDisplay(item.end_date)}` : ''}
                    </td>
                    <td>${item.description || '-'}</td>
                    <td>
                        <div class="status-btn ${active ? 'active' : 'inactive'}">
                            ${active ? 'Active' : 'Inactive'}
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit-btn" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete-btn" title="Delete">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                `;

                // Remove click handler from status button since it's now automatic
                const statusBtn = row.querySelector('.status-btn');
                statusBtn.style.cursor = 'default'; // Remove pointer cursor
                
                // Add event listeners
                row.querySelector('.edit-btn').addEventListener('click', () => {
                    showEditRecurringForm({
                        id: item.id,
                        account_id: item.account_id,
                        amount: item.amount,
                        category_id: item.category_id,
                        name: item.name,
                        type: item.type,
                        frequency: item.frequency,
                        start_date: item.start_date,
                        end_date: item.end_date,
                        description: item.description,
                        is_active: item.is_active
                    });
                });

                row.querySelector('.delete-btn').addEventListener('click', () => {
                    showDeleteConfirmationModal({
                        title: 'Delete Recurring Transaction',
                        message: 'Are you sure you want to delete this recurring transaction?',
                        onConfirm: async () => {
                            await deleteRecurring(item.id);
                        }
                    });
                });

                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="table-empty-state">No recurring items found</td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error fetching recurring:', error);
        showError('Failed to load recurring transactions');
    }
  }