"use client";

import { useEffect } from "react";

/**
 * Once per full page load (a PWA launch included): where the time went, from the browser's
 * own navigation timing, sent to /api/vitals after the page has loaded. Client navigations
 * don't remount this, so they send nothing.
 */
export function LaunchTiming() {
	useEffect(() => {
		const hydrated = performance.now();
		const send = () => {
			// Offline (a launch from the cache) there's nobody to tell, and a failed beacon is noise.
			if (!navigator.onLine) return;
			const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
			if (!nav) return;
			const at = (v: number) => (v > 0 ? Math.round(v) : undefined);
			const body = JSON.stringify({
				path: location.pathname,
				type: nav.type,
				standalone:
					window.matchMedia("(display-mode: standalone)").matches ||
					(navigator as { standalone?: boolean }).standalone === true,
				controlled: !!navigator.serviceWorker?.controller,
				transferSize: nav.transferSize,
				workerStart: at(nav.workerStart),
				fetchStart: at(nav.fetchStart),
				responseStart: at(nav.responseStart),
				responseEnd: at(nav.responseEnd),
				domInteractive: at(nav.domInteractive),
				domContentLoaded: at(nav.domContentLoadedEventEnd),
				loadEnd: at(nav.loadEventEnd),
				hydrated: Math.round(hydrated),
			});
			navigator.sendBeacon?.("/api/vitals", new Blob([body], { type: "application/json" }));
		};
		// After the load event, so its end is known; never in the way of the page.
		const later = () => setTimeout(send, 1000);
		if (document.readyState === "complete") later();
		else window.addEventListener("load", later, { once: true });
		return () => window.removeEventListener("load", later);
	}, []);

	return null;
}
