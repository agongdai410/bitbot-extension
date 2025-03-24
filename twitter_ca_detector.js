// Panel-based script to detect contract addresses on Twitter/X.com pages
console.log('Twitter/X.com CA detector script loaded in panel context!');

// Store the active tab info
let activeTabId = null;
let isTwitterTab = false;
let detector = null;

// We'll create an object to track all the injected scripts
class TabDetector {
  constructor(tabId) {
    this.tabId = tabId;
    this.detectorsInjected = false;
    this.lastDetectedCA = null;
    this.detectedCAs = new Set();
    this.isMonitoring = false;
  }
  
  // Inject the content script into the tab
  async inject() {
    if (this.detectorsInjected) return;
    
    try {
      console.log(`Injecting CA detector content script into tab ${this.tabId}`);
      
      // Inject the content script that will run in the context of the page
      await chrome.scripting.executeScript({
        target: { tabId: this.tabId },
        func: injectDetectorCode
      });
      
      this.detectorsInjected = true;
      console.log(`Successfully injected CA detector into tab ${this.tabId}`);
      
      // Start periodic checker to send status ping to the injected script
      this.startMonitoring();
    } catch (error) {
      console.error('Error injecting CA detector script:', error);
    }
  }
  
  // Force a scan of the current page
  async forceScan() {
    if (!this.detectorsInjected) {
      await this.inject();
    }
    
    try {
      console.log(`Forcing scan for tab ${this.tabId}`);
      await chrome.tabs.sendMessage(this.tabId, { action: 'forceScan' });
    } catch (error) {
      console.warn('Error triggering forced scan:', error);
      // If the content script isn't responding, try to re-inject it
      if (error.message && error.message.includes('receiving end does not exist')) {
        this.detectorsInjected = false;
        await this.inject();
        // Try again after reinjection
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(this.tabId, { action: 'forceScan' });
          } catch (retryError) {
            console.error('Error forcing scan after reinjection:', retryError);
          }
        }, 500);
      }
    }
  }
  
  // Start monitoring for new CAs on the page
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log(`Starting CA monitoring for tab ${this.tabId}`);
    
    // Ping the content script periodically to trigger scans
    this.monitorInterval = setInterval(async () => {
      try {
        await chrome.tabs.sendMessage(this.tabId, { 
          action: 'checkForCAs',
        });
      } catch (error) {
        console.warn('Error sending message to content script:', error);
        // If the content script isn't responding, try to re-inject it
        if (error.message.includes('receiving end does not exist')) {
          this.detectorsInjected = false;
          clearInterval(this.monitorInterval);
          this.isMonitoring = false;
          this.inject();
        }
      }
    }, 3000);
  }
  
  // Stop monitoring when tab is not active or closed
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    console.log(`Stopping CA monitoring for tab ${this.tabId}`);
    clearInterval(this.monitorInterval);
    this.isMonitoring = false;
  }
}

// Listen for messages from the injected content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'caDetected') {
    console.log('Received CA from content script:', message.contractAddress);
    
    // Forward to the service worker
    chrome.runtime.sendMessage({
      type: 'CA_DETECTED',
      contractAddress: message.contractAddress,
      url: sender.tab.url
    });
    
    sendResponse({ received: true });
  }
  else if (message.action === 'log') {
    console.log('Content script log:', message.message);
    sendResponse({ received: true });
  }
  
  // Return true to indicate we'll send an async response
  return true;
});

// Monitor tab changes and inject detector when on Twitter/X
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;
  await checkAndInjectScript(activeTabId);
  
  // Force a scan when switching to a Twitter tab
  if (detector && detector.detectorsInjected) {
    setTimeout(() => {
      detector.forceScan();
    }, 500);
  }
});

// Also monitor for URL changes in the active tab
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Trigger on both 'loading' and 'complete' to catch all navigation events
  if (tabId === activeTabId && tab.url && (tab.url.includes('twitter.com') || tab.url.includes('x.com'))) {
    if (changeInfo.status === 'loading') {
      console.log('Twitter page is loading, preparing detector...');
      // Make sure detector is ready
      if (!detector || detector.tabId !== tabId) {
        detector = new TabDetector(tabId);
      }
    }
    
    if (changeInfo.status === 'complete') {
      console.log('Twitter page load complete, injecting and scanning...');
      await checkAndInjectScript(tabId);
      
      // Force an immediate scan after page load completes
      if (detector && detector.detectorsInjected) {
        setTimeout(() => {
          console.log('Triggering immediate scan after page load');
          chrome.tabs.sendMessage(tabId, { action: 'forceScan' });
        }, 1000); // Short delay to let the page render
      }
    }
  }
});

