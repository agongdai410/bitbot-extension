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
  let scrollDirection = 'down'; // Track scroll direction
  
  // Regular expression to match Solana contract addresses
  const CA_REGEX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
  
  // Get extension URL for the SVG icon
  const BITBOT_ICON_URL = chrome.runtime.getURL('icons/bitbot.svg');
  
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
    
    // First get all text-containing elements
    const allTextElements = document.querySelectorAll('div, span, p, a, h1, h2, h3, h4, h5, h6');
    logToPanel(`Found ${allTextElements.length} total text elements`);
    
    // Filter to focus on leaf-like nodes - elements that either:
    // 1. Have no children with text content
    // 2. Have minimal nesting and contain contract addresses themselves
    const leafElements = Array.from(allTextElements).filter(el => {
      // Skip invisible elements early
      if (el.offsetParent === null) {
        return false;
      }
      
      // Check if this element has text directly in it (not just in children)
      const directText = Array.from(el.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent.trim())
        .join('');
        
      // Either it has direct text containing numbers (potential CA)
      // or it has no child elements with their own text
      return (directText.match(/[0-9]+/) && directText.length > 10) || 
             (el.children.length === 0 && el.textContent.trim().length > 0);
    });
    
    logToPanel(`Filtered to ${leafElements.length} leaf-like elements for CA scanning`);
    
    const visibleCAs = [];
    
    // Process only the filtered leaf elements
    leafElements.forEach(element => {
      // Get the position relative to the viewport
      const rect = element.getBoundingClientRect();
      
      // Only process elements that are actually visible on screen - strict visibility check
      // Element must be substantially visible in the viewport (at least 50% of height or 50px minimum)
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(window.innerHeight, rect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const elementHeight = rect.height;
      
      // Ensure element is meaningfully visible: either 50% of its height is visible or at least 50px is visible
      const isSubstantiallyVisible = 
        (visibleHeight >= elementHeight * 0.5) || // At least 50% visible
        (visibleHeight >= 50); // Or at least 50 pixels visible
      
      if (visibleHeight > 0 && isSubstantiallyVisible) {
        const text = element.textContent;
        const addresses = extractContractAddresses(text);
        
        if (addresses.length > 0) {
          addresses.forEach(address => {
            // Calculate how much of the element is visible in the viewport (visibility score)
            const visibleTop = Math.max(0, rect.top);
            const visibleBottom = Math.min(window.innerHeight, rect.bottom);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);
            
            // Calculate center distance from viewport center (for tiebreaker)
            const elementCenter = (rect.top + rect.bottom) / 2;
            const viewportCenter = window.innerHeight / 2;
            const centerDistance = Math.abs(elementCenter - viewportCenter);
            
            visibleCAs.push({
              address: address,
              element: element,
              position: rect.top,
              visibleHeight: visibleHeight,
              centerDistance: centerDistance
            });
          });
        }
      }
    });
    
    logToPanel(`Found ${visibleCAs.length} visible contract addresses`);
    
    // Process the most visible CA
    findMostVisibleCA(visibleCAs);
  }
  
  // Function to find and process the most visible CA
  function findMostVisibleCA(visibleCAs) {
    if (visibleCAs.length === 0) {
      logToPanel('No visible contract addresses found');
      return;
    }
    
    // Double-check that elements are still substantially visible (Twitter can have rapid DOM changes)
    const confirmedVisibleCAs = visibleCAs.filter(ca => {
      const rect = ca.element.getBoundingClientRect();
      
      // Calculate how much is visible right now
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(window.innerHeight, rect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const elementHeight = rect.height;
      
      // More strict visibility check for final processing - must be in good viewing position
      return (visibleHeight > 0) && 
             ((visibleHeight >= elementHeight * 0.5) || (visibleHeight >= 50)) &&
             (rect.top < window.innerHeight * 0.8); // Not near bottom edge of viewport
    });
    
    if (confirmedVisibleCAs.length === 0) {
      logToPanel('No substantially visible contract addresses found');
      return;
    }
    
    // Special handling for scrolling up - prioritize CAs that appear at the top of the viewport
    let caToProcess;
    
    if (scrollDirection === 'up' && confirmedVisibleCAs.length > 0) {
      // When scrolling up, prioritize CAs that are newly visible near the top of the screen
      // Sort by position from top (smaller top value means higher in the viewport)
      const topCAs = [...confirmedVisibleCAs].sort((a, b) => a.position - b.position);
      
      // Find a CA that's near the top and likely newly visible
      for (const ca of topCAs) {
        const rect = ca.element.getBoundingClientRect();
        // Consider it newly visible if it's in the top 1/3 of the viewport
        if (rect.top >= 0 && rect.top < window.innerHeight / 3) {
          // If this CA is different from the last processed one, use it
          if (!lastProcessedCA || ca.address !== lastProcessedCA.address) {
            logToPanel(`Found newly visible CA at top while scrolling up: ${ca.address}`);
            caToProcess = ca;
            break;
          }
        }
      }
      
      // If no suitable CA found for scrolling up, fall back to most visible one
      if (!caToProcess) {
        caToProcess = getDefaultCA(confirmedVisibleCAs);
      }
    } else {
      // For scrolling down or when direction isn't relevant, use standard logic
      caToProcess = getDefaultCA(confirmedVisibleCAs);
    }
    
    processSelectedCA(caToProcess);
  }
  
  // Helper function to get the most visible CA using default sorting logic
  function getDefaultCA(visibleCAs) {
    // Sort CAs by visibility score (most visible first) and then by center distance (closest to center first)
    const sortedCAs = [...visibleCAs].sort((a, b) => {
      // First compare by visible height
      if (b.visibleHeight !== a.visibleHeight) {
        return b.visibleHeight - a.visibleHeight;
      }
      // If tied on visible height, compare by distance from center
      return a.centerDistance - b.centerDistance;
    });
    
    // Return the most visible CA
    return sortedCAs[0];
  }
  
  // Helper function to process the selected CA
  function processSelectedCA(ca) {
    logToPanel(`Processing CA: ${ca.address} (height: ${ca.visibleHeight}, center distance: ${ca.centerDistance.toFixed(2)})`);
    
    // Check if this is different from the last processed CA
    const isSameAsLastCA = lastProcessedCA && 
                         lastProcessedCA.address === ca.address &&
                         Math.abs(lastProcessedCA.position - ca.position) < 10;
    
    if (!isSameAsLastCA) {
      logToPanel(`Showing new CA: ${ca.address}`);
      
      // Remove previous highlight if it exists
      if (lastProcessedCA) {
        // Look for any previously highlighted spans and remove them
        removeAllHighlights();
      }
      
      // Update the last processed CA
      lastProcessedCA = ca;
      
      // Highlight the specific CA text within the element
      highlightCAText(ca.element, ca.address);
      
      // Send message to the extension
      try {
        chrome.runtime.sendMessage({
          action: 'caDetected',
          contractAddress: ca.address,
          url: window.location.href
        });
      } catch (error) {
        logToPanel('Failed to send message to extension: ' + error);
      }
    } else {
      logToPanel('CA is the same as the last processed one, not sending again');
    }
  }
  
  // Helper function to remove all highlight spans
  function removeAllHighlights() {
    const highlightedSpans = document.querySelectorAll('.bitbot-ca-highlight');
    highlightedSpans.forEach(span => {
      try {
        // Get the original CA text (without the button)
        const caAddress = span.getAttribute('data-address');
        
        // Create a new text node with just the CA address
        const textNode = document.createTextNode(caAddress || span.firstChild.textContent);
        
        // Replace the span with the text node
        const parent = span.parentNode;
        if (parent) {
          parent.replaceChild(textNode, span);
        }
      } catch (e) {
        logToPanel('Error removing highlight: ' + e.message);
      }
    });
  }
  
  // Function to highlight the specific CA text within an element
  function highlightCAText(element, caAddress) {
    // Find the text node containing the CA
    const walker = document.createTreeWalker(
      element, 
      NodeFilter.SHOW_TEXT,
      { acceptNode: node => node.textContent.includes(caAddress) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }
    );
    
    const textNode = walker.nextNode();
    if (!textNode) {
      logToPanel('Could not find text node containing CA');
      return;
    }
    
    // Get the text content and index of the CA
    const text = textNode.textContent;
    const caIndex = text.indexOf(caAddress);
    
    if (caIndex === -1) {
      logToPanel('Could not find CA in text node');
      return;
    }
    
    // Split the text node into before, CA, and after parts
    const beforeText = text.substring(0, caIndex);
    const afterText = text.substring(caIndex + caAddress.length);
    
    // Create the highlighted span for the CA
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'bitbot-ca-highlight';
    highlightSpan.textContent = caAddress;
    highlightSpan.style.cssText = 'border: 2px solid orange; border-radius: 4px; padding: 1px 2px; margin: 0 2px; display: inline-flex; align-items: center;';
    
    // Create Bitbot button
    const button = document.createElement('button');
    button.className = 'bitbot-ca-button';
    button.style.cssText = 'background: linear-gradient(45deg, #ff8c00, #ff6347); color: white; border: none; border-radius: 4px; margin-left: 4px; padding: 1px 4px; font-size: 10px; cursor: pointer; display: inline-flex; align-items: center;';
    
    // Create icon for button
    let iconElement;
    
    try {
      // Try to create image element with SVG icon
      const icon = document.createElement('img');
      icon.src = BITBOT_ICON_URL || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij48Y2lyY2xlIGN4PSI4IiBjeT0iOCIgcj0iNyIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==';
      icon.alt = 'Bitbot';
      icon.style.cssText = 'height: 12px; width: 12px; margin-right: 2px;';
      icon.onerror = () => {
        // If icon fails to load, replace with a simple circle
        const fallbackIcon = document.createElement('span');
        fallbackIcon.style.cssText = 'display: inline-block; width: 8px; height: 8px; background-color: white; border-radius: 50%; margin-right: 3px;';
        button.replaceChild(fallbackIcon, icon);
      };
      iconElement = icon;
    } catch (e) {
      // Fallback to a simple circle if the icon creation fails
      const fallbackIcon = document.createElement('span');
      fallbackIcon.style.cssText = 'display: inline-block; width: 8px; height: 8px; background-color: white; border-radius: 50%; margin-right: 3px;';
      iconElement = fallbackIcon;
    }
    
    // Add text to button
    const buttonText = document.createTextNode('Bitbot');
    
    // Assemble button
    button.appendChild(iconElement);
    button.appendChild(buttonText);
    
    // Add event handler to button
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Trigger the same action as when the CA is detected
      chrome.runtime.sendMessage({
        action: 'caDetected',
        contractAddress: caAddress,
        url: window.location.href
      });
    });
    
    // Add button to highlighted span
    highlightSpan.appendChild(button);
    
    // Replace the original text node with our highlighted version
    const parent = textNode.parentNode;
    
    // Create text nodes for before and after parts
    const beforeNode = document.createTextNode(beforeText);
    const afterNode = document.createTextNode(afterText);
    
    // Replace the original node with our three parts
    parent.replaceChild(afterNode, textNode);
    parent.insertBefore(highlightSpan, afterNode);
    parent.insertBefore(beforeNode, highlightSpan);
    
    logToPanel('Successfully highlighted CA text with Bitbot button');
  }
  
  // Set up scroll event listener
  function setupScrollListener() {
    logToPanel('Setting up scroll listener');
    let scrollStoppedDuration = 0;
    const SCROLL_SETTLE_TIME = 350; // ms to wait after scrolling stops to consider it "settled"
    
    window.addEventListener('scroll', () => {
      isScrolling = true;
      scrollStoppedDuration = 0; // Reset the duration whenever scrolling happens
      
      // Detect scroll direction
      const currentScrollY = window.scrollY;
      scrollDirection = currentScrollY < lastScrollY ? 'up' : 'down';
      lastScrollY = currentScrollY;
      
      // Clear previous timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Set new timeout with two phases - first wait for brief pause
      scrollTimeout = setTimeout(() => {
        // First check if scroll has stopped for a short time
        if (scrollStoppedDuration === 0) {
          scrollStoppedDuration = Date.now();
          
          // Set another timeout to verify scrolling has fully settled
          scrollTimeout = setTimeout(() => {
            const timeSinceScrollStopped = Date.now() - scrollStoppedDuration;
            
            // Only proceed if we've been stopped for the settle time
            if (timeSinceScrollStopped >= SCROLL_SETTLE_TIME) {
              isScrolling = false;
              logToPanel(`Scrolling has fully stopped (direction: ${scrollDirection}), scanning for CAs...`);
              scanForContractAddresses();
            }
          }, SCROLL_SETTLE_TIME);
        }
      }, 150);
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
      // Remove any previous CA highlights
      removeAllHighlights();
      
      // Clear the tracked highlights
      highlightedCAs.clear();
      
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