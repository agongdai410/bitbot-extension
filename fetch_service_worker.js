// Domains that require special handling
const TWITTER_DOMAINS = [
  'twitter.com',
  'x.com',
  'abs.twimg.com',
  'pbs.twimg.com',
  'video.twimg.com',
  'api.twitter.com',
  'api.x.com'
];

const YOUTUBE_DOMAINS = [
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'ytimg.com',
  'yt3.ggpht.com',
  'yt3.googleusercontent.com'
];

// Headers to add to outgoing requests (ensures sites see us as a regular browser)
const ENHANCED_REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

// Additional request headers for Twitter API
const TWITTER_API_HEADERS = {
  'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
  'x-twitter-client-language': 'en',
  'x-twitter-active-user': 'yes',
  'Origin': 'https://twitter.com'
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

// Caching strategy
const CACHE_NAME = 'web-viewer-cache-v1';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Register this service worker
self.addEventListener('install', event => {
  console.log('Web Viewer Service Worker installed');
  self.skipWaiting();
  
  // Initialize the declarativeNetRequest rules
  event.waitUntil(initializeHeaderModificationRules());
});

self.addEventListener('activate', event => {
  console.log('Web Viewer Service Worker activated');
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
  
  // Handle messages from panel.js
  if (event.data && event.data.type === 'loading-page') {
    // The panel is loading a page - perform any setup needed
    console.log('Panel is loading URL:', event.data.url);
    
    // If it's Twitter/X, make sure we have a guest token
    const url = new URL(event.data.url);
    if (url.hostname === 'twitter.com' || url.hostname === 'x.com') {
      if (!guestToken) {
        await getGuestToken();
      }
    }
  } else if (event.data && event.data.type === 'page-loaded') {
    // The panel reports a page was loaded (or failed)
    console.log('Panel reports page loaded:', event.data.success ? 'success' : 'failed');
    
    // If the client needs a response, send one
    if (event.source) {
      event.source.postMessage({
        type: 'page-load-status',
        success: event.data.success,
        url: event.data.url,
        error: event.data.error || null
      });
    }
  }
});

// Initialize declarativeNetRequest rules to remove security headers
async function initializeHeaderModificationRules() {
  try {
    // Remove any existing rules first
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1, 2, 3]
    });
    
    // Add rule for all websites - remove X-Frame-Options and CSP
    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: [
        {
          id: 1,
          priority: 100, // Higher priority
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            responseHeaders: [
              {
                header: "X-Frame-Options",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              }
            ]
          },
          condition: {
            urlFilter: "*",
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME
            ]
          }
        },
        {
          id: 2,
          priority: 100, // Higher priority
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            responseHeaders: [
              {
                header: "Content-Security-Policy",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              },
              {
                header: "Content-Security-Policy-Report-Only",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              },
              {
                header: "Frame-Options",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              },
              {
                header: "Cross-Origin-Embedder-Policy",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              },
              {
                header: "Cross-Origin-Opener-Policy",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              },
              {
                header: "Cross-Origin-Resource-Policy",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              }
            ]
          },
          condition: {
            urlFilter: "*",
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST
            ]
          }
        },
        // Add UA rule for Twitter/YouTube specifically
        {
          id: 3,
          priority: 200, // Even higher priority for specific domains
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: "User-Agent",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: ENHANCED_REQUEST_HEADERS["User-Agent"]
              },
              {
                header: "Sec-Fetch-Dest",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: "document"
              }
            ]
          },
          condition: {
            domains: [...TWITTER_DOMAINS, ...YOUTUBE_DOMAINS],
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.IMAGE,
              chrome.declarativeNetRequest.ResourceType.SCRIPT,
              chrome.declarativeNetRequest.ResourceType.STYLESHEET
            ]
          }
        }
      ]
    });
    
    console.log('Successfully set up declarativeNetRequest rules for header modification');
  } catch (error) {
    console.error('Failed to set up declarativeNetRequest rules:', error);
  }
}

