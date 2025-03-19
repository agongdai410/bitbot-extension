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
  
  // Flag to track if a load is in progress to prevent multiple concurrent loads
  let isLoadingInProgress = false;
  // Max retries for loading
  const MAX_RETRIES = 3;
  
  // Function to toggle between iframe sources
  async function toggleIframeSource(showX) {
    // Prevent multiple toggles at once
    if (isLoadingInProgress) {
      return;
    }
    
    isLoadingInProgress = true;
    
    // Show loading indicator
    showLoading(true);
    
    try {
      if (showX) {
        // Update button states
        btnX.classList.add('active');
        btnPmgn.classList.remove('active');
        
        // Pre-notify service worker about the upcoming navigation to ensure rules are activated
        await notifyServiceWorkerAndWait(X_URL);
        
        // Change iframe source
        loadUrlWithRetry(X_URL, 'Loading X.com');
      } else {
        // Update button states
        btnPmgn.classList.add('active');
        btnX.classList.remove('active');
        
        // Load gmgn.ai with retry
        await notifyServiceWorkerAndWait(PMGN_URL);
        loadUrlWithRetry(PMGN_URL, 'Loading pmgn.ai');
      }
    } catch (error) {
      console.error('Error toggling iframe source:', error);
      showNotification('Error switching content', true);
      showLoading(false);
      isLoadingInProgress = false;
    }
  }
  
  // Function to load URL with retry mechanism
  async function loadUrlWithRetry(url, loadingMessage, attempt = 1) {
    showNotification(loadingMessage, false);
    
    // Add cache buster to avoid caching issues
    const cacheBuster = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    const urlWithCacheBuster = `${url}${separator}_cb=${cacheBuster}`;
    
    // Set iframe source
    contentIframe.src = urlWithCacheBuster;
    
    // Set up load event for this attempt
    const loadPromise = new Promise((resolve, reject) => {
      const loadTimeout = setTimeout(() => {
        reject(new Error('Loading timed out'));
      }, 15000);
      
      const handleLoad = () => {
        clearTimeout(loadTimeout);
        contentIframe.removeEventListener('load', handleLoad);
        contentIframe.removeEventListener('error', handleError);
        resolve();
      };
      
      const handleError = (event) => {
        clearTimeout(loadTimeout);
        contentIframe.removeEventListener('load', handleLoad);
        contentIframe.removeEventListener('error', handleError);
        reject(new Error('Failed to load iframe'));
      };
      
      contentIframe.addEventListener('load', handleLoad, { once: true });
      contentIframe.addEventListener('error', handleError, { once: true });
    });
    
    try {
      await loadPromise;
      console.log(`Successfully loaded ${url}`);
      showLoading(false);
      isLoadingInProgress = false;
      
      // Apply appropriate handler based on loaded URL
      if (url.includes('x.com')) {
        showNotification('Showing X.com', false);
      } else if (url.includes('gmgn.ai')) {
        showNotification('Showing pmgn.ai', false);
        // Try to bypass Cloudflare
        bypassCloudflare();
      }
    } catch (error) {
      console.warn(`Load attempt ${attempt} for ${url} failed:`, error);
      
      if (attempt < MAX_RETRIES) {
        // Retry with backoff
        const backoffDelay = 500 * attempt; // Incremental backoff
        showNotification(`Retrying... (${attempt}/${MAX_RETRIES})`, false);
        
        // Refresh rules before retrying
        await notifyServiceWorkerAndWait(url);
        
        setTimeout(() => {
          loadUrlWithRetry(url, loadingMessage, attempt + 1);
        }, backoffDelay);
      } else {
        // Max retries reached, show error
        console.error(`Failed to load ${url} after ${MAX_RETRIES} attempts`);
        showNotification(`Failed to load ${url.includes('x.com') ? 'X.com' : 'pmgn.ai'}`, true);
        showLoading(false);
        isLoadingInProgress = false;
      }
    }
  }
  
  // Function to notify service worker and wait for confirmation
  async function notifyServiceWorkerAndWait(url) {
    return new Promise((resolve) => {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        // Create a unique message ID for this request
        const messageId = Date.now().toString();
        
        // Set up one-time listener for response
        const handleMessage = (event) => {
          if (event.data && event.data.type === 'RULES_READY' && event.data.messageId === messageId) {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            resolve();
          }
        };
        
        navigator.serviceWorker.addEventListener('message', handleMessage);
        
        // Send message to service worker
        navigator.serviceWorker.controller.postMessage({
          type: 'PREPARE_URL',
          url: url,
          messageId: messageId
        });
        
        // Resolve after timeout in case service worker doesn't respond
        setTimeout(() => {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
          resolve();
        }, 500);
      } else {
        // No service worker, resolve immediately
        resolve();
      }
    });
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
  
  // Function to notify the service worker about any URL
  function notifyServiceWorker(url) {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'LOAD_URL',
        url: url
      });
    }
  }
  
  // Set up service worker message listener
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('Received message from service worker:', event.data);
    
    if (event.data.type === 'BYPASS_CLOUDFLARE') {
      console.log('Received bypass Cloudflare instruction');
      bypassCloudflare();
    }
  });
  
  // Initialize with a notification
  showNotification('Showing X.com', false);
  
  // Debug message to confirm panel script initialized
  console.log('Panel script initialized');
}); 