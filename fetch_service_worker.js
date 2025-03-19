// Add Cloudflare domains to the existing domains list
const CLOUDFLARE_DOMAINS = [
  'gmgn.ai',
  'www.gmgn.ai',
  'dexscreener.com',
  'dextools.io'
];

// Browser user agents
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Headers to remove from responses to allow framing
const HEADERS_TO_REMOVE = [
  'x-frame-options',
  'frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-embedder-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy'
];

// Add a function to initialize Cloudflare bypass rules
async function initializeCloudflareBypassRules() {
  try {
    console.log('Setting up Cloudflare bypass rules');
    
    // Remove any existing rules first
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1, 2, 3, 4, 5]
    });
    
    // Add rules for Cloudflare-protected domains
    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [
        // Rule 1: Higher priority rule specifically for gmgn.ai
        {
          id: 1,
          priority: 9999, // Extremely high priority specifically for gmgn.ai
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            responseHeaders: [
              {
                header: "X-Frame-Options",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              },
              {
                header: "Content-Security-Policy",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              },
              {
                header: "Frame-Options",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              }
            ]
          },
          condition: {
            urlFilter: "*gmgn.ai*",
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST
            ]
          }
        },
        // Rule 2: Remove security headers for all Cloudflare domains
        {
          id: 2,
          priority: 1000,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            responseHeaders: HEADERS_TO_REMOVE.map(header => ({
              header: header,
              operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
            }))
          },
          condition: {
            domains: CLOUDFLARE_DOMAINS,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST
            ]
          }
        },
        // Rule 3: Set Desktop UA for Cloudflare domains
        {
          id: 3,
          priority: 1000,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: "User-Agent",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: DESKTOP_USER_AGENT
              },
              {
                header: "Sec-Fetch-Dest",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: "document"
              }
            ]
          },
          condition: {
            domains: CLOUDFLARE_DOMAINS,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.SCRIPT,
              chrome.declarativeNetRequest.ResourceType.STYLESHEET,
              chrome.declarativeNetRequest.ResourceType.IMAGE
            ]
          }
        },
        // Rule 4: Add Access-Control-Allow-Origin header for Cloudflare domains
        {
          id: 4,
          priority: 1000,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            responseHeaders: [
              {
                header: "Access-Control-Allow-Origin",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: "*"
              }
            ]
          },
          condition: {
            domains: CLOUDFLARE_DOMAINS,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST
            ]
          }
        },
        // Rule 5: Add header that helps with Cloudflare detection
        {
          id: 5,
          priority: 1000,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: "Sec-Fetch-Mode",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: "navigate"
              },
              {
                header: "Sec-Fetch-Site",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: "none"
              }
            ]
          },
          condition: {
            domains: CLOUDFLARE_DOMAINS,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME
            ]
          }
        }
      ]
    });
    
    console.log('Cloudflare bypass rules set up successfully');
  } catch (error) {
    console.error('Failed to set up Cloudflare bypass rules:', error);
  }
}

// Initialize the service worker with Cloudflare bypass rules
self.addEventListener('install', (event) => {
  console.log('Service worker installing');
  // Initialize Cloudflare bypass rules
  event.waitUntil(initializeCloudflareBypassRules());
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Add activate event listener to claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  console.log('Service worker activated and claimed clients');
});

// Listen for messages from panel.js
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'LOAD_URL') {
    const url = event.data.url;
    console.log('Service worker received LOAD_URL message:', url);
    
    // Check if URL is for gmgn.ai 
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname.includes('gmgn.ai')) {
        console.log('gmgn.ai URL detected, refreshing rules');
        // Refresh rules when loading gmgn.ai
        await initializeCloudflareBypassRules();
        
        // Try to find active client (tab) to inject frame-busting prevention script
        try {
          const allClients = await clients.matchAll({
            includeUncontrolled: true,
            type: 'window'
          });
          
          for (const client of allClients) {
            console.log('Found client:', client.url);
            if (client.url.includes(chrome.runtime.id)) {
              console.log('Found extension client, sending bypass instruction');
              client.postMessage({
                type: 'BYPASS_CLOUDFLARE',
                url: url
              });
              break;
            }
          }
        } catch (err) {
          console.error('Error finding clients:', err);
        }
      }
    } catch (e) {
      console.error('Error parsing URL:', e);
    }
  }
});

