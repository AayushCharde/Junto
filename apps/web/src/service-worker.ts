/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

// `self` is the ServiceWorkerGlobalScope inside a service worker.
const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `junto-cache-${version}`;
// Versioned build output + static files (manifest, icon, robots…) — safe to precache.
const PRECACHE = [...build, ...files];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;
	// Never cache API, auth, or anything dynamic/session-bound.
	if (url.pathname.startsWith('/api') || url.pathname.startsWith('/auth')) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			// Immutable, versioned build assets: cache-first.
			if (PRECACHE.includes(url.pathname)) {
				const hit = await cache.match(url.pathname);
				if (hit) return hit;
			}

			// Pages/navigations: network-first, fall back to cache when offline.
			try {
				const response = await fetch(request);
				if (response.ok && response.type === 'basic') {
					cache.put(request, response.clone());
				}
				return response;
			} catch (err) {
				const cached = await cache.match(request);
				if (cached) return cached;
				throw err;
			}
		})()
	);
});
