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

      const response = await axios.post('https://api.fyenanceapp.com/v1/validate-license', {
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
      return { 
        valid: false, 
        error: 'Internet connection required for initial license activation'
      };
    }
  }

  isValidKeyFormat(key) {
    // Our format: XXXX-XXXX-XXXX-XXXX
    const ourFormat = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    
    // AppSumo format: 8-4-4-4-12 UUID format
    const appSumoFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    return ourFormat.test(key) || appSumoFormat.test(key);
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
        
        const currentMachineId = this.generateMachineId();
        if (licenseData.machineId !== currentMachineId) {
          console.log('Machine ID mismatch');
          return false;
        }

        try {
          const response = await axios.post('https://api.fyenanceapp.com/v1/validate-license', {
            licenseKey: licenseData.key,
            machineId: currentMachineId
          });
          
          console.log('Server validation response:', response.data);
          if (!response.data.valid) {
            console.log('License is no longer valid:', response.data.error);
            return false;
          }
          
          return response.data.valid;
        } catch (error) {
          console.log('Offline mode - using local license validation');
          return true;
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

// Create and export a single instance
const licenseService = new LicenseService();
module.exports = licenseService; 