// Listen for fetch events
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // For Twitter/X domains, we want to be especially careful about interception
  const isTwitterDomain = TWITTER_DOMAINS.some(domain => url.hostname.includes(domain));
  const isMainTwitterPage = url.hostname === 'twitter.com' || url.hostname === 'x.com';
  
  // Always use respondWith to handle all fetch events
  event.respondWith(
    (async function() {
      try {
        // For main Twitter/X pages, bypass cache to ensure we get the freshest response
        if (!isMainTwitterPage) {
          // Check for cached responses first (except for Twitter API calls)
          if (!url.hostname.includes('api.twitter.com') && !url.hostname.includes('api.x.com')) {
            const cachedResponse = await getCachedResponse(event.request);
            if (cachedResponse) {
              console.log('Using cached response for:', url.href);
              return cachedResponse;
            }
          }
        }
        
        // Wait for any preloadResponse (could be used for navigation requests)
        const preloadResponse = await event.preloadResponse;
        if (preloadResponse) {
          console.log('Using preload response for:', url.href);
          // Even with declarativeNetRequest, we still need to process some responses
          return await modifyResponseIfNeeded(preloadResponse.clone(), isTwitterDomain);
        }
        
        // Based on domain, choose the appropriate handler
        if (isTwitterDomain) {
          console.log('Intercepting Twitter request:', url.href);
          return handleTwitterRequest(event.request);
        } else if (YOUTUBE_DOMAINS.some(domain => url.hostname.includes(domain))) {
          console.log('Intercepting YouTube request:', url.href);
          return handleYouTubeRequest(event.request);
        } else {
          // For all other domains, use the general handler
          console.log('Intercepting general request:', url.href);
          return handleGeneralRequest(event.request);
        }
      } catch (error) {
        console.error('Error in fetch handler:', error);
        // Fall back to original request
        return fetch(event.request);
      }
    })()
  );
});

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
    modifiedRequest.headers.set('Referer', 'https://www.youtube.com/');
    modifiedRequest.headers.set('Origin', 'https://www.youtube.com');
    
    // Add cache busting for non-API requests
    if (request.method === 'GET' && !request.url.includes('/api/')) {
      const url = new URL(request.url);
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
async function handleTwitterRequest(request) {
  try {
    // Check if this is the main Twitter/X page, which needs special handling
    const url = new URL(request.url);
    const isMainPage = (url.hostname === 'twitter.com' || url.hostname === 'x.com') && 
                       (url.pathname === '/' || url.pathname === '');
    const isProfilePage = (url.hostname === 'twitter.com' || url.hostname === 'x.com') && 
                         url.pathname.match(/^\/[a-zA-Z0-9_]+\/?$/);
    
    // For main page and profile pages, we'll try both methods
    const needsSpecialHandling = isMainPage || isProfilePage;
    
    // Clone the request to modify
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
    
    // For Twitter API requests, add special authentication headers
    if (request.url.includes('api.twitter.com') || request.url.includes('api.x.com')) {
      // Add Twitter-specific API headers
      Object.entries(TWITTER_API_HEADERS).forEach(([key, value]) => {
        modifiedRequest.headers.set(key, value);
      });
      
      // Add specific tokens if we have them
      if (guestToken) {
        modifiedRequest.headers.set('x-guest-token', guestToken);
      }
      if (csrfToken) {
        modifiedRequest.headers.set('x-csrf-token', csrfToken);
      }
      
      // Add special handling for GraphQL requests
      if (request.url.includes('graphql')) {
        modifiedRequest.headers.set('content-type', 'application/json');
      }
      
      // Add special handling for UserByScreenName requests
      if (request.url.includes('UserByScreenName')) {
        // These feature flags are required for newer Twitter GraphQL API
        const featureFlags = {
          "responsive_web_graphql_exclude_directive_enabled": true,
          "verified_phone_label_enabled": false,
          "responsive_web_home_pinned_timelines_enabled": true,
          "responsive_web_graphql_timeline_navigation_enabled": true,
          "responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
          "c9s_tweet_anatomy_moderator_badge_enabled": true,
          "tweetypie_unmention_optimization_enabled": true,
          "responsive_web_edit_tweet_api_enabled": true,
          "graphql_is_translatable_rweb_tweet_is_translatable_enabled": true,
          "view_counts_everywhere_api_enabled": true,
          "longform_notetweets_consumption_enabled": true,
          "responsive_web_twitter_article_tweet_consumption_enabled": false,
          "tweet_awards_web_tipping_enabled": false,
          "freedom_of_speech_not_reach_fetch_enabled": true,
          "standardized_nudges_misinfo": true,
          "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": true,
          "longform_notetweets_rich_text_read_enabled": true,
          "longform_notetweets_inline_media_enabled": true,
          "responsive_web_enhance_cards_enabled": false
        };
        
        // For POST requests (most GraphQL are POST), add feature flags to body
        if (request.method === 'POST' && request.body) {
          try {
            const originalBody = await request.clone().json();
            const modifiedBody = {
              ...originalBody,
              variables: {
                ...originalBody.variables,
                ...featureFlags
              }
            };
            
            // Create a new request with modified body
            modifiedRequest = new Request(request.url, {
              method: request.method,
              headers: modifiedRequest.headers,
              body: JSON.stringify(modifiedBody),
              mode: modifiedRequest.mode,
              credentials: modifiedRequest.credentials
            });
          } catch (e) {
            console.error('Error modifying GraphQL body:', e);
          }
        }
        
        // For GET requests, add feature flags to URL
        if (request.method === 'GET') {
          // Create a new URL to add parameters
          const newUrl = new URL(request.url);
          
          // Add each feature flag to the URL
          Object.entries(featureFlags).forEach(([key, value]) => {
            newUrl.searchParams.set(key, value.toString());
          });
          
          // Create a new request with modified URL
          modifiedRequest = new Request(newUrl.toString(), {
            method: request.method,
            headers: modifiedRequest.headers,
            mode: modifiedRequest.mode,
            credentials: modifiedRequest.credentials
          });
        }
      }
    }
    
    // Special handling for main Twitter page
    if (needsSpecialHandling) {
      // Try to get a guest token if we don't have one
      if (!guestToken && !attemptedGuestToken) {
        attemptedGuestToken = true;
        await getGuestToken();
      }
      
      // For the main page, we use no-store to force a fresh request
      modifiedRequest.headers.set('Cache-Control', 'no-store');
      
      // Try the alternative Twitter method - a wrapper HTML that loads Twitter in a special way
      try {
        // Just try fetching to check if we can access Twitter normally
        const testResponse = await fetch(modifiedRequest, { method: 'HEAD' });
        
        // If we get a 200 OK, proceed normally
        if (testResponse.ok) {
          console.log('Twitter page accessible via normal fetch, proceeding with standard method');
        } else {
          // If we can't access Twitter normally, use the wrapper approach
          console.log('Twitter page not accessible, using wrapper approach');
          return generateTwitterWrapperResponse(request.url);
        }
      } catch (error) {
        console.log('Error testing Twitter access, using wrapper approach:', error);
        return generateTwitterWrapperResponse(request.url);
      }
    }
    
    // Add cache busting for non-API requests to avoid cached responses
    if (request.method === 'GET' && !request.url.includes('/api/') && !request.url.includes('graphql')) {
      const url = new URL(request.url);
      url.searchParams.set('_t', Date.now());
      modifiedRequest = new Request(url.toString(), {
        method: modifiedRequest.method,
        headers: modifiedRequest.headers,
        body: modifiedRequest.body,
        mode: modifiedRequest.mode,
        credentials: modifiedRequest.credentials
      });
    }
    
    // Make the actual request
    let response = await fetch(modifiedRequest);
    
    // If we got a 401 or 403 and don't have a guest token, try to get one and retry
    if ((response.status === 401 || response.status === 403) && 
        (request.url.includes('api.twitter.com') || request.url.includes('api.x.com'))) {
      console.log('Got 401/403, trying to refresh guest token and retry');
      await getGuestToken();
      
      // Retry the request with the new token
      if (guestToken) {
        modifiedRequest.headers.set('x-guest-token', guestToken);
        response = await fetch(modifiedRequest);
      }
    }
    
    // For main Twitter page, check if we need to fall back to the wrapper method
    if (needsSpecialHandling && (response.status === 403 || response.status === 401)) {
      console.log('Twitter returned ' + response.status + ', using wrapper approach');
      return generateTwitterWrapperResponse(request.url);
    }
    
    // Extract tokens from response
    await extractTokensFromResponse(response.clone());
    
    // For main Twitter page, use aggressive header modification
    if (needsSpecialHandling) {
      const modifiedResponse = await aggressiveHeaderModification(response.clone());
      return modifiedResponse;
    }
    
    // For all other Twitter requests, just modify if needed
    const modifiedResponse = await modifyResponseIfNeeded(response.clone(), true);
    
    // Cache the response for future use if not an API call and not the main page
    if (!needsSpecialHandling && !request.url.includes('/api/') && !request.url.includes('graphql')) {
      cacheResponse(request, modifiedResponse.clone());
    }
    
    return modifiedResponse;
  } catch (error) {
    console.error('Error handling Twitter request:', error);
    // Try alternative method for Twitter main page
    if (request.url.includes('twitter.com') || request.url.includes('x.com')) {
      const url = new URL(request.url);
      const isMainPage = (url.pathname === '/' || url.pathname === '');
      const isProfilePage = url.pathname.match(/^\/[a-zA-Z0-9_]+\/?$/);
      
      if (isMainPage || isProfilePage) {
        console.log('Error accessing Twitter, using wrapper approach');
        return generateTwitterWrapperResponse(request.url);
      }
    }
    
    // Fall back to original request
    return fetch(request);
  }
}

// Generate a wrapper HTML page that contains the Twitter page in an optimized way
function generateTwitterWrapperResponse(twitterUrl) {
  const twitterWrappedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Twitter - Web Viewer</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
    }
    #twitter-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .loading {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #1DA1F2;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div id="twitter-wrapper">
    <div class="loading" id="loading">
      <div class="spinner"></div>
      <p>Loading Twitter...</p>
    </div>
    <iframe id="twitter-frame" src="about:blank"></iframe>
  </div>
  
  <script>
    (function() {
      // The URL to load
      const twitterUrl = "${twitterUrl}";
      const frame = document.getElementById('twitter-frame');
      const loading = document.getElementById('loading');
      
      // Set up frame load event
      frame.addEventListener('load', function() {
        // First hide the loading indicator after a short delay
        setTimeout(() => {
          loading.style.display = 'none';
        }, 500);
        
        try {
          // Try to inject scripts into the frame to disable security checks
          const frameDoc = frame.contentDocument || frame.contentWindow.document;
          const script = frameDoc.createElement('script');
          script.textContent = \`
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
          \`;
          
          // Inject the script
          if (frameDoc.body) {
            frameDoc.body.appendChild(script);
          }
        } catch (e) {
          // This will likely fail due to CORS, which is expected
          console.log('Cannot access frame content due to CORS (expected)');
        }
      });
      
      // Set up error handler
      frame.addEventListener('error', function() {
        loading.innerHTML = '<p>Error loading Twitter. Please try again.</p>';
      });
      
      // Load Twitter with a cache-busting parameter
      const cacheBuster = Date.now();
      const urlWithCache = twitterUrl + (twitterUrl.includes('?') ? '&' : '?') + '_t=' + cacheBuster;
      frame.src = urlWithCache;
    })();
  </script>
</body>
</html>
  `;
  
  // Create headers for our wrapper response
  const headers = new Headers();
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('X-Frame-Options-Modified', 'true');
  
  // Return our custom HTML wrapper
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