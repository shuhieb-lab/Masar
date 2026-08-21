const CACHE = 'masar-v046';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './layout-fix.css',
  './app.js',
  './students-import.js',
  './teachers.js',
  './backup.js',
  './security-hardening.js',
  './config.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './pdf-export.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.endsWith('/layout-fix.css') ||
    url.pathname.endsWith('layout-fix.css') ||
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('app.js') ||
    url.pathname.endsWith('/students-import.js') ||
    url.pathname.endsWith('students-import.js') ||
    url.pathname.endsWith('/backup.js') ||
    url.pathname.endsWith('backup.js') ||
    url.pathname.endsWith('/teachers.js') ||
    url.pathname.endsWith('teachers.js') ||
    url.pathname.endsWith('/security-hardening.js') ||
    url.pathname.endsWith('security-hardening.js') ||
    url.pathname.endsWith('/config.js') ||
    url.pathname.endsWith('config.js') ||
    url.pathname.endsWith('/pdf-export.js') ||
    url.pathname.endsWith('pdf-export.js')
  ) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
