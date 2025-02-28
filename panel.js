// Wait for DOM to be fully loaded before accessing any elements
document.addEventListener('DOMContentLoaded', function() {
  // Store references to DOM elements
  const urlInput = document.getElementById('urlInput');
  const goBtn = document.getElementById('goBtn');
  const clearBtn = document.getElementById('clearBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const contentFrame = document.getElementById('contentFrame');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const errorMessage = document.getElementById('errorMessage');
  
  // Keep track of frame loading state
  let loadTimeout = null;
  let currentURL = '';
  
  // Initialize serviceWorker communication - make sure to use the correct path
  if (navigator.serviceWorker) {
    navigator.serviceWorker.getRegistration()
      .then(registration => {
        if (registration) {
          console.log('Service worker already registered with scope:', registration.scope);
        } else {
          console.log('No service worker registration found, trying to register');
          // Use relative path instead of absolute
          return navigator.serviceWorker.register('./fetch_service_worker.js')
            .then(reg => {
              console.log('Service worker registered with scope:', reg.scope);
            });
        }
      })
      .catch(error => {
        console.error('Service worker registration error:', error);
      });
  } else {
    console.error('Service workers not supported in this browser');
  }
  
  // Show/hide loading indicator
  function showLoading(show = true) {
    if (loadingIndicator) {
      loadingIndicator.classList.toggle('hidden', !show);
    }
  }
  
  // Show error message
  function showError(message = '') {
    if (errorMessage) {
      errorMessage.textContent = message;
      errorMessage.classList.toggle('hidden', !message);
    }
  }
  
  // Helper function to load URL
  function loadUrl(url) {
    if (!url) return;
    
    // Reset error message
    showError();
    
    // Add 'https://' if protocol is missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
      if (urlInput) urlInput.value = url;
    }
    
    // Store current URL
    currentURL = url;
    
    // Add cache busting for URLs
    const cacheBuster = Date.now();
    const urlWithCache = url + (url.includes('?') ? '&' : '?') + '_t=' + cacheBuster;
    
    // Set up timeout for loading 
    if (loadTimeout) {
      clearTimeout(loadTimeout);
    }
    
    loadTimeout = setTimeout(() => {
      if (contentFrame.src === urlWithCache) {
        showLoading(false);
        showError('Loading is taking longer than expected. The site might be blocked or unavailable.');
      }
    }, 20000); // 20 second timeout
    
    // Show loading indicator
    showLoading(true);
    
    // Load the URL in the iframe
    if (contentFrame) {
      contentFrame.src = urlWithCache;
      console.log('Loading URL:', urlWithCache);
      
      // Notify the service worker that we're loading a page
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'loading-page',
          url: url
        });
      } else {
        console.warn('Service worker not controlling this page yet, cannot send message');
      }
    } else {
      console.error('Content frame not found! Make sure you have an iframe with id="contentFrame"');
      showLoading(false);
      showError('Content frame not found!');
    }
  }
  
  // Add event listeners if elements exist
  if (urlInput) {
    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        loadUrl(urlInput.value);
      }
    });
    
    urlInput.addEventListener('input', () => {
      if (clearBtn) {
        clearBtn.style.display = urlInput.value ? 'flex' : 'none';
      }
    });
    
    // Focus input field when the page loads
    urlInput.focus();
  } else {
    console.error('URL input element not found! Make sure you have an element with id="urlInput"');
  }
  
  if (goBtn) {
    goBtn.addEventListener('click', () => {
      if (urlInput) {
        loadUrl(urlInput.value);
      }
    });
  } else {
    console.error('Go button element not found! Make sure you have an element with id="goBtn"');
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (contentFrame && contentFrame.src) {
        loadUrl(contentFrame.src.split('?_t=')[0]); // Remove cache buster when refreshing
      } else if (urlInput && urlInput.value) {
        loadUrl(urlInput.value);
      }
    });
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (urlInput) {
        urlInput.value = '';
        urlInput.focus();
        clearBtn.style.display = 'none';
      }
    });
    
    // Initialize clear button visibility
    if (urlInput) {
      clearBtn.style.display = urlInput.value ? 'flex' : 'none';
    }
  } else {
    console.error('Clear button element not found! Make sure you have an element with id="clearBtn"');
  }
  
  // Handle iframe load events
  if (contentFrame) {
    contentFrame.addEventListener('load', () => {
      // Clear the timeout
      if (loadTimeout) {
        clearTimeout(loadTimeout);
        loadTimeout = null;
      }
      
      // Hide loading indicator when the content is loaded
      showLoading(false);
      
      try {
        // Try to check if there was an error loading the page
        const frameUrl = contentFrame.src;
        
        // Try to access the contentDocument to see if we can interact with the page
        const frameWindow = contentFrame.contentWindow;
        const frameDocument = contentFrame.contentDocument || (frameWindow ? frameWindow.document : null);
        
        // If we can access the content, check if it's an error page
        if (frameDocument && frameDocument.title) {
          if (frameDocument.title.includes('refused to connect') || 
              frameDocument.title.includes('Error') || 
              frameDocument.title.includes('not available')) {
            showError('Error loading content: ' + frameDocument.title);
          } else {
            // Update the urlInput with the final URL after redirects
            if (urlInput && frameWindow && frameWindow.location && frameWindow.location.href) {
              let finalUrl = frameWindow.location.href.split('?_t=')[0]; // Remove cache buster
              if (finalUrl !== currentURL) {
                urlInput.value = finalUrl;
                currentURL = finalUrl;
              }
            }
            
            // Notify the service worker that the page was loaded successfully
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'page-loaded',
                url: currentURL,
                success: true
              });
            }
          }
        }
        
        console.log('Frame loaded:', frameUrl);
      } catch (error) {
        // We can't access the content due to CORS - this is actually expected and OK
        console.log('Frame loaded, but content not accessible due to CORS (this is normal)');
        
        // Notify the service worker of successful load
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'page-loaded',
            url: currentURL,
            success: true
          });
        }
      }
    });
    
    contentFrame.addEventListener('error', (error) => {
      console.error('Frame error:', error);
      showLoading(false);
      showError('Failed to load content. Please try again.');
      
      // Notify the service worker of error
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'page-loaded',
          url: currentURL,
          success: false,
          error: error.message || 'Unknown error'
        });
      }
    });
  }
  
  // Add a message handler to receive messages from the service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('Received message from service worker:', event.data);
    
    if (event.data && event.data.type === 'page-load-status') {
      if (event.data.success) {
        showError('');
      } else {
        showLoading(false);
        showError(event.data.error || 'Error loading page');
      }
    } else if (event.data && event.data.type === 'content-error') {
      showLoading(false);
      showError(event.data.error || 'Error loading content');
    }
  });
  
  // Set up a default URL (Optional - can start with Twitter)
  // Uncomment this line if you want to automatically load Twitter when the panel opens
  // setTimeout(() => loadUrl('https://twitter.com'), 1000);
  
  // Debug message to confirm script loaded
  console.log('Panel script initialized successfully');
}); 