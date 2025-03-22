// Wait for DOM to be fully loaded before accessing any elements
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const btnRefresh = document.getElementById('btn-refresh');
  const btnXIcon = document.getElementById('btn-x-icon');
  const btnGmgnIcon = document.getElementById('btn-gmgn-icon');
  const btnBackward = document.getElementById('btn-backward');
  const btnForward = document.getElementById('btn-forward');
  const btnSwap = document.getElementById('btn-swap');
  const btnSettings = document.getElementById('btn-settings');
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
  // Track history for each iframe
  let xHistory = { current: -1, urls: [] };
  let gmgnHistory = { current: -1, urls: [] };
  
  // Function to toggle between iframes
  async function toggleIframeSource(showX) {
    // No need to toggle if already on the selected iframe
    if ((showX && currentActiveIframe === 'x') ||
        (!showX && currentActiveIframe === 'gmgn')) {
      return;
    }
    
    // Update button states
    if (showX) {
      btnXIcon.classList.add('active');
      btnGmgnIcon.classList.remove('active');
      
      // Show X iframe, hide GMGN iframe
      iframeX.classList.add('active');
      iframeGmgn.classList.remove('active');
      currentActiveIframe = 'x';
      
      // If X iframe hasn't been loaded yet, load it
      if (!iframeX.getAttribute('data-loaded')) {
        await loadIframe(iframeX, X_URL, 'Loading X.com', 'x');
        // Add to history
        addToHistory(X_URL, 'x');
      } else {
        showNotification('Showing X.com', false);
      }
    } else {
      btnGmgnIcon.classList.add('active');
      btnXIcon.classList.remove('active');
      
      // Show GMGN iframe, hide X iframe
      iframeGmgn.classList.add('active');
      iframeX.classList.remove('active');
      currentActiveIframe = 'gmgn';
      
      // If GMGN iframe hasn't been loaded yet, load it
      if (!iframeGmgn.getAttribute('data-loaded')) {
        await loadIframe(iframeGmgn, PMGN_URL, 'Loading pmgn.ai', 'gmgn');
        // Add to history
        addToHistory(PMGN_URL, 'gmgn');
      } else {
        showNotification('Showing pmgn.ai', false);
      }
    }
    
    // Update navigation buttons state
    updateNavigationState();
  }
  
  // Function to add URL to history
  function addToHistory(url, iframeId) {
    const history = iframeId === 'x' ? xHistory : gmgnHistory;
    
    // If we're not at the end of history, truncate the future entries
    if (history.current < history.urls.length - 1) {
      history.urls = history.urls.slice(0, history.current + 1);
    }
    
    // Add the new URL
    history.urls.push(url);
    history.current = history.urls.length - 1;
    
    // Update navigation buttons
    updateNavigationState();
  }
  
  // Function to navigate back
  async function goBack() {
    const history = currentActiveIframe === 'x' ? xHistory : gmgnHistory;
    const iframe = currentActiveIframe === 'x' ? iframeX : iframeGmgn;
    
    if (history.current > 0) {
      history.current--;
      const url = history.urls[history.current];
      await loadIframe(iframe, url, `Loading previous page`, currentActiveIframe);
      updateNavigationState();
    }
  }
  
  // Function to navigate forward
  async function goForward() {
    const history = currentActiveIframe === 'x' ? xHistory : gmgnHistory;
    const iframe = currentActiveIframe === 'x' ? iframeX : iframeGmgn;
    
    if (history.current < history.urls.length - 1) {
      history.current++;
      const url = history.urls[history.current];
      await loadIframe(iframe, url, `Loading next page`, currentActiveIframe);
      updateNavigationState();
    }
  }
  
  // Function to update navigation button states
  function updateNavigationState() {
    const history = currentActiveIframe === 'x' ? xHistory : gmgnHistory;
    
    // Update back button
    btnBackward.disabled = history.current <= 0;
    btnBackward.style.opacity = history.current <= 0 ? '0.5' : '1';
    
    // Update forward button
    btnForward.disabled = history.current >= history.urls.length - 1;
    btnForward.style.opacity = history.current >= history.urls.length - 1 ? '0.5' : '1';
  }
  
  // Function to go home (load the default page for current iframe)
  async function goHome(site) {
    if (isLoadingInProgress) return;
    
    if (site === 'x' || (site === undefined && currentActiveIframe === 'x')) {
      await loadIframe(iframeX, X_URL, 'Loading X.com home', 'x');
      addToHistory(X_URL, 'x');
      // Update the active state
      btnXIcon.classList.add('active');
      btnGmgnIcon.classList.remove('active');
      iframeX.classList.add('active');
      iframeGmgn.classList.remove('active');
      currentActiveIframe = 'x';
    } else {
      await loadIframe(iframeGmgn, PMGN_URL, 'Loading pmgn.ai home', 'gmgn');
      addToHistory(PMGN_URL, 'gmgn');
      // Update the active state
      btnGmgnIcon.classList.add('active');
      btnXIcon.classList.remove('active');
      iframeGmgn.classList.add('active');
      iframeX.classList.remove('active');
      currentActiveIframe = 'gmgn';
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
      // Get current URL from history or default to home
      const history = xHistory;
      const currentURL = history.urls[history.current] || X_URL;
      await loadIframe(iframeX, currentURL, 'Refreshing X.com', 'x');
    } else {
      // Get current URL from history or default to home
      const history = gmgnHistory;
      const currentURL = history.urls[history.current] || PMGN_URL;
      await loadIframe(iframeGmgn, currentURL, 'Refreshing pmgn.ai', 'gmgn');
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
  
  // Event Listeners
  btnXIcon.addEventListener('click', () => toggleIframeSource(true));
  btnGmgnIcon.addEventListener('click', () => toggleIframeSource(false));
  btnRefresh.addEventListener('click', refreshCurrentIframe);
  btnBackward.addEventListener('click', goBack);
  btnForward.addEventListener('click', goForward);
  btnSwap.addEventListener('click', () => {
    // Toggle between X and pmgn.ai
    toggleIframeSource(currentActiveIframe === 'gmgn');
  });
  btnSettings.addEventListener('click', () => {
    showNotification('Settings feature coming soon', false);
  });
  
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
        showNotification('Panel ready', false);
        
        // Wait for service worker to be fully active before loading x.com
        setTimeout(() => {
          // Only load X content after panel is fully initialized
          loadIframe(iframeX, X_URL, 'Loading X.com', 'x');
          // Add to history
          addToHistory(X_URL, 'x');
        }, 500);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        showNotification('Service worker registration failed', true);
      }
    } else {
      console.error('Service Workers are not supported in this browser.');
      showNotification('Service Workers not supported', true);
    }
  }
  
  // Initialize navigation buttons
  updateNavigationState();
  
  // Initialize on load
  initServiceWorker();
  
  // Debug message to confirm panel script initialized
  console.log('Panel script initialized');
}); 