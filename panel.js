// Wait for DOM to be fully loaded before accessing any elements
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const addressBar = document.getElementById('url-input');
  const loadButton = document.getElementById('load-button');
  const viewFrame = document.getElementById('view-frame');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorMessage = document.getElementById('error-message');
  const clearButton = document.getElementById('clear-button');
  const refreshButton = document.getElementById('refresh-button');
  
  // Function to load a URL in the iframe
  function loadUrl(url) {
    if (!url) {
      showNotification('Please enter a URL');
      return;
    }
    
    // Ensure URL has protocol
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
      addressBar.value = url;
    }
    
    // Store current URL
    currentUrl = url;
    
    // Show loading indicator
    showLoading(true);
    hideError();
    
    try {
      
      // Special handling for certain URLs
      const urlObj = new URL(url);
      if (urlObj.hostname === 'x.com' || urlObj.hostname === 'www.x.com') {
        showNotification('Loading X.com in enhanced mode...');
      }
      
      // Set the iframe src to load the page
      viewFrame.src = url;
      
      // Update clear button visibility
      if (clearButton) {
        clearButton.style.display = 'flex';
      }
      
      // Set up a timeout for loading
      const loadTimeout = setTimeout(() => {
        showLoading(false);
        showNotification('Loading timed out. The page may be blocked from displaying in iframes.');
      }, 30000); // 30 second timeout
      
      // Handle iframe load event
      viewFrame.onload = () => {
        clearTimeout(loadTimeout);
        showLoading(false);
      };
      
      // Handle iframe error event
      viewFrame.onerror = (error) => {
        clearTimeout(loadTimeout);
        showLoading(false);
        showNotification('Failed to load the page: ' + error.message);
      };
    } catch (error) {
      showLoading(false);
      showNotification('Invalid URL or loading error: ' + error.message);
    }
  }
  
  // Show/hide loading indicator
  function showLoading(show) {
    if (loadingIndicator) {
      loadingIndicator.style.display = show ? 'block' : 'none';
    }
    if (viewFrame) {
      viewFrame.style.opacity = show ? '0.3' : '1';
    }
  }
  
  // Hide error message
  function hideError() {
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
  }
  
  // Show a temporary notification
  function showNotification(message, error = true, duration = 3000) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
      throw new Error('Notification element not found');
    }
    
    notification.style.backgroundColor = error ? '#ff0000' : '#333';
    // Set message and show
    notification.textContent = message;
    notification.style.opacity = '1';
    
    // Hide after duration
    setTimeout(() => {
      notification.style.opacity = '0';
    }, duration);
  }
  
  // Function to clear the address bar
  function clearAddressBar() {
    if (addressBar) {
      addressBar.value = '';
      addressBar.focus();
      if (clearButton) {
        clearButton.style.display = 'none';
      }
    }
  }
  
  // Function to refresh the current page
  function refreshPage() {
    if (currentUrl) {
      loadUrl(currentUrl);
    } else if (addressBar && addressBar.value) {
      loadUrl(addressBar.value);
    }
  }
  
  // Set up event listeners
  if (loadButton) {
    loadButton.addEventListener('click', () => {
      loadUrl(addressBar.value);
    });
  }
  
  if (addressBar) {
    addressBar.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        loadUrl(addressBar.value);
      }
    });
    
    // Show/hide clear button based on input
    addressBar.addEventListener('input', () => {
      if (clearButton) {
        clearButton.style.display = addressBar.value ? 'flex' : 'none';
      }
    });
    
    // Initialize clear button visibility
    if (clearButton && addressBar.value) {
      clearButton.style.display = 'flex';
    } else if (clearButton) {
      clearButton.style.display = 'none';
    }
  }
  
  if (clearButton) {
    clearButton.addEventListener('click', clearAddressBar);
  }
  
  if (refreshButton) {
    refreshButton.addEventListener('click', refreshPage);
  }
  
  // Add visibility change and unload listeners to detect when panel closes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      notifyPanelClosed();
    } else if (document.visibilityState === 'visible') {
      notifyPanelOpened();
    }
  });
  
  window.addEventListener('beforeunload', () => {
    notifyPanelClosed();
  });
  
  // Initialize on load
  initServiceWorker();
  
  // Focus address bar by default
  if (addressBar) {
    addressBar.focus();
  }
  
  // Pre-load default URL if present in address bar
  if (addressBar && addressBar.value) {
    loadUrl(addressBar.value);
  }
  
  // Debug message to confirm panel script initialized
  console.log('Panel script initialized');
}); 