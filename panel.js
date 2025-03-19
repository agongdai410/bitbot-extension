// Wait for DOM to be fully loaded before accessing any elements
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const btnX = document.getElementById('btn-x');
  const btnPmgn = document.getElementById('btn-pmgn');
  const contentIframe = document.getElementById('content-iframe');
  const loadingIndicator = document.getElementById('loading-indicator');
  
  // URLs for the iframe sources
  const X_URL = 'https://x.com';
  const PMGN_URL = 'https://gmgn.ai/?chain=sol';
  
  // Function to toggle between iframe sources
  function toggleIframeSource(showX) {
    // Show loading indicator
    showLoading(true);
    
    if (showX) {
      // Update button states
      btnX.classList.add('active');
      btnPmgn.classList.remove('active');
      
      // Change iframe source
      contentIframe.src = X_URL;
      showNotification('Loading X.com', false);
    } else {
      // Update button states
      btnPmgn.classList.add('active');
      btnX.classList.remove('active');
      
      // Change iframe source
      contentIframe.src = PMGN_URL;
      showNotification('Loading pmgn.ai', false);
    }
  }
  
  // Show/hide loading indicator
  function showLoading(show) {
    if (loadingIndicator) {
      loadingIndicator.style.display = show ? 'block' : 'none';
    }
    if (contentIframe) {
      contentIframe.style.opacity = show ? '0.3' : '1';
    }
  }
  
  // Show a temporary notification
  function showNotification(message, error = false, duration = 3000) {
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
  
  // Set up event listeners for the buttons
  if (btnX) {
    btnX.addEventListener('click', () => {
      toggleIframeSource(true);
    });
  }
  
  if (btnPmgn) {
    btnPmgn.addEventListener('click', () => {
      toggleIframeSource(false);
    });
  }
  
  // Handle iframe loading events
  contentIframe.addEventListener('load', () => {
    showLoading(false);
    
    // Show appropriate notification based on current src
    if (contentIframe.src.includes('x.com')) {
      showNotification('Showing X.com', false);
    } else if (contentIframe.src.includes('gmgn.ai')) {
      showNotification('Showing pmgn.ai', false);
    }
  });
  
  // Add error event handler
  contentIframe.addEventListener('error', () => {
    showLoading(false);
    
    // Show appropriate error notification based on current src
    if (contentIframe.src.includes('x.com')) {
      showNotification('Failed to load X.com', true);
    } else if (contentIframe.src.includes('gmgn.ai')) {
      showNotification('Failed to load pmgn.ai', true);
    } else {
      showNotification('Failed to load content', true);
    }
  });
  
  // Initialize with a notification
  showNotification('Showing X.com', false);
  
  // Debug message to confirm panel script initialized
  console.log('Panel script initialized');
}); 