window.apmUtils = {
  loadFromLocalStorage: (key, defaultValue = null) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);  
    }
    return defaultValue;
  },
  saveToLocalStorage: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  },
  removeFromLocalStorage: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing ${key} from localStorage:`, error);
    }
  },
  isXOrTwitterUrl: (url) => {
    return !!url && (url.startsWith('https://x.com') || url.startsWith('https://twitter.com'));
  },
  isGmgnUrl: (url) => {
    return !!url && url.startsWith('https://gmgn.ai');
  },
};