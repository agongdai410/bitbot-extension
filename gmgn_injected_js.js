/**
 * GMGN.ai page content script
 * Detects contract addresses in the URL and adds UI elements
 */

(function() {
  console.log('GMGN.ai content script loaded');
  
  // Regular expression to match Solana contract addresses
  const CA_REGEX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
  
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
   * Creates and adds a button to the top of the page
   * @param {string} contractAddress - The contract address to use in button actions
   */
  function addContractButton(contractAddress) {
    // Create the main button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'bitbot-gmgn-button-container';
    buttonContainer.style.cssText = `
      position: fixed;
      top: 15px;
      right: 15px;
      z-index: 9999;
      display: flex;
      align-items: center;
      background: #252525;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 4px;
      height: 36px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    
    // Add branding text
    const brandText = document.createElement('div');
    brandText.textContent = 'BitBot';
    brandText.style.cssText = `
      padding: 0 10px;
      font-size: 14px;
      font-weight: 600;
      color: #FFCD01;
    `;
    buttonContainer.appendChild(brandText);
    
    // First divider
    const divider1 = document.createElement('div');
    divider1.style.cssText = 'height: 18px; width: 1px; background-color: rgba(255,255,255,0.08);';
    buttonContainer.appendChild(divider1);
    
    // Create Trade button
    const tradeButton = document.createElement('div');
    tradeButton.textContent = 'Trade';
    tradeButton.style.cssText = `
      padding: 0 10px;
      font-size: 14px;
      color: white;
      cursor: pointer;
      height: 100%;
      display: flex;
      align-items: center;
    `;
    tradeButton.addEventListener('mouseover', () => {
      tradeButton.style.background = 'rgba(255,255,255,0.16)';
    });
    tradeButton.addEventListener('mouseout', () => {
      tradeButton.style.background = 'transparent';
    });
    tradeButton.addEventListener('click', () => {
      window.open(`https://t.me/test_newbitbot?start=trade-${contractAddress}`, '_blank');
    });
    buttonContainer.appendChild(tradeButton);
    
    // Second divider
    const divider2 = document.createElement('div');
    divider2.style.cssText = 'height: 18px; width: 1px; background-color: rgba(255,255,255,0.08);';
    buttonContainer.appendChild(divider2);
    
    // Create Copy button
    const copyButton = document.createElement('div');
    copyButton.textContent = 'Copy CA';
    copyButton.style.cssText = `
      padding: 0 10px;
      font-size: 14px;
      color: white;
      cursor: pointer;
      height: 100%;
      display: flex;
      align-items: center;
    `;
    copyButton.addEventListener('mouseover', () => {
      copyButton.style.background = 'rgba(255,255,255,0.16)';
    });
    copyButton.addEventListener('mouseout', () => {
      copyButton.style.background = 'transparent';
    });
    copyButton.addEventListener('click', () => {
      // Copy the CA to clipboard
      navigator.clipboard.writeText(contractAddress)
        .then(() => {
          const originalText = copyButton.textContent;
          copyButton.textContent = 'Copied!';
          setTimeout(() => {
            copyButton.textContent = originalText;
          }, 2000);
        })
        .catch(err => {
          console.error('Could not copy text: ', err);
        });
    });
    buttonContainer.appendChild(copyButton);
    
    // Add the button container to the page
    document.body.appendChild(buttonContainer);
    console.log('Added BitBot button to GMGN.ai page for contract address:', contractAddress);
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