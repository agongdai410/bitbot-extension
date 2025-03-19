// Wait for DOM to be fully loaded before accessing any elements
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const btnX = document.getElementById('btn-x');
  const btnPmgn = document.getElementById('btn-pmgn');
  const btnRefresh = document.getElementById('btn-refresh');
  const iframeX = document.getElementById('iframe-x');
  const iframeGmgn = document.getElementById('iframe-gmgn');
  const loadingIndicator = document.getElementById('loading-indicator');
  
  // URLs for the iframe sources
  const X_URL = 'https://x.com';
  const PMGN_URL = 'https://gmgn.ai/?chain=sol';
  
  // Flag to track if a load is in progress to prevent multiple concurrent loads
  let isLoadingInProgress = false;
  // Max retries for loading
  const MAX_RETRIES = 3;
  // Track current active iframe
  let currentActiveIframe = 'x';
  
  // Function to toggle between iframes
  async function toggleIframeSource(showX) {
    // No need to toggle if already on the selected iframe
    if ((showX && currentActiveIframe === 'x') ||
        (!showX && currentActiveIframe === 'gmgn')) {
      return;
    }
    
    // Update button states
    if (showX) {
      btnX.classList.add('active');
      btnPmgn.classList.remove('active');
      
      // Show X iframe, hide GMGN iframe
      iframeX.classList.add('active');
      iframeGmgn.classList.remove('active');
      currentActiveIframe = 'x';
      
      // If X iframe hasn't been loaded yet, load it
      if (!iframeX.getAttribute('data-loaded')) {
        await loadIframe(iframeX, X_URL, 'Loading X.com', 'x');
      } else {
        showNotification('Showing X.com', false);
      }
    } else {
      btnPmgn.classList.add('active');
      btnX.classList.remove('active');
      
      // Show GMGN iframe, hide X iframe
      iframeGmgn.classList.add('active');
      iframeX.classList.remove('active');
      currentActiveIframe = 'gmgn';
      
      // If GMGN iframe hasn't been loaded yet, load it
      if (!iframeGmgn.getAttribute('data-loaded')) {
        await loadIframe(iframeGmgn, PMGN_URL, 'Loading pmgn.ai', 'gmgn');
      } else {
        showNotification('Showing pmgn.ai', false);
      }
    }
  }
  
  // Function to load an iframe
  async function loadIframe(iframe, url, loadingMessage, iframeId, attempt = 1) {
    // Prevent multiple loads at once
    if (isLoadingInProgress) {
      return;
    }
    
    isLoadingInProgress = true;
    showLoading(true);
    showNotification(loadingMessage, false);
    
    try {
      // Pre-notify service worker about the upcoming navigation
      await notifyServiceWorkerAndWait(url, iframeId);
      
      // Add cache buster to avoid caching issues
      const cacheBuster = Date.now();
      const separator = url.includes('?') ? '&' : '?';
      const urlWithCacheBuster = `${url}${separator}_cb=${cacheBuster}`;
      
      // Set iframe source
      iframe.src = urlWithCacheBuster;
      
      // Set up load event for this attempt
      const loadPromise = new Promise((resolve, reject) => {
        const loadTimeout = setTimeout(() => {
          reject(new Error('Loading timed out'));
        }, 15000);
        
        const handleLoad = () => {
          clearTimeout(loadTimeout);
          iframe.removeEventListener('load', handleLoad);
          iframe.removeEventListener('error', handleError);
          resolve();
        };
        
        const handleError = (event) => {
          clearTimeout(loadTimeout);
          iframe.removeEventListener('load', handleLoad);
          iframe.removeEventListener('error', handleError);
          reject(new Error('Failed to load iframe'));
        };
        
        iframe.addEventListener('load', handleLoad, { once: true });
        iframe.addEventListener('error', handleError, { once: true });
      });
      
      await loadPromise;
      console.log(`Successfully loaded ${url}`);
      
      // Mark iframe as loaded
      iframe.setAttribute('data-loaded', 'true');
      
      showLoading(false);
      isLoadingInProgress = false;
      
      // Apply appropriate handler based on loaded URL
      if (url.includes('x.com')) {
        showNotification('Showing X.com', false);
      } else if (url.includes('gmgn.ai')) {
        showNotification('Showing pmgn.ai', false);
        // Try to bypass Cloudflare
        bypassCloudflare(iframe);
      }
    } catch (error) {
      console.warn(`Load attempt ${attempt} for ${url} failed:`, error);
      
      if (attempt < MAX_RETRIES) {
        // Retry with backoff
        const backoffDelay = 500 * attempt; // Incremental backoff
        showNotification(`Retrying... (${attempt}/${MAX_RETRIES})`, false);
        
        // Refresh rules before retrying
        await notifyServiceWorkerAndWait(url, iframeId);
        
        setTimeout(() => {
          loadIframe(iframe, url, loadingMessage, iframeId, attempt + 1);
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
  
  // Function to reload the current active iframe
  async function refreshCurrentIframe() {
    if (isLoadingInProgress) {
      return;
    }
    
    if (currentActiveIframe === 'x') {
      await loadIframe(iframeX, X_URL, 'Refreshing X.com', 'x');
    } else {
      await loadIframe(iframeGmgn, PMGN_URL, 'Refreshing pmgn.ai', 'gmgn');
    }
  }
  
  // Function to notify service worker and wait for confirmation
  async function notifyServiceWorkerAndWait(url, iframeId) {
    return new Promise((resolve) => {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        // Create a unique message ID for this request
        const messageId = Date.now().toString();
        
        // Set up one-time listener for response
        const handleMessage = (event) => {
          if (event.data && 
              event.data.type === 'RULES_READY' && 
              event.data.messageId === messageId) {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            resolve();
          }
        };
        
        navigator.serviceWorker.addEventListener('message', handleMessage);
        
        // Send message to service worker
        navigator.serviceWorker.controller.postMessage({
          type: 'PREPARE_URL',
          url: url,
          messageId: messageId,
          iframeId: iframeId
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
    
    // Apply opacity to the active iframe
    const activeIframe = currentActiveIframe === 'x' ? iframeX : iframeGmgn;
    if (activeIframe) {
      activeIframe.style.opacity = show ? '0.3' : '1';
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
  function bypassCloudflare(iframe) {
    try {
      // This function will attempt to execute in the parent context (panel.js)
      // to handle frame-busting prevention for the iframe content
      if (iframe.contentWindow) {
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
        iframe.addEventListener('load', () => {
          try {
            // Attempt to execute script in iframe context
            if (iframe.contentWindow && iframe.contentDocument) {
              const script = document.createElement('script');
              script.textContent = scriptContent;
              iframe.contentDocument.head.appendChild(script);
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
  
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      refreshCurrentIframe();
    });
  }
  
  // Function to notify the service worker about any URL
  function notifyServiceWorker(url, iframeId) {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'LOAD_URL',
        url: url,
        iframeId: iframeId
      });
    }
  }
  
  // Set up service worker message listener
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('Received message from service worker:', event.data);
    
    if (event.data.type === 'BYPASS_CLOUDFLARE') {
      console.log('Received bypass Cloudflare instruction');
      const targetIframe = event.data.iframeId === 'x' ? iframeX : iframeGmgn;
      bypassCloudflare(targetIframe);
    }
  });
  
  // Initialize service worker
  async function initServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        // Check for existing service worker registration first
        const swRegistration = await navigator.serviceWorker.getRegistration();
        
        if (!swRegistration) {
          console.log('No active service worker found, registering new one');
          await navigator.serviceWorker.register('./fetch_service_worker.js');
        } else {
          console.log('Using existing service worker registration');
        }
        
        // Initialize with a notification
        showNotification('Showing X.com', false);
        
        // Load GMGN iframe in the background
        setTimeout(() => {
          if (!iframeGmgn.getAttribute('data-loaded')) {
            loadIframe(iframeGmgn, PMGN_URL, 'Preloading pmgn.ai in background', 'gmgn');
          }
        }, 5000);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        showNotification('Service worker registration failed', true);
      }
    } else {
      console.error('Service Workers are not supported in this browser.');
      showNotification('Service Workers not supported', true);
    }
  }
  
  // Initialize on load
  initServiceWorker();
  
  // Debug message to confirm panel script initialized
  console.log('Panel script initialized');
}); 