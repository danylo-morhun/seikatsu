"use client";

import { warmPages } from "@/features/pwa/lib/sw-client";
import { readAppEntry } from "@/lib/app-entry";
import { APPS_CONFIG } from "@/lib/app-themes";
import { useEffect } from "react";

const KEY = "seikatsu:warmed-at";
const EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Signed-in shell only: every few hours, while idle and online, has the service worker fetch
 * each app's entry page so the whole suite opens offline, not just the pages already visited.
 */
export function OfflineWarmup() {
	useEffect(() => {
		if (!("serviceWorker" in navigator) || !navigator.onLine) return;
		let last = 0;
		try {
			last = Number(window.localStorage.getItem(KEY)) || 0;
		} catch {
			// storage unavailable — warm every visit
		}
		if (Date.now() - last < EVERY_MS) return;

		let cancelled = false;
		navigator.serviceWorker.ready.then(() => {
			const run = () => {
				if (cancelled) return;
				const urls = ["/", ...Object.keys(APPS_CONFIG).map((href) => readAppEntry(href) ?? href)];
				warmPages(urls).catch(() => undefined);
				try {
					window.localStorage.setItem(KEY, String(Date.now()));
				} catch {
					// fine — warmed anyway
				}
			};
			if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 10_000 });
			else setTimeout(run, 3000);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return null;
}
