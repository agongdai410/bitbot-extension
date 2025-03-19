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
      
      // Load gmgn.ai directly
      loadGmgnDirect();
    }
  }
  
  // Function to load gmgn.ai directly
  function loadGmgnDirect() {
    showNotification('Loading pmgn.ai', false);
    
    // Notify service worker first to prepare for gmgn.ai loading
    notifyServiceWorker(PMGN_URL);
    
    // Add cache buster to avoid caching issues
    const cacheBuster = Date.now();
    const urlWithCacheBuster = `${PMGN_URL}&_cb=${cacheBuster}`;
    
    // Set iframe source to gmgn.ai directly
    contentIframe.src = urlWithCacheBuster;
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
  
  // Function to bypass Cloudflare frame-busting
  function bypassCloudflare() {
    try {
      // This function will attempt to execute in the parent context (panel.js)
      // to handle frame-busting prevention for the iframe content
      if (contentIframe.contentWindow) {
        // Create a <script> element to be injected
        const scriptContent = `
          // This script will try to override the iframe content document
          // to prevent frame-busting behaviors
          try {
            // Watch for when the Cloudflare iframe loads
            const observer = new MutationObserver(function(mutations) {
              // Look for Cloudflare verification iframes
              document.querySelectorAll('iframe[src*="challenges"], .cf-turnstile, iframe[src*="turnstile"]').forEach(el => {
                console.log('Found Cloudflare element, making visible', el);
                el.style.display = 'block';
                el.style.visibility = 'visible';
                el.style.opacity = '1';
              });
            });
            
            // Start observing the document with the configured parameters
            observer.observe(document.body, { 
              childList: true, 
              subtree: true,
              attributes: true
            });
            console.log('Cloudflare observer set up');
          } catch(e) {
            console.error('Error in Cloudflare prevention:', e);
          }
        `;
        
        // Wait for iframe to load
        contentIframe.addEventListener('load', () => {
          try {
            // Attempt to execute script in iframe context
            if (contentIframe.contentWindow && contentIframe.contentDocument) {
              const script = document.createElement('script');
              script.textContent = scriptContent;
              contentIframe.contentDocument.head.appendChild(script);
              console.log('Injected Cloudflare bypass script');
            }
          } catch (e) {
            console.log('Could not access iframe content due to CORS (expected):', e);
          }
        }, { once: true });
      }
    } catch (e) {
      console.error('Error in bypassCloudflare:', e);
    }
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
      // Try to bypass Cloudflare
      bypassCloudflare();
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
  
  // Function to notify the service worker when a URL is loaded
  function notifyServiceWorker(url) {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'LOAD_URL',
        url: url
      });
    }
  }
  
  // Add handler for iframe navigation
  contentIframe.addEventListener('load', () => {
    // Notify service worker of loaded URL for possible Cloudflare handling
    notifyServiceWorker(contentIframe.src);
  });
  
  // Set up service worker message listener
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('Received message from service worker:', event.data);
    
    if (event.data.type === 'BYPASS_CLOUDFLARE') {
      console.log('Received bypass Cloudflare instruction');
      bypassCloudflare();
    }
  });
  
  // Debug message to confirm panel script initialized
  console.log('Panel script initialized');
}); 