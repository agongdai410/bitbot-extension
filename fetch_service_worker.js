// Add Cloudflare domains to the existing domains list
const CLOUDFLARE_DOMAINS = [
  'gmgn.ai',
  'www.gmgn.ai',
  'dexscreener.com',
  'dextools.io'
];

// Define Twitter/X domains
const TWITTER_DOMAINS = [
  'twitter.com',
  'www.twitter.com',
  'x.com',
  'www.x.com',
  'mobile.twitter.com',
  'mobile.x.com',
  'abs.twimg.com',
  'pbs.twimg.com',
  'video.twimg.com',
  'api.twitter.com',
  'api.x.com'
];

// Constants
const CACHE_NAME = 'bitbot-extension-cache-v1';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Browser user agents
const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// Enhanced request headers that mimic a regular browser
const ENHANCED_REQUEST_HEADERS = {
  'User-Agent': MOBILE_USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Sec-CH-UA': '"Google Chrome";v="113", "Chromium";v="113"',
  'Sec-CH-UA-Mobile': '?1',
  'Sec-CH-UA-Platform': '"Android"'
};

// Additional request headers for Twitter API - updated for mobile
const TWITTER_API_HEADERS = {
  'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
  'x-twitter-client-language': 'en',
  'x-twitter-active-user': 'yes',
  'Origin': 'https://twitter.com',
  'x-twitter-client': 'mobileweb',
  'x-twitter-client-version': 'rweb-mobile'
};

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

// Track authentication state for Twitter
let bearerToken = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
let guestToken = '';
let csrfToken = '';
let attemptedGuestToken = false;

// Track side panel URLs to distinguish them from normal browsing
const sidePanelUrls = new Set();

// Track the last token we've detected to avoid redundant searches
let lastDetectedToken = null;

// Register this service worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installed');
  
  // Skip waiting to activate the service worker faster
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activated');
  
  // Take control of all clients/tabs immediately
  event.waitUntil(clients.claim());
  
  // Set up the declarative net request rules
  event.waitUntil(initializeHeaderRules());
  
  // Start monitoring tabs for URL changes
  setupTabUrlMonitoring();
});

// Listen for messages from panel.js
self.addEventListener('message', async (event) => {
  // Handle URL loading messages
  if (event.data && (event.data.type === 'LOAD_URL' || event.data.type === 'PREPARE_URL' || event.data.type === 'loading-page')) {
    const url = event.data.url;
    const messageId = event.data.messageId;  // Will be undefined for LOAD_URL messages
    const iframeId = event.data.iframeId;  // Will be 'x' or 'gmgn'
    
    console.log(`Service worker received ${event.data.type} message:`, url, 'for iframe:', iframeId);
    
    // Add to side panel URL tracking
    if (url) {
      sidePanelUrls.add(url);
    }
    
    try {
      const parsedUrl = new URL(url);
      
      // For both gmgn.ai and x.com, refresh rules
      if (parsedUrl.hostname.includes('gmgn.ai') || 
          TWITTER_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) {
        console.log('Special site detected, refreshing rules');
        // Refresh rules
        await initializeHeaderRules();
        
        // For Twitter/X domains, try to get a guest token
        if (TWITTER_DOMAINS.some(domain => parsedUrl.hostname.includes(domain))) {
          if (!guestToken) {
            await getGuestToken();
          }
        }
        
        // Try to find active client (tab) to inject frame-busting prevention script for CloudFlare
        if (parsedUrl.hostname.includes('gmgn.ai')) {
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
                  url: url,
                  iframeId: iframeId || 'gmgn' // Default to gmgn if not specified
                });
                break;
              }
            }
          } catch (err) {
            console.error('Error finding clients:', err);
          }
        }
        
        // If this was a PREPARE_URL message, send response that rules are ready
        if ((event.data.type === 'PREPARE_URL' || event.data.type === 'loading-page') && event.source) {
          console.log('Sending RULES_READY response for messageId:', messageId);
          event.source.postMessage({
            type: 'RULES_READY',
            messageId: messageId,
            iframeId: iframeId
          });
        }
      }
    } catch (e) {
      console.error('Error parsing URL:', e);
      
      // Still send response if it was a PREPARE_URL message
      if (event.data.type === 'PREPARE_URL' && messageId && event.source) {
        event.source.postMessage({
          type: 'RULES_READY',
          messageId: messageId,
          iframeId: iframeId
        });
      }
    }
  }
});

