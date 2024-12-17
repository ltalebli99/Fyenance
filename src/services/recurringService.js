import { formatCurrency, capitalizeFirstLetter, formatDateForDisplay } from '../utils/formatters.js';
import { showEditRecurringForm, toggleRecurringStatus } from '../components/recurring.js';
import { confirmDelete } from '../utils/utils.js';
import { TablePagination } from '../utils/pagination.js';

let recurringPagination;

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
            filteredData = filteredData.filter(r => 
                r.name.toLowerCase().includes(term) ||
                r.description?.toLowerCase().includes(term) ||
                r.category_name?.toLowerCase().includes(term)
            );
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
                        ${item.start_date ? formatDateForDisplay(item.start_date) : 'Invalid Date'}
                        ${item.end_date ? ` until ${formatDateForDisplay(item.end_date)}` : ''}
                    </td>
                    <td>${item.description || '-'}</td>
                    <td>
                        <div class="status-btn ${item.is_active ? 'active' : 'inactive'}">
                            ${item.is_active ? 'Active' : 'Inactive'}
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

                // Add event listeners
                row.querySelector('.status-btn').addEventListener('click', () => {
                    toggleRecurringStatus(item.id, !item.is_active, item);
                });

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
                    confirmDelete('recurring', item.id);
                });

                tableBody.appendChild(row);
            });
        } else {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">No recurring items found</td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('Error fetching recurring:', error);
        showError('Failed to load recurring transactions');
    }
  }