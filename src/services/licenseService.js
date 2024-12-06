const crypto = require('crypto');
const axios = require('axios');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class LicenseService {
  constructor() {
    this.licenseFilePath = path.join(app.getPath('userData'), 'license.json');
  }

  generateMachineId() {
    const systemInfo = [
      require('os').hostname(),
      require('os').platform(),
      require('os').cpus()[0].model,
      app.getPath('userData')
    ].join('|');
    
    return crypto
      .createHash('sha256')
      .update(systemInfo)
      .digest('hex');
  }

  async validateLicense(licenseKey) {
    try {
      console.log('Validating license:', licenseKey);

      const response = await axios.post('http://localhost:3000/api/validate-license', {
        licenseKey,
        machineId: this.generateMachineId()
      });

      console.log('Validation response:', response.data);

      if (response.data.valid) {
        this.saveLicense(licenseKey);
        return { valid: true };
      }
      return { valid: false, error: response.data.error || 'Invalid license key' };
    } catch (error) {
      console.error('License validation error:', error);
      return { valid: false, error: 'Failed to validate license' };
    }
  }

  isValidKeyFormat(key) {
    // Format: XXXX-XXXX-XXXX-XXXX
    return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
  }

  saveLicense(licenseKey) {
    try {
      const licenseData = {
        key: licenseKey,
        machineId: this.generateMachineId(),
        activatedAt: new Date().toISOString()
      };
      console.log('Saving license:', licenseData);
      fs.writeFileSync(this.licenseFilePath, JSON.stringify(licenseData));
    } catch (error) {
      console.error('Error saving license:', error);
    }
  }

  getLicenseInfo() {
    try {
      if (fs.existsSync(this.licenseFilePath)) {
        return JSON.parse(fs.readFileSync(this.licenseFilePath));
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async checkLicenseExists() {
    try {
      console.log('Checking license existence...');
      if (fs.existsSync(this.licenseFilePath)) {
        const licenseData = JSON.parse(fs.readFileSync(this.licenseFilePath));
        console.log('Found license data:', licenseData);
        
        try {
          const response = await axios.post('http://localhost:3000/api/validate-license', {
            licenseKey: licenseData.key,
            machineId: this.generateMachineId()
          });
          
          console.log('Server validation response:', response.data);
          
          if (!response.data.valid) {
            console.log('License is no longer valid:', response.data.error);
            return false;
          }
          
          return true;
        } catch (error) {
          console.error('Error validating license with server:', error);
          return false;
        }
      }
      console.log('No license file found');
      return false;
    } catch (error) {
      console.error('Error checking license:', error);
      return false;
    }
  }

  clearLicense() {
    try {
      if (fs.existsSync(this.licenseFilePath)) {
        fs.unlinkSync(this.licenseFilePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error clearing license:', error);
      return false;
    }
  }
}

module.exports = new LicenseService();