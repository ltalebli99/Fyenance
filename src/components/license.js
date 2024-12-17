export function setupLicenseHandlers() {
    const activateBtn = document.getElementById('activate-btn');
    const licenseInput = document.getElementById('license-key-input');
    const purchaseLink = document.getElementById('purchase-link');
  
    if (activateBtn) {
      activateBtn.addEventListener('click', async () => {
        const licenseKey = licenseInput.value.trim().toUpperCase();
        if (!licenseKey) {
          showLicenseMessage('Please enter a license key', 'error');
          return;
        }
    
        try {
          activateBtn.disabled = true;
          activateBtn.textContent = 'Validating...';
          
          const result = await window.licenseApi.validateLicense(licenseKey);
          
          if (result.valid) {
            showLicenseMessage('License activated successfully!', 'success');
            setTimeout(() => {
              document.getElementById('license-overlay').style.display = 'none';
              // Force a complete page reload
              window.location.reload();
            }, 1500);
          } else {
            showLicenseMessage(result.error || 'Invalid license key', 'error');
          }
        } catch (error) {
          showLicenseMessage('Error validating license', 'error');
        } finally {
          activateBtn.disabled = false;
          activateBtn.textContent = 'Activate License';
        }
      });
    }
  
    if (purchaseLink) {
      purchaseLink.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('Purchase link clicked');
        
        // Debug logs
        console.log('electronAPI available:', !!window.electronAPI);
        console.log('openExternal available:', !!window.electronAPI?.openExternal);
        
        try {
          await window.electronAPI.openExternal('https://www.fyenanceapp.com/buy');
          console.log('Link opened successfully');
        } catch (error) {
          console.error('Error opening link:', error);
        }
      });
    }
  
    // Format license key input
    if (licenseInput) {
      licenseInput.addEventListener('input', (e) => {
          // Remove all non-alphanumeric and non-hyphen characters
          let value = e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
          
          // Check if it's a UUID-style key (AppSumo format)
          if (value.length > 16) {
              // UUID format (8-4-4-4-12)
              const parts = [];
              const pattern = [8, 4, 4, 4, 12]; // UUID segment lengths
              let pos = 0;
              
              pattern.forEach(length => {
                  if (pos < value.length) {
                      parts.push(value.slice(pos, pos + length));
                      pos += length;
                  }
              });
              
              e.target.value = parts.join('-');
          } else {
              // Standard format (XXXX-XXXX-XXXX-XXXX)
              if (value.length > 16) value = value.slice(0, 16);
              
              const parts = [];
              for (let i = 0; i < value.length; i += 4) {
                  parts.push(value.slice(i, i + 4));
              }
              e.target.value = parts.join('-');
          }
      });
  
      // Add paste event handler
      licenseInput.addEventListener('paste', (e) => {
          e.preventDefault();
          const pastedText = (e.clipboardData || window.clipboardData).getData('text');
          const cleanedText = pastedText.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
          
          // Validate formats
          const isStandardFormat = /^[A-Z0-9]{16}$/.test(cleanedText.replace(/-/g, ''));
          const isUUIDFormat = /^[A-Z0-9]{32}$/.test(cleanedText.replace(/-/g, ''));
          
          if (!isStandardFormat && !isUUIDFormat) {
              licenseInput.value = 'INVALID KEY';
              return;
          }
          
          // Format based on detected type
          if (isUUIDFormat) {
              // UUID format (8-4-4-4-12)
              const value = cleanedText.replace(/-/g, '');
              const parts = [];
              const pattern = [8, 4, 4, 4, 12];
              let pos = 0;
              
              pattern.forEach(length => {
                  if (pos < value.length) {
                      parts.push(value.slice(pos, pos + length));
                      pos += length;
                  }
              });
              
              licenseInput.value = parts.join('-');
          } else {
              // Standard format
              const value = cleanedText.replace(/-/g, '');
              const parts = [];
              for (let i = 0; i < value.length; i += 4) {
                  parts.push(value.slice(i, i + 4));
              }
              licenseInput.value = parts.join('-');
          }
      });
    }
   
  
  
    // Format license key input
    licenseInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase();
      if (value.length > 16) value = value.slice(0, 16);
      
      // Add dashes
      const parts = [];
      for (let i = 0; i < value.length; i += 4) {
        parts.push(value.slice(i, i + 4));
      }
      e.target.value = parts.join('-');
    });
  }
  
  export async function updateLicenseInfo() {
    try {
      console.log('Fetching license info...'); 
      const licenseInfo = await window.licenseApi.getLicenseInfo();
      
      if (!licenseInfo) {
        console.log('No license info found');
        updateUIForInactiveLicense();
        return;
      }

      console.log('Received license info:', licenseInfo);
      updateUIForActiveLicense(licenseInfo);
      
    } catch (error) {
      console.error('Error updating license info:', error);
      updateUIForInactiveLicense();
    }
  }

  function updateUIForActiveLicense(licenseInfo) {
    const statusElement = document.querySelector('.license-status');
    const keyElement = document.getElementById('current-license-key');
    const dateElement = document.getElementById('license-activation-date');
    
    if (statusElement) {
      statusElement.textContent = 'Active';
      statusElement.classList.add('active');
    }
    if (keyElement) keyElement.textContent = licenseInfo.key;
    if (dateElement) {
      const activationDate = new Date(licenseInfo.activatedAt);
      dateElement.textContent = activationDate.toLocaleDateString();
    }
  }

  function updateUIForInactiveLicense() {
    const statusElement = document.querySelector('.license-status');
    if (statusElement) {
      statusElement.textContent = 'Inactive';
      statusElement.classList.remove('active');
    }
  }
  
  export function showLicenseMessage(message, type) {
    const statusMessage = document.getElementById('license-status-message');
    statusMessage.textContent = message;
    statusMessage.className = type;
  }
  
  export async function clearLicense() {
    try {
      await window.licenseApi.clearLicense();
      window.location.reload(); 
    } catch (error) {
      console.error('Failed to clear license:', error);
    }
  }
  
  document.getElementById('clear-license-btn')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear the license? This will require reactivation.')) {
      await clearLicense();
    }
  });
  
  document.getElementById('close-license-btn').addEventListener('click', () => {
    window.electronAPI.closeWindow();
  });