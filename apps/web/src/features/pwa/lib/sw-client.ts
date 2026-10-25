// Messages to the service worker (public/sw.js). Every call is a no-op where service workers
// aren't available (old browsers, private modes, dev without a registration).

type SwMessage = { type: "skipWaiting" } | { type: "warm"; urls: string[] } | { type: "clear" };

/** The build the page runs, so each deploy registers a new worker script URL. */
export const SW_URL = `/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`;

export function swSupported() {
	return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

export async function postToWorker(message: SwMessage) {
	if (!swSupported()) return;
	const registration = await navigator.serviceWorker.getRegistration();
	(registration?.active ?? navigator.serviceWorker.controller)?.postMessage(message);
}

/** Pre-cache pages so they open offline before they were ever visited. */
export function warmPages(urls: string[]) {
	return postToWorker({ type: "warm", urls: [...new Set(urls)] });
}

/** Drop every cached page: they hold the signed-in user's data. */
export function forgetPages() {
	return postToWorker({ type: "clear" });
}
