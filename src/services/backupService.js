const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class BackupService {
  constructor(database) {
    this.database = database;
    this.backupsDir = path.join(app.getPath('userData'), 'backups');
    this.maxBackups = 25;
    
    // Ensure backups directory exists
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
  }

  async createBackup(reason = 'auto') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `Fyenance-Backup-${timestamp}-${reason}`;
      const backupPath = path.join(this.backupsDir, `${backupName}.db`);

      // Export current database to backup location
      await this.database.exportDatabase(backupPath);

      // Clean up old backups
      await this.cleanOldBackups();

      return { success: true, path: backupPath };
    } catch (error) {
      console.error('Backup creation failed:', error);
      return { success: false, error: error.message };
    }
  }

  async cleanOldBackups() {
    const backups = await this.getBackups();
    if (backups.length > this.maxBackups) {
      const toDelete = backups
        .sort((a, b) => b.date - a.date)
        .slice(this.maxBackups);

      for (const backup of toDelete) {
        fs.unlinkSync(backup.path);
      }
    }
  }

  async getBackups() {
    try {
      const files = fs.readdirSync(this.backupsDir);
      return files
        .filter(file => file.endsWith('.db'))
        .map(file => {
          const filePath = path.join(this.backupsDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            date: stats.mtime,
            size: stats.size
          };
        })
        .sort((a, b) => b.date - a.date);
    } catch (error) {
      console.error('Error getting backups:', error);
      throw error;
    }
  }

  async restoreBackup(backupPath) {
    try {
      // Create a backup before restoration
      await this.createBackup('pre-restore');
      
      // Use existing import function
      const result = await this.database.importDatabase(backupPath);
      return { success: true };
    } catch (error) {
      console.error('Backup restoration failed:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteBackup(backupPath) {
    try {
        // Debug log the incoming path
        console.log('Attempting to delete backup:', {
            backupPath,
            backupsDir: this.backupsDir,
            exists: fs.existsSync(backupPath),
            dirContents: fs.readdirSync(this.backupsDir)
        });

        // Validate that the backup path is within our backups directory
        const normalizedBackupPath = path.normalize(backupPath);
        const normalizedBackupsDir = path.normalize(this.backupsDir);
        
        console.log('Normalized paths:', {
            normalizedBackupPath,
            normalizedBackupsDir,
            isWithinDir: normalizedBackupPath.startsWith(normalizedBackupsDir)
        });

        if (!normalizedBackupPath.startsWith(normalizedBackupsDir)) {
            return { 
                success: false, 
                error: 'Invalid backup path' 
            };
        }

        if (fs.existsSync(normalizedBackupPath)) {
            fs.unlinkSync(normalizedBackupPath);
            return { success: true };
        }
        
        return { 
            success: false, 
            error: 'Backup file not found',
            debug: {
                originalPath: backupPath,
                normalizedPath: normalizedBackupPath,
                backupsDir: this.backupsDir,
                exists: fs.existsSync(normalizedBackupPath),
                dirContents: fs.readdirSync(this.backupsDir)
            }
        };
    } catch (error) {
        console.error('Error deleting backup:', error);
        return { 
            success: false, 
            error: error.message,
            debug: { backupPath }
        };
    }
  }
}

module.exports = BackupService;