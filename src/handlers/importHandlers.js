const { PDFExtract } = require('pdf.js-extract');
const Papa = require('papaparse');
const { safeIpcHandle } = require('../core/ipcSafety');

function setupImportHandlers(database) {
  safeIpcHandle('parse:pdf', async (event, buffer) => {
    const pdfExtract = new PDFExtract();
    try {
      const data = await pdfExtract.extractBuffer(buffer);
      const transactions = structurePDFData(data);
      return { data: transactions, error: null };
    } catch (error) {
      console.error('PDF parsing error:', error);
      return { data: null, error: error.message };
    }
  });

  function structurePDFData(data) {
    const transactions = [];
    let currentTransaction = null;
    
    data.pages.forEach(page => {
      page.content.sort((a, b) => a.y - b.y || a.x - b.x).forEach(item => {
        const text = item.str.trim();
        
        const datePattern = /\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/;
        const amountPattern = /[$€£]?\s*-?\d+[,.]\d{2}/;
        
        if (datePattern.test(text)) {
          if (currentTransaction) {
            transactions.push(currentTransaction);
          }
          currentTransaction = { date: text };
        } else if (amountPattern.test(text)) {
          if (currentTransaction) {
            currentTransaction.amount = parseFloat(text.replace(/[$€£,]/g, ''));
          }
        } else if (currentTransaction) {
          currentTransaction.description = currentTransaction.description 
            ? `${currentTransaction.description} ${text}`
            : text;
        }
      });
    });

    if (currentTransaction) {
      transactions.push(currentTransaction);
    }

    return transactions;
  }

  safeIpcHandle('parse:csv', async (event, text) => {
    try {
      return new Promise((resolve) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
          transform: (value) => value.trim(),
          complete: (results) => {
            if (results.errors.length > 0) {
              resolve({ data: null, error: results.errors[0].message });
            } else {
              resolve({ data: results.data, error: null });
            }
          },
          error: (error) => resolve({ data: null, error: error.message })
        });
      });
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  safeIpcHandle('import:bulkTransactions', async (event, { transactions, accountId }) => {
    try {
      const results = {
        success: [],
        failed: [],
        recurring: []
      };

      for (const tx of transactions) {
        try {
          if (tx.isRecurring) {
            const date = new Date(tx.date);
            
            const recurringTx = {
              account_id: parseInt(accountId, 10),
              name: tx.description.substring(0, 100),
              amount: Math.abs(parseFloat(tx.amount)),
              type: tx.type || (parseFloat(tx.amount) >= 0 ? 'income' : 'expense'),
              category_id: tx.category_id || null,
              start_date: tx.date,
              description: tx.description || '',
              is_active: 1,
              frequency: 'monthly'
            };

            const result = database.addRecurring(recurringTx);
            if (result.lastInsertRowid) {
              results.recurring.push({ ...tx, id: result.lastInsertRowid });
            } else {
              throw new Error('Failed to add recurring transaction');
            }
          } else {
            const result = database.addTransaction({
              account_id: parseInt(accountId, 10),
              type: tx.type || (parseFloat(tx.amount) >= 0 ? 'income' : 'expense'),
              amount: Math.abs(parseFloat(tx.amount)),
              date: tx.date,
              description: tx.description || '',
              category_id: tx.category_id || null
            });
            results.success.push({ ...tx, id: result.lastInsertRowid });
          }
        } catch (err) {
          results.failed.push({ transaction: tx, error: err.message });
        }
      }

      return { 
        data: results, 
        error: null,
        needsRefresh: results.success.length > 0 || results.recurring.length > 0
      };
    } catch (error) {
      return { data: null, error: error.message };
    }
  });

  // src/handlers/importHandlers.js
safeIpcHandle('import:detectDuplicates', async (event, transactions) => {
    try {
        const existing = database.getTransactions();
        const recurring = database.getRecurring();
        console.log('Checking transactions:', transactions);
        
        const duplicates = transactions.filter(newTx => {
            // Check against existing transactions
            const isTransactionDuplicate = existing.some(existingTx => {
                const newDate = new Date(newTx.date).toISOString().split('T')[0];
                const existingDate = new Date(existingTx.date).toISOString().split('T')[0];
                const dateMatch = newDate === existingDate;
                
                const newAmount = Math.abs(parseFloat(newTx.amount));
                const existingAmount = Math.abs(parseFloat(existingTx.amount));
                const amountMatch = Math.abs(existingAmount - newAmount) < 0.01;
                
                const cleanNewDesc = newTx.description.toLowerCase().trim();
                const cleanExistingDesc = existingTx.description.toLowerCase().trim();
                const descriptionMatch = cleanNewDesc === cleanExistingDesc;

                return dateMatch && amountMatch && descriptionMatch;
            });

            // Check against recurring transactions
            const isRecurringDuplicate = recurring.some(recurringTx => {
                const newAmount = Math.abs(parseFloat(newTx.amount));
                const recurringAmount = Math.abs(parseFloat(recurringTx.amount));
                const amountMatch = Math.abs(recurringAmount - newAmount) < 0.01;
                
                const cleanNewDesc = newTx.description.toLowerCase().trim();
                const cleanRecurringDesc = (recurringTx.name || recurringTx.description || '').toLowerCase().trim();
                const descriptionMatch = cleanNewDesc === cleanRecurringDesc;

                // For recurring, we only check amount and description match
                // since the date will be different (it's a recurring payment)
                return amountMatch && descriptionMatch;
            });

            return isTransactionDuplicate || isRecurringDuplicate;
        });

        // Potential matches logic - now including recurring
        const potentialMatches = transactions.filter(newTx => {
            if (duplicates.includes(newTx)) return false;

            // Check against existing transactions
            const transactionMatch = existing.some(existingTx => {
                const newDate = new Date(newTx.date);
                const existingDate = new Date(existingTx.date);
                const daysDifference = Math.abs(newDate - existingDate) / (1000 * 60 * 60 * 24);
                
                const newAmount = Math.abs(parseFloat(newTx.amount));
                const existingAmount = Math.abs(parseFloat(existingTx.amount));
                const amountMatch = Math.abs(existingAmount - newAmount) < 0.01;
                
                const cleanNewDesc = newTx.description.toLowerCase().trim();
                const cleanExistingDesc = existingTx.description.toLowerCase().trim();
                const exactDescMatch = cleanNewDesc === cleanExistingDesc;

                return amountMatch && (
                    (exactDescMatch && daysDifference <= 3) ||
                    (daysDifference <= 1 && (cleanNewDesc.includes(cleanExistingDesc) || cleanExistingDesc.includes(cleanNewDesc)))
                );
            });

            // Check against recurring transactions
            const recurringMatch = recurring.some(recurringTx => {
                const newAmount = Math.abs(parseFloat(newTx.amount));
                const recurringAmount = Math.abs(parseFloat(recurringTx.amount));
                const amountMatch = Math.abs(recurringAmount - newAmount) < 0.01;
                
                const cleanNewDesc = newTx.description.toLowerCase().trim();
                const cleanRecurringDesc = (recurringTx.name || recurringTx.description || '').toLowerCase().trim();
                
                // For recurring, we consider it a potential match if:
                // 1. The amounts are similar (within 1 cent)
                // 2. The descriptions have some overlap
                return amountMatch && (
                    cleanNewDesc.includes(cleanRecurringDesc) || 
                    cleanRecurringDesc.includes(cleanNewDesc)
                );
            });

            return transactionMatch || recurringMatch;
        });

        console.log('Found duplicates:', duplicates.length);
        console.log('Found potential matches:', potentialMatches.length);

        return {
            data: { duplicates, potentialMatches },
            error: null
        };
    } catch (error) {
        console.error('Duplicate detection error:', error);
        return { data: null, error: error.message };
    }
});

  // Helper functions for duplicate detection
  function cleanDescription(description) {
    return description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ')        // Normalize whitespace
      .trim();
  }

  function fuzzyMatch(str1, str2) {
    // Make matching more strict
    const threshold = 0.9; // Increase from 0.8 to 0.9
    
    str1 = str1.toLowerCase().trim();
    str2 = str2.toLowerCase().trim();
    
    // Require exact match for short descriptions
    if (str1.length < 10 || str2.length < 10) {
        return str1 === str2;
    }
    
    // For longer descriptions, use fuzzy matching
    if (str1.includes(str2) || str2.includes(str1)) {
        return true;
    }
    
    const distance = levenshteinDistance(str1, str2);
    return (Math.max(str1.length, str2.length) - distance) / Math.max(str1.length, str2.length) >= threshold;
  }

  function levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    return matrix[str2.length][str1.length];
  }
}

module.exports = { setupImportHandlers };