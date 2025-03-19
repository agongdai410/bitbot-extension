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
let bearerToken = TWITTER_API_HEADERS.authorization.replace('Bearer ', '');
let guestToken = '';
let csrfToken = '';
let attemptedGuestToken = false;

// Track side panel URLs to distinguish them from normal browsing
const sidePanelUrls = new Set();

// Register this service worker
self.addEventListener('install', (event) => {
  console.log(new Date().toISOString() + ' - Service worker loaded');
  console.log('Service Worker installing');
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  // Initialize the declarativeNetRequest rules
  event.waitUntil(initializeHeaderRules());
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  // Claim clients so the service worker starts controlling current pages
  event.waitUntil(clients.claim());
  
  // Try to get a guest token immediately so it's ready when needed
  getGuestToken().catch(err => console.error('Initial guest token error:', err));
  
  // Clear old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Listen for messages from the panel
self.addEventListener('message', async (event) => {
  console.log('Service worker received message:', event.data);
  
  // Handle SKIP_WAITING message for immediate activation
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Skip waiting and activate immediately');
    self.skipWaiting();
    return;
  }
  
  // Register side panel URLs when they're loaded
  if (event.data && event.data.type === 'loading-page') {
    // The panel is loading a page - track this URL as from side panel
    console.log('Panel is loading URL:', event.data.url);
    sidePanelUrls.add(event.data.url);
    
    // Always use mobile view (ignore the isMobile parameter - always true)
    
    // Parse the URL to determine what setup might be needed
    try {
      const url = new URL(event.data.url);
      
      // If it's Twitter/X, make sure we have a guest token
      if (url.hostname === 'twitter.com' || url.hostname === 'x.com' || 
          url.hostname === 'mobile.twitter.com' || url.hostname === 'mobile.x.com') {
        if (!guestToken) {
          await getGuestToken();
        }
        
        // For x.com, prepare for special handling
        if (url.hostname === 'x.com' || url.hostname === 'www.x.com') {
          console.log('X.com URL detected, will use wrapper approach');
          
          // If there's a client to respond to, let it know
          if (event.source) {
            event.source.postMessage({
              type: 'x-handling-info',
              message: 'Using wrapper approach for x.com'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing loading-page message:', error);
    }
  } else if (event.data && event.data.type === 'page-loaded') {
    // The panel reports a page was loaded (or failed)
    console.log('Panel reports page loaded:', event.data.success ? 'success' : 'failed');
    
    // Always use mobile view (ignore the isMobile parameter - always true)
    
    // If the client needs a response, send one
    if (event.source) {
      event.source.postMessage({
        type: 'page-load-status',
        success: event.data.success,
        url: event.data.url,
        error: event.data.error || null,
        isMobile: true // Always use mobile view
      });
    }
  }
});

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

// Function to check if a URL is loaded in the side panel
function isFromSidePanel(url) {
  return sidePanelUrls.has(url) || (url && url.includes(chrome.runtime.id));
}

// Function to convert URL to mobile version if needed
function convertToMobileUrl(url, forceConvert = false) {
  if (!url) return url;
  
  try {
    const parsedUrl = new URL(url);
    
    // Always convert to mobile (ignore forceConvert parameter - always true)
    
    // Handle common domains
    if (parsedUrl.hostname === 'twitter.com') {
      parsedUrl.hostname = 'mobile.twitter.com';
    } else if (parsedUrl.hostname === 'x.com') {
      parsedUrl.hostname = 'mobile.x.com';
    } else if (parsedUrl.hostname === 'www.youtube.com' || parsedUrl.hostname === 'youtube.com') {
      parsedUrl.hostname = 'm.youtube.com';
    } else if (parsedUrl.hostname === 'www.reddit.com' || parsedUrl.hostname === 'reddit.com') {
      parsedUrl.hostname = 'old.reddit.com'; // Old reddit is more iframe-friendly
    } else if (parsedUrl.hostname === 'www.wikipedia.org') {
      parsedUrl.hostname = 'en.m.wikipedia.org';
    } else if (parsedUrl.hostname.endsWith('.wikipedia.org') && !parsedUrl.hostname.includes('.m.')) {
      // Convert all wikipedia domains to mobile
      parsedUrl.hostname = parsedUrl.hostname.replace('.wikipedia.org', '.m.wikipedia.org');
    } else if (parsedUrl.hostname === 'www.facebook.com') {
      parsedUrl.hostname = 'm.facebook.com';
    } else if (parsedUrl.hostname === 'www.instagram.com' || parsedUrl.hostname === 'instagram.com') {
      // Instagram auto-detects from UA
      parsedUrl.hostname = 'www.instagram.com';
    }
    
    return parsedUrl.toString();
  } catch (e) {
    console.error('Error converting to mobile URL:', e);
    return url;
  }
}

// Listen for fetch events - only modify side panel requests
self.addEventListener('fetch', event => {
  // Get URL from event
  const url = event.request.url;
  
  // Skip non-HTTP(S) requests
  if (!url.startsWith('http')) {
    return;
  }
  
  // Only handle requests from the side panel
  if (event.clientId) {
    clients.get(event.clientId).then(client => {
      if (client && client.url && client.url.includes(chrome.runtime.id)) {
        // This is a side panel request
        event.respondWith(handleFetchRequest(event, url));
      }
      // Otherwise, let normal browsing proceed unmodified
    }).catch(err => {
      console.error('Error checking client:', err);
    });
  } else if (event.request.referrer && event.request.referrer.includes(chrome.runtime.id)) {
    // Another way to detect side panel requests
    event.respondWith(handleFetchRequest(event, url));
  }
  // For all other requests, do nothing and let normal browsing proceed
});

async function handleFetchRequest(event, url) {
  try {
    // Get client ID for tracking state
    const clientId = event.clientId;
    
    // Always use mobile view
    let isMobile = true;
    
    // Check cache first
    const cachedResponse = await caches.match(event.request);
    if (cachedResponse) {
      console.log('Serving from cache:', url);
      return cachedResponse;
    }
    
    // Parse the URL to decide how to handle it
    const parsedUrl = new URL(url);
    
    // Check if this is Twitter/X
    const isTwitter = parsedUrl.hostname === 'twitter.com' || 
                      parsedUrl.hostname === 'x.com' || 
                      parsedUrl.hostname === 'mobile.twitter.com' || 
                      parsedUrl.hostname === 'mobile.x.com';
                      
    // Check if it's YouTube
    const isYouTube = parsedUrl.hostname === 'youtube.com' || 
                      parsedUrl.hostname === 'www.youtube.com' || 
                      parsedUrl.hostname === 'm.youtube.com';
    
    // Apply appropriate handling based on domain
    let requestUrl = url;
    
    if (isTwitter) {
      // Check if it's a main page or profile page that might need special handling
      const isMainPage = parsedUrl.pathname === '/' || parsedUrl.pathname === '';
      const isProfilePage = /^\/[a-zA-Z0-9_]+\/?$/.test(parsedUrl.pathname);
      const needsSpecialHandling = isMainPage || isProfilePage;
      
      // For Twitter, always convert to mobile URL
      requestUrl = convertToMobileUrl(url, true);
      
      // For Twitter, check if it needs the wrapper approach
      if (needsSpecialHandling) {
        try {
          // Quickly check if we can access the page directly
          const headResponse = await fetch(requestUrl, { 
            method: 'HEAD',
            headers: { 'User-Agent': ENHANCED_REQUEST_HEADERS["User-Agent"] }
          });
          
          // If we detect X-Frame-Options or the site refuses, use wrapper
          if (!headResponse.ok || headResponse.headers.get('X-Frame-Options')) {
            console.log('Twitter/X page not directly accessible, using wrapper');
            return generateTwitterWrapperResponse(requestUrl);
          }
        } catch (error) {
          console.log('Error checking Twitter/X page accessibility:', error);
          return generateTwitterWrapperResponse(requestUrl);
        }
      }
    } else if (isYouTube) {
      // For YouTube, always convert to mobile format
      requestUrl = convertToMobileUrl(url, true);
    } else {
      // For all other domains, always convert to mobile
      requestUrl = convertToMobileUrl(url, true);
    }
    
    // Clone the request for modification
    let request = new Request(requestUrl, {
      headers: getModifiedHeaders(requestUrl, event.request.headers),
      method: event.request.method,
      body: event.request.body,
      mode: 'cors',
      credentials: event.request.credentials,
      redirect: 'follow'
    });
    
    // The rest of the fetch handler
    console.log(`Fetching mobile URL:`, requestUrl);
    const response = await fetch(request);
    
    // Process the response
    if (response.ok) {
      // Modify response headers to allow framing
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: modifyResponseHeaders(response.headers)
      });
      
      // Cache the response if appropriate
      if (shouldCacheResponse(requestUrl, response)) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, newResponse.clone());
      }
      
      return newResponse;
    }
    
    return response;
  } catch (error) {
    console.error('Error in fetch handler:', error);
    return new Response('Network error', { status: 500 });
  }
}

// Modified response processor that relies more on declarativeNetRequest
async function modifyResponseIfNeeded(response, isTwitterDomain) {
  try {
    // Even with declarativeNetRequest, we still need to check HTML content for inline framing blockers
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      // For Twitter, we need more aggressive modifications
      if (isTwitterDomain) {
        return await aggressiveHeaderModification(response.clone());
      }
      
      // For other HTML, just check if the body has frame busting code
      const clonedResponse = response.clone();
      const text = await clonedResponse.text();
      
      // Check for common frame busting techniques in the HTML
      const hasBustingCode = 
        text.includes('top !== self') || 
        text.includes('top != self') || 
        text.includes('top.location') || 
        text.includes('parent !== window') ||
        text.includes('window.frameElement');
      
      if (hasBustingCode) {
        // More advanced body modification
        return await modifyHtmlContent(response, text);
      }
    }
    
    // For non-HTML or HTML without busting, declarativeNetRequest should handle it
    return response;
  } catch (error) {
    console.error('Error in modifyResponseIfNeeded:', error);
    return response;
  }
}

// Modify HTML content to prevent frame busting scripts
async function modifyHtmlContent(response, html) {
  // Basic replacements for common frame busting code
  const modifiedHtml = html
    .replace(/if\s*\(\s*(?:window\.)?top\s*!==?\s*(?:window\.)?self\s*\)/g, 'if (false)')
    .replace(/if\s*\(\s*(?:window\.)?parent\s*!==?\s*(?:window\s*\))/g, 'if (false)')
    .replace(/window\.frameElement/g, 'null')
    .replace(/self\s*!==?\s*top/g, 'false')
    .replace(/top\s*!==?\s*self/g, 'false')
    .replace(/parent\s*!==?\s*window/g, 'false')
    .replace(/top\s*!=\s*self/g, 'false')
    .replace(/window\.top\s*!==?\s*window\.self/g, 'false');
  
  // Add our script to the head to override security properties
  const headPos = modifiedHtml.indexOf('</head>');
  let finalHtml = modifiedHtml;
  
  if (headPos !== -1) {
    const antiFrameBustingScript = `
      <script>
        // Override security checks
        Object.defineProperty(window, 'frameElement', { value: null });
        Object.defineProperty(window, 'top', { value: window.self });
        Object.defineProperty(window, 'parent', { value: window.self });
        
        // Prevent location hijacking
        const originalAssign = window.location.assign;
        const originalReplace = window.location.replace;
        window.location.assign = function(url) {
          if (url && typeof url === 'string' && url.includes('top.location')) return;
          return originalAssign.apply(this, arguments);
        };
        window.location.replace = function(url) {
          if (url && typeof url === 'string' && url.includes('top.location')) return;
          return originalReplace.apply(this, arguments);
        };
      </script>
    `;
    
    // Insert script before head closing tag
    finalHtml = modifiedHtml.substring(0, headPos) + antiFrameBustingScript + modifiedHtml.substring(headPos);
  }
  
  // Create the new response with the same status and headers
  const modifiedResponseInit = {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers)
  };
  
  // Ensure all security headers are removed (backup in case declarativeNetRequest missed any)
  HEADERS_TO_REMOVE.forEach(header => {
    modifiedResponseInit.headers.delete(header);
  });
  
  // Add our processed marker
  modifiedResponseInit.headers.set('X-Frame-Options-Modified', 'true');
  
  return new Response(finalHtml, modifiedResponseInit);
}

