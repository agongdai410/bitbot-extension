/**
 * GMGN.ai page content script
 * Detects contract addresses in the URL and adds UI elements
 */

(function() {
  console.log('GMGN.ai content script loaded');
  
  // Regular expression to match Solana contract addresses
  const CA_REGEX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
  
  // Base64 encoded SVG icon (apm-lightening-dark.svg)
  const APM_ICON_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSJibGFjayIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KPHBhdGggZD0iTTEwLjc0NjQgMjAuOTk5N0g5LjczMjg5TDguNjEzNjUgMTkuMzYzM0wxMC45NzAyIDEzLjA5MzhIOS4wODU4Nkw3Ljk2NDM2IDExLjQ1NDRMOC40MTM0NiAxMEwxMC45MTM0IDQuNjM2MzNMMTQuOSAzTDE2LjAzNTQgNC42MzYzM0wxMi42MjAxIDEyLjQ4MDlMMTQuMTMyNiAxMC44NDgzTDE1LjI2OTkgMTIuNDgwOUwxMC43NDY0IDIwLjk5OTdaIiBmaWxsPSIjMkIyQjJCIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjAuMzY1MjI2IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik04LjYxMTM5IDE5LjM2MzNMOS44NDg2OCAxMS40NTc1SDcuOTY0MzZMOS43OTE5MiAzSDE0LjkxMzlMMTEuNDk4NiAxMC44NDQ2SDE0LjE0ODRMOS43MzA2MyAxOS4zNjMzSDguNjExMzlaIiBmaWxsPSIjRkZDRDAwIiBzdHJva2U9ImJsYWNrIiBzdHJva2Utd2lkdGg9IjAuMzY1MjI2IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik05LjczNTI3IDE5LjM2MzhMMTAuNzMwOCAyMS4wMDAxSDkuNjA5M0w4LjYxMzc3IDE5LjM2MzhIOS43MzUyN1oiIGZpbGw9IiM1NDU0NTQiIHN0cm9rZT0iYmxhY2siIHN0cm9rZS13aWR0aD0iMC4zNjUyMjYiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+Cg==';
  
  /**
   * Extract contract address from gmgn.ai token URL
   * @param {string} url - The URL to check for contract addresses
   * @returns {string|null} The extracted contract address or null if not found
   */
  function extractContractAddress(url) {
    // URL pattern: https://gmgn.ai/sol/token/CONTRACT_ADDRESS
    // or https://gmgn.ai/sol/token/[referral_code]_[CA]
    const matches = url.match(/\/token\/([^\/\?#]+)/);
    if (matches && matches[1]) {
      const tokenPart = matches[1];
      console.log('Extracted token part from URL:', tokenPart);
      
      // Check if the token part contains a referral code (separated by underscore)
      if (tokenPart.includes('_')) {
        // Split by underscore and take the last part which is the actual CA
        const parts = tokenPart.split('_');
        const actualCA = parts[parts.length - 1];
        console.log('URL contains referral code, extracted actual CA:', actualCA);
        return actualCA;
      }
      
      // If no underscore is found, return the whole token part
      console.log('No referral code found, using full token:', tokenPart);
      return tokenPart;
    }
    console.log('No token found in URL:', url);
    return null;
  }
  
  /**
   * Validate whether a string is a valid contract address
   * @param {string} address - The address to validate
   * @returns {boolean} True if valid, false otherwise
   */
  function isValidContractAddress(address) {
    return CA_REGEX.test(address);
  }
  
  /**
   * Creates and adds a button to the appropriate location in the gmgn.ai page
   * @param {string} contractAddress - The contract address to use in button actions
   */
  function addContractButton(contractAddress) {
    // Create the main button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'bitbot-gmgn-button-container';
    buttonContainer.style.cssText = `
      display: flex;
      align-items: center;
      background: #FFCD00;
      border-radius: 4px;
      height: 24px;
      cursor: pointer;
      transition: opacity 0.2s;
      margin-left: 4px;
    `;
    
    // Add hover effect
    buttonContainer.addEventListener('mouseover', () => {
      buttonContainer.style.opacity = '0.8';
    });
    buttonContainer.addEventListener('mouseout', () => {
      buttonContainer.style.opacity = '1';
    });
    
    // Add click handler
    buttonContainer.addEventListener('click', () => {
      window.open(`https://t.me/test_newbitbot?start=trade-${contractAddress}`, '_blank');
    });
    
    // Add the icon
    const iconElement = document.createElement('div');
    iconElement.style.cssText = `
      width: 24px;
      height: 24px;
      background-image: url(${APM_ICON_BASE64});
      background-size: cover;
      background-position: center;
    `;
    buttonContainer.appendChild(iconElement);
    
    // Add the "Quick Trade" text
    const textElement = document.createElement('div');
    textElement.textContent = 'Quick Trade';
    textElement.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
      font-size: 12px;
      color: #14151A;
      padding: 0 12px;
    `;
    buttonContainer.appendChild(textElement);

    // Insert the button container into the specified DOM location
    function insertButtonToTargetLocation() {
      try {
        // 1. Find all <p> elements with class .chakra-text but no css-0
        const textElements = document.querySelectorAll('p.chakra-text:not(.css-0)');
        if (!textElements || textElements.length === 0) {
          console.warn('No p.chakra-text elements found');
          return false;
        }
        
        // Use the contract address to find the right element
        let caNode = null;
        
        // 2. Find the element with text content that is a shortened form of the CA
        // Format: [first 5 chars]...[last 3 chars]
        const shortCA = `${contractAddress.substring(0, 5)}...${contractAddress.substring(contractAddress.length - 3)}`;
        console.log('Looking for node with shortened CA format:', shortCA);
        
        for (const el of textElements) {
          // Check if the element contains only text content (no child elements)
          if (el.childElementCount === 0) {
            const text = el.textContent.trim();
            // Check if the text matches the expected short CA format
            if (text.includes('...') && 
                text.startsWith(contractAddress.substring(0, 5)) && 
                text.endsWith(contractAddress.substring(contractAddress.length - 3))) {
              caNode = el;
              console.log('Found caNode with shortened CA format:', text);
              break;
            }
          }
        }
        
        if (!caNode) {
          // As a fallback, try to find an element that at least contains the first 5 chars
          for (const el of textElements) {
            if (el.childElementCount === 0) {
              const text = el.textContent.trim();
              if (text.includes(contractAddress.substring(0, 5))) {
                caNode = el;
                console.log('Found caNode with partial CA match:', text);
                break;
              }
            }
          }
        }
        
        if (!caNode) {
          console.warn('Could not find caNode with shortened CA format');
          return false;
        }
        
        // 3. Traverse up the DOM tree from caNode to find ampUiWrapper
        // It should have 2 children and have a top boundingRect value smaller than caNode's
        const caNodeRect = caNode.getBoundingClientRect();
        let currentNode = caNode.parentNode;
        let ampUiWrapper = null;
        
        while (currentNode && currentNode !== document.body) {
          // Check if the current node has exactly 2 children
          if (currentNode.childElementCount === 2) {
            const currentRect = currentNode.getBoundingClientRect();
            // Check if the top of the current node is above the top of caNode
            if (currentRect.top < caNodeRect.top) {
              // Use the first child of this node as ampUiWrapper
              ampUiWrapper = currentNode.firstElementChild;
              console.log('Found parent wrapper node:', currentNode);
              console.log('Using its first child as ampUiWrapper:', ampUiWrapper);
              break;
            }
          }
          currentNode = currentNode.parentNode;
        }
        
        if (!ampUiWrapper) {
          console.warn('Could not find appropriate ampUiWrapper');
          return false;
        }
        
        // Check if we already added our button to avoid duplicates
        const existingButton = document.querySelector('.bitbot-gmgn-button-container');
        if (existingButton) {
          existingButton.remove();
        }
        
        // Append our button container to ampUiWrapper
        ampUiWrapper.appendChild(buttonContainer);
        console.log('Successfully added BitBot button to GMGN.ai page at target location');
        return true;
      } catch (err) {
        console.error('Error inserting button to target location:', err);
        return false;
      }
    }
    
    // Try to insert the button right away, if it fails, use a retry mechanism
    // as the DOM might still be loading/changing
    if (!insertButtonToTargetLocation()) {
      console.log('Initial button placement failed, setting up retry mechanism');
      
      // Set up a retry mechanism with exponential backoff
      let retryCount = 0;
      const maxRetries = 5;
      const retryInterval = 500; // Start with 500ms
      
      const retryInsert = () => {
        if (retryCount < maxRetries) {
          setTimeout(() => {
            console.log(`Retry ${retryCount + 1} of ${maxRetries}`);
            if (!insertButtonToTargetLocation()) {
              retryCount++;
              retryInsert();
            }
          }, retryInterval * Math.pow(1.5, retryCount));
        } else {
          console.warn('Failed to place button in target location after maximum retries');
          // Fall back to body append as a last resort
          const existingButton = document.querySelector('.bitbot-gmgn-button-container');
          if (!existingButton) {
            // Use fixed positioning as fallback
            buttonContainer.style.position = 'fixed';
            buttonContainer.style.top = '15px';
            buttonContainer.style.right = '15px';
            buttonContainer.style.zIndex = '9999';
            document.body.appendChild(buttonContainer);
            console.log('Added BitBot button to body as fallback');
          }
        }
      };
      
      retryInsert();
    }
  }
  
  /**
   * Main initialization function
   */
  function initialize() {
    // Get the current URL
    const currentUrl = window.location.href;
    
    // Extract the contract address
    const contractAddress = extractContractAddress(currentUrl);
    
    // Validate and add button if it's a valid CA
    if (contractAddress && isValidContractAddress(contractAddress)) {
      console.log('Valid contract address found:', contractAddress);
      
      // If the DOM is already loaded, add the button immediately
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        addContractButton(contractAddress);
      } else {
        // Otherwise, wait for the DOM to be ready
        document.addEventListener('DOMContentLoaded', () => {
          addContractButton(contractAddress);
        });
      }
      
      // Send message to background script about the detected CA
      try {
        chrome.runtime.sendMessage({
          action: 'gmgnCADetected',
          contractAddress: contractAddress,
          url: currentUrl
        });
      } catch (e) {
        console.error('Error sending message to extension:', e);
      }
    } else {
      console.log('No valid contract address found in URL');
    }
  }
  
  // Run the initialization function
  initialize();
  
  // Also check for URL changes (SPA navigation)
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log('URL changed, checking for contract address');
      initialize();
    }
  }).observe(document, { subtree: true, childList: true });
})(); 