// Keep this version in sync with the app shell.
const ASSET_VERSION = '3.1';
const CACHE_NAME = `odak-app-shell:${self.registration.scope}:${ASSET_VERSION}`;
const CACHE_PREFIX = `odak-app-shell:${self.registration.scope}:`;
const scoped = path => new URL(path, self.registration.scope).href;
const versioned = path => scoped(`${path}?v=${ASSET_VERSION}`);
const INDEX = scoped('index.html');
const CORE = [
  'example.md', 'manifest.json', 'apple-icon.png',
  'assets/styles/style.css', 'assets/styles/responsive.css',
  'assets/styles/theme-light.css', 'assets/styles/theme-dark.css', 'assets/styles/theme-odak.css',
  'assets/scripts/script.js', 'assets/scripts/draggable-image.js', 'assets/scripts/wysiwyg-markdown-editor.js',
  'assets/vendor/bootstrap.min.css', 'assets/vendor/bootstrap.bundle.min.js', 'assets/vendor/font-awesome.min.css',
  'assets/images/odak.svg', 'assets/images/odak-icon.png', 'assets/images/odak-icon-192.png',
  'assets/images/odak-icon-512.png', 'assets/images/odak-paper.png', 'assets/images/dark-paper.png',
  'assets/images/white-paper.png', 'assets/fonts/Vazirmatn-Regular.woff2', 'assets/fonts/Vazirmatn-Bold.woff2'
].map(versioned);
// The vendored Font Awesome stylesheet pins these shared font files to its own asset revision.
CORE.push(INDEX, scoped('assets/webfonts/fa-solid-900.woff2?v=3.0-20260626-V'),
  scoped('assets/webfonts/fa-solid-900.ttf?v=3.0-20260626-V'));
const OPTIONAL = [
  'key-new-01', 'key-new-02', 'key-new-03', 'key-new-04', 'key-new-05',
  'space-new', 'backspace', 'return-new', 'scrollUp', 'scrollDown'
].map(sound => versioned(`assets/sounds/type-machine/${sound}.mp3`));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE.map(url => new Request(url, { cache: 'reload' })));
    await Promise.allSettled(OPTIONAL.map(url => cache.add(url)));
    // Leave an update waiting until the last old-version tab closes.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const rootScope = self.registration.scope === `${self.location.origin}/`;
    await Promise.all(keys.filter(key => key !== CACHE_NAME &&
      (key.startsWith(CACHE_PREFIX) || (rootScope && key.startsWith('odak-app-cache-v'))))
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  const url = new URL(request.url);
  const appNavigation = request.mode === 'navigate' &&
    (url.pathname === new URL(self.registration.scope).pathname || url.pathname === new URL(INDEX).pathname);
  if (!appNavigation && !CORE.includes(request.url) && !OPTIONAL.includes(request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(appNavigation ? INDEX : request.url);
    if (hit && !request.headers.has('Range')) return hit;
    try {
      return await fetch(request);
    } catch {
      return hit || new Response('This resource is not available offline.', { status: 503 });
    }
  })());
});
