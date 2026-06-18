// Service Worker for Odak App

const ASSET_VERSION = '3.0-20260626-IV';
const CACHE_NAME = `odak-app-cache-v${ASSET_VERSION}`;
const versioned = url => `${url}?v=${ASSET_VERSION}`;
const urlsToCache = [
  '/',
  versioned('/index.html'),
  versioned('/example.md'),
  versioned('/assets/styles/style.css'),
  versioned('/assets/styles/responsive.css'),
  versioned('/assets/styles/theme-light.css'),
  versioned('/assets/styles/theme-dark.css'),
  versioned('/assets/styles/theme-odak.css'),
  versioned('/assets/scripts/script.js'),
  versioned('/assets/images/odak-icon.png'),
  versioned('/assets/images/odak-icon-192.png'),
  versioned('/assets/images/odak-icon-512.png'),
  versioned('/assets/images/odak.svg'),
  versioned('/assets/images/odak-paper.png'),
  versioned('/assets/images/dark-paper.png'),
  versioned('/assets/images/white-paper.png'),
  versioned('/manifest.json'),
  versioned('/assets/fonts/Vazirmatn-Regular.woff2'),
  versioned('/assets/fonts/Vazirmatn-Bold.woff2'),
  versioned('/assets/webfonts/fa-solid-900.ttf'),
  versioned('/assets/webfonts/fa-solid-900.woff2'),
  versioned('/assets/sounds/type-machine/key-new-01.mp3'),
  versioned('/assets/sounds/type-machine/key-new-02.mp3'),
  versioned('/assets/sounds/type-machine/key-new-03.mp3'),
  versioned('/assets/sounds/type-machine/key-new-04.mp3'),
  versioned('/assets/sounds/type-machine/key-new-05.mp3'),
  versioned('/assets/sounds/type-machine/space-new.mp3'),
  versioned('/assets/sounds/type-machine/backspace.mp3'),
  versioned('/assets/sounds/type-machine/return-new.mp3'),
  versioned('/assets/sounds/type-machine/scrollUp.mp3'),
  versioned('/assets/sounds/type-machine/scrollDown.mp3'),
  versioned('/assets/scripts/draggable-image.js'),
  versioned('/assets/scripts/wysiwyg-markdown-editor.js'),
  versioned('/assets/vendor/bootstrap.min.css'),
  versioned('/assets/vendor/font-awesome.min.css'),
  versioned('/assets/vendor/bootstrap.bundle.min.js')
];

// Install event - cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return Promise.allSettled(urlsToCache.map(url => cache.add(url)));
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheAllowlist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheAllowlist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request to prevent consuming it
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then(response => {
            // Check if valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response to store in cache and return it
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Return a fallback page if offline and page not in cache
            if (event.request.mode === 'navigate') {
              return caches.match(versioned('/index.html'));
            }
            
            // For other requests, try to return a cached version
            return caches.match(event.request.url)
              .then(cachedResponse => {
                if (cachedResponse) {
                  return cachedResponse;
                }
                
                // If no cached version exists, return a basic offline page
                const acceptHeader = event.request.headers.get('accept') || '';
                if (acceptHeader.includes('text/html')) {
                  return caches.match(versioned('/index.html'));
                }
                
                // For other types of requests, return a basic offline response
                return new Response('Offline content not available', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'text/plain'
                  })
                });
              });
          });
      })
  );
}); 
