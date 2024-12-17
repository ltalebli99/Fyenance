// src/components/smartImport.js
import { StatementImporter } from '../services/importService.js';
import { openModal, showError, showSuccess } from '../utils/utils.js';
import { populateAccountDropdowns } from '../utils/dropdownHelpers.js';
import { refreshData } from '../utils/refresh.js';
import { TransactionParser } from '../utils/transactionParser.js';
import { capitalizeFirstLetter, formatCurrency } from '../utils/formatters.js';

const importer = new StatementImporter();

// Pagination state
const ITEMS_PER_PAGE = 10;
let currentPage = 1;
let totalPages = 1;

// Import state management
const importState = {
    reset() {
        this.currentStep = 1;
        this.selectedAccountId = null;
        this.parsedData = null;
        this.mappedColumns = null;
        this.mappedTransactions = null;
        this.currentPage = 1;
        this.totalPages = 1;
        console.log('Import state reset');
    },
    setSelectedAccount(accountId) {
        this.selectedAccountId = accountId;
        console.log('Selected account:', accountId);
    }
};

function updatePagination(data) {
    totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = Math.min(start + ITEMS_PER_PAGE, data.length);
    
    document.getElementById('showing-start').textContent = start + 1;
    document.getElementById('showing-end').textContent = end;
    document.getElementById('total-items').textContent = data.length;
    
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages;
    
    return data.slice(start, end);
}

function showColumnMappingStep(data) {
    // Hide step 1, show step 2
    document.getElementById('step-1').style.display = 'none';
    document.getElementById('step-2').style.display = 'flex';

    // Get the preview table and column selects
    const previewTable = document.getElementById('preview-table');
    const dateColumn = document.getElementById('date-column');
    const amountColumn = document.getElementById('amount-column');
    const descriptionColumn = document.getElementById('description-column');

    // Clear previous options
    dateColumn.innerHTML = '<option value="">Select column...</option>';
    amountColumn.innerHTML = '<option value="">Select column...</option>';
    descriptionColumn.innerHTML = '<option value="">Select column...</option>';

    // Get column headers from the first row
    const headers = Object.keys(data[0] || {});

    // Initialize table header row
    let headerRow = '<tr>';
    
    // Create table headers with fixed width
    headers.forEach(header => {
        headerRow += `<th style="min-width: 150px">${header}</th>`;
    });
    headerRow += '</tr>';

    // Create table body (show first 5 rows)
    let bodyRows = data.slice(0, 5).map(row => {
        let tr = '<tr>';
        headers.forEach(header => {
            tr += `<td style="min-width: 150px">${row[header] || ''}</td>`;
        });
        return tr + '</tr>';
    }).join('');

    // Set table HTML
    previewTable.innerHTML = headerRow + bodyRows;

    // Common column patterns for different banks
    const datePatterns = /date|posted|transaction/i;
    const amountPatterns = /amount|debit|credit|withdrawal|deposit/i;
    const descriptionPatterns = /desc|payee|memo|transaction|merchant/i;

    // Add highlighting functionality
    const selects = document.querySelectorAll('.mapping-field select');
    selects.forEach(select => {
        select.addEventListener('change', (e) => {
            const headers = Array.from(previewTable.querySelectorAll('th'));
            const selectedHeader = e.target.value;
            const columnIndex = headers.findIndex(th => th.textContent === selectedHeader);
            highlightColumn(columnIndex);
        });
    });

    // Populate column selects with all headers
    headers.forEach(header => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;
        
        const clonedOption = option.cloneNode(true);
        const clonedOption2 = option.cloneNode(true);
        const clonedOption3 = option.cloneNode(true);

        // Add to appropriate select based on patterns
        if (datePatterns.test(header)) {
            dateColumn.appendChild(clonedOption);
            if (header.toLowerCase().includes('transaction')) {
                dateColumn.value = header; // Prefer transaction date
            }
        }
        
        if (amountPatterns.test(header)) {
            amountColumn.appendChild(clonedOption2);
            // If we find separate debit/credit columns, create a special value
            if (header.toLowerCase().includes('debit') || header.toLowerCase().includes('credit')) {
                const specialOption = document.createElement('option');
                specialOption.value = 'DEBIT_CREDIT_SPLIT';
                specialOption.textContent = '(Use Debit/Credit Columns)';
                amountColumn.insertBefore(specialOption, amountColumn.firstChild);
                amountColumn.value = 'DEBIT_CREDIT_SPLIT';
            }
        }
        
        if (descriptionPatterns.test(header)) {
            descriptionColumn.appendChild(clonedOption3);
        }

        // If no pattern match, add to all selects as a fallback
        if (!datePatterns.test(header) && 
            !amountPatterns.test(header) && 
            !descriptionPatterns.test(header)) {
            dateColumn.appendChild(option);
            amountColumn.appendChild(option.cloneNode(true));
            descriptionColumn.appendChild(option.cloneNode(true));
        }
    });

    // Show next/back buttons
    document.getElementById('prev-step').style.display = 'block';
    document.getElementById('next-step').style.display = 'block';
}