// Cache management functions
async function getCachedResponse(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);
    
    if (!cachedResponse) return null;
    
    // Check if the cached response is still valid
    const cachedDate = new Date(cachedResponse.headers.get('date') || Date.now());
    if (Date.now() - cachedDate.getTime() > CACHE_DURATION) {
      console.log('Cache expired for:', request.url);
      return null; // Cache expired
    }
    
    return cachedResponse;
  } catch (error) {
    console.error('Cache retrieval error:', error);
    return null;
  }
}

// Modified cacheResponse function to check for unsupported URL schemes
async function cacheResponse(request, response) {
  try {
    // Skip caching for chrome-extension:// URLs and other unsupported schemes
    if (request.url.startsWith('chrome-extension:') || 
        request.url.startsWith('chrome:') ||
        request.url.startsWith('chrome-search:') ||
        request.url.startsWith('devtools:')) {
      return;
    }
    
    const cache = await caches.open(CACHE_NAME);
    // Only cache successful responses
    if (response && response.ok) {
      await cache.put(request, response);
      console.log('Cached response for:', request.url);
    }
  } catch (error) {
    console.error('Cache storage error:', error);
  }
}

// Handle regular website requests
async function handleGeneralRequest(request) {
  try {
    // Clone and modify the request with enhanced headers
    let modifiedRequest = new Request(request.url, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
      mode: 'cors',
      credentials: 'include'
    });
    
    // Add enhanced headers to make the request look like it's coming from a browser
    Object.entries(ENHANCED_REQUEST_HEADERS).forEach(([key, value]) => {
      modifiedRequest.headers.set(key, value);
    });
    
    // Add cache busting for non-API requests to avoid cached responses with security headers
    if (request.method === 'GET' && !request.url.includes('/api/')) {
      const url = new URL(request.url);
      url.searchParams.set('_cb', Date.now());
      modifiedRequest = new Request(url.toString(), {
        method: modifiedRequest.method,
        headers: modifiedRequest.headers,
        body: modifiedRequest.body,
        mode: modifiedRequest.mode,
        credentials: modifiedRequest.credentials
      });
    }
    
    // Make the fetch request
    const response = await fetch(modifiedRequest);
    
    // Process the response if needed (declarativeNetRequest does most of the work)
    const modifiedResponse = await modifyResponseIfNeeded(response.clone(), false);
    
    // Cache the response for future use
    cacheResponse(request, modifiedResponse.clone());
    
    return modifiedResponse;
  } catch (error) {
    console.error('Error handling general request:', error);
    return fetch(request);
  }
}

