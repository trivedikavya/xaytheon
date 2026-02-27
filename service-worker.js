/**
 * XAYTHEON Service Worker v2
 * Provides offline support, intelligent caching strategies, push notifications,
 * and background sync for the XAYTHEON PWA.
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `xaytheon-static-${CACHE_VERSION}`;
const API_CACHE_NAME = `xaytheon-api-${CACHE_VERSION}`;
const CDN_CACHE_NAME = `xaytheon-cdn-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `xaytheon-images-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// ==================== STATIC ASSETS (App Shell) ====================
// These are pre-cached on install for instant offline access
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/offline.html',
    '/navbar.html',

    // Core pages
    '/github.html',
    '/analytics.html',
    '/achievements.html',
    '/watchlist.html',
    '/community.html',
    '/explore.html',
    '/contributions.html',
    '/login.html',
    '/register.html',
    '/search.html',
    '/contact.html',

    // Feature pages
    '/heatmap.html',
    '/sentiment.html',
    '/compare.html',
    '/health.html',
    '/pr-review.html',
    '/ai-chat.html',
    '/code-dna.html',
    '/brain-map.html',
    '/knowledge-map.html',
    '/fleet.html',
    '/forensics.html',
    '/arch-drift.html',
    '/green-code.html',
    '/compliance.html',
    '/bundle-city.html',
    '/war-room.html',
    '/risk-galaxy.html',
    '/predictive-dashboard.html',
    '/infra-monitor.html',
    '/observability.html',

    // Core CSS
    '/style.css',
    '/home.css',
    '/favorites.css',
    '/github.css',
    '/analytics.css',
    '/achievements.css',
    '/watchlist.css',
    '/modal-fix.css',

    // Core JS
    '/script.js',
    '/auth.js',
    '/pwa.js',
    '/theme.js',
    '/i18n.js',
    '/favorites.js',
    '/offline-manager.js',

    // Manifest & Icons
    '/manifest.json',
    '/assets/favicon.svg',
    '/assets/logo/thelogo.png',
    '/assets/icons/icon.svg',
    '/assets/icons/icon-192x192.png',
    '/assets/icons/icon-512x512.png',
    '/assets/icons/icon-144x144.png',
    '/assets/icons/icon-72x72.png',
    '/assets/icons/icon-96x96.png',
    '/assets/icons/badge-72x72.png',
];

// Lazily cached CSS (cached on first access, not on install)
const LAZY_CSS = [
    '/heatmap.css', '/sentiment.css', '/compare.css', '/health.css',
    '/pr-review.css', '/ai.css', '/code-dna.css', '/brain-map.css',
    '/knowledge-map.css', '/fleet.css', '/forensics.css', '/arch-drift.css',
    '/green-code.css', '/compliance.css', '/bundle-city.css', '/war-room.css',
    '/risk-galaxy.css', '/predictive.css', '/infra-monitor.css', '/observability.css',
    '/search.css', '/collaboration.css', '/builder.css', '/globe.css',
    '/graph.css', '/analyzer.css', '/sprint-planner.css', '/sprint-forecaster.css',
    '/test-lab.css', '/time-travel.css', '/traffic.css', '/risk.css',
    '/pr.css', '/release.css', '/refactor-safety.css', '/security-warroom.css',
    '/features_analytics.css', '/github-suggestions.css',
];

// API endpoints to cache with network-first strategy
const API_ENDPOINTS = [
    '/api/achievements',
    '/api/achievements/leaderboard',
];

// Trusted CDN origins for caching
const TRUSTED_CDNS = [
    'https://cdn.jsdelivr.net',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://cdnjs.cloudflare.com',
];

// ==================== INSTALL EVENT ====================
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker v2...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Pre-caching app shell...');
                // Use addAll with error resilience — skip assets that 404
                return Promise.allSettled(
                    STATIC_ASSETS.map(async (url) => {
                        try {
                            const response = await fetch(url, { cache: 'no-cache' });
                            if (response.ok) {
                                await cache.put(url, response);
                            } else {
                                console.warn(`[SW] Skipped caching (${response.status}): ${url}`);
                            }
                        } catch (err) {
                            console.warn(`[SW] Failed to cache: ${url}`, err.message);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] App shell pre-cached successfully');
                return self.skipWaiting(); // Activate immediately
            })
    );
});

// ==================== ACTIVATE EVENT ====================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker v2...');

    const currentCaches = [CACHE_NAME, API_CACHE_NAME, CDN_CACHE_NAME, IMAGE_CACHE_NAME];

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => !currentCaches.includes(name))
                        .map((name) => {
                            console.log('[SW] Purging old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service Worker v2 activated');
                return self.clients.claim(); // Take control of all pages immediately
            })
    );
});

// ==================== FETCH EVENT ====================
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip chrome-extension and other non-http(s) schemes
    if (!url.protocol.startsWith('http')) return;

    // API requests — Network First, fallback to cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request, API_CACHE_NAME));
        return;
    }

    // CDN resources — Stale While Revalidate (fast load, background update)
    if (isTrustedCDN(url.origin)) {
        event.respondWith(staleWhileRevalidate(request, CDN_CACHE_NAME));
        return;
    }

    // Skip cross-origin requests that aren't trusted CDNs
    if (url.origin !== location.origin) return;

    // Images — Cache First (images rarely change)
    if (isImageAsset(url.pathname)) {
        event.respondWith(cacheFirst(request, IMAGE_CACHE_NAME));
        return;
    }

    // Static assets (CSS, JS, fonts) — Stale While Revalidate
    if (isStaticAsset(url.pathname)) {
        event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
        return;
    }

    // HTML pages — Network First with offline fallback
    if (request.headers.get('accept')?.includes('text/html') || url.pathname.endsWith('.html')) {
        event.respondWith(networkFirstWithOffline(request));
        return;
    }

    // Default — Stale While Revalidate
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
});

// ==================== CACHING STRATEGIES ====================

/**
 * Cache First — Serve from cache, fetch from network only if not cached.
 * Best for: images, icons, fonts — rarely changing assets.
 */
