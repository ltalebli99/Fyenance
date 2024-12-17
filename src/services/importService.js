export class StatementImporter {
    constructor() {
        this.currentStep = 1;
        this.parsedData = null;
        this.mappedColumns = null;
        this.mappedTransactions = null;
        this.existingTransactions = null;
    }

    async parseFile(file) {
        console.log('ImportService.parseFile called with:', file.type, file.name);
        try {
            if (!file) {
                throw new Error('No file provided');
            }

            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                const buffer = await file.arrayBuffer();
                const { data, error } = await window.importApi.parsePDF(buffer);
                if (error) throw new Error(error);
                if (!data || !Array.isArray(data)) {
                    throw new Error('Invalid PDF data format');
                }
                return data;
            } else if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
                const text = await file.text();
                console.log('CSV content preview:', text.substring(0, 200));
                
                const { data, error } = await window.importApi.parseCSV(text);
                if (error) throw new Error(error);
                if (!data || !Array.isArray(data) || data.length === 0) {
                    throw new Error('No valid data found in the CSV file');
                }
                return data;
            } else {
                throw new Error('Unsupported file type. Please use CSV or PDF files.');
            }
        } catch (error) {
            console.error('ParseFile error:', error);
            throw error;
        }
    }

    async detectDuplicates(transactions) {
        // Ensure transactions are properly formatted before sending
        const formattedTransactions = transactions.map(tx => ({
            date: new Date(tx.date).toISOString().split('T')[0], // Normalize date format
            amount: Math.abs(parseFloat(tx.amount)), // Normalize amount
            description: tx.description.trim(), // Clean description
            type: tx.type // Use the original type from import
        }));

        const { data, error } = await window.importApi.detectDuplicates(formattedTransactions);
        if (error) throw new Error(error);
        return data;
    }

    async importTransactions(transactions, accountId) {
        if (!accountId) {
            return { data: null, error: 'Please select an account' };
        }
        
        try {
            const { data, error, needsRefresh } = await window.importApi.bulkImport({ 
                transactions, 
                accountId: parseInt(accountId, 10)
            });
            
            if (error) {
                throw new Error(error);
            }
            
            return { 
                data, 
                error: null,
                needsRefresh: {
                    transactions: data.success.length > 0,
                    recurring: data.recurring.length > 0
                }
            };
        } catch (error) {
            console.error('Import error:', error);
            return { data: null, error: error.message };
        }
    }
}