// Function to detect Cloudflare-protected sites
function isCloudflareProtectedSite(hostname) {
  return CLOUDFLARE_DOMAINS.some(domain => hostname.includes(domain));
}

// Fetch event listener to intercept requests and modify them
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // Skip non-HTTP(S) URLs
  if (!url.startsWith('http')) {
    return;
  }
  
  try {
    const parsedUrl = new URL(url);
    
    // Check if this is a Cloudflare-protected site
    if (isCloudflareProtectedSite(parsedUrl.hostname)) {
      console.log('Intercepting Cloudflare site request:', parsedUrl.hostname);
      
      // Cloudflare-specific handling
      event.respondWith(handleCloudflareRequest(event, url));
    }
  } catch (e) {
    console.error('Error in fetch handler:', e);
  }
});

// Handle Cloudflare-protected sites
async function handleCloudflareRequest(event, url) {
  try {
    // Create a modified request with desktop user agent
    const modifiedHeaders = new Headers(event.request.headers);
    modifiedHeaders.set('User-Agent', DESKTOP_USER_AGENT);
    modifiedHeaders.set('Sec-Fetch-Dest', 'document');
    modifiedHeaders.set('Sec-Fetch-Mode', 'navigate');
    modifiedHeaders.set('Sec-Fetch-Site', 'none');
    modifiedHeaders.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
    modifiedHeaders.set('Accept-Language', 'en-US,en;q=0.5');
    
    // Create new request with modified headers
    const modifiedRequest = new Request(url, {
      method: event.request.method,
      headers: modifiedHeaders,
      body: event.request.body,
      mode: 'cors',
      credentials: 'include',
      redirect: 'follow'
    });
    
    // Fetch with modified request
    const response = await fetch(modifiedRequest);
    
    // Check if it's HTML content
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const originalText = await response.text();
      
      // Create a modified version with frame-busting prevention
      let modifiedText = originalText;
      
      // Add CSP meta tag to allow unsafe-inline scripts
      modifiedText = modifiedText.replace('<head>', 
        `<head>
        <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src *;">
        <script>
        // Prevents frame busting by overriding key properties
        try {
          // Keep a reference to the original Object.defineProperty
          const originalDefineProperty = Object.defineProperty;
          
          // Override top, parent, self, etc.
          originalDefineProperty(window, 'top', { 
            get: function() { return window; },
            configurable: false
          });
          originalDefineProperty(window, 'parent', { 
            get: function() { return window; },
            configurable: false
          });
          originalDefineProperty(window, 'self', { 
            get: function() { return window; },
            configurable: false
          });
          originalDefineProperty(window, 'frameElement', {
            get: function() { return null; },
            configurable: false
          });
          
          // Override all frame-busting checks
          function handleFrameChecks() {
            if (document.body) {
              // Cloudflare needs iframes to be visible
              document.querySelectorAll('iframe[src*="challenges"], .cf-turnstile, iframe[src*="turnstile"]').forEach(el => {
                el.style.display = 'block';
                el.style.visibility = 'visible';
                el.style.opacity = '1';
              });
            }
          }
          
          // Check immediately and periodically
          setInterval(handleFrameChecks, 500);
          handleFrameChecks();
          
          // Also watch for future changes
          if (window.MutationObserver) {
            new MutationObserver(function(mutations) {
              handleFrameChecks();
            }).observe(document, { 
              childList: true, 
              subtree: true,
              attributes: true
            });
          }
          
          console.log('Frame-busting prevention applied');
        } catch(e) {
          console.error('Error in frame-busting prevention:', e);
        }
        </script>`);
      
      // Create a modified response with all security headers removed
      const newHeaders = new Headers(response.headers);
      for (const header of HEADERS_TO_REMOVE) {
        newHeaders.delete(header);
      }
      
      // Explicitly remove problematic headers with different case patterns
      newHeaders.delete('X-Frame-Options');
      newHeaders.delete('x-frame-options');
      newHeaders.delete('Content-Security-Policy');
      newHeaders.delete('content-security-policy');
      
      // Add permissive headers
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('X-Frame-Options-Modified', 'true');
      
      return new Response(modifiedText, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }
    
    // For non-HTML responses, just remove security headers
    const newHeaders = new Headers(response.headers);
    for (const header of HEADERS_TO_REMOVE) {
      newHeaders.delete(header);
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (error) {
    console.error('Error handling Cloudflare request:', error);
    return new Response('Error loading content', { status: 500 });
  }
} 