// Function to detect Cloudflare-protected sites
function isCloudflareProtectedSite(hostname) {
  return CLOUDFLARE_DOMAINS.some(domain => hostname.includes(domain));
}

// Function to detect Twitter/X domains
function isTwitterSite(hostname) {
  return TWITTER_DOMAINS.some(domain => hostname.includes(domain));
}

// Function to check if a URL is loaded in the side panel
function isFromSidePanel(url) {
  return sidePanelUrls.has(url) || (url && url.includes(chrome.runtime.id));
}

// Initialize all header modification rules
async function initializeHeaderRules() {
  try {
    console.log('Setting up header modification rules');
    
    // Remove any existing rules first
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1, 2, 3, 4, 5, 6, 7, 8]
    });
    
    // Add rules
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
        },
        
        // Rule 6: Highest priority rule for removing security headers from X.com/Twitter
        {
          id: 6,
          priority: 9999, // Extremely high priority specifically for Twitter/X
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            responseHeaders: [
              {
                header: "X-Frame-Options",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              },
              {
                header: "x-frame-options",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              },
              {
                header: "Content-Security-Policy",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              },
              {
                header: "content-security-policy",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              },
              {
                header: "Frame-Options",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              },
              {
                header: "frame-options",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              }
            ]
          },
          condition: {
            domains: TWITTER_DOMAINS,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST
            ]
          }
        },
        
        // Rule 7: X.com with specific URL filter pattern (another way to target X.com)
        {
          id: 7,
          priority: 9999,
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
              }
            ]
          },
          condition: {
            urlFilter: "*://*.x.com/*|*://x.com/*|*://*.twitter.com/*|*://twitter.com/*",
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST
            ]
          }
        },
        
        // Rule 8: Set Mobile UA for X.com/Twitter
        {
          id: 8,
          priority: 1000,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: "User-Agent",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: MOBILE_USER_AGENT
              },
              {
                header: "Sec-Fetch-Dest",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: "document"
              }
            ]
          },
          condition: {
            domains: TWITTER_DOMAINS,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST
            ]
          }
        }
      ]
    });
    
    console.log('Header modification rules set up successfully');
  } catch (error) {
    console.error('Failed to set up header rules:', error);
  }
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
    
    // Check if this is a Twitter/X site and use the wrapper approach
    if (isTwitterSite(parsedUrl.hostname)) {
      // For x.com specifically, return the wrapper HTML
      if (parsedUrl.hostname === 'x.com' || parsedUrl.hostname === 'www.x.com') {
        console.log('Intercepting X.com request - using wrapper approach');
        event.respondWith(generateTwitterWrapperResponse(url));
        return;
      }
      
      console.log('Intercepting Twitter/X site request:', parsedUrl.hostname);
      
      // Twitter-specific handling
      event.respondWith(handleTwitterRequest(event, url));
    }
    // Check if this is a Cloudflare-protected site
    else if (isCloudflareProtectedSite(parsedUrl.hostname)) {
      console.log('Intercepting Cloudflare site request:', parsedUrl.hostname);
      
      // Cloudflare-specific handling
      event.respondWith(handleCloudflareRequest(event, url));
    }
  } catch (e) {
    console.error('Error in fetch handler:', e);
  }
});

