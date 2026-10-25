// seikatsu service worker. Registered by features/pwa/components/ServiceWorker.tsx as
// /sw.js?v=<build>; a new build means a new script URL, so the browser installs a fresh worker.
//
// - /_next/static, icons, fonts: cache-first (content-hashed, never change).
// - Page loads: network-first with a short timeout, then the last cached copy, then /offline.
// - RSC fetches (client navigation): network-only; offline, answer with a non-RSC response so
//   the router falls back to a full page load, which the page cache then serves.
// - Anything else (server actions, POSTs, /api): untouched.

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const STATIC = "seikatsu-static";
const PAGES = "seikatsu-pages";
const SHELL = `seikatsu-shell-${VERSION}`;
const OFFLINE_URL = "/offline";
const SHELL_URLS = [
	OFFLINE_URL,
	"/manifest.webmanifest",
	"/icons/icon-192.png",
	"/icons/favicon.svg",
];
const NAV_TIMEOUT_MS = 2500;
const STATIC_LIMIT = 600;

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(SHELL)
			.then((cache) => cache.addAll(SHELL_URLS))
			// The first install has no page to disrupt; later ones wait for the update toast.
			.then(() => (self.registration.active ? undefined : self.skipWaiting())),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((k) => k.startsWith("seikatsu-shell-") && k !== SHELL)
					.map((k) => caches.delete(k)),
			);
			await trim(STATIC, STATIC_LIMIT);
			if (self.registration.navigationPreload) {
				await self.registration.navigationPreload.enable();
			}
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("message", (event) => {
	const data = event.data || {};
	if (data.type === "skipWaiting") self.skipWaiting();
	if (data.type === "warm" && Array.isArray(data.urls)) event.waitUntil(warm(data.urls));
	if (data.type === "clear") event.waitUntil(caches.delete(PAGES));
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (
		url.pathname.startsWith("/_next/static/") ||
		url.pathname.startsWith("/icons/") ||
		url.pathname.startsWith("/_next/image")
	) {
		event.respondWith(cacheFirst(request));
		return;
	}
	if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;

	if (request.headers.get("RSC") === "1") {
		event.respondWith(rsc(request));
		return;
	}
	if (request.mode === "navigate") {
		event.respondWith(page(event));
	}
});

async function cacheFirst(request) {
	const cached = await caches.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (response.ok) {
		const cache = await caches.open(STATIC);
		cache.put(request, response.clone());
	}
	return response;
}

async function rsc(request) {
	try {
		return await fetch(request);
	} catch {
		// Not text/x-component → the router does a full navigation, served from PAGES. A 200,
		// so offline prefetches don't each log a failed request.
		return new Response("offline", {
			headers: { "Content-Type": "text/plain", "X-Seikatsu-Offline": "1" },
		});
	}
}

/** Page key: path + query, so /kuroji?tab=accounts and /kuroji are cached apart. */
function pageKey(url) {
	const u = new URL(url);
	return u.pathname + u.search;
}

async function page(event) {
	const { request } = event;
	const cache = await caches.open(PAGES);
	const key = pageKey(request.url);
	const network = (async () => {
		const preloaded = await event.preloadResponse;
		const response = preloaded || (await fetch(request));
		// Only real pages: a redirect means signed out, an error page isn't worth keeping.
		if (response.ok && !response.redirected && isHtml(response)) {
			event.waitUntil(cache.put(key, response.clone()));
		}
		return response;
	})();
	network.catch(() => undefined); // a late failure after the cache answered isn't an error

	const cached = await cache.match(key);
	if (!cached) {
		try {
			return await network;
		} catch {
			return (await caches.match(OFFLINE_URL)) || Response.error();
		}
	}
	// A slow network loses to the cached copy after NAV_TIMEOUT_MS; the fetch still lands in
	// the cache for next time.
	const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS));
	try {
		return (await Promise.race([network, timeout])) || cached;
	} catch {
		return cached;
	}
}

function isHtml(response) {
	return (response.headers.get("Content-Type") || "").includes("text/html");
}

/**
 * Pre-fetch pages so they open offline before they were ever visited — with the scripts and
 * styles they name (script tags and the RSC payload's chunk lists), or they'd render dead.
 */
async function warm(urls) {
	const cache = await caches.open(PAGES);
	for (const url of urls) {
		try {
			const response = await fetch(url, { credentials: "same-origin", redirect: "manual" });
			if (!response.ok || !isHtml(response)) continue;
			await cache.put(pageKey(new URL(url, self.location.origin)), response.clone());
			await warmAssets(await response.text());
		} catch {
			return; // offline again — try next time
		}
	}
}

async function warmAssets(html) {
	const assets = new Set(html.match(/\/_next\/static\/[\w\-./~%]+\.(?:js|css|woff2)/g) || []);
	const cache = await caches.open(STATIC);
	for (const asset of assets) {
		if (await caches.match(asset)) continue;
		const response = await fetch(asset);
		if (response.ok) await cache.put(asset, response);
	}
}

async function trim(name, limit) {
	const cache = await caches.open(name);
	const keys = await cache.keys();
	await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((k) => cache.delete(k)));
}