// Handle YouTube requests (special case)
async function handleYouTubeRequest(request) {
  try {
    // For YouTube, we add special referrer
    let modifiedRequest = new Request(request.url, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
      mode: 'cors',
      credentials: 'include'
    });
    
    // Add enhanced headers
    Object.entries(ENHANCED_REQUEST_HEADERS).forEach(([key, value]) => {
      modifiedRequest.headers.set(key, value);
    });
    
    // YouTube specific headers
    modifiedRequest.headers.set('Referer', 'https://m.youtube.com/');
    modifiedRequest.headers.set('Origin', 'https://m.youtube.com');
    modifiedRequest.headers.set('X-YouTube-Client-Name', '2'); // 2 = mobile web
    modifiedRequest.headers.set('X-YouTube-Client-Version', '2.20230721.00.00');
    
    // Add cache busting for non-API requests
    if (request.method === 'GET' && !request.url.includes('/api/')) {
      const url = new URL(request.url);
      
      // Redirect to mobile YouTube if it's the main site
      if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') {
        url.hostname = 'm.youtube.com';
      }
      
      url.searchParams.set('_yt', Date.now());
      modifiedRequest = new Request(url.toString(), {
        method: modifiedRequest.method,
        headers: modifiedRequest.headers,
        body: modifiedRequest.body,
        mode: modifiedRequest.mode,
        credentials: modifiedRequest.credentials
      });
    }
    
    // Make the actual request
    const response = await fetch(modifiedRequest);
    
    // Modify the response if needed (declarativeNetRequest does most of the work)
    const modifiedResponse = await modifyResponseIfNeeded(response.clone(), false);
    
    // Cache the response for future use if not an API call
    if (!request.url.includes('/api/')) {
      cacheResponse(request, modifiedResponse.clone());
    }
    
    return modifiedResponse;
  } catch (error) {
    console.error('Error handling YouTube request:', error);
    return fetch(request);
  }
}

