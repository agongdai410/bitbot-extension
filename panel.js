// Wait for DOM to be fully loaded before accessing any elements
document.addEventListener('DOMContentLoaded', () => {
  // Get DOM elements
  const btnRefresh = document.getElementById('btn-refresh');
  const btnRetry = document.getElementById('retry-button');
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
  // Track history for each iframe - initialize from localStorage if available
  let xHistory = loadHistoryFromLocalStorage('x') || { current: -1, urls: [] };
  let gmgnHistory = loadHistoryFromLocalStorage('gmgn') || { current: -1, urls: [] };
  // Max history size
  const MAX_HISTORY_SIZE = 100;
  
  // Track the last token we've detected to avoid redundant searches
  let lastDetectedToken = null;
  
  // Function to load history from localStorage
  function loadHistoryFromLocalStorage(iframeId) {
    try {
      const savedHistory = localStorage.getItem(`${iframeId}_history`);
      if (savedHistory) {
        return JSON.parse(savedHistory);
      }
    } catch (e) {
      console.error(`Error loading ${iframeId} history from localStorage:`, e);
    }
    return null;
  }
  
  // Function to save history to localStorage
  function saveHistoryToLocalStorage(iframeId, history) {
    try {
      localStorage.setItem(`${iframeId}_history`, JSON.stringify(history));
    } catch (e) {
      console.error(`Error saving ${iframeId} history to localStorage:`, e);
    }
  }
  
  // Function to toggle between iframes
  async function toggleIframeSource(showX) {
    // No need to toggle if already on the selected iframe
    if ((showX && currentActiveIframe === 'x') ||
        (!showX && currentActiveIframe === 'gmgn')) {
      return;
    }
    
    // Before toggling, save the current active iframe's state
    const oldIframeId = currentActiveIframe;
    const oldHistory = oldIframeId === 'x' ? xHistory : gmgnHistory;
    
    // Update button states
    if (showX) {
      btnXIcon.classList.add('active');
      btnGmgnIcon.classList.remove('active');
      
      // Show X iframe, hide GMGN iframe
      iframeX.classList.add('active');
      iframeGmgn.classList.remove('active');
      
      // Reset any inline styles that might interfere with visibility
      iframeX.style.display = '';
      iframeX.style.opacity = '1';
      
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
      
      // Reset any inline styles that might interfere with visibility
      iframeGmgn.style.display = '';
      iframeGmgn.style.opacity = '1';
      
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
    
    // Log the history transition for debugging
    console.log(`Switched from ${oldIframeId} to ${currentActiveIframe}`);
    console.log(`${oldIframeId} history:`, oldHistory);
    console.log(`${currentActiveIframe} history:`, currentActiveIframe === 'x' ? xHistory : gmgnHistory);
    
    // Update navigation buttons state based on current iframe's history
    updateNavigationState();
    
    // Update swap button state when active iframe changes
    updateSwapButtonState();
  }
  
  // Function to add URL to history
  function addToHistory(url, iframeId) {
    const history = iframeId === 'x' ? xHistory : gmgnHistory;
    
    // If we're not at the end of history, truncate the future entries
    if (history.current < history.urls.length - 1) {
      history.urls = history.urls.slice(0, history.current + 1);
    }
    
    // Skip adding if URL is identical to the last entry (prevent consecutive duplicates)
    if (history.urls.length > 0 && history.urls[history.current] === url) {
      console.log(`Skipping duplicate history entry: ${url}`);
      return;
    }
    
    // Add the new URL
    history.urls.push(url);
    history.current = history.urls.length - 1;
    
    // Maintain max size by removing oldest entries
    if (history.urls.length > MAX_HISTORY_SIZE) {
      const excess = history.urls.length - MAX_HISTORY_SIZE;
      history.urls = history.urls.slice(excess);
      history.current -= excess;
      if (history.current < 0) history.current = 0;
    }
    
    // Save to localStorage
    saveHistoryToLocalStorage(iframeId, history);
    
    // Update navigation buttons
    updateNavigationState();
  }
  
  // Function to navigate back
  async function goBack() {
    // Get history and iframe based on current active one
    const history = currentActiveIframe === 'x' ? xHistory : gmgnHistory;
    const iframe = currentActiveIframe === 'x' ? iframeX : iframeGmgn;
    
    // Only allow navigation if we're not at the beginning of this iframe's history
    if (history.current > 0) {
      // Check current URL before navigation
      const currentUrl = history.urls[history.current];
      const previousUrl = history.urls[history.current - 1];
      
      // If navigating away from a token search on X, reset the token tracker
      if (currentActiveIframe === 'x' && 
          currentUrl && currentUrl.includes('search?q=') &&
          (!previousUrl || !previousUrl.includes('search?q='))) {
        console.log('Navigating away from token search, resetting lastDetectedToken');
        lastDetectedToken = null;
      }
      
      history.current--;
      const url = history.urls[history.current];
      await loadIframe(iframe, url, `Loading previous page`, currentActiveIframe);
      
      // Save updated history position
      saveHistoryToLocalStorage(currentActiveIframe, history);
      
      updateNavigationState();
    }
  }
  
  // Function to navigate forward
  async function goForward() {
    // Get history and iframe based on current active one
    const history = currentActiveIframe === 'x' ? xHistory : gmgnHistory;
    const iframe = currentActiveIframe === 'x' ? iframeX : iframeGmgn;
    
    // Only allow navigation if we're not at the end of this iframe's history
    if (history.current < history.urls.length - 1) {
      // Check current URL before navigation
      const currentUrl = history.urls[history.current];
      const nextUrl = history.urls[history.current + 1];
      
      // If navigating away from a token search on X, reset the token tracker
      if (currentActiveIframe === 'x' && 
          currentUrl && currentUrl.includes('search?q=') &&
          (!nextUrl || !nextUrl.includes('search?q='))) {
        console.log('Navigating away from token search, resetting lastDetectedToken');
        lastDetectedToken = null;
      }
      
      history.current++;
      const url = history.urls[history.current];
      await loadIframe(iframe, url, `Loading next page`, currentActiveIframe);
      
      // Save updated history position
      saveHistoryToLocalStorage(currentActiveIframe, history);
      
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
    
    // Log current navigation state for debugging
    console.log(`Navigation state updated for ${currentActiveIframe}:`);
    console.log(`  Current position: ${history.current + 1}/${history.urls.length}`);
    console.log(`  Backward button: ${btnBackward.disabled ? 'disabled' : 'enabled'}`);
    console.log(`  Forward button: ${btnForward.disabled ? 'disabled' : 'enabled'}`);
    if (history.urls.length > 0) {
      console.log(`  Current URL: ${history.urls[history.current]}`);
    }
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
  
  // Function to extract contract address from gmgn.ai token URL
  function extractContractAddress(url) {
    // URL pattern: https://gmgn.ai/sol/token/CONTRACT_ADDRESS
    const matches = url.match(/\/token\/([^\/\?#]+)/);
    if (matches && matches[1]) {
      return matches[1];
    }
    return null;
  }
  
  // Function to switch to X and search for a token
  async function searchTokenOnX(contractAddress) {
    if (!contractAddress) return;
    
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(contractAddress)}`;
    
    // Switch to X iframe
    btnXIcon.classList.add('active');
    btnGmgnIcon.classList.remove('active');
    iframeX.classList.add('active');
    iframeGmgn.classList.remove('active');
    currentActiveIframe = 'x';
    
    // Load the search URL
    await loadIframe(iframeX, searchUrl, `Searching for token on X.com`, 'x');
    addToHistory(searchUrl, 'x');
    
    // Update navigation state
    updateNavigationState();
  }
  
  // Function to check if current URL is a token page and automatically search on X
  function checkForTokenPage(url, iframeId) {
    if (iframeId === 'gmgn' && url.includes('/token/')) {
      const contractAddress = extractContractAddress(url);
      if (contractAddress) {
        // Save the current gmgn url to history
        addToHistory(url, 'gmgn');
        
        // Automatically search this token on X
        searchTokenOnX(contractAddress);
        
        // Show a brief notification about the automatic search
        showNotification(`Searching for ${contractAddress.slice(0, 8)}... on X`, false);
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
    showFailedToLoadNotification(false); // Hide failed notification on new load attempt
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
      console.log(`Setting iframe source for ${iframeId} to: ${urlWithCacheBuster}`);
      
      // Add a MutationObserver to detect browser error pages
      let errorDetectionObserver;
      try {
        errorDetectionObserver = new MutationObserver((mutations) => {
          // Check if browser has injected its error page
          if (iframe.contentDocument) {
            const errorText = iframe.contentDocument.body?.innerText || '';
            if (errorText.includes('unexpectedly closed the connection') || 
                errorText.includes('refused to connect') ||
                errorText.includes('ERR_CONNECTION_') ||
                errorText.includes('failed to load')) {
              console.log(`Detected browser error page in ${iframeId} iframe:`, errorText);
              // Clear the observer since we found an error
              errorDetectionObserver.disconnect();
              // Show our custom error notification instead
              showFailedToLoadNotification(true);
              showLoading(false);
            }
          }
        });
        
        // Start observing with a delay to allow iframe to start loading
        setTimeout(() => {
          try {
            if (iframe.contentDocument) {
              errorDetectionObserver.observe(iframe.contentDocument, { 
                childList: true, 
                subtree: true, 
                characterData: true 
              });
            }
          } catch (e) {
            // CORS may prevent access to contentDocument
            console.log('Could not set up error detection due to CORS');
          }
        }, 100);
      } catch (e) {
        console.log('Error setting up error detection:', e);
      }
      
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
      showFailedToLoadNotification(false); // Ensure failed notification is hidden on success
      isLoadingInProgress = false;
      
      // Apply appropriate handler based on loaded URL
      if (url.includes('x.com')) {
        showNotification('Showing X.com', false);
        
        // If we're navigating to a non-search page in X.com, reset the lastDetectedToken
        // so we can detect the same token again if needed
        if (!url.includes('search?q=')) {
          console.log('Resetting lastDetectedToken due to navigation to non-search X.com page');
          lastDetectedToken = null;
        }
      } else if (url.includes('gmgn.ai')) {
        showNotification('Showing pmgn.ai', false);
        // Try to bypass Cloudflare
        bypassCloudflare(iframe);
      }
      
      // For gmgn.ai token pages, check if it's a new token
      if (iframeId === 'gmgn' && url.includes('/token/')) {
        const token = extractContractAddress(url);
        if (token && token !== lastDetectedToken) {
          lastDetectedToken = token;
          // Check if it's a token page
          checkForTokenPage(url, iframeId);
        }
      }
    } catch (error) {
      console.warn(`Load attempt ${attempt} for ${url} failed:`, error);
      
      // Clean up error detection observer if it exists
      if (errorDetectionObserver) {
        errorDetectionObserver.disconnect();
      }
      
      // Check if this is a connection error
      const isConnectionError = 
        error.message.includes('timeout') || 
        error.message.includes('connection') ||
        error.message.includes('network');
      
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
        showFailedToLoadNotification(true); // Show failed notification after max retries
        isLoadingInProgress = false;
      }
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
  
  // Show/hide failed to load notification
  function showFailedToLoadNotification(show) {
    const failedNotification = document.getElementById('failed-to-load-notification');
    if (failedNotification) {
      failedNotification.style.display = show ? 'flex' : 'none';
      
      // Ensure the notification is on top of everything
      failedNotification.style.zIndex = show ? '10000' : '10';
    }
    
    // Get the active iframe
    const activeIframe = currentActiveIframe === 'x' ? iframeX : iframeGmgn;
    if (activeIframe) {
      if (show) {
        // When showing the error, apply opacity but don't hide completely
        // This preserves the active/inactive iframe state from CSS
        activeIframe.style.opacity = '0.1';
        
        // Optional: clear the src to prevent continued connection attempts
        if (activeIframe.src.includes('gmgn.ai')) {
          // Only do this for gmgn.ai which has connection issues
          setTimeout(() => {
            // Store the failed URL to retry later if needed
            activeIframe.setAttribute('data-failed-url', activeIframe.src);
            // Set to a blank page to stop the error
            activeIframe.src = 'about:blank';
          }, 100);
        }
      } else {
        // Restore normal opacity but don't change display property
        // The display property is controlled by the .active class
        activeIframe.style.opacity = '1';
      }
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
  
  // Event Listeners
  btnXIcon.addEventListener('click', () => toggleIframeSource(true));
  btnGmgnIcon.addEventListener('click', () => toggleIframeSource(false));
  btnRefresh.addEventListener('click', refreshCurrentIframe);
  btnRetry.addEventListener('click', refreshCurrentIframe);
  btnBackward.addEventListener('click', goBack);
  btnForward.addEventListener('click', goForward);
  btnSwap.addEventListener('click', async () => {
    // Swap content between main browser window and side panel
    await swapWithMainWindow();
  });
  btnSettings.addEventListener('click', () => {
    showNotification('Settings feature coming soon', false);
  });
  
  // Trade button to open Bitbot in a new tab
  const tradeButton = document.getElementById('trade-button');
  if (tradeButton) {
    tradeButton.addEventListener('click', () => {
      window.open('https://www.bitbot.app/', '_blank');
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
    else if (event.data.type === 'TOKEN_DETECTED') {
      console.log('Token detected in main browser:', event.data.tokenAddress);
      
      // Save gmgn URL to history even if not currently viewing that iframe
      addToHistory(event.data.gmgnUrl, 'gmgn');
      
      // Check if the token is different from last detected
      if (event.data.tokenAddress !== lastDetectedToken) {
        lastDetectedToken = event.data.tokenAddress;
        
        // Search for this token on X
        searchTokenOnX(event.data.tokenAddress);
        
        // Show notification
        showNotification(`Searching for ${event.data.tokenAddress.slice(0, 8)}... on X`, false);
      }
    }
    else if (event.data.type === 'CA_DETECTED') {
      console.log('Contract address detected on X.com:', event.data.contractAddress);
      
      // Create gmgn.ai token URL
      const gmgnUrl = `https://gmgn.ai/sol/token/${event.data.contractAddress}`;
      
      // Always process newly detected CAs from scrolling, even if they were seen before
      // Just check if it's the same as the currently displayed one
      const currentGmgnUrl = iframeGmgn.src;
      const isShowingThisCA = currentGmgnUrl && currentGmgnUrl.includes(event.data.contractAddress);
      
      if (!isShowingThisCA) {
        console.log('Switching to new CA page:', event.data.contractAddress);
        lastDetectedToken = event.data.contractAddress;
        
        // Remember previous active iframe
        const previousActiveIframe = currentActiveIframe;
        
        // Switch to gmgn iframe and load the token page
        btnGmgnIcon.classList.add('active');
        btnXIcon.classList.remove('active');
        iframeGmgn.classList.add('active');
        iframeX.classList.remove('active');
        currentActiveIframe = 'gmgn';
        
        // Load the gmgn.ai token page 
        loadIframe(iframeGmgn, gmgnUrl, `Loading token on gmgn.ai`, 'gmgn');
        
        // Add to gmgn history - importantly, we use 'gmgn' as the iframe ID to keep histories separate
        addToHistory(gmgnUrl, 'gmgn');
        
        console.log(`Switched from ${previousActiveIframe} to gmgn for CA: ${event.data.contractAddress}`);
        console.log('Current gmgn history:', gmgnHistory);
        
        // Update navigation state
        updateNavigationState();
        
        // Show notification
        showNotification(`Loading ${event.data.contractAddress.slice(0, 8)}... on gmgn.ai`, false);
      } else {
        console.log('Already showing this CA, no need to reload');
      }
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
        
        // Check if current tab has a gmgn.ai token page
        if (chrome && chrome.tabs) {
          chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
            if (tabs && tabs.length > 0) {
              const currentTab = tabs[0];
              console.log('Current tab URL:', currentTab.url);
              
              if (currentTab.url && currentTab.url.includes('gmgn.ai') && currentTab.url.includes('/token/')) {
                // Extract token address
                const tokenAddress = extractContractAddress(currentTab.url);
                if (tokenAddress) {
                  console.log('Found token in active tab:', tokenAddress);
                  lastDetectedToken = tokenAddress;
                  
                  // Save the gmgn.ai URL to history
                  addToHistory(currentTab.url, 'gmgn');
                  
                  // Load X with token search
                  const searchUrl = `https://x.com/search?q=${encodeURIComponent(tokenAddress)}`;
                  await loadIframe(iframeX, searchUrl, `Searching for token on X.com`, 'x');
                  addToHistory(searchUrl, 'x');
                  
                  // Show notification
                  showNotification(`Searching for ${tokenAddress.slice(0, 8)}... on X`, false);
                  return; // Skip the default X.com loading
                }
              }
              
              // Check if the current tab is NOT on x.com or gmgn.ai
              const isNotXOrGmgn = currentTab.url && 
                                  !currentTab.url.includes('x.com') && 
                                  !currentTab.url.includes('twitter.com') && 
                                  !currentTab.url.includes('gmgn.ai');
              
              if (isNotXOrGmgn) {
                // Check if there's X.com browsing history
                if (xHistory && xHistory.urls && xHistory.urls.length > 0 && xHistory.current >= 0) {
                  // Get the last visited URL from X.com history
                  const lastXUrl = xHistory.urls[xHistory.current];
                  console.log('Loading last visited X URL from history:', lastXUrl);
                  
                  // Load the last visited X.com URL
                  await loadIframe(iframeX, lastXUrl, 'Loading last visited X.com page', 'x');
                  return; // Skip the default X.com loading
                }
              }
              
              // Default: load X.com homepage
              loadIframe(iframeX, X_URL, 'Loading X.com', 'x');
              addToHistory(X_URL, 'x');
            } else {
              // Fallback to default X.com if tabs API fails
              loadIframe(iframeX, X_URL, 'Loading X.com', 'x');
              addToHistory(X_URL, 'x');
            }
          });
        } else {
          // If tabs API is not available, try to load last X URL from history
          if (xHistory && xHistory.urls && xHistory.urls.length > 0 && xHistory.current >= 0) {
            // Get the last visited URL from X.com history
            const lastXUrl = xHistory.urls[xHistory.current];
            console.log('Loading last visited X URL from history (no tabs API):', lastXUrl);
            setTimeout(() => {
              loadIframe(iframeX, lastXUrl, 'Loading last visited X.com page', 'x');
            }, 500);
          } else {
            // Fall back to default X.com
            setTimeout(() => {
              loadIframe(iframeX, X_URL, 'Loading X.com', 'x');
              addToHistory(X_URL, 'x');
            }, 500);
          }
        }
      } catch (error) {
        console.error('Service Worker registration failed:', error);
        showNotification('Service worker registration failed', true);
        
        // Try to load last X URL from history even if service worker fails
        if (xHistory && xHistory.urls && xHistory.urls.length > 0 && xHistory.current >= 0) {
          const lastXUrl = xHistory.urls[xHistory.current];
          loadIframe(iframeX, lastXUrl, 'Loading last visited X.com page', 'x');
        } else {
          // Fall back to default X.com
          loadIframe(iframeX, X_URL, 'Loading X.com', 'x');
          addToHistory(X_URL, 'x');
        }
      }
    } else {
      console.error('Service Workers are not supported in this browser.');
      showNotification('Service Workers not supported', true);
      
      // Try to load last X URL from history
      if (xHistory && xHistory.urls && xHistory.urls.length > 0 && xHistory.current >= 0) {
        const lastXUrl = xHistory.urls[xHistory.current];
        loadIframe(iframeX, lastXUrl, 'Loading last visited X.com page', 'x');
      } else {
        // Fall back to default X.com
        loadIframe(iframeX, X_URL, 'Loading X.com', 'x');
        addToHistory(X_URL, 'x');
      }
    }
  }
  
  // Initialize navigation buttons
  updateNavigationState();
  
  // Initialize swap button state
  updateSwapButtonState();
  
  // Monitor tab URL changes to update swap button state
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      // Only update if it's the active tab
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs && tabs.length > 0 && tabs[0].id === tabId) {
          updateSwapButtonState();
        }
      });
    }
  });
  
  // Monitor tab activation changes
  chrome.tabs.onActivated.addListener(() => {
    updateSwapButtonState();
  });
  
  // Initialize on load
  initServiceWorker();
  
  // Debug message to confirm panel script initialized
  console.log('Panel script initialized');
  
  // Function to swap content between main window and side panel
  async function swapWithMainWindow() {
    // Get the active iframe and its URL
    const activeIframe = currentActiveIframe === 'x' ? iframeX : iframeGmgn;
    const iframeUrl = activeIframe.src;
    
    if (!iframeUrl || iframeUrl === 'about:blank') {
      showNotification('No content to swap', true);
      return;
    }
    
    try {
      // Get current tab's URL
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tabs || !tabs.length) {
        showNotification('Could not access current tab', true);
        return;
      }
      
      const currentTab = tabs[0];
      const mainWindowUrl = currentTab.url;
      
      // Only proceed if we have valid URLs
      if (!mainWindowUrl) {
        showNotification('Invalid main window URL', true);
        return;
      }
      
      // Navigate main window to iframe URL
      await chrome.tabs.update(currentTab.id, { url: iframeUrl });
      showNotification('Swapped content with main window', false);
      
      // Load main window URL in the appropriate iframe based on domain
      const isXUrl = mainWindowUrl.includes('x.com') || mainWindowUrl.includes('twitter.com');
      const isGmgnUrl = mainWindowUrl.includes('gmgn.ai');
      
      if (isXUrl) {
        // Switch to X iframe if needed
        if (currentActiveIframe !== 'x') {
          await toggleIframeSource(true);
        }
        await loadIframe(iframeX, mainWindowUrl, 'Loading main window content', 'x');
        addToHistory(mainWindowUrl, 'x');
      } else if (isGmgnUrl) {
        // Switch to GMGN iframe if needed
        if (currentActiveIframe !== 'gmgn') {
          await toggleIframeSource(false);
        }
        await loadIframe(iframeGmgn, mainWindowUrl, 'Loading main window content', 'gmgn');
        addToHistory(mainWindowUrl, 'gmgn');
      } else {
        // For other URLs, load in the current active iframe
        showNotification('Loading main window content in current panel', false);
        await loadIframe(
          activeIframe, 
          mainWindowUrl, 
          'Loading main window content', 
          currentActiveIframe
        );
        addToHistory(mainWindowUrl, currentActiveIframe);
      }
      
      // Update navigation state
      updateNavigationState();
      
      // After swapping, update the swap button state
      setTimeout(() => {
        updateSwapButtonState();
      }, 500);
    } catch (error) {
      console.error('Error swapping content:', error);
      showNotification('Failed to swap content', true);
    }
  }
  
  // Function to update the swap button state (enabled/disabled)
  async function updateSwapButtonState() {
    try {
      // Get current tab's URL
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tabs || !tabs.length) {
        console.warn('Could not access current tab');
        btnSwap.disabled = true;
        btnSwap.style.opacity = '0.5';
        return;
      }
      
      const currentTab = tabs[0];
      const mainWindowUrl = currentTab.url;
      
      // Check if main window has either x.com or gmgn.ai content
      const isMainWindowX = mainWindowUrl && (mainWindowUrl.includes('x.com') || mainWindowUrl.includes('twitter.com'));
      const isMainWindowGmgn = mainWindowUrl && mainWindowUrl.includes('gmgn.ai');
      
      // Get current panel content
      const isPanelX = currentActiveIframe === 'x';
      const isPanelGmgn = currentActiveIframe === 'gmgn';
      
      // Enable swap only if there's a meaningful swap possible (X <-> gmgn)
      const canSwap = (isMainWindowX && isPanelGmgn) || (isMainWindowGmgn && isPanelX);
      
      // Update button state
      btnSwap.disabled = !canSwap;
      btnSwap.style.opacity = canSwap ? '1' : '0.5';
      
      console.log(`Swap button ${canSwap ? 'enabled' : 'disabled'}: Main window: ${
        isMainWindowX ? 'X' : isMainWindowGmgn ? 'gmgn' : 'other'}, Panel: ${isPanelX ? 'X' : 'gmgn'}`);
      
    } catch (error) {
      console.error('Error updating swap button state:', error);
      btnSwap.disabled = true;
      btnSwap.style.opacity = '0.5';
    }
  }
}); 