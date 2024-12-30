import { formatCurrency, capitalizeFirstLetter, formatDateForDisplay } from '../utils/formatters.js';
import { showEditRecurringForm, deleteRecurring } from '../components/recurring.js';
import { showDeleteConfirmationModal } from '../utils/modals.js';
import { TablePagination } from '../utils/pagination.js';
import { parseSearchDate, isSameDay, monthMappings } from '../utils/dateSearch.js';

let recurringPagination;

function isRecurringActive(item) {
    const startDate = item.start_date ? new Date(item.start_date) : null;
    const endDate = item.end_date ? new Date(item.end_date) : null;
    const today = new Date();
    
    return (!startDate || startDate <= today) && 
           (!endDate || endDate >= today);
}

function matchesDateSearch(recurring, searchResult) {
    if (!searchResult) return false;

    const startDate = recurring.start_date ? new Date(recurring.start_date) : null;
    const endDate = recurring.end_date ? new Date(recurring.end_date) : null;

    // For year-only searches
    if (searchResult.type === 'year') {
        const year = searchResult.value;
        return (startDate && startDate.getFullYear() === year) || 
               (endDate && endDate.getFullYear() === year);
    }

    // For full date searches
    if (searchResult.type === 'full-date') {
        // If we only have a month, check if any dates in that month
        if (searchResult.day === null) {
            const startOfMonth = new Date(Date.UTC(searchResult.year, searchResult.month, 1));
            const endOfMonth = new Date(Date.UTC(searchResult.year, searchResult.month + 1, 0));
            
            const startDate = r.start_date ? new Date(Date.UTC(
                new Date(r.start_date).getUTCFullYear(),
                new Date(r.start_date).getUTCMonth(),
                new Date(r.start_date).getUTCDate()
            )) : null;
            
            const endDate = r.end_date ? new Date(Date.UTC(
                new Date(r.end_date).getUTCFullYear(),
                new Date(r.end_date).getUTCMonth(),
                new Date(r.end_date).getUTCDate()
            )) : null;

            return (!startDate || startDate <= endOfMonth) && 
                   (!endDate || endDate >= startOfMonth);
        }
        
        // If we only have a day, check if any dates match that day
        if (searchResult.month === null) {
            const startDate = r.start_date ? new Date(r.start_date) : null;
            const endDate = r.end_date ? new Date(r.end_date) : null;
            
            return (startDate && startDate.getUTCDate() === searchResult.day) || 
                   (endDate && endDate.getUTCDate() === searchResult.day);
        }

        // If we have both month and day, use the existing logic
        const searchDate = new Date(Date.UTC(
            searchResult.year,
            searchResult.month,
            searchResult.day
        ));
        
        // Create dates from ISO strings and normalize to UTC midnight
        const startDate = r.start_date ? new Date(Date.UTC(
            new Date(r.start_date).getUTCFullYear(),
            new Date(r.start_date).getUTCMonth(),
            new Date(r.start_date).getUTCDate()
        )) : null;
        
        const endDate = r.end_date ? new Date(Date.UTC(
            new Date(r.end_date).getUTCFullYear(),
            new Date(r.end_date).getUTCMonth(),
            new Date(r.end_date).getUTCDate()
        )) : null;

        console.log('Comparing dates for:', r.name);
        console.log('Search Date:', searchDate.toISOString());
        console.log('Start Date:', startDate?.toISOString());
        console.log('End Date:', endDate?.toISOString());
        
        // Check if search date falls within the recurring period
        const isWithinPeriod = (!startDate || searchDate >= startDate) && 
                              (!endDate || searchDate <= endDate);
        
        console.log('Is Within Period:', isWithinPeriod);
        
        return isWithinPeriod;
    }

    return false;
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

        // Get filter values
        const typeFilter = filters.type || 'all';
        const categoryFilter = filters.category || 'all';
        const statusFilter = filters.status || 'all';
        const sortBy = filters.sort || 'name-asc';
        const searchTerm = typeof filters.search === 'string' ? filters.search : '';

        // Get all data first for total count
        const { data: allData } = await window.databaseApi.getAllRecurring(accountId);
        
        // Apply filters to get total filtered count
        let filteredData = [...allData];
        
        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const searchResult = parseSearchDate(term);
            
            console.log('Search Term:', term);
            console.log('Parsed Search Result:', searchResult);
            
            filteredData = filteredData.filter(r => {
                // Check for date matches first
                if (searchResult) {
                    // For year-only searches
                    if (searchResult.type === 'year') {
                        const startDate = r.start_date ? new Date(r.start_date) : null;
                        const endDate = r.end_date ? new Date(r.end_date) : null;
                        return (startDate && startDate.getUTCFullYear() === searchResult.value) || 
                               (endDate && endDate.getUTCFullYear() === searchResult.value);
                    }

                    // For full date searches
                    if (searchResult.type === 'full-date') {
                        // If we only have a month, check if any dates in that month
                        if (searchResult.day === null) {
                            const startOfMonth = new Date(Date.UTC(searchResult.year, searchResult.month, 1));
                            const endOfMonth = new Date(Date.UTC(searchResult.year, searchResult.month + 1, 0));
                            
                            const startDate = r.start_date ? new Date(Date.UTC(
                                new Date(r.start_date).getUTCFullYear(),
                                new Date(r.start_date).getUTCMonth(),
                                new Date(r.start_date).getUTCDate()
                            )) : null;
                            
                            const endDate = r.end_date ? new Date(Date.UTC(
                                new Date(r.end_date).getUTCFullYear(),
                                new Date(r.end_date).getUTCMonth(),
                                new Date(r.end_date).getUTCDate()
                            )) : null;

                            return (!startDate || startDate <= endOfMonth) && 
                                   (!endDate || endDate >= startOfMonth);
                        }
                        
                        // If we only have a day, check if any dates match that day
                        if (searchResult.month === null) {
                            const startDate = r.start_date ? new Date(r.start_date) : null;
                            const endDate = r.end_date ? new Date(r.end_date) : null;
                            
                            return (startDate && startDate.getUTCDate() === searchResult.day) || 
                                   (endDate && endDate.getUTCDate() === searchResult.day);
                        }

                        // If we have both month and day, use the existing logic
                        const searchDate = new Date(Date.UTC(
                            searchResult.year,
                            searchResult.month,
                            searchResult.day
                        ));
                        
                        // Create dates from ISO strings and normalize to UTC midnight
                        const startDate = r.start_date ? new Date(Date.UTC(
                            new Date(r.start_date).getUTCFullYear(),
                            new Date(r.start_date).getUTCMonth(),
                            new Date(r.start_date).getUTCDate()
                        )) : null;
                        
                        const endDate = r.end_date ? new Date(Date.UTC(
                            new Date(r.end_date).getUTCFullYear(),
                            new Date(r.end_date).getUTCMonth(),
                            new Date(r.end_date).getUTCDate()
                        )) : null;

                        console.log('Comparing dates for:', r.name);
                        console.log('Search Date:', searchDate.toISOString());
                        console.log('Start Date:', startDate?.toISOString());
                        console.log('End Date:', endDate?.toISOString());
                        
                        // Check if search date falls within the recurring period
                        const isWithinPeriod = (!startDate || searchDate >= startDate) && 
                                              (!endDate || searchDate <= endDate);
                        
                        console.log('Is Within Period:', isWithinPeriod);
                        
                        return isWithinPeriod;
                    }
                }

                // Rest of the existing search logic for non-date terms
                const searchableFields = [
                    r.name?.toLowerCase(),
                    r.description?.toLowerCase(),
                    r.category_name?.toLowerCase(),
                    r.amount.toString(),
                    r.type?.toLowerCase(),
                    r.frequency?.toLowerCase()
                ].filter(Boolean);

                return searchableFields.some(field => field.includes(term));
            });
        }

        // Apply type filter
        if (typeFilter !== 'all') {
            filteredData = filteredData.filter(r => r.type === typeFilter);
        }

        // Apply category filter
        if (categoryFilter !== 'all') {
            filteredData = filteredData.filter(r => r.category_id === parseInt(categoryFilter));
        }

        // Apply status filter
        if (statusFilter !== 'all') {
            filteredData = filteredData.filter(r => {
                const today = new Date();
                const startDate = new Date(r.start_date);
                const endDate = r.end_date ? new Date(r.end_date) : null;
                const isActive = (!startDate || startDate <= today) && 
                               (!endDate || endDate >= today);
                
                return statusFilter === 'active' ? isActive : !isActive;
            });
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
        const totalCount = filteredData.length;

        // Apply pagination
        const offset = recurringPagination.getOffset();
        const limit = recurringPagination.getLimit();
        filteredData = filteredData.slice(offset, offset + limit);

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
                        ${item.type === 'income' ? '+' : '-'}${formatCurrency(Math.abs(item.amount))}
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
                            try {
                                const result = await deleteRecurring(item.id);
                                if (!result.success) throw new Error(result.error);
                            } catch (error) {
                                console.error('Error deleting recurring:', error);
                                showError('Failed to delete recurring transaction');
                            }
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

        return { data: filteredData, error: null };
    } catch (error) {
        console.error('Error fetching recurring:', error);
        return { data: null, error: error.message };
    }
}