// Handle Twitter requests with special authentication
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
    
    // Explicitly handle case variations
    newHeaders.delete('X-Frame-Options');
    newHeaders.delete('x-frame-options');
    newHeaders.delete('Content-Security-Policy');
    newHeaders.delete('content-security-policy');
    
    // Set permissive headers
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('X-Frame-Options-Modified', 'true');
    
    // Return modified response
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

// Generate a wrapper HTML page that contains the Twitter page in an optimized way
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

// More aggressive header modification for Twitter main page
async function aggressiveHeaderModification(response) {
  try {
    // Read the response body
    const originalBody = await response.arrayBuffer();
    
    // Create a completely new response with minimal headers
    const headers = new Headers();
    
    // Copy only essential headers
    const essentialHeaders = [
      'content-type',
      'content-length',
      'date',
      'expires',
      'last-modified'
    ];
    
    essentialHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) headers.set(header, value);
    });
    
    // Add our own permissive security headers
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', '*');
    headers.set('X-Modified-By', 'Web-Viewer-Extension');
    
    // If it's HTML content, we need to be extra careful
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      // Create a completely new response with the modified body
      const textBody = new TextDecoder().decode(originalBody);
      
      // Remove any script that might be setting X-Frame-Options
      const modifiedBody = textBody
        .replace(/<script[^>]*>.*?document\.domain.*?<\/script>/gs, '')
        .replace(/window\.self\s*!==\s*window\.top/g, 'false')
        .replace(/self\s*!==\s*top/g, 'false')
        .replace(/parent\s*!==\s*window/g, 'false')
        .replace(/window\.frameElement/g, 'null')
        .replace(/if\s*\(\s*window\.top\s*!==\s*window\.self\s*\)/g, 'if (false)')
        .replace(/<meta[^>]*http-equiv\s*=\s*["']X-Frame-Options["'][^>]*>/gi, '')
        .replace(/<meta[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/gi, '');
      
      // Add our own meta tags to prevent framing detection
      const headEndPos = modifiedBody.indexOf('</head>');
      if (headEndPos !== -1) {
        const injectedTags = `
          <meta name="referrer" content="no-referrer">
          <style>html, body { height: 100%; margin: 0; }</style>
          <script>
            // Override security checks
            Object.defineProperty(window, 'frameElement', { value: null });
            Object.defineProperty(window, 'top', { value: window.self });
            Object.defineProperty(window, 'parent', { value: window.self });
            
            // Prevent location hijacking
            const originalAssign = window.location.assign;
            const originalReplace = window.location.replace;
            window.location.assign = function(url) {
              if (url && typeof url === 'string' && url.includes('top.location')) return;
              return originalAssign.apply(this, arguments);
            };
            window.location.replace = function(url) {
              if (url && typeof url === 'string' && url.includes('top.location')) return;
              return originalReplace.apply(this, arguments);
            };
          </script>
        `;
        const modifiedHtml = modifiedBody.substring(0, headEndPos) + 
                             injectedTags + 
                             modifiedBody.substring(headEndPos);
        
        return new Response(modifiedHtml, {
          status: response.status,
          statusText: response.statusText,
          headers: headers
        });
      }
    }
    
    // If no special HTML processing, just return with modified headers
    return new Response(originalBody, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    });
  } catch (error) {
    console.error('Error in aggressive header modification:', error);
    return response;
  }
}

