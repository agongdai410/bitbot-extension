// Wait for DOM to be fully loaded before accessing any elements
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const addressBar = document.getElementById('url-input');
  const loadButton = document.getElementById('load-button');
  const viewFrame = document.getElementById('view-frame');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorMessage = document.getElementById('error-message');
  const toggleMobileButton = document.getElementById('toggle-mobile');
  const clearButton = document.getElementById('clear-button');
  const refreshButton = document.getElementById('refresh-button');
  const viewModeIndicator = document.getElementById('view-mode');
  
  // State variables
  let swRegistration = null;
  let isMobileView = false;
  let currentUrl = '';
  
  // Initialize the service worker
  async function initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // Check for existing service worker registration first
        swRegistration = await navigator.serviceWorker.getRegistration();
        
        if (!swRegistration) {
          console.log('No active service worker found, registering new one');
          swRegistration = await navigator.serviceWorker.register('./fetch_service_worker.js');
          console.log('Service Worker registered successfully:', swRegistration.scope);
        } else {
          console.log('Using existing service worker registration:', swRegistration.scope);
        }
        
        // Ensure the service worker is activated
        if (swRegistration.installing) {
          console.log('Service worker installing...');
          // Wait for the service worker to be ready
          const worker = swRegistration.installing;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'activated') {
              console.log('Service worker is now activated');
            }
          });
        } else if (swRegistration.waiting) {
          console.log('Service worker installed, waiting to activate...');
          // Force activation if needed
          swRegistration.waiting.postMessage({type: 'SKIP_WAITING'});
        } else if (swRegistration.active) {
          console.log('Service worker active');
        }
        
        // Listen for messages from the service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          console.log('Message from service worker:', event.data);
          
          if (event.data.type === 'x-handling-info') {
            showNotification(event.data.message);
          } else if (event.data.type === 'page-load-status') {
            handlePageLoadStatus(event.data);
          }
        });
        
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        showError('Service worker registration failed. Some features may not work correctly.');
      }
    } else {
      console.error('Service Workers are not supported in this browser.');
      showError('Service Workers are not supported in this browser. The extension may not work correctly.');
    }
  }
  
  // Function to load a URL in the iframe
  function loadUrl(url) {
    if (!url) {
      showError('Please enter a URL');
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
      // Inform service worker that we're loading a page
      if (swRegistration && swRegistration.active) {
        swRegistration.active.postMessage({
          type: 'loading-page',
          url: url,
          isMobile: isMobileView
        });
      }
      
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
        showError('Loading timed out. The page may be blocked from displaying in iframes.');
      }, 30000); // 30 second timeout
      
      // Handle iframe load event
      viewFrame.onload = () => {
        clearTimeout(loadTimeout);
        showLoading(false);
        
        // Inform service worker that page loaded successfully
        if (swRegistration && swRegistration.active) {
          swRegistration.active.postMessage({
            type: 'page-loaded',
            success: true,
            url: url,
            isMobile: isMobileView
          });
        }
      };
      
      // Handle iframe error event
      viewFrame.onerror = (error) => {
        clearTimeout(loadTimeout);
        showLoading(false);
        showError('Failed to load the page: ' + error.message);
        
        // Inform service worker that page load failed
        if (swRegistration && swRegistration.active) {
          swRegistration.active.postMessage({
            type: 'page-loaded',
            success: false,
            url: url,
            error: error.message,
            isMobile: isMobileView
          });
        }
      };
    } catch (error) {
      showLoading(false);
      showError('Invalid URL or loading error: ' + error.message);
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
  
  // Show error message
  function showError(message) {
    if (errorMessage) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
    }
  }
  
  // Hide error message
  function hideError() {
    if (errorMessage) {
      errorMessage.style.display = 'none';
    }
  }
  
  // Show a temporary notification
  function showNotification(message, duration = 5000) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'notification';
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.left = '50%';
      notification.style.transform = 'translateX(-50%)';
      notification.style.backgroundColor = '#333';
      notification.style.color = 'white';
      notification.style.padding = '10px 20px';
      notification.style.borderRadius = '5px';
      notification.style.zIndex = '1000';
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      document.body.appendChild(notification);
    }
    
    // Set message and show
    notification.textContent = message;
    notification.style.opacity = '1';
    
    // Hide after duration
    setTimeout(() => {
      notification.style.opacity = '0';
    }, duration);
  }

  // Handle page load status messages from service worker
  function handlePageLoadStatus(data) {
    if (!data.success && data.error) {
      showError(`Load error: ${data.error}`);
    }
  }

  // Toggle mobile view
  function toggleMobileView() {
    isMobileView = !isMobileView;
    if (toggleMobileButton) {
      toggleMobileButton.textContent = isMobileView ? '🖥️ Desktop View' : '📱 Mobile View';
    }
    
    // Update view mode indicator
    if (viewModeIndicator) {
      viewModeIndicator.textContent = isMobileView ? 'Mobile' : 'Desktop';
    }
    
    showNotification(`Switched to ${isMobileView ? 'mobile' : 'desktop'} view. Reload the page to apply.`);
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
  
  if (toggleMobileButton) {
    toggleMobileButton.addEventListener('click', toggleMobileView);
  }
  
  if (clearButton) {
    clearButton.addEventListener('click', clearAddressBar);
  }
  
  if (refreshButton) {
    refreshButton.addEventListener('click', refreshPage);
  }
  
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