async function cacheFirst(request, cacheName = CACHE_NAME) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('[SW] Cache-first fallback failed:', error);
        // Return a transparent 1x1 pixel for failed images
        if (isImageAsset(new URL(request.url).pathname)) {
            return new Response(
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
            );
        }
        throw error;
    }
}

/**
 * Network First — Try network, fallback to cache.
 * Best for: API calls, dynamic data.
 */
async function networkFirst(request, cacheName = CACHE_NAME) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('[SW] Network failed, serving from cache...');
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;

        // Return a JSON error for API requests
        return new Response(
            JSON.stringify({ error: 'offline', message: 'You are currently offline.' }),
            {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

/**
 * Network First with Offline Fallback — For HTML pages.
 * Shows the cached version or offline page when network is unavailable.
 */
async function networkFirstWithOffline(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.log('[SW] Offline — serving cached page or offline fallback...');
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;

        // Serve offline fallback page
        const offlineResponse = await caches.match(OFFLINE_URL);
        if (offlineResponse) return offlineResponse;

        // Last resort
        return new Response(
            '<html><body style="background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h1 style="color:#6366f1">📴 Offline</h1><p>Please check your internet connection.</p><button onclick="location.reload()" style="background:#6366f1;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;margin-top:16px">Retry</button></div></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
        );
    }
}

/**
 * Stale While Revalidate — Serve from cache instantly, update in background.
 * Best for: CSS, JS files — fast load + eventual freshness.
 */
async function staleWhileRevalidate(request, cacheName = CACHE_NAME) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch(() => null);

    return cachedResponse || (await fetchPromise) || new Response('', { status: 408 });
}

// ==================== HELPER FUNCTIONS ====================

function isStaticAsset(pathname) {
    return /\.(css|js|woff|woff2|ttf|eot|json)$/i.test(pathname);
}

function isImageAsset(pathname) {
    return /\.(png|jpg|jpeg|gif|svg|ico|webp|avif)$/i.test(pathname);
}

function isTrustedCDN(origin) {
    return TRUSTED_CDNS.some(cdn => origin.startsWith(cdn));
}

// ==================== PUSH NOTIFICATIONS ====================
self.addEventListener('push', (event) => {
    console.log('[SW] Push received');

    let data = {
        title: 'XAYTHEON',
        body: 'You have a new notification!',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/badge-72x72.png',
        tag: 'xaytheon-notification',
        data: { url: '/' }
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            data: data.data,
            vibrate: [100, 50, 100],
            actions: [
                { action: 'open', title: '🚀 Open' },
                { action: 'close', title: '✖ Dismiss' }
            ]
        })
    );
});

// ==================== NOTIFICATION CLICK ====================
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked');
    event.notification.close();

    if (event.action === 'close') return;

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ==================== BACKGROUND SYNC ====================
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);

    if (event.tag === 'sync-pending-requests') {
        event.waitUntil(syncPendingRequests());
    }
});

async function syncPendingRequests() {
    const pendingRequests = await getPendingRequests();

    for (const request of pendingRequests) {
        try {
            const response = await fetch(request.url, {
                method: request.method,
                headers: request.headers,
                body: request.body
            });

            if (response.ok) {
                await removePendingRequest(request.id);
                console.log('[SW] Synced request:', request.url);
            }
        } catch (error) {
            console.error('[SW] Failed to sync request:', error);
        }
    }
}

// IndexedDB helpers for pending requests
async function getPendingRequests() {
    return [];
}

async function removePendingRequest(id) {
    // Handled by pwa.js on the main thread
}

// ==================== MESSAGE HANDLING ====================
self.addEventListener('message', (event) => {
    console.log('[SW] Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_VERSION });
    }

    // Allow clearing specific caches from the client
    if (event.data.type === 'CLEAR_CACHE') {
        const cacheToClear = event.data.cacheName;
        caches.delete(cacheToClear).then(() => {
            console.log('[SW] Cache cleared:', cacheToClear);
        });
    }

    // Force refresh all caches
    if (event.data.type === 'REFRESH_ALL') {
        caches.keys().then(names => {
            return Promise.all(names.map(name => caches.delete(name)));
        }).then(() => {
            console.log('[SW] All caches cleared');
        });
    }

    // Cache a specific URL on demand
    if (event.data.type === 'CACHE_URL') {
        const urlToCache = event.data.url;
        caches.open(CACHE_NAME).then(cache => {
            return cache.add(urlToCache);
        }).then(() => {
            console.log('[SW] Cached on demand:', urlToCache);
        }).catch(err => {
            console.warn('[SW] Failed to cache:', urlToCache, err);
        });
    }
});

// ==================== PERIODIC BACKGROUND SYNC ====================
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'update-content') {
        event.waitUntil(updateCachedContent());
    }
});

async function updateCachedContent() {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();

    // Silently update cached HTML pages in the background
    for (const request of requests) {
        if (request.url.endsWith('.html')) {
            try {
                const response = await fetch(request, { cache: 'no-cache' });
                if (response.ok) {
                    await cache.put(request, response);
                }
            } catch (err) {
                // Silently fail — we're in the background
            }
        }
    }
}

console.log(`[SW] Service Worker v${CACHE_VERSION} loaded`);
