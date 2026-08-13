// Call Desk (Leads) — service worker with forced auto-update.
// Same pattern as the main Loan Tracker's sw.js: bump CACHE_VERSION on
// every release, and the app shell force-updates on next open with no
// manual cache-clear needed. See leads.html's initServiceWorkerAutoUpdate
// for the page-side half of this flow.

const CACHE_VERSION = 'v3';                     // <-- bump this on every deploy
const CACHE_NAME = 'calldesk-shell-' + CACHE_VERSION;
const SHELL_FILES = ['./index.html', './manifest.json', './calldesk-icon-192.png', './calldesk-icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let CDN/Supabase calls pass straight through

  event.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
