

async function handleExport() {
    const { filePath } = await window.electronAPI.showSaveDialog({
        title: 'Export Database',
        defaultPath: 'fyenance.db',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });
  
    if (filePath) {
        const { success, error } = await window.databaseApi.exportDatabase(filePath);
        if (success) {
            alert('Database exported successfully!');
        } else {
            console.error('Error exporting database:', error);
        }
    }
  }
  
  async function handleImport() {
    const { filePaths } = await window.electronAPI.showOpenDialog({
        title: 'Import Database',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        properties: ['openFile']
    });
  
    if (filePaths && filePaths[0]) {
        try {
            const { success, error } = await window.databaseApi.importDatabase(filePaths[0]);
            if (success) {
                alert('Database imported successfully! The application will now restart.');
                window.electronAPI.relaunchApp();
            } else {
                console.error('Error importing database:', error);
                alert(`Error importing database: ${error.message || error}`);
            }
        } catch (err) {
            console.error('Unexpected error during import:', err);
            alert(`Unexpected error during import: ${err.message || err}`);
        }
    }
  }
  
  document.getElementById('export-btn').addEventListener('click', handleExport);
  document.getElementById('import-btn').addEventListener('click', handleImport);
  
  // Add this function to handle CSV export
async function handleCSVExport() {
    try {
        const { filePaths, canceled } = await window.electronAPI.showFolderDialog();
        
        if (canceled || !filePaths[0]) return;
  
        const { success, error } = await window.databaseApi.exportCSV(filePaths[0]);
        
        if (success) {
            alert('Data exported successfully to CSV files!');
        } else {
            console.error('Error exporting CSV:', error);
            alert('Failed to export CSV files. Please check the console for details.');
        }
    } catch (error) {
        console.error('CSV export error:', error);
        alert('An error occurred while exporting CSV files.');
    }
  }
  
  // Add event listener for the CSV export button
  document.getElementById('export-csv-btn').addEventListener('click', handleCSVExport);
  