// Check if the tab is Twitter/X and inject the script if needed
async function checkAndInjectScript(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    isTwitterTab = tab.url && (tab.url.includes('twitter.com') || tab.url.includes('x.com'));
    
    if (isTwitterTab) {
      console.log('Detected Twitter/X.com tab:', tab.url);
      
      // Create a new detector or use existing one
      if (!detector || detector.tabId !== tabId) {
        detector = new TabDetector(tabId);
      }
      
      await detector.inject();
    } else if (detector) {
      detector.stopMonitoring();
    }
  } catch (error) {
    console.error('Error checking tab:', error);
  }
}

// Initialize by checking the current active tab
async function initialize() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      activeTabId = tabs[0].id;
      await checkAndInjectScript(activeTabId);
      
      // Force a scan when the side panel is opened (panel.js is loaded)
      if (detector && detector.detectorsInjected) {
        console.log('Panel opened, triggering initial scan...');
        setTimeout(() => {
          chrome.tabs.sendMessage(activeTabId, { action: 'forceScan' });
        }, 1500);
      }
    }
  } catch (error) {
    console.error('Error during initialization:', error);
  }
  
  // Listen for document visibility changes (side panel opened)
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden) {
      console.log('Side panel became visible, refreshing detector...');
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0) {
        activeTabId = tabs[0].id;
        await checkAndInjectScript(activeTabId);
        
        // Force a scan when visibility changes
        if (detector && detector.detectorsInjected) {
          setTimeout(() => {
            chrome.tabs.sendMessage(activeTabId, { action: 'forceScan' });
          }, 500);
        }
      }
    }
  });
}

