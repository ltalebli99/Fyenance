class StateService {
    constructor() {
      this.subscribers = new Map();
      this.state = {
        currentAccount: 'all',
        currentSection: 'Dashboard',
        isLoading: false,
        hasLicense: false
      };
    }
  
    subscribe(key, callback) {
      if (!this.subscribers.has(key)) {
        this.subscribers.set(key, new Set());
      }
      this.subscribers.get(key).add(callback);
    }
  
    unsubscribe(key, callback) {
      if (this.subscribers.has(key)) {
        this.subscribers.get(key).delete(callback);
      }
    }
  
    setState(key, value) {
      this.state[key] = value;
      if (this.subscribers.has(key)) {
        this.subscribers.get(key).forEach(callback => callback(value));
      }
    }
  
    getState(key) {
      return this.state[key];
    }
  }
  
  export const stateService = new StateService();