// Get a guest token for Twitter unauthenticated access
async function getGuestToken() {
  try {
    console.log('Attempting to get a new guest token...');
    
    // Try first from the activate.json endpoint
    const response = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'User-Agent': ENHANCED_REQUEST_HEADERS['User-Agent'],
        'Content-Type': 'application/json',
        'Origin': 'https://twitter.com',
        'Referer': 'https://twitter.com/'
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
    
    // Try alternative endpoint
    const altResponse = await fetch('https://api.twitter.com/1.1/guest/activate.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'User-Agent': 'TwitterAndroid/9.95.0-release.0 (29950000-r-0)',
        'Content-Type': 'application/json'
      }
    });
    
    if (altResponse.ok) {
      const data = await altResponse.json();
      if (data.guest_token) {
        guestToken = data.guest_token;
        console.log('Successfully obtained guest token (alt method):', guestToken);
        return;
      }
    }
    
    // If that fails, try from the main page (x.com)
    const xPageResponse = await fetch('https://x.com/', {
      headers: {
        ...ENHANCED_REQUEST_HEADERS,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
    if (xPageResponse.ok) {
      const html = await xPageResponse.text();
      
      // Look for the guest token in the HTML
      const match = html.match(/"gt=(\d+)"/);
      if (match && match[1]) {
        guestToken = match[1];
        console.log('Extracted guest token from HTML:', guestToken);
        return;
      }
      
      // Try to extract from JavaScript
      const jsMatch = html.match(/GUEST_TOKEN['"]\s*:\s*['"]([\w\d]+)['"]/i);
      if (jsMatch && jsMatch[1]) {
        guestToken = jsMatch[1];
        console.log('Extracted guest token from JS:', guestToken);
        return;
      }
    }
    
    // Last try from twitter.com
    const twitterPageResponse = await fetch('https://twitter.com/', {
      headers: {
        ...ENHANCED_REQUEST_HEADERS,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
    if (twitterPageResponse.ok) {
      const html = await twitterPageResponse.text();
      
      // Look for the guest token in the HTML
      const match = html.match(/"gt=(\d+)"/);
      if (match && match[1]) {
        guestToken = match[1];
        console.log('Extracted guest token from Twitter HTML:', guestToken);
        return;
      }
    }
    
    console.warn('Failed to obtain a guest token through any method');
  } catch (error) {
    console.error('Error getting guest token:', error);
  }
}

// Extract authentication tokens from Twitter response
async function extractTokensFromResponse(response) {
  try {
    // Check headers for tokens
    const newGuestToken = response.headers.get('x-guest-token');
    if (newGuestToken) {
      guestToken = newGuestToken;
      console.log('Updated guest token from headers:', guestToken);
    }
    
    // Extract CSRF token from cookies
    const cookies = response.headers.get('set-cookie');
    if (cookies) {
      const csrfMatch = cookies.match(/ct0=([^;]+)/);
      if (csrfMatch && csrfMatch[1]) {
        csrfToken = csrfMatch[1];
        console.log('Updated CSRF token from cookies:', csrfToken);
      }
    }
    
    // For HTML responses, try to extract tokens from the content
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      try {
        const clonedResponse = response.clone();
        const html = await clonedResponse.text();
        
        // Extract from meta tags
        const guestTokenMatch = html.match(/<meta\s+content="([^"]+)"\s+name="gt"/i);
        if (guestTokenMatch && guestTokenMatch[1]) {
          guestToken = guestTokenMatch[1];
          console.log('Updated guest token from HTML meta:', guestToken);
        }
        
        // Extract CSRF from DOM
        const csrfMatch = html.match(/<input\s+type="hidden"\s+value="([^"]+)"\s+name="authenticity_token"/i);
        if (csrfMatch && csrfMatch[1]) {
          csrfToken = csrfMatch[1];
          console.log('Updated CSRF token from HTML form:', csrfToken);
        }
      } catch (e) {
        console.error('Error parsing HTML for tokens:', e);
      }
    }
  } catch (error) {
    console.error('Error extracting tokens:', error);
  }
}

// Function to modify request headers based on the URL
function getModifiedHeaders(url, originalHeaders) {
  const headers = new Headers();
  
  // Copy original headers
  for (const [key, value] of originalHeaders.entries()) {
    // Skip specific headers we want to override
    if (!['user-agent', 'origin', 'referer'].includes(key.toLowerCase())) {
      headers.append(key, value);
    }
  }
  
  // Apply enhanced headers for better compatibility
  const urlObj = new URL(url);
  
  // Twitter/X needs special headers
  if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
    headers.set('User-Agent', MOBILE_USER_AGENT);
    headers.set('Origin', 'https://mobile.twitter.com');
    headers.set('Referer', 'https://mobile.twitter.com/');
    headers.set('x-twitter-active-user', 'yes');
    headers.set('x-twitter-client-language', 'en');
    
    // For API requests, add more specific headers
    if (urlObj.hostname.includes('api.')) {
      headers.set('x-twitter-auth-type', 'OAuth2Session');
      if (guestToken) {
        headers.set('x-guest-token', guestToken);
      }
      headers.set('authorization', 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA');
    }
  } 
  // YouTube needs its own set of headers
  else if (urlObj.hostname.includes('youtube.com')) {
    headers.set('User-Agent', MOBILE_USER_AGENT);
    headers.set('Origin', 'https://m.youtube.com');
    headers.set('Referer', 'https://m.youtube.com/');
  } 
  // For all other sites, use generic headers
  else {
    headers.set('User-Agent', ENHANCED_REQUEST_HEADERS['User-Agent']);
    for (const [key, value] of Object.entries(ENHANCED_REQUEST_HEADERS)) {
      if (key !== 'User-Agent') {
        headers.set(key, value);
      }
    }
  }
  
  return headers;
}

// Function to determine if a response should be cached
function shouldCacheResponse(url, response) {
  try {
    const urlObj = new URL(url);
    
    // Don't cache extension URLs
    if (urlObj.protocol === 'chrome-extension:') {
      return false;
    }
    
    // Don't cache API calls or authentication endpoints
    if (url.includes('/api/') || 
        url.includes('oauth') || 
        url.includes('auth') || 
        url.includes('login')) {
      return false;
    }
    
    // Don't cache non-success responses
    if (!response.ok) {
      return false;
    }
    
    // Don't cache if cache-control says no-store
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl && (cacheControl.includes('no-store') || cacheControl.includes('no-cache'))) {
      return false;
    }
    
    // Don't cache very large responses
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) { // > 5MB
      return false;
    }
    
    // For Twitter/YouTube, be more selective
    if (urlObj.hostname.includes('twitter.com') || urlObj.hostname.includes('x.com')) {
      // Only cache static assets and main pages
      return url.includes('/static/') || 
             url.endsWith('.js') || 
             url.endsWith('.css') || 
             url.endsWith('.png') || 
             url.endsWith('.jpg') || 
             url.endsWith('.svg') ||
             url === 'https://twitter.com/' ||
             url === 'https://x.com/';
    }
    
    // Cache most other responses
    return true;
  } catch (error) {
    console.error('Error in shouldCacheResponse:', error);
    return false;
  }
}

// Function to modify response headers to allow framing
function modifyResponseHeaders(originalHeaders) {
  const headers = new Headers(originalHeaders);
  
  // Remove security headers that prevent framing
  const headersToRemove = [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Frame-Options',
    'Content-Security-Policy-Report-Only'
  ];
  
  headersToRemove.forEach(header => {
    if (headers.has(header)) {
      headers.delete(header);
    }
  });
  
  // Add headers that allow framing
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('X-Frame-Options', 'ALLOWALL');
  
  // If CSP exists and we can't remove it, try to modify it
  const csp = originalHeaders.get('Content-Security-Policy');
  if (csp) {
    // Replace frame-ancestors directive
    let modifiedCsp = csp.replace(/frame-ancestors[^;]*;/g, 'frame-ancestors *;');
    if (modifiedCsp === csp) {
      // If no frame-ancestors directive exists, add one
      modifiedCsp = 'frame-ancestors *; ' + csp;
    }
    headers.set('Content-Security-Policy', modifiedCsp);
  }
  
  return headers;
} 