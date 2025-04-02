/**
 * X page content script
 * Detects contract addresses in the URL and adds UI elements
 */

(function() {
  console.log('GMGN.ai content script loaded');

  // Base64 encoded SVG icons
  const SVG_ICONS = {
    LIGHTNING: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOCIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDggMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik0zLjIxMTYgMTQuOTk5NUgyLjQwNTlMMS41MTYxNSAxMy42OTg3TDMuMzg5NDkgOC43MTQ3NUgxLjg5MTU0TDEgNy40MTE1MUwzLjM0NDM2IDEuOTkxNDhMNi41MTM0NyAwLjY5MDY3NEw3LjQxNjEyIDEuOTkxNDhMNC43MDEwOSA4LjIyNzU2TDUuOTAzNDcgNi45Mjk3M0w2LjgwNzU4IDguMjI3NTZMMy4yMTE2IDE0Ljk5OTVaIiBmaWxsPSIjMkIyQjJCIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjAuMjkwMzM3IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik0xLjUxNDM2IDEzLjY5ODdMMi40OTc5NSA3LjQxMzk0SDFMMi40NTI4MiAwLjY5MDY3NEg2LjUyNDU4TDMuODA5NTUgNi45MjY3NUg1LjkxNjA0TDIuNDA0MSAxMy42OTg3SDEuNTE0MzZaIiBmaWxsPSIjRkZDRDAwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjAuMjkwMzM3IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik0yLjQwODE0IDEzLjY5OTFMMy4xOTk1NCAxNC45OTk5SDIuMzA4TDEuNTE2NiAxMy42OTkxSDIuNDA4MTRaIiBmaWxsPSIjNTQ1NDU0IiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjAuMjkwMzM3IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=',
    CHART: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTUuMzMzMzMgMy4zMzMzN0g3LjMzMzMzVjkuMzMzMzdINS4zMzMzM1YxMS4zMzM0SDRWOS4zMzMzN0gyVjMuMzMzMzdINFYxLjMzMzM3SDUuMzMzMzNWMy4zMzMzN1pNMy4zMzMzMyA0LjY2NjcxVjguMDAwMDRINlY0LjY2NjcxSDMuMzMzMzNaTTEyIDYuNjY2NzFIMTRWMTIuNjY2N0gxMlYxNC42NjY3SDEwLjY2NjdWMTQuNjY2N0g4LjY2NjY3VjYuNjY2NzFIMTAuNjY2N1Y0LjY2NjcxSDEyVjYuNjY2NzFaTTEwIDguMDAwMDRWMTEuMzMzNEgxMi42NjY3VjguMDAwMDRIMTBaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
    COPY: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuNjY2NjcgNC4wMDAwNFYyLjAwMDA0QzQuNjY2NjcgMS44MjMyMyA0LjczNjkgMS42NTM2NiA0Ljg2MTkzIDEuNTI4NjRDNC45ODY5NSAxLjQwMzYxIDUuMTU2NTIgMS4zMzMzNyA1LjMzMzMzIDEuMzMzMzdIMTMuMzMzM0MxMy41MTAxIDEuMzMzMzcgMTMuNjc5NyAxLjQwMzYxIDEzLjgwNDcgMS41Mjg2NEMxMy45Mjk4IDEuNjUzNjYgMTQgMS44MjMyMyAxNCAyLjAwMDA0VjExLjMzMzRDMTQgMTEuNTEwMiAxMy45Mjk4IDExLjY3OTggMTMuODA0NyAxMS44MDQ4QzEzLjY3OTcgMTEuOTI5OCAxMy41MTAxIDEyIDEzLjMzMzMgMTJIMTEuMzMzM1YxNEMxMS4zMzMzIDE0LjM2OCAxMS4wMzMzIDE0LjY2NjcgMTAuNjYyIDE0LjY2NjdIMi42NzEzM0MyLjU4MzQyIDE0LjY2NzIgMi40OTYyNiAxNC42NTA0IDIuNDE0ODggMTQuNjE3MUMyLjMzMzUgMTQuNTgzOSAyLjI1OTQ5IDE0LjUzNDkgMi4xOTcxMSAxNC40NzI5QzIuMTM0NzIgMTQuNDExIDIuMDg1MiAxNC4zMzczIDIuMDUxMzcgMTQuMjU2MUMyLjAxNzU0IDE0LjE3NSAyLjAwMDA5IDE0LjA4OCAyIDE0TDIuMDAyIDQuNjY2NzFDMi4wMDIgNC4yOTg3MSAyLjMwMiA0LjAwMDA0IDIuNjczMzMgNC4wMDAwNEg0LjY2NjY3Wk0zLjMzNTMzIDUuMzMzMzdMMy4zMzMzMyAxMy4zMzM0SDEwVjUuMzMzMzdIMy4zMzUzM1pNNiA0LjAwMDA0SDExLjMzMzNWMTAuNjY2N0gxMi42NjY3VjIuNjY2NzFINlY0LjAwMDA0WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==',
    TICK: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTguMDQ1NjMgMTMuMDc0NUwxNi45NTI3IDQuMTY2NUwxOC4zMjM4IDUuNTM2NjdMOC4wNDU2MyAxNS44MTQ5TDEuODc4OTEgOS42NDgxNEwzLjI0OTA3IDguMjc3OTdMOC4wNDU2MyAxMy4wNzQ1WiIgZmlsbD0iIzgzRDk0RiIvPgo8L3N2Zz4K'
  };

  // Store state variables for CA detection
  let lastProcessedCA = null;
  let scrollTimeout = null;
  let lastScrollY = window.scrollY;
  let scrollDirection = 'down'; // Track scroll direction
  
  // Add cooldown mechanism to prevent rapid CA switching
  let lastCASelectionTime = 0;
  const CA_SELECTION_COOLDOWN = 100; // ms to wait before selecting a new CA
  
  // Regular expression to match Solana contract addresses
  const CA_REGEX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
  
  // Log function that sends logs to the panel context
  function logToPanel(message) {
    try {
      console.log(`${new Date().toISOString()} ${message}`);
    } catch (e) {
      if (e.message.includes("Extension context invalidated")) {
        removeAllHighlights();
        this.detectorDisabled = true;
      }
    }
  }
  
  // Function to extract contract addresses from text content
  function extractContractAddresses(text) {
    if (!text) return [];
    
    const matches = [];
    
    // Split text into words and filter for potential CAs
    const words = text.split(/[\s\n\r\t,.;:'"!?()[\]{}\/\\<>]+/);
    for (const word of words) {
      // Check for direct CA matches
      if (CA_REGEX.test(word)) {
        matches.push(word);
        continue;
      }
      
      // Check for referral code prefixes (6-10 alphanumeric chars + underscore + CA)
      if (word.includes('_')) {
        const referralPattern = /^[a-zA-Z0-9]{6,10}_([1-9A-HJ-NP-Za-km-z]{43,44})$/;
        const referralMatch = word.match(referralPattern);
        
        if (referralMatch && referralMatch[1]) {
          const potentialCA = referralMatch[1];
          if (CA_REGEX.test(potentialCA)) {
            logToPanel(`Found CA with referral prefix in text: ${potentialCA}`);
            matches.push(potentialCA);
          }
        }
      }
    }
    
    if (matches.length > 0) {
      logToPanel('Found CA matches: ' + matches.join(', '));
    }
    
    return matches;
  }
  
  // Special function to detect CAs in links with partial visibility
  function scanLinksForPartialCAs() {
    // Focus on a much broader set of links with potential CAs - don't restrict to t.co
    const linkElements = document.querySelectorAll('main a[href^="https://t.co/"]');
    const visibleCAs = [];
    
    let processedCount = 0;

    linkElements.forEach(link => {
      // Skip if not visible
      if (link.offsetParent === null) {
        return;
      }

      if (!link.href.startsWith('https://t.co/')) {
        return;
      }
      
      // Check if this is in the viewport
      const rect = link.getBoundingClientRect();
      if (rect.top >= window.innerHeight || rect.bottom <= 0) {
        return; // Not in viewport
      }
      
      // Calculate visibility metrics for later use
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(window.innerHeight, rect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const elementHeight = rect.height;
      
      // Calculate center distance from viewport center (for tiebreaker)
      const elementCenter = (rect.top + rect.bottom) / 2;
      const viewportCenter = window.innerHeight / 2;
      const centerDistance = Math.abs(elementCenter - viewportCenter);
      
      // Check if substantially visible
      const isSubstantiallyVisible = 
        (visibleHeight >= elementHeight * 0.5) || // At least 50% visible
        (visibleHeight >= 50); // Or at least 50 pixels visible

      
      if (!isSubstantiallyVisible) {
        return;
      }

      // Skip links with too many child elements - focus on simpler links that may have CAs
      if (link.children.length > 5) {
        return;
      }
      
      // Get link text but don't apply too many filters - we might miss CAs
      const textContent = link.textContent;

      // Skip links with less than 30 characters
      if (textContent.length < 30) {
        return;
      }
      
      // If the link already has a CA detected (special case for scrolling)
      // Extract that CA directly rather than re-scanning the link
      if (link.hasAttribute('data-bitbot-found-ca') && link.hasAttribute('data-address')) {
        const caAddress = link.getAttribute('data-address');
        if (caAddress) {
          visibleCAs.push({
            address: caAddress,
            element: link,
            position: rect.top,
            visibleHeight: visibleHeight,
            centerDistance: centerDistance,
            isLink: true,
            isAlreadyHighlighted: link.classList.contains('bitbot-ca-link-highlight')
          });
          processedCount++;
          return;
        }
      }
      
      // Extract both the visible text and the href
      const visibleText = link.textContent.trim();
      const href = link.href || '';
      
      // Combine all possible sources of the CA
      let possibleSources = [visibleText, href];
      
      // Also extract potential truncated text from span elements
      const spans = link.querySelectorAll('span');
      let spanTexts = '';
      spans.forEach(span => {
        spanTexts += span.textContent;
      });
      
      if (spanTexts) {
        possibleSources.push(spanTexts);
      }

      // Remove non-alphanumeric characters
      possibleSources = possibleSources.map(source => source.replace(/[^?a-zA-Z0-9 _\-:/\\]/g, ''));
      
      // Try to debug what we're finding
      logToPanel(`Checking link: "${visibleText}" with href: ${href}`);
      
      // Try to extract CAs from all possible sources
      for (const source of possibleSources) {
        const addresses = extractContractAddresses(source);
        
        if (addresses.length > 0) {
          // Mark as having a found CA
          link.setAttribute('data-bitbot-found-ca', 'true');
          processedCount++;
          
          addresses.forEach(address => {
            logToPanel(`Found CA in link: ${address} (from: ${source.substring(0, 30)}...)`);
            
            visibleCAs.push({
              address: address,
              element: link,
              position: rect.top,
              visibleHeight: visibleHeight,
              centerDistance: centerDistance,
              isLink: true // Add flag to identify this as a link CA
            });
            
            // NOTE: Removed immediate highlighting - will do it after unified selection
            // highlightLinkWithCA(link, address);
          });
          
          // Once we found CAs in this link, no need to check other sources
          break;
        }
      }
      
      // If no direct CA found, attempt our URL extraction methods
      if (!link.hasAttribute('data-bitbot-found-ca') && (href.includes('token/') || visibleText.includes('token/'))) {
        const cleanURL = extractCleanURL(link);
        const addresses = extractContractAddressesFromURL(cleanURL);
        
        if (addresses.length > 0) {
          // Mark as having a found CA
          link.setAttribute('data-bitbot-found-ca', 'true');
          processedCount++;
          
          addresses.forEach(address => {
            logToPanel(`Found CA in link (from URL extraction): ${address}`);
            
            visibleCAs.push({
              address: address,
              element: link,
              position: rect.top,
              visibleHeight: visibleHeight,
              centerDistance: centerDistance,
              isLink: true // Add flag to identify this as a link CA
            });
            
            // NOTE: Removed immediate highlighting - will do it after unified selection
            // highlightLinkWithCA(link, address);
          });
        }
      }
    });
    
    logToPanel(`Special link scanning processed ${linkElements.length} links, found CAs in ${processedCount} links`);
    
    // Return the collected CAs instead of processing them here
    return visibleCAs;
  }
  
  // Function to extract a clean URL from a link element by removing HTML tags
  function extractCleanURL(linkElement) {
    // Create a temporary container
    const tempContainer = document.createElement('div');
    
    // Clone all child nodes to preserve the original link
    for (const node of linkElement.childNodes) {
      tempContainer.appendChild(node.cloneNode(true));
    }
    
    // Get the text content which will strip HTML tags
    let fullText = tempContainer.textContent;
    
    // If that fails, use the original link's text
    if (!fullText || fullText.trim() === '') {
      fullText = linkElement.textContent;
    }
    
    // Also check the href attribute which might contain the full URL
    const href = linkElement.href || '';
    
    // If the text content is truncated (ends with '…') and href is available, prefer the href
    if (fullText.includes('…') && href) {
      try {
        // Try to decode the URL if it's encoded
        const decodedHref = decodeURIComponent(href);
        return decodedHref;
      } catch (e) {
        // If decoding fails, return the original href
        return href;
      }
    }
    
    return fullText;
  }
  
  // Function to extract potential contract addresses from a URL
  function extractContractAddressesFromURL(url) {
    // First try direct extraction with the existing function
    const directMatches = extractContractAddresses(url);
    if (directMatches.length > 0) {
      return directMatches;
    }
    
    // Try to handle common URL patterns where the CA is a path segment
    if (url.includes('/token/') || url.includes('/coin/')) {
      // Extract the segment after /token/ or /coin/
      const tokenMatch = url.match(/\/(token|coin)\/([^\/\?&#]+)/i);
      if (tokenMatch && tokenMatch[2]) {
        const tokenPart = tokenMatch[2];
        
        // Check if this token part contains an underscore (common in referral links)
        if (tokenPart.includes('_')) {
          // Check for referral code pattern: 6-10 alphanumeric chars followed by underscore
          const referralPattern = /^[a-zA-Z0-9]{6,10}_(.+)$/;
          const referralMatch = tokenPart.match(referralPattern);
          
          if (referralMatch && referralMatch[1]) {
            const potentialCA = referralMatch[1];
            if (CA_REGEX.test(potentialCA)) {
              logToPanel(`Found CA with referral prefix: ${potentialCA}`);
              return [potentialCA];
            }
          }
          
          // If not a standard referral pattern, try the last part after underscore
          const parts = tokenPart.split('_');
          const lastPart = parts[parts.length - 1];
          
          // Check if the last part is a valid CA
          if (CA_REGEX.test(lastPart)) {
            return [lastPart];
          }
          
          // If not, check if the full token part is a valid CA
          if (CA_REGEX.test(tokenPart)) {
            return [tokenPart];
          }
        } else if (CA_REGEX.test(tokenPart)) {
          // If no underscore, just check if the token part is a CA
          return [tokenPart];
        }
      }
    }
    
    // If no direct matches, try to extract segments that might be parts of a CA
    // Look for paths in the URL that might contain the CA
    const urlParts = url.split(/[\/\?&=#]+/);
    
    // First check for complete matches
    for (const part of urlParts) {
      // Skip short parts or obvious non-CA segments
      if (part.length < 20 || part.includes('.') || part.includes(':')) {
        continue;
      }
      
      // Check if this part matches a CA pattern
      if (CA_REGEX.test(part)) {
        return [part];
      }
    }
    
    // If no complete CA found, look for concatenated parts that might form a CA
    // This happens when Twitter splits URLs with spans
    if (urlParts.length >= 2) {
      // Try to combine adjacent parts
      for (let i = 0; i < urlParts.length - 1; i++) {
        const part1 = urlParts[i];
        const part2 = urlParts[i + 1];
        
        // Only consider parts that don't have obvious URL components
        if (part1.includes('.') || part2.includes('.')) {
          continue;
        }
        
        // Try to combine the parts and check if it's a CA
        const combined = part1 + part2;
        if (CA_REGEX.test(combined)) {
          return [combined];
        }
        
        // Also try substrings of the combined string
        if (combined.length >= 43) {
          for (let start = 0; start <= combined.length - 43; start++) {
            const candidate = combined.substring(start, start + 44);
            if (CA_REGEX.test(candidate)) {
              return [candidate];
            }
          }
        }
      }
    }
    
    return [];
  }
  
  // Function to scan the visible page content for contract addresses
  function scanForContractAddresses() {
    // Check if we're in the cooldown period after selecting a CA
    const now = Date.now();
    if (now - lastCASelectionTime < CA_SELECTION_COOLDOWN) {
      logToPanel(`Skipping CA scan - in cooldown period (${now - lastCASelectionTime}ms < ${CA_SELECTION_COOLDOWN}ms)`);
      return;
    }
    
    logToPanel('Scanning page for contract addresses...', new Date().getTime());
    
    // First handle special case: links that contain partial CAs
    const linkCAs = scanLinksForPartialCAs() || [];
    linkCAs.forEach(ca => {
      highlightCAWithButton(ca);
    });
    logToPanel(`Found ${linkCAs.length} potential CAs in links`);
    
    // Get the main element - focus our search on the main content area
    const mainElement = document.querySelector('main');
    if (!mainElement) {
      logToPanel('No main element found, skipping text scan');
      // Even if main is not found, we should still process any link CAs we found
      if (linkCAs.length > 0) {
        findMostVisibleCA(linkCAs);
      }
      return;
    }
    
    // More targeted approach - first look for direct text nodes with numbers
    // Use a TreeWalker for better performance when scanning large DOMs
    let potentialElements = [];
    const treeWalker = document.createTreeWalker(
      mainElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip very short text, empty text, or text without numbers
          if (!node.textContent || 
              node.textContent.trim().length < 30 || 
              !node.textContent.match(/[0-9]/)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip if parent is already processed
          if (node.parentElement && node.parentElement.hasAttribute('data-bitbot-found-ca')) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Skip hidden elements
          if (node.parentElement && node.parentElement.offsetParent === null) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    // Collect potential text nodes
    let currentNode;
    let nodeCount = 0;
    let maxNodes = 300; // Limit the number of nodes to process in one scan
    
    while ((currentNode = treeWalker.nextNode()) && nodeCount < maxNodes) {
      // Add the parent element of this text node to our list of elements to check
      if (currentNode.parentElement && !potentialElements.includes(currentNode.parentElement)) {
        potentialElements.push(currentNode.parentElement);
        nodeCount++;
      }
    }
    
    logToPanel(`Found ${potentialElements.length} potential text elements to scan`);
    
    // Now filter for elements with potential CAs
    const leafElements = potentialElements.filter(el => {
      // Skip invisible elements early
      if (el.offsetParent === null) {
        return false;
      }
      
      // Skip elements where we already found a CA (not just processed elements)
      if (el.hasAttribute('data-bitbot-found-ca')) {
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
    
    const textCAs = [];
    
    // Process only the filtered leaf elements
    leafElements.forEach(element => {
      // Get the position relative to the viewport
      const rect = element.getBoundingClientRect();
      
      // Check if this element is at least partially visible
      const isPartiallyVisible = (rect.top < window.innerHeight && rect.bottom > 0);
      
      // For extraction, we'll check all elements with CAs, not just visible ones
      const text = element.textContent;
      const addresses = extractContractAddresses(text);
      
      if (addresses.length > 0) {
        addresses.forEach(address => {
          // Check if this CA has already been highlighted
          const isAlreadyHighlighted = mainElement.querySelector(`.bitbot-ca-text[data-address="${address}"]`) !== null;

          if (!isAlreadyHighlighted) {
            // Highlight all CAs with action B only (inject UI, no yellow/bold text)
            highlightCAWithButton({ element, address, isLink: false });
          }
          
          // Only add visible CAs to the textCAs array for potential current CA selection
          if (isPartiallyVisible) {
            // Calculate visibility metrics for selection
            const visibleTop = Math.max(0, rect.top);
            const visibleBottom = Math.min(window.innerHeight, rect.bottom);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);
            
            // Calculate center distance from viewport center (for tiebreaker)
            const elementCenter = (rect.top + rect.bottom) / 2;
            const viewportCenter = window.innerHeight / 2;
            const centerDistance = Math.abs(elementCenter - viewportCenter);
            
            textCAs.push({
              address: address,
              element: element,
              position: rect.top,
              visibleHeight: visibleHeight,
              centerDistance: centerDistance,
              isLink: false,
              isAlreadyHighlighted: isAlreadyHighlighted
            });
          }
        });
      }
    });
    
    logToPanel(`Found ${textCAs.length} visible contract addresses in text`);
    
    // Combine link CAs and text CAs for unified processing
    const allVisibleCAs = [...linkCAs, ...textCAs];
    logToPanel(`Total CAs found: ${allVisibleCAs.length} (${linkCAs.length} in links, ${textCAs.length} in text)`);

    // Process the most visible CA from all sources or notify panel that we're on X.com but no CA was found
    if (allVisibleCAs.length > 0) {
      findMostVisibleCA(allVisibleCAs);
    } else {
      // No CAs found, sending message with empty contractAddress
      console.log('No CAs found, sending message with empty contractAddress');
      chrome.runtime.sendMessage({
        type: 'CA_DETECTED_ON_X',
        contractAddress: '',
        url: window.location.href
      }, response => {
        if (chrome.runtime.lastError) {
          console.log(`Error sending message: ${chrome.runtime.lastError.message}`);
        } else if (response) {
          console.log(`Service worker response received: ${JSON.stringify(response)}`);
        }
      });
    }
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
      
      // Update position and visibility metrics in the CA object
      ca.visibleHeight = visibleHeight;
      ca.position = rect.top;
      
      // Calculate center distance from viewport center (for better selection)
      const elementCenter = (rect.top + rect.bottom) / 2;
      const viewportCenter = window.innerHeight / 2;
      ca.centerDistance = Math.abs(elementCenter - viewportCenter);

      // More strict visibility check for final processing - must be in good viewing position
      return (visibleHeight > 0) && 
             ((visibleHeight >= elementHeight * 0.5) || (visibleHeight >= 30)) &&
             (rect.top < window.innerHeight && rect.bottom > 0); // Not near bottom edge of viewport
    });

    if (confirmedVisibleCAs.length === 0) {
      logToPanel('No substantially visible contract addresses found');
      return;
    }
    
    const lastProcessedCAInVisibleCAs = confirmedVisibleCAs.find(ca => ca.address === (lastProcessedCA ? lastProcessedCA.address : ''));
    // Add the last processed CA to the list of visible CAs if it exists
    // Update its position to the current position, which might have changed after scrolling
    if (lastProcessedCA && lastProcessedCAInVisibleCAs) {
      const rect = lastProcessedCA.element.getBoundingClientRect();
      lastProcessedCA.position = rect.top;
      lastProcessedCAInVisibleCAs.position = rect.top;
    }
    const sortedCAs = [
      ...confirmedVisibleCAs, 
    ].sort((a, b) => a.position - b.position);

    let caToProcess;
    
    // If there's a previously processed CA and it's still visible
    if (lastProcessedCA) {
      // Find the current CA in the sorted array (if it exists)
      const currentCAIndex = sortedCAs.findIndex(ca => ca.address === lastProcessedCA.address);

      if (scrollDirection === 'down') {
        if (currentCAIndex !== -1) {
          // When scrolling down, select the next CA in the sorted array (which is below)
          if (currentCAIndex < sortedCAs.length - 1) {
            caToProcess = sortedCAs[currentCAIndex + 1];
            logToPanel(`Found CA immediately below current at index ${currentCAIndex + 1}`);
          } else {
            // If current CA is the last one, keep the current selection
            logToPanel('Current CA is already the bottommost, keeping current selection');
            return;
          }
        } else {
          // If current CA is no longer visible, select the topmost visible CA
          caToProcess = sortedCAs[0];
          logToPanel(`No current CA, selecting topmost at position ${caToProcess.position}`);
        }
      } else if (scrollDirection === 'up') {
        if (currentCAIndex !== -1) {
          // When scrolling up, select the previous CA in the sorted array (which is above)
          if (currentCAIndex > 0) {
            caToProcess = sortedCAs[currentCAIndex - 1];
            logToPanel(`Found CA immediately above current at index ${currentCAIndex - 1}`);
          } else {
            // If current CA is the first one, keep the current selection
            logToPanel('Current CA is already the topmost, keeping current selection');
            return;
          }
        } else {
          // If current CA is no longer visible, select the bottommost visible CA
          caToProcess = sortedCAs[sortedCAs.length - 1];
          logToPanel(`No current CA, selecting bottommost at position ${caToProcess.position}`);
        }
      } else {
        // If not scrolling, use default selection criteria
        caToProcess = getDefaultCA(confirmedVisibleCAs);
      }
    } else {
      // No previous CA was processed, select based on scroll direction
      if (scrollDirection === 'down') {
        // Select topmost CA
        caToProcess = sortedCAs[0];
        logToPanel(`No previous CA, scrolling down: selecting topmost at position ${caToProcess.position}`);
      } else if (scrollDirection === 'up') {
        // Select bottommost CA
        caToProcess = sortedCAs[sortedCAs.length - 1];
        logToPanel(`No previous CA, scrolling up: selecting bottommost at position ${caToProcess.position}`);
      } else {
        // If not scrolling, use default selection criteria
        caToProcess = getDefaultCA(confirmedVisibleCAs);
      }
    }
    
    // Process the selected CA
    processSelectedCA(caToProcess);
  }
  
  // Helper function to get the most visible CA using default sorting logic
  function getDefaultCA(visibleCAs) {
    // Sort CAs by visibility score and position in viewport
    const sortedCAs = [...visibleCAs].sort((a, b) => {
      // Calculate optimal position based on scroll direction
      // When scrolling down, prefer CAs in the upper half of the viewport
      // When scrolling up, prefer CAs in the lower half of the viewport
      const idealPosition = scrollDirection === 'down' ? 
                          window.innerHeight * 0.3 : // 30% down from the top when scrolling down
                          window.innerHeight * 0.7;  // 70% down from the top when scrolling up
      
      const aRect = a.element.getBoundingClientRect();
      const bRect = b.element.getBoundingClientRect();
      
      // Calculate center of each element
      const aCenter = (aRect.top + aRect.bottom) / 2;
      const bCenter = (bRect.top + bRect.bottom) / 2;
      
      // Calculate distance from the ideal position
      const aDistance = Math.abs(aCenter - idealPosition);
      const bDistance = Math.abs(bCenter - idealPosition);
      
      // First, if one is already highlighted and the other isn't, prefer the non-highlighted one
      if (a.isAlreadyHighlighted && !b.isAlreadyHighlighted) return 1;
      if (!a.isAlreadyHighlighted && b.isAlreadyHighlighted) return -1;
      
      // First compare by visible height (more visible is better)
      if (b.visibleHeight !== a.visibleHeight) {
        return b.visibleHeight - a.visibleHeight;
      }
      
      // Then compare by distance from ideal position based on scroll direction
      return aDistance - bDistance;
    });
    
    // Return the most optimal CA
    return sortedCAs[0];
  }
  
  // Helper function to process the selected CA
  function processSelectedCA(ca) {
    if (!ca) return;
    
    logToPanel(`Processing CA: ${ca.address} (height: ${ca.visibleHeight}, center distance: ${ca.centerDistance.toFixed(2)}, isLink: ${ca.isLink})`);
    
    // Check if this is different from the last processed CA
    const isSameAsLastCA = lastProcessedCA && 
                         lastProcessedCA.address === ca.address &&
                         Math.abs(lastProcessedCA.position - ca.position) < 20;
    
    if (!isSameAsLastCA) {
      logToPanel(`Showing new CA: ${ca.address}`);
      
      // If there was a previously selected CA, remove its highlight (action A - yellow/bold)
      if (lastProcessedCA) {
        removeCurrentCAHighlight(lastProcessedCA);
      }
      
      // Update the last processed CA
      lastProcessedCA = ca;
      
      // Record the time when this CA was selected (for cooldown)
      lastCASelectionTime = Date.now();
      
      // Apply highlight to the current CA (action A - yellow/bold)
      applyCurrentCAHighlight(ca);
      
      // Send message to the extension to load the gmgn.ai page
      try {
        // Using consistent message format that the service worker expects
        logToPanel(`Sending message to service worker for CA: ${ca.address}`);
        chrome.runtime.sendMessage({
          type: 'CA_DETECTED_ON_X',  // Use 'type' instead of 'action' for consistency
          contractAddress: ca.address,
          url: window.location.href
        }, response => {
          if (chrome.runtime.lastError) {
            logToPanel(`Error sending message: ${chrome.runtime.lastError.message}`);
          } else if (response) {
            logToPanel(`Service worker response received: ${JSON.stringify(response)}`);
          }
        });
      } catch (error) {
        logToPanel(`Failed to send message to extension: ${error}`);
      }
    } else {
      logToPanel('CA is the same as the last processed one, not sending again');
    }
  }

  // Function to apply action A (yellow/bold highlight) to the current CA
  function applyCurrentCAHighlight(ca) {
    if (!ca) return;

    try {
      if (ca.isLink) {
        // For links, find the link element and apply highlighting
        const linkElement = ca.element;
        if (linkElement) {
          linkElement.classList.add('bitbot-ca-current');
          linkElement.style.color = '#FFCD01';
          linkElement.style.fontWeight = '600';
          linkElement.style.textDecoration = 'underline';
          
          // Find the associated bitbot UI and highlight its chart button
          const buttonContainer = linkElement.parentElement.querySelector('.bitbot-ca-button');
          if (buttonContainer) {
            const chartDiv = buttonContainer.children[2]; // The chart button is the 3rd child (index 2)
            if (chartDiv) {
              chartDiv.style.background = 'rgba(255,255,255,0.16)';
            }
          }
        }
      } else {
        // For text CAs, find the span containing the CA text
        const caTextSpan = findCATextSpan(ca.element, ca.address);
        if (caTextSpan) {
          caTextSpan.classList.add('bitbot-ca-current');
          caTextSpan.style.color = '#FFCD01';
          caTextSpan.style.fontWeight = '600';
          caTextSpan.style.textDecoration = 'underline';
          
          // Find the associated bitbot UI and highlight its chart button
          const buttonContainer = ca.element.parentElement.querySelector('.bitbot-ca-button');
          if (buttonContainer) {
            const chartDiv = buttonContainer.children[2]; // The chart button is the 3rd child (index 2)
            if (chartDiv) {
              chartDiv.style.background = 'rgba(255,255,255,0.16)';
            }
          }
        }
      }
    } catch (e) {
      logToPanel(`Error applying current CA highlight: ${e.message}`);
    }
  }

  // Function to remove action A (yellow/bold highlight) from the previous current CA
  function removeCurrentCAHighlight(ca) {
    if (!ca) return;

    try {
      if (ca.isLink) {
        // For links, find the link element and remove highlighting
        const linkElement = ca.element;
        if (linkElement) {
          linkElement.classList.remove('bitbot-ca-current');
          linkElement.style.color = '';
          linkElement.style.fontWeight = '';
          linkElement.style.textDecoration = '';
          
          // Find the associated bitbot UI and remove chart button highlight
          const buttonContainer = linkElement.parentElement.querySelector('.bitbot-ca-button');
          if (buttonContainer) {
            const chartDiv = buttonContainer.children[2]; // The chart button is the 3rd child (index 2)
            if (chartDiv) {
              chartDiv.style.background = 'transparent';
            }
          }
        }
      } else {
        // For text CAs, find the span containing the CA text
        const caTextSpan = findCATextSpan(ca.element, ca.address);
        if (caTextSpan) {
          caTextSpan.classList.remove('bitbot-ca-current');
          caTextSpan.style.color = '';
          caTextSpan.style.fontWeight = '';
          caTextSpan.style.textDecoration = '';
          
          // Find the associated bitbot UI and remove chart button highlight
          const buttonContainer = caTextSpan.parentElement.querySelector('.bitbot-ca-button');
          if (buttonContainer) {
            const chartDiv = buttonContainer.children[2]; // The chart button is the 3rd child (index 2)
            if (chartDiv) {
              chartDiv.style.background = 'transparent';
            }
          }
        }
      }
    } catch (e) {
      logToPanel(`Error removing current CA highlight: ${e.message}`);
    }
  }

  // Helper function to find the text span for a CA
  function findCATextSpan(element, address) {
    if (!element || !address) return null;

    if (element.classList.contains('bitbot-ca-text') && element.getAttribute('data-address') === address) {
      return element;
    }
    
    // Try to find by data-address attribute first
    let span = element.querySelector(`.bitbot-ca-text[data-address="${address}"]`);
    
    // If not found, try to find by text content
    if (!span) {
      const spans = element.querySelectorAll('.bitbot-ca-text');
      for (const s of spans) {
        if (s.textContent === address) {
          span = s;
          break;
        }
      }
    }
    
    return span;
  }

  // New function to highlight CA with button only (action B)
  function highlightCAWithButton(ca) {
    if (ca.isLink) {
      // For link elements
      highlightLinkWithButton(ca.element, ca.address);
    } else {
      // For text elements
      highlightTextWithButton(ca.element, ca.address);
    }
  }

  // For text elements - only add the button, no text styling
  function highlightTextWithButton(element, caAddress) {
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
    
    // Create the outer wrapper span with flex layout
    const highlightSpan = document.createElement('span');
    highlightSpan.className = 'bitbot-ca-highlight';
    highlightSpan.setAttribute('data-address', caAddress);
    highlightSpan.style.cssText = 'display:inline-flex; flex-wrap: wrap; line-height: 2; align-items: center; position: relative;';
    
    // Create inner span for the CA text (without applying yellow/bold styling yet)
    const caTextSpan = document.createElement('span');
    caTextSpan.className = 'bitbot-ca-text';
    caTextSpan.setAttribute('data-address', caAddress);
    caTextSpan.textContent = caAddress;
    caTextSpan.style.cssText = ''; // No styling initially
    
    // Add the CA text span to the wrapper span
    highlightSpan.appendChild(caTextSpan);
    
    // Create and add Bitbot button using the extracted function
    const button = injectAmpUi(caAddress, element, false);
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
    
    // Mark the element as processed
    element.setAttribute('data-bitbot-found-ca', 'true');
    
    logToPanel('Successfully highlighted CA text with button only');
  }

  // For link elements - only add the button, no text styling
  function highlightLinkWithButton(linkElement, caAddress) {
    // First, check if this link already has a Bitbot button
    if (linkElement.querySelector('.bitbot-ca-button')) {
      return; // Already has a button
    }
    
    // Check if the link is already wrapped
    if (linkElement.parentNode && linkElement.parentNode.classList.contains('bitbot-ca-link-wrapper')) {
      return; // Already wrapped
    }
    
    // Since we're using absolute positioning, we need to create a wrapper if the link isn't already positioned
    const currentPosition = window.getComputedStyle(linkElement).position;
    if (currentPosition === 'static') {
      linkElement.style.position = 'relative';
    }
    
    // Add a special class for identification
    linkElement.classList.add('bitbot-ca-link-highlight');
    
    // Store the original address for reference
    linkElement.setAttribute('data-address', caAddress);
    linkElement.setAttribute('data-bitbot-found-ca', 'true');
    
    // Create a wrapper element
    const wrapper = document.createElement('div');
    wrapper.className = 'bitbot-ca-link-wrapper';
    wrapper.style.cssText = 'display: inline-flex; flex-wrap: wrap; line-height: 2; align-items: center; gap: 8px;';
    
    // Insert the wrapper into the DOM in place of the linkElement
    linkElement.parentNode.insertBefore(wrapper, linkElement);
    
    // Move the linkElement into the wrapper
    wrapper.appendChild(linkElement);
    
    // Create and add button to the wrapper (not the link)
    const button = injectAmpUi(caAddress, linkElement, true);
    wrapper.appendChild(button);
    
    logToPanel('Successfully highlighted link with button only');
  }

  // Helper function to remove all highlight spans
  function removeAllHighlights() {
    // Regular text highlights
    const highlightedSpans = document.querySelectorAll('.bitbot-ca-highlight');
    highlightedSpans.forEach(span => {
      try {
        // Get the original CA text (without the UI elements)
        const caAddress = span.getAttribute('data-address');
        
        // First remove any buttons/divs inside the span
        const elements = span.querySelectorAll('.bitbot-ca-button');
        elements.forEach(el => el.parentNode.removeChild(el));
        
        // Get the CA text from the inner span if it exists, or from the attribute
        let caText = caAddress;
        const caTextSpan = span.querySelector('.bitbot-ca-text');
        if (caTextSpan) {
          caText = caTextSpan.textContent || caAddress;
        }
        
        // Create a new text node with just the CA address
        const textNode = document.createTextNode(caText);
        
        // Replace the span with the text node
        const parent = span.parentNode;
        if (parent) {
          parent.replaceChild(textNode, span);
        }
      } catch (e) {
        logToPanel('Error removing highlight: ' + e.message);
      }
    });
    
    // Link highlights with wrappers
    const highlightWrappers = document.querySelectorAll('.bitbot-ca-link-wrapper');
    highlightWrappers.forEach(wrapper => {
      try {
        // Find the link inside the wrapper
        const link = wrapper.querySelector('.bitbot-ca-link-highlight');
        if (link) {
          // Restore original link styling
          link.style.position = '';
          link.classList.remove('bitbot-ca-link-highlight');
          link.classList.remove('bitbot-ca-current');
          link.style.color = '';
          link.style.fontWeight = '';
          link.style.textDecoration = '';
          
          // Remove data attributes so the link can be re-processed
          link.removeAttribute('data-bitbot-found-ca');
          link.removeAttribute('data-address');
          
          // Remove any buttons that might be directly inside the link
          const elements = link.querySelectorAll('.bitbot-ca-button');
          elements.forEach(el => el.parentNode.removeChild(el));
          
          // Move the link out of the wrapper back to its original position
          wrapper.parentNode.insertBefore(link, wrapper);
          wrapper.parentNode.removeChild(wrapper);
        } else {
          // If no link found, just remove the wrapper
          wrapper.parentNode.removeChild(wrapper);
        }
      } catch (e) {
        logToPanel('Error removing highlight wrapper: ' + e.message);
      }
    });
    
    // Clean up any orphaned UI elements that might remain outside of links/spans
    const allElements = document.querySelectorAll('.bitbot-ca-button');
    allElements.forEach(element => {
      try {
        element.parentNode.removeChild(element);
      } catch (e) {
        logToPanel('Error removing orphaned UI element: ' + e.message);
      }
    });
  }

  // Function to create and inject the APM UI for a contract address
  function injectAmpUi(caAddress, element, isLink) {
    // Create wrapper div
    const wrapper = document.createElement('div');
    wrapper.className = 'bitbot-ca-button'; // Keep the same class for compatibility
    wrapper.style.cssText = 'height: 28px; background: #252525; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 0; display: inline-flex; align-items: center;';
    
    // First child div - Trade button
    const tradeDiv = document.createElement('div');
    tradeDiv.style.cssText = 'text-decoration: none; padding: 0 8px; display: flex; align-items: center; font-weight: 500; font-size: 14px; color: #FFCD01; cursor: pointer;';
    
    // Add hover effect
    tradeDiv.addEventListener('mouseover', () => {
      tradeDiv.style.background = 'rgba(255,255,255,0.16)';
    });
    tradeDiv.addEventListener('mouseout', () => {
      tradeDiv.style.background = 'transparent';
    });
    
    // Add lightning icon
    const lightningIcon = document.createElement('img');
    lightningIcon.src = SVG_ICONS.LIGHTNING;
    lightningIcon.alt = 'Trade';
    lightningIcon.style.cssText = 'height: 28px; width: 8px; margin-right: 4px;';
    
    // Add text
    const tradeText = document.createTextNode('Trade');
    
    // Assemble trade div
    tradeDiv.appendChild(lightningIcon);
    tradeDiv.appendChild(tradeText);
    
    // Add click handler to open Telegram bot
    tradeDiv.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Open Telegram bot with the contract address
      window.open(`https://t.me/test_newbitbot?start=trade-${caAddress}`, '_blank');
    });
    
    // Create first divider
    const divider1 = document.createElement('div');
    divider1.style.cssText = 'height: 9px; width: 1px; background-color: rgba(255,255,255,0.08);';
    
    // Second child div - Chart button
    const chartDiv = document.createElement('div');
    chartDiv.style.cssText = 'height: 28px; width: 36px; display: flex; justify-content: center; align-items: center; cursor: pointer;';
    
    // Add hover effect
    chartDiv.addEventListener('mouseover', () => {
      chartDiv.style.background = 'rgba(255,255,255,0.16)';
    });
    chartDiv.addEventListener('mouseout', () => {
      const isActive = wrapper.parentElement.querySelector('.bitbot-ca-current');
      if (!isActive) {
        chartDiv.style.background = 'transparent';
      }
    });
    
    // Add chart icon
    const chartIcon = document.createElement('img');
    chartIcon.src = SVG_ICONS.CHART;
    chartIcon.alt = 'Chart';
    chartIcon.style.cssText = 'height: 16px; width: 16px;';
    
    // Assemble chart div
    chartDiv.appendChild(chartIcon);
    
    // Add click handler for chart function
    chartDiv.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('sendCaToApm:', caAddress);
      chrome.runtime.sendMessage({
        type: 'CA_DETECTED_ON_X',
        contractAddress: caAddress,
        url: window.location.href,
        forceRefresh: true,
      });
      if (element) {
        const rect = element.getBoundingClientRect();
        const visibleHeight = window.innerHeight || document.documentElement.clientHeight;
        const centerDistance = Math.abs(rect.top - (visibleHeight / 2));
        processSelectedCA({
          element,
          address: caAddress,
          isLink,
          position: rect.top,
          visibleHeight: visibleHeight,
          centerDistance: centerDistance,
        });
      }
      sendCaToApm(caAddress); // Call the implemented function
    });
    
    // Create second divider
    const divider2 = document.createElement('div');
    divider2.style.cssText = 'height: 9px; width: 1px; background-color: rgba(255,255,255,0.08);';
    
    // Third child div - Copy button
    const copyDiv = document.createElement('div');
    copyDiv.style.cssText = 'height: 28px;width: 36px; display: flex; justify-content: center; align-items: center; cursor: pointer;';
    
    // Add hover effect
    copyDiv.addEventListener('mouseover', () => {
      copyDiv.style.background = 'rgba(255,255,255,0.16)';
    });
    copyDiv.addEventListener('mouseout', () => {
      copyDiv.style.background = 'transparent';
    });
    
    // Add copy icon
    const copyIcon = document.createElement('img');
    copyIcon.src = SVG_ICONS.COPY;
    copyIcon.alt = 'Copy';
    copyIcon.style.cssText = 'height: 16px; width: 16px;';
    
    // Assemble copy div
    copyDiv.appendChild(copyIcon);
    
    // Add click handler for copy function
    copyDiv.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Copy address to clipboard
      copyToClipboard(caAddress);
      
      // Change icon to tick
      copyIcon.src = SVG_ICONS.TICK;
      copyDiv.style.cursor = 'default';
      
      // Disable click for 3 seconds
      copyDiv.style.pointerEvents = 'none';
      
      // Set timeout to revert back after 3 seconds
      setTimeout(() => {
        copyIcon.src = SVG_ICONS.COPY;
        copyDiv.style.cursor = 'pointer';
        copyDiv.style.pointerEvents = 'auto';
      }, 3000);
    });
    
    // Assemble the wrapper div with all child divs
    wrapper.appendChild(tradeDiv);
    wrapper.appendChild(divider1);
    wrapper.appendChild(chartDiv);
    wrapper.appendChild(divider2);
    wrapper.appendChild(copyDiv);
    
    return wrapper;
  }
  
  // Set up scroll event listener
  function setupScrollListener() {
    logToPanel('Setting up scroll listener');
    const MIN_SCROLL_THRESHOLD = 10; // Minimum pixels to scroll before triggering handler
    
    window.addEventListener('scroll', (e) => {
      const currentScrollY = window.scrollY;
      const scrollDistance = Math.abs(currentScrollY - lastScrollY);
      
      // Only process scroll events if the distance exceeds our threshold
      if (scrollDistance < MIN_SCROLL_THRESHOLD) {
        lastScrollY = currentScrollY;
        return; // Skip this scroll event
      }
      
      // Process significant scroll event
      isScrolling = true;
      
      // Detect scroll direction
      scrollDirection = currentScrollY < lastScrollY ? 'up' : 'down';
      lastScrollY = currentScrollY;

      // Clear previous timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Set timeout to scan exactly 300ms after scrolling stops
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
        logToPanel(`Scrolling has stopped (direction: ${scrollDirection}), scanning for CAs after 300ms delay...`);
        
        // Check if we're in cooldown period before scheduling the scan
        const cooldownRemaining = CA_SELECTION_COOLDOWN - (Date.now() - lastCASelectionTime);
        if (cooldownRemaining > 0) {
          logToPanel(`In CA selection cooldown, waiting ${cooldownRemaining}ms before scanning`);
          // Schedule scan after cooldown expires
          setTimeout(() => {
            scanForContractAddresses();
          }, cooldownRemaining);
        } else {
          scanForContractAddresses();
        }
      }, 300);
    });
    
    // Also scan when the user interacts with the page
    document.addEventListener('click', () => {
      setTimeout(() => {
        logToPanel('Click detected, scanning for new CAs...');
        
        // Check if we're in cooldown period before initiating a scan
        const cooldownRemaining = CA_SELECTION_COOLDOWN - (Date.now() - lastCASelectionTime);
        if (cooldownRemaining > 0) {
          logToPanel(`In CA selection cooldown, waiting ${cooldownRemaining}ms before scanning`);
          // Schedule scan after cooldown expires
          setTimeout(() => {
            scanForContractAddresses();
          }, cooldownRemaining);
        } else {
          scanForContractAddresses();
        }
      }, 500);
    });
  }
  
  // Listen for messages from the panel script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (this.detectorDisabled) {
      return;
    }
    
    // Log the received message for debugging
    logToPanel(`Received message: ${JSON.stringify(message)}`);
    
    if (message.action === 'checkForCAs') {
      scanForContractAddresses();
      sendResponse({ scanning: true });
    }
    else if (message.action === 'disabled') {
      // Called when extension is disabled/unloaded
      removeAllHighlights();
      sendResponse({ cleaned: true });
    }
    else if (message.action === 'forceScan') {
      // Check for override flag in the message
      const override = message.override === true;
      
      // Check cooldown unless override is specified
      if (!override) {
        const cooldownRemaining = CA_SELECTION_COOLDOWN - (Date.now() - lastCASelectionTime);
        if (cooldownRemaining > 0) {
          logToPanel(`In CA selection cooldown, delaying force scan by ${cooldownRemaining}ms`);
          setTimeout(() => {
            executeForceScan();
          }, cooldownRemaining);
          sendResponse({ delayed: true, cooldown: cooldownRemaining });
          return true;
        }
      }
      
      // Execute force scan immediately
      executeForceScan();
      sendResponse({ scanning: true });
    }
    else if (message.action === 'cleanup') {
      // Called when extension is disabled/unloaded
      removeAllHighlights();
      sendResponse({ cleaned: true });
    }
    
    // Helper function to execute a force scan
    function executeForceScan() {
      if (this.detectorDisabled) {
        return;
      }
      // Reset the current selection, but don't remove all highlights
      if (lastProcessedCA) {
        removeCurrentCAHighlight(lastProcessedCA);
        lastProcessedCA = null;
      }
      
      logToPanel('Forced scan triggered, searching for CAs from the top');
      
      // Variable to track if any CAs were found during the scan
      let hasFoundCAs = false;
      
      // Override the findMostVisibleCA function temporarily to track if CAs were found
      const originalFindMostVisibleCA = findMostVisibleCA;
      findMostVisibleCA = function(visibleCAs) {
        if (visibleCAs && visibleCAs.length > 0) {
          hasFoundCAs = true;
        }
        // Call the original function
        return originalFindMostVisibleCA(visibleCAs);
      };
      
      // Execute the scan
      scanForContractAddresses();
      
      // Restore the original function
      findMostVisibleCA = originalFindMostVisibleCA;
      
      // If no CAs were found and we haven't sent a message from scanForContractAddresses,
      if (!hasFoundCAs) {
        setTimeout(() => {
          // Double-check if a CA was processed during the scan
          if (!lastProcessedCA) {
            chrome.runtime.sendMessage({
              type: 'CA_DETECTED_ON_X',
              contractAddress: '',
              url: window.location.href
            }, response => {
              if (chrome.runtime.lastError) {
                logToPanel(`Error sending message: ${chrome.runtime.lastError.message}`);
              }
            });
          }
        }, 100); // Small delay to ensure scanForContractAddresses has finished
      }
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
  }

  // Function to copy text to clipboard
  function copyToClipboard(text) {
    // Use the Clipboard API if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          console.log('Text copied to clipboard');
        })
        .catch(error => {
          console.error('Error copying text to clipboard:', error);
          fallbackCopyToClipboard(text);
        });
    } else {
      // Fallback for browsers that don't support the Clipboard API
      fallbackCopyToClipboard(text);
    }
  }

  // Fallback method for older browsers
  function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Make the textarea out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      console.log(successful ? 'Text copied to clipboard' : 'Copy failed');
    } catch (error) {
      console.error('Error copying text to clipboard:', error);
    }
    
    document.body.removeChild(textArea);
  }

  // Function to send CA to APM panel
  function sendCaToApm(caAddress) {
    if (!caAddress) return;
    
    logToPanel(`Sending OPEN_APM_PANEL message to service worker for CA: ${caAddress}`);
    
    try {
      chrome.runtime.sendMessage({
        type: 'OPEN_APM_PANEL',
        contractAddress: caAddress,
        url: window.location.href
      }, response => {
        console.log('Service worker response for OPEN_APM_PANEL:', response);
        if (chrome.runtime.lastError) {
          logToPanel(`Error sending OPEN_APM_PANEL message: ${chrome.runtime.lastError.message}`);
        } else if (response) {
          if (response.sidePanelOpened) {
            setTimeout(() => {
              chrome.runtime.sendMessage({
                type: 'CA_DETECTED_ON_X',
                contractAddress: caAddress,
                url: window.location.href,
                forceRefresh: true,
              });
            }, 500);
            setTimeout(() => {
              chrome.runtime.sendMessage({
                type: 'CA_DETECTED_ON_X',
                contractAddress: caAddress,
                url: window.location.href,
                forceRefresh: true,
              });
            }, 2500);
          } else {
            console.error(`Side panel not opened: ${response.error}`);
          }
        }
      });
    } catch (error) {
      logToPanel(`Failed to send OPEN_APM_PANEL message: ${error}`);
    }
  }

  initialize();

  // add `main` element mutation observer
  let realContentLoaded = false;
  new MutationObserver(() => {
    if (realContentLoaded) {
      return;
    }
    const mainElement = document.querySelector('main');
    if (mainElement && mainElement.textContent.length > 100) {
      realContentLoaded = true;
      initialize();
    }
  }).observe(document, { childList: true, subtree: true });
})(); 