// Content script to be injected into the Twitter page (this will be stringified and injected)
function injectDetectorCode() {
  // Log that we've been injected
  console.log('CA detector content script injected into page context!');
  
  // Store detected CAs to avoid duplicates
  const detectedCAs = new Set();
  let lastProcessedCA = null;
  let isScrolling = false;
  let scrollTimeout = null;
  const SCROLL_DELAY = 300; // ms to wait after scrolling stops
  let lastScrollY = window.scrollY;
  
  // Regular expression to match Solana contract addresses
  const CA_REGEX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
  
  // Log function that sends logs to the panel context
  function logToPanel(message) {
    chrome.runtime.sendMessage({ action: 'log', message });
  }
  
  // Function to extract contract addresses from text content
  function extractContractAddresses(text) {
    if (!text) return [];
    
    const matches = [];
    
    // Split text into words and filter for potential CAs
    const words = text.split(/[\s\n\r\t,.;:'"!?()[\]{}\/\\<>]+/);
    for (const word of words) {
      if (CA_REGEX.test(word)) {
        matches.push(word);
      }
    }
    
    if (matches.length > 0) {
      logToPanel('Found CA matches: ' + matches.join(', '));
    }
    
    return matches;
  }
  
  // Function to scan the visible page content for contract addresses
  function scanForContractAddresses() {
    logToPanel('Scanning page for contract addresses...');
    
    // Get all elements that might contain text - be more thorough
    const textElements = document.querySelectorAll('div, span, p, a, h1, h2, h3, h4, h5, h6');
    logToPanel(`Scanning ${textElements.length} text elements for CAs`);
    
    const cas = [];
    
    // Extract CAs from each element
    textElements.forEach(element => {
      // Skip hidden elements
      if (element.offsetParent === null) {
        return;
      }
      
      // Get the position relative to the viewport
      const rect = element.getBoundingClientRect();
      // Only process elements that are actually visible on screen (not preloaded content)
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const text = element.textContent;
        const addresses = extractContractAddresses(text);
        
        if (addresses.length > 0) {
          addresses.forEach(address => {
            // Only add new addresses that haven't been processed yet
            if (!detectedCAs.has(address)) {
              cas.push({
                address: address,
                element: element,
                position: rect.top
              });
              detectedCAs.add(address);
            }
          });
        }
      }
    });
    
    // Sort CAs by vertical position (top to bottom)
    cas.sort((a, b) => a.position - b.position);
    
    logToPanel(`Found ${cas.length} new contract addresses`);
    
    // Process the next unprocessed CA (if available)
    processNextCA(cas);
  }
  
  // Function to process the next CA in the list
  function processNextCA(cas) {
    if (cas.length === 0) {
      logToPanel('No new contract addresses found');
      return;
    }
    
    // Filter to only include CAs that are currently visible
    const visibleCAs = cas.filter(ca => {
      const rect = ca.element.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    });
    
    if (visibleCAs.length === 0) {
      logToPanel('No visible contract addresses found');
      return;
    }
    
    // Find the next CA that's below the last processed one
    let nextCA = null;
    
    if (!lastProcessedCA) {
      // If this is the first scan, take the topmost CA
      nextCA = visibleCAs[0];
    } else {
      // Find the next CA below the last processed one
      for (const ca of visibleCAs) {
        if (ca.position > lastProcessedCA.position) {
          nextCA = ca;
          break;
        }
      }
      
      // If no CA below the last one is found, don't change anything
      if (!nextCA) {
        logToPanel('No new CAs below the last processed one');
        return;
      }
    }
    
    if (nextCA) {
      logToPanel('Found new contract address: ' + nextCA.address);
      lastProcessedCA = nextCA;
      
      // Highlight the element containing the CA (for debugging/visual feedback)
      nextCA.element.style.border = '2px solid red';
      
      // Send message to the extension
      try {
        chrome.runtime.sendMessage({
          action: 'caDetected',
          contractAddress: nextCA.address,
          url: window.location.href
        });
      } catch (error) {
        logToPanel('Failed to send message to extension: ' + error);
      }
    }
  }
  
  // Set up scroll event listener
  function setupScrollListener() {
    logToPanel('Setting up scroll listener');
    window.addEventListener('scroll', () => {
      isScrolling = true;
      
      // Check if we've scrolled more than 200px since last check
      const currentScrollY = window.scrollY;
      const hasScrolledSignificantly = Math.abs(currentScrollY - lastScrollY) > 200;
      
      // Clear previous timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Set new timeout
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        logToPanel('Scrolling stopped, scanning for new CAs...');
        lastScrollY = currentScrollY;
        scanForContractAddresses();
      }, SCROLL_DELAY);
      
      // If we've scrolled significantly, scan immediately without waiting for stop
      if (hasScrolledSignificantly) {
        logToPanel('Significant scroll detected, scanning during scroll');
        lastScrollY = currentScrollY;
        scanForContractAddresses();
      }
    });
    
    // Also scan when the user interacts with the page
    document.addEventListener('click', () => {
      setTimeout(() => {
        logToPanel('Click detected, scanning for new CAs...');
        scanForContractAddresses();
      }, 500);
    });
  }
  
  // Set up mutation observer to detect dynamic content changes
  function setupMutationObserver() {
    logToPanel('Setting up mutation observer');
    const observer = new MutationObserver(mutations => {
      let shouldScan = false;
      
      // Look for significant DOM changes that might contain new CAs
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && 
                (node.tagName === 'DIV' || node.tagName === 'SPAN' || 
                 node.tagName === 'P' || node.tagName === 'A')) {
              shouldScan = true;
              break;
            }
          }
        }
        
        if (shouldScan) break;
      }
      
      // Only scan if we found significant changes and not currently scrolling
      if (shouldScan && !isScrolling) {
        // Wait a bit for the DOM to settle after changes
        setTimeout(() => {
          logToPanel('DOM changed, scanning for new CAs...');
          scanForContractAddresses();
        }, 500);
      }
    });
    
    // Start observing the document body for DOM changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  
  // Periodically scan for CAs, in case scroll or mutation events miss some
  function setupPeriodicScanner() {
    logToPanel('Setting up periodic scanner');
    setInterval(() => {
      if (!isScrolling) {
        logToPanel('Running periodic scan for CAs...');
        scanForContractAddresses();
      }
    }, 5000); // Scan every 5 seconds
  }
  
  // Listen for messages from the panel script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'checkForCAs') {
      scanForContractAddresses();
      sendResponse({ scanning: true });
    }
    else if (message.action === 'forceScan') {
      // Reset lastProcessedCA to ensure we find the topmost CA again
      lastProcessedCA = null;
      logToPanel('Forced scan triggered, searching for CAs from the top');
      scanForContractAddresses();
      sendResponse({ scanning: true });
    }
    
    // Return true for async responses
    return true;
  });
  
  // Initialize the detector
  function initialize() {
    logToPanel('CA detector initialized in page context');
    
    // Initial scan for CAs
    setTimeout(() => {
      scanForContractAddresses();
    }, 1000);
    
    // Set up event listeners
    setupScrollListener();
    setupMutationObserver();
    setupPeriodicScanner();
  }
  
  // Run initialization
  initialize();
}

// Initialize when the script loads
initialize(); 