// Generate a wrapper HTML page that contains Twitter content in an optimized way
function generateTwitterWrapperResponse(twitterUrl) {
  // Convert URL to mobile version if not already
  let mobileTwitterUrl = twitterUrl;
  try {
    const parsedUrl = new URL(twitterUrl);
    if (parsedUrl.hostname === 'twitter.com') {
      parsedUrl.hostname = 'mobile.twitter.com';
      mobileTwitterUrl = parsedUrl.toString();
    } else if (parsedUrl.hostname === 'x.com') {
      parsedUrl.hostname = 'mobile.x.com';
      mobileTwitterUrl = parsedUrl.toString();
    }
    
    // Add a cache busting parameter
    const cacheBuster = Date.now();
    const urlSeparator = mobileTwitterUrl.includes('?') ? '&' : '?';
    mobileTwitterUrl = `${mobileTwitterUrl}${urlSeparator}_cb=${cacheBuster}`;
  } catch (e) {
    console.error('Error converting to mobile URL:', e);
  }

  const twitterWrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src *;">
  <meta http-equiv="X-Frame-Options" content="ALLOWALL">
  <title>Twitter - Web Viewer</title>
  <style>
    /* Remove any margin/padding and set full height */
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    /* Make iframe full size */
    #wrapper-iframe {
      width: 100%;
      height: 100%;
      border: none;
      position: relative;
      display: block;
    }
    
    /* Ensure content fills entire viewport */
    #content-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
    }
    
    /* Loading spinner */
    .loading {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(255, 255, 255, 0.9);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10;
      transition: opacity 0.3s;
    }
    
    .spinner {
      width: 50px;
      height: 50px;
      border: 5px solid #f3f3f3;
      border-top: 5px solid #1DA1F2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 20px;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .error {
      display: none;
      color: #E0245E;
      text-align: center;
      max-width: 80%;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div id="content-container">
    <!-- First, we'll create a div for our loading spinner -->
    <div id="loading" class="loading">
      <div class="spinner"></div>
      <div>Loading Twitter (Mobile View)...</div>
      <div id="error" class="error"></div>
    </div>
    
    <!-- Then create an iframe that will load the Twitter mobile page -->
    <iframe id="wrapper-iframe" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title="Twitter Content"></iframe>
  </div>

  <script>
    // Reference our elements
    const contentFrame = document.getElementById('wrapper-iframe');
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    
    // Function to show/hide loading
    function setLoading(show, error = null) {
      loadingEl.style.opacity = show ? '1' : '0';
      loadingEl.style.pointerEvents = show ? 'auto' : 'none';
      
      if (error) {
        errorEl.textContent = error;
        errorEl.style.display = 'block';
      } else {
        errorEl.style.display = 'none';
      }
      
      if (!show) {
        // After fade out, hide completely
        setTimeout(() => {
          loadingEl.style.display = 'none';
        }, 300);
      }
    }
    
    // Function to handle frame load
    function onFrameLoad() {
      try {
        setLoading(false);
        
        // Try to access the frame content (may fail due to CORS)
        const frameWindow = contentFrame.contentWindow;
        
        // If we have access, inject our anti-frame-busting script
        if (frameWindow && frameWindow.document) {
          const script = frameWindow.document.createElement('script');
          script.textContent = \`
            // Prevent frame busting techniques
            window.open = function(url, target, features) {
              console.log('Intercepted window.open:', url);
              return window;
            };
            
            // Override window.top and window.parent
            Object.defineProperty(window, 'top', {
              get: function() { return window; }
            });
            
            Object.defineProperty(window, 'parent', {
              get: function() { return window; }
            });
            
            // Override document.domain
            Object.defineProperty(document, 'domain', {
              get: function() { return location.hostname; },
              set: function() { return location.hostname; }
            });
            
            console.log('Twitter frame-busting protection applied');
          \`;
          frameWindow.document.head.appendChild(script);
        }
      } catch (e) {
        // This is expected due to CORS restrictions
        console.log('Could not access frame content due to CORS (expected)');
      }
    }
    
    // Function to handle errors
    function onFrameError(event) {
      console.error('Error loading Twitter:', event);
      setLoading(true, 'Failed to load Twitter. The site may be temporarily unavailable.');
    }
    
    // Add event listeners
    contentFrame.addEventListener('load', onFrameLoad);
    contentFrame.addEventListener('error', onFrameError);
    
    // Set a loading timeout
    const loadTimeout = setTimeout(() => {
      if (loadingEl.style.opacity !== '0') {
        setLoading(true, 'Loading is taking longer than expected. Twitter may be unavailable.');
      }
    }, 20000);
    
    // Load the URL
    try {
      contentFrame.src = "${mobileTwitterUrl}";
    } catch (e) {
      console.error('Error setting iframe src:', e);
      setLoading(true, 'Error loading Twitter: ' + e.message);
    }
  </script>
</body>
</html>`;

  // Create and return a Response with the HTML content
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'X-Frame-Options': 'ALLOWALL',
    'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src *;",
    'Access-Control-Allow-Origin': '*'
  });
  
  return new Response(twitterWrappedHtml, {
    status: 200,
    headers: headers
  });
}

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

// Handle Twitter/X requests
async function handleTwitterRequest(event, url) {
  try {
    // Create a modified request with mobile user agent
    const modifiedHeaders = new Headers(event.request.headers);
    modifiedHeaders.set('User-Agent', MOBILE_USER_AGENT);
    modifiedHeaders.set('Sec-Fetch-Dest', 'document');
    modifiedHeaders.set('Sec-Fetch-Mode', 'navigate');
    modifiedHeaders.set('Sec-Fetch-Site', 'none');
    modifiedHeaders.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
    modifiedHeaders.set('Accept-Language', 'en-US,en;q=0.5');
    
    // Check if it's an x.com request - if so, use the wrapper (handled earlier)
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname === 'x.com' || parsedUrl.hostname === 'www.x.com') {
      return generateTwitterWrapperResponse(url);
    }
    
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
    
    // For all responses, remove security headers
    const newHeaders = new Headers(response.headers);
    
    // Remove all security headers
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
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (error) {
    console.error('Error handling Twitter request:', error);
    // For any errors with Twitter, use the wrapper approach
    return generateTwitterWrapperResponse(url);
  }
}

// Get a guest token for Twitter unauthenticated access
async function getGuestToken() {
  try {
    console.log('Attempting to get a new guest token...');
    
    // Try from the activate.json endpoint
    const response = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'User-Agent': MOBILE_USER_AGENT,
        'Content-Type': 'application/json',
        'Origin': 'https://mobile.twitter.com',
        'Referer': 'https://mobile.twitter.com/'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.guest_token) {
        guestToken = data.guest_token;
        console.log('Successfully obtained guest token:', guestToken);
        return;
      }
    }
    
    console.warn('Failed to obtain a guest token');
  } catch (error) {
    console.error('Error getting guest token:', error);
  }
}

// Function to monitor tab URL changes
function setupTabUrlMonitoring() {
  // Check if the tab API is available
  if (chrome.tabs) {
    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // Only process when URL changes and loading is complete
      if (changeInfo.status === 'complete' && tab.url) {
        console.log('Tab updated:', tab.url);
        
        // Check if it's a gmgn.ai token page
        if (tab.url.includes('gmgn.ai') && tab.url.includes('/token/')) {
          // Extract token address
          const tokenAddress = extractContractAddress(tab.url);
          if (tokenAddress && tokenAddress !== lastDetectedToken) {
            lastDetectedToken = tokenAddress;
            console.log('Token detected in browser tab:', tokenAddress);
            
            // Notify all extension clients (including panel) about this token
            notifyClientsAboutToken(tokenAddress, tab.url);
          }
        }
      }
    });
    
    console.log('Tab URL monitoring set up');
  } else {
    console.error('Cannot access chrome.tabs API');
  }
}

// Function to extract contract address from gmgn.ai URL
function extractContractAddress(url) {
  const matches = url.match(/\/token\/([^\/\?#]+)/);
  if (matches && matches[1]) {
    return matches[1];
  }
  return null;
}

// Function to notify clients about detected token
async function notifyClientsAboutToken(tokenAddress, gmgnUrl) {
  const clientList = await clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  });
  
  console.log(`Notifying ${clientList.length} clients about token ${tokenAddress}`);
  
  clientList.forEach(client => {
    client.postMessage({
      type: 'TOKEN_DETECTED',
      tokenAddress: tokenAddress,
      gmgnUrl: gmgnUrl
    });
  });
} 