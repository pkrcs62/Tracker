// Loan Tracker — service worker with forced auto-update.
//
// WHY THE OLD VERSION WENT STALE:
// skipWaiting() alone activates a new worker, but a page that's already
// open keeps running the OLD javascript/DOM until it reloads — nobody
// reloads it for them, so "update" silently did nothing.
//
// FIX: bump CACHE_VERSION on every release (this is the ONLY thing you
// need to edit to ship an update). The browser always re-checks sw.js
// itself on load, byte-for-byte — so a changed CACHE_VERSION here is
// what triggers the whole update flow below. Combined with the reload
// logic in index.html, every device force-updates to the new version
// within seconds of opening the app, no manual cache-clear needed.

const CACHE_VERSION = 'v5';                     // <-- bump this on every deploy
const CACHE_NAME = 'loan-tracker-shell-' + CACHE_VERSION;
const SHELL_FILES = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch(() => {})
  );
  // Move to "installed/waiting" fast, but do NOT force-activate here —
  // index.html decides when it's safe to swap (see SKIP_WAITING message
  // below), so an open tab never gets its JS pulled out from under it
  // mid-use. If no page is listening, the postMessage below still lands
  // as soon as one connects.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Let the page tell us "the user is ready, take over now."
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let CDN/Supabase calls pass straight through

  // Network-first, always re-caching the freshest bytes under the
  // CURRENT version's cache name — falls back to cache only when
  // truly offline.
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