function updatePreviewList(transactions, duplicates, potentialMatches) {
    const previewHeader = `
        <div class="preview-header">
            <div class="import-legend">
                <div class="legend-item">
                    <div class="legend-color duplicate"></div>
                    <span>Exact Duplicates (will be skipped)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color potential"></div>
                    <span>Potential Duplicates (review needed)</span>
                </div>
            </div>
            <div class="preview-instructions">
                <i class="fas fa-info-circle"></i>
                <span>
                    Review transactions below. Uncheck items you don't want to import. 
                    Mark recurring items that should be set up as recurring transactions.
                </span>
            </div>
        </div>
    `;

    const previewList = document.getElementById('preview-list');
    const paginatedData = updatePagination(transactions);

    previewList.innerHTML = previewHeader + paginatedData.map(tx => {
        const isDuplicate = duplicates.some(dup => 
            dup.date === tx.date && 
            Math.abs(dup.amount - tx.amount) < 0.01 && 
            dup.description.toLowerCase().trim() === tx.description.toLowerCase().trim()
        );
        
        const potentialMatch = potentialMatches.find(match => 
            match.date === tx.date || 
            (Math.abs(match.amount - tx.amount) < 0.01 && 
             match.description === tx.description)
        );

        // Mark transaction as duplicate
        if (isDuplicate) {
            tx.isDuplicate = true;
            tx.skipImport = true; // Also set skipImport flag
        }

        return `
            <div class="preview-item ${isDuplicate ? 'duplicate' : potentialMatch ? 'potential-match' : ''}">
                <div class="preview-checkbox">
                    <input type="checkbox" 
                           class="import-checkbox" 
                           ${isDuplicate ? 'disabled checked' : 'checked'}>
                </div>
                <div class="preview-date">${tx.date}</div>
                <div class="preview-amount ${tx.type === 'expense' ? 'negative' : 'positive'}">
                    ${formatCurrency(tx.amount)}
                </div>
                <div class="preview-description">
                    <div>${tx.description}</div>
                    ${tx.category_id ? `<div class="category-tag">${capitalizeFirstLetter(tx.categoryName || 'Uncategorized')}</div>` : ''}
                </div>
                <div class="preview-recurring">
                    <label class="recurring-label">
                        <input type="checkbox" 
                               class="recurring-checkbox" 
                               ${tx.isRecurring ? 'checked' : ''}>
                        <span>Recurring Payment</span>
                    </label>
                </div>
                ${potentialMatch ? `
                    <div class="potential-match-info" title="Similar transaction found">
                        <i class="fas fa-exclamation-triangle"></i>
                        <div class="match-details">
                            <strong>Similar transaction found:</strong>
                            <div class="match-details-content">
                                <div>Date: ${potentialMatch.date}</div>
                                <div>Amount: ${formatCurrency(potentialMatch.amount)}</div>
                                <div>Description: ${potentialMatch.description}</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${isDuplicate ? `
                    <div class="potential-match-info" title="Exact duplicate found">
                        <i class="fas fa-ban"></i>
                        <div class="match-details">
                            <strong>Exact duplicate found - will be skipped</strong>
                            <div class="match-details-content">
                                <div>Date: ${tx.date}</div>
                                <div>Amount: ${formatCurrency(tx.amount)}</div>
                                <div>Description: ${tx.description}</div>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    // Add event listeners for checkboxes
    document.querySelectorAll('.import-checkbox').forEach((checkbox, index) => {
        checkbox.addEventListener('change', (e) => {
            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const actualIndex = startIndex + index;
            importer.mappedTransactions[actualIndex].skipImport = !e.target.checked;
        });
    });

    // Add event listeners for recurring checkboxes
    document.querySelectorAll('.recurring-checkbox').forEach((checkbox, index) => {
        checkbox.addEventListener('change', (e) => {
            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const actualIndex = startIndex + index;
            importer.mappedTransactions[actualIndex].isRecurring = e.target.checked;
        });
    });
}

function showStep(stepNumber) {
    // Update step progress
    document.querySelectorAll('.step-item').forEach((item, index) => {
        const step = index + 1;
        item.classList.remove('active', 'completed');
        if (step === stepNumber) {
            item.classList.add('active');
        } else if (step < stepNumber) {
            item.classList.add('completed');
        }
    });

    // Show/hide steps
    document.querySelectorAll('.import-step').forEach((step, index) => {
        step.style.display = index + 1 === stepNumber ? 'flex' : 'none';
    });

    // Show/hide back button
    const prevButton = document.getElementById('prev-step');
    if (prevButton) {
        prevButton.style.display = stepNumber > 1 ? 'flex' : 'none';
    }

    // Update next button text
    const nextButton = document.getElementById('next-step');
    if (nextButton) {
        nextButton.innerHTML = stepNumber === 3 ? 
            'Import <i class="fas fa-check"></i>' : 
            'Next <i class="fas fa-arrow-right"></i>';
    }
}

async function mapTransactions(data, dateCol, amountCol, descriptionCol) {
    // Get all categories first to check their types
    const { data: categories } = await window.databaseApi.fetchCategories();
    const categoryMap = new Map(categories.map(cat => [cat.id, { name: cat.name, type: cat.type }]));

    try {
        console.log('Starting transaction mapping...', {
            totalRows: data.length,
            columns: { dateCol, amountCol, descriptionCol }
        });

        const mappedTransactions = [];

        // Common recurring payment keywords
        const recurringKeywords = [
            'netflix', 'spotify', 'hulu', 'disney+', 'amazon prime',
            'subscription', 'monthly', 'recurring', 'payment', 'bill',
            'insurance', 'mortgage', 'rent', 'loan', 'lease',
            'utility', 'phone', 'internet', 'cable', 'gym'
        ];

        for (let index = 0; index < data.length; index++) {
            const row = data[index];
            
            if (!row || !row[dateCol]) {
                console.warn(`Skipping invalid row ${index + 1}`);
                continue;
            }

            try {
                let amount, importType;

                // Handle DEBIT_CREDIT_SPLIT case
                if (amountCol === 'DEBIT_CREDIT_SPLIT') {
                    if (row['Credits'] && row['Credits'].trim()) {
                        amount = parseFloat(row['Credits'].replace(/[^0-9.-]/g, ''));
                        importType = 'income';
                    } else if (row['Debits'] && row['Debits'].trim()) {
                        amount = parseFloat(row['Debits'].replace(/[^0-9.-]/g, ''));
                        importType = 'expense';
                    } else {
                        console.warn(`No valid amount found in row ${index + 1}`);
                        continue;
                    }
                } else {
                    const rawAmount = String(row[amountCol] || '');
                    const cleanAmount = rawAmount.replace(/[^0-9.-]/g, '');
                    
                    if (!cleanAmount) {
                        console.warn(`Invalid amount format at row ${index + 1}`);
                        continue;
                    }

                    amount = Math.abs(parseFloat(cleanAmount));
                    importType = rawAmount.includes('(') || rawAmount.includes(')') || rawAmount.startsWith('-') ? 'expense' : 'income';
                }

                const dateValue = row[dateCol];
                const date = new Date(dateValue);
                if (isNaN(date.getTime())) {
                    console.warn(`Invalid date at row ${index + 1}: ${dateValue}`);
                    continue;
                }

                // Parse the transaction to get category and suggested type
                const parsedResult = await TransactionParser.parse(
                    `${amount} ${row[descriptionCol]}`
                );

                // Get the description
                const description = row[descriptionCol]?.trim() || 'No description';

                // Determine final type and category
                let finalType = importType;
                let finalCategoryId = null;
                let finalCategoryName = null;

                if (parsedResult?.category_id) {
                    const category = categoryMap.get(parsedResult.category_id);
                    // Only use the category if its type matches the import type
                    if (category && category.type === importType) {
                        finalCategoryId = parsedResult.category_id;
                        finalCategoryName = parsedResult.categoryName;
                    } else {
                        console.log(`Category type mismatch - Import: ${importType}, Category: ${category?.type}. Keeping uncategorized.`);
                    }
                }

                // Check if description matches recurring patterns
                const isLikelyRecurring = recurringKeywords.some(keyword => 
                    description.includes(keyword)
                );

                const transaction = {
                    date: new Date(row[dateCol]).toISOString().split('T')[0],
                    amount,
                    description: parsedResult?.description || row[descriptionCol],
                    type: finalType,
                    category_id: finalCategoryId,
                    categoryName: finalCategoryName,
                    isRecurring: isLikelyRecurring,
                    skipImport: false
                };

                mappedTransactions.push(transaction);
            } catch (error) {
                console.error(`Error mapping row ${index + 1}:`, error);
                continue;
            }
        }

        return mappedTransactions;
    } catch (error) {
        console.error('Transaction mapping error:', error);
        return [];
    }
}

function closeImportModal() {
    const modal = document.getElementById('smart-import-modal');
    if (modal) {
        modal.classList.remove('show');
    }
    resetSmartImport();
}

function setLoading(isLoading) {
    const buttons = document.querySelectorAll('#next-step, #prev-step, #trigger-file-upload');
    buttons.forEach(button => {
        button.disabled = isLoading;
    });
    
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }
}

export function initializeSmartImport() {
    importState.reset();
    
    try {
        // Initialize account dropdown
        populateAccountDropdowns().then(() => {
            const accountSelect = document.getElementById('import-account-select');
            if (accountSelect) {
                accountSelect.replaceWith(accountSelect.cloneNode(true));
                const freshAccountSelect = document.getElementById('import-account-select');
                freshAccountSelect.addEventListener('change', (e) => {
                    importState.setSelectedAccount(e.target.value);
                });
            }
        });

        // Reset file input
        const fileInput = document.getElementById('statement-file');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // Show first step, hide others
        document.querySelectorAll('.import-step').forEach((step, index) => {
            step.style.display = index === 0 ? 'flex' : 'none';
        });
        
        // Hide back button initially
        const prevButton = document.getElementById('prev-step');
        if (prevButton) {
            prevButton.style.display = 'none';
        }

        // Initialize event listeners
        initializeEventListeners();
    } catch (err) {
        console.error('Error initializing import modal:', err);
        showError('Failed to initialize import');
    }

    // Add backdrop click handler
    const backdrop = document.querySelector('#smart-import-modal .modal-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                closeImportModal();
            }
        });
    }
}

function initializeEventListeners() {
    // Pagination listeners
    document.getElementById('prev-page')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updatePreviewList(importer.mappedTransactions, importer.duplicates || [], importer.potentialMatches || []);
        }
    });

    document.getElementById('next-page')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            updatePreviewList(importer.mappedTransactions, importer.duplicates || [], importer.potentialMatches || []);
        }
    });

    // Step navigation listeners
    document.getElementById('prev-step')?.addEventListener('click', () => {
        const currentStep = document.querySelector('.import-step:not([style*="display: none"])');
        const stepNumber = parseInt(currentStep.id.split('-')[1]);
        if (stepNumber > 1) {
            showStep(stepNumber - 1);
        }
    });

    document.getElementById('next-step')?.addEventListener('click', async () => {
        const currentStep = document.querySelector('.import-step:not([style*="display: none"])');
        const stepNumber = parseInt(currentStep.id.split('-')[1]);
        
        if (stepNumber === 1) {
            // Validate account and file selection
            if (!importState.selectedAccountId) {
                showError('Please select an account');
                return;
            }
            if (!importer.parsedData) {
                showError('Please upload a file first');
                return;
            }
            showStep(2);
        } else if (stepNumber === 2) {
            // Validate column mapping
            const dateCol = document.getElementById('date-column').value;
            const amountCol = document.getElementById('amount-column').value;
            const descriptionCol = document.getElementById('description-column').value;
            
            if (!dateCol || !amountCol || !descriptionCol) {
                showError('Please map all required columns');
                return;
            }
    
            try {
                // Map transactions and check for duplicates
                importer.mappedTransactions = await mapTransactions(importer.parsedData, dateCol, amountCol, descriptionCol);
                const duplicateResult = await importer.detectDuplicates(importer.mappedTransactions);
                
                if (duplicateResult.error) {
                    throw new Error(duplicateResult.error);
                }
    
                const duplicates = duplicateResult.duplicates || [];
                const potentialMatches = duplicateResult.potentialMatches || [];
                
                // Store duplicates and potential matches
                importer.duplicates = duplicates;
                importer.potentialMatches = potentialMatches;
                
                // Update stats
                document.getElementById('total-tx').textContent = importer.mappedTransactions.length;
                document.getElementById('new-tx').textContent = 
                    importer.mappedTransactions.length - duplicates.length;
                document.getElementById('duplicate-tx').textContent = duplicates.length;
                
                // Update preview list with mapped transactions
                updatePreviewList(importer.mappedTransactions, duplicates, potentialMatches);
                
                // Show review step
                currentStep.style.display = 'none';
                document.getElementById('step-3').style.display = 'flex';
            } catch (error) {
                console.error('Error in duplicate detection:', error);
                showError(`Failed to process transactions: ${error.message}`);
                return;
            }
            showStep(3);
        } else if (stepNumber === 3) {
            try {
                if (!importState.selectedAccountId) {
                    throw new Error('Please select an account');
                }

                // Filter out skipped and duplicate transactions
                const allTransactionsToImport = importer.mappedTransactions.filter(tx => 
                    !tx.skipImport && !tx.isDuplicate
                ).map(tx => ({
                    ...tx,
                    account_id: importState.selectedAccountId,
                    // Keep isRecurring flag from the checkbox state
                    isRecurring: tx.isRecurring
                }));

                console.log('All transactions to import:', allTransactionsToImport);

                // Import all transactions (both regular and recurring)
                const result = await importer.importTransactions(
                    allTransactionsToImport,
                    importState.selectedAccountId
                );

                console.log('Import result:', result);

                if (result.data) {
                    const successMsg = [];
                    if (result.data.success?.length > 0) {
                        successMsg.push(`${result.data.success.length} transactions`);
                    }
                    if (result.data.recurring?.length > 0) {
                        successMsg.push(`${result.data.recurring.length} recurring transactions`);
                        // Explicitly trigger recurring update
                        window.dispatchEvent(new CustomEvent('recurring-updated'));
                    }
                    
                    showSuccess(`Successfully imported ${successMsg.join(' and ')}`);
                    
                    // Close and reset modal
                    closeImportModal();

                    // Refresh all data including recurring
                    refreshData({
                        all: true
                    });
                }
            } catch (error) {
                console.error('Error during import:', error);
                showError(`Import failed: ${error.message}`);
                return;
            }
        }
    });

    // File upload handlers
    initializeFileUploadHandlers();

    // Modal close handler
    document.getElementById('close-smart-import')?.addEventListener('click', () => {
        closeImportModal();
        resetSmartImport();
    });

    document.querySelectorAll('.potential-match-info').forEach(info => {
        info.addEventListener('mouseenter', (e) => {
            const tooltip = info.querySelector('.match-details');
            if (!tooltip) return;

            const rect = info.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const tooltipHeight = tooltip.offsetHeight;
            
            // Show tooltip
            tooltip.style.display = 'block';
            
            // Check if showing below would overflow viewport
            if (rect.bottom + tooltipHeight > viewportHeight) {
                // Position above
                tooltip.style.bottom = '100%';
                tooltip.style.top = 'auto';
                tooltip.classList.add('tooltip-above');
            } else {
                // Position below
                tooltip.style.top = '100%';
                tooltip.style.bottom = 'auto';
                tooltip.classList.remove('tooltip-above');
            }

            // Center horizontally
            tooltip.style.left = '50%';
        });

        info.addEventListener('mouseleave', (e) => {
            const tooltip = info.querySelector('.match-details');
            if (tooltip) {
                tooltip.style.display = 'none';
            }
        });
    });
}

function initializeFileUploadHandlers() {
    const fileInput = document.getElementById('statement-file');
    const uploadButton = document.getElementById('trigger-file-upload');
    
    // Remove any existing listeners
    const newFileInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newFileInput, fileInput);
    
    // Add debounce flag and timeout
    let isProcessing = false;
    let processingTimeout;

    uploadButton?.addEventListener('click', () => {
        // Prevent new file selection if currently processing
        if (isProcessing) {
            showError('Please wait for current file to finish processing');
            return;
        }

        const accountId = document.getElementById('import-account-select')?.value;
        if (!accountId) {
            showError('Please select an account first');
            return;
        }
        newFileInput.click();
    });

    newFileInput?.addEventListener('change', async (e) => {
        e.preventDefault();
        
        // Prevent processing if already handling a file
        if (isProcessing) {
            newFileInput.value = '';
            return;
        }
        
        // Set processing flag
        isProcessing = true;
        
        // Clear any existing timeout
        if (processingTimeout) {
            clearTimeout(processingTimeout);
        }
        
        // Check if account is selected first
        const accountId = document.getElementById('import-account-select')?.value;
        if (!accountId) {
            showError('Please select an account first');
            newFileInput.value = '';
            return;
        }
        
        const file = e.target.files[0];
        if (!file) {
            showError('Please select a file');
            return;
        }

        const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/json'];
        if (!allowedTypes.includes(file.type)) {
            showError('Invalid file type. Please upload a CSV or Excel file');
            newFileInput.value = '';
            return;
        }

        // Set processing flag
        newFileInput.dataset.processing = 'true';
        
        // Disable inputs while processing
        if (uploadButton) uploadButton.disabled = true;
        
        document.getElementById('file-name').textContent = file.name;
        
        try {
            const parsedData = await importer.parseFile(file);
            if (!parsedData?.length) {
                throw new Error('No valid data found in file');
            }
            importer.parsedData = parsedData;
            showColumnMappingStep(parsedData);
        } catch (error) {
            console.error('File parsing error:', error);
            showError(`Failed to parse file: ${error.message}`);
            document.getElementById('file-name').textContent = '';
        } finally {
            // Set a timeout before allowing new file selection
            processingTimeout = setTimeout(() => {
                isProcessing = false;
            }, 2000); // 2 second debounce

            // Re-enable inputs
            if (uploadButton) uploadButton.disabled = false;
            newFileInput.value = '';
        }
    });
}

function highlightColumn(columnIndex) {
    const table = document.getElementById('preview-table');
    // Remove existing highlights
    table.querySelectorAll('.highlight-column').forEach(cell => {
        cell.classList.remove('highlight-column');
    });
    
    // Add highlight to selected column
    if (columnIndex !== null) {
        table.querySelectorAll(`tr td:nth-child(${columnIndex + 1})`).forEach(cell => {
            cell.classList.add('highlight-column');
        });
    }
}

function resetSmartImport() {
    // Reset import state
    importState.reset();
    
    // Reinitialize file upload handlers
    initializeFileUploadHandlers();
    
    // Reset file name display
    const fileName = document.getElementById('file-name');
    if (fileName) {
        fileName.textContent = 'No file selected';
    }
    
    // Reset all steps visibility
    document.querySelectorAll('.import-step').forEach((step, index) => {
        step.style.display = index === 0 ? 'flex' : 'none';
    });
    
    // Reset step indicators
    document.querySelectorAll('.step-item').forEach((item, index) => {
        item.classList.toggle('active', index === 0);
        item.classList.remove('completed');
    });
    
    // Reset preview list
    const previewList = document.getElementById('preview-list');
    if (previewList) {
        previewList.innerHTML = '';
    }
    
    // Reset column mappings
    ['date-column', 'amount-column', 'description-column'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = '<option value="">Select column...</option>';
        }
    });
    
    // Reset stats
    ['total-tx', 'new-tx', 'duplicate-tx'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '0';
        }
    });

    // Reset navigation buttons
    const prevButton = document.getElementById('prev-step');
    if (prevButton) {
        prevButton.style.display = 'none';
    }
    
    // Reset pagination
    currentPage = 1;
    totalPages = 1;
}
