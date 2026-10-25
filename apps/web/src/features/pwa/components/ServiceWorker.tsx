"use client";

import { SW_URL, swSupported } from "@/features/pwa/lib/sw-client";
import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Registers the service worker and offers a reload when a new deploy's worker is waiting.
 * Production only: in dev the worker would cache Turbopack's chunks across edits.
 */
export function ServiceWorker() {
	useEffect(() => {
		if (!swSupported() || process.env.NODE_ENV !== "production") return;
		let reloading = false;

		const offerUpdate = (worker: ServiceWorker) => {
			toast("A new version is ready", {
				id: "sw-update",
				duration: Number.POSITIVE_INFINITY,
				action: {
					label: "Reload",
					onClick: () => worker.postMessage({ type: "skipWaiting" }),
				},
			});
		};

		const onControllerChange = () => {
			if (reloading) return;
			reloading = true;
			window.location.reload();
		};

		// An installed app is resumed, not reloaded, for days: look for a new deploy on each return.
		const onVisible = () => {
			if (document.visibilityState !== "visible") return;
			navigator.serviceWorker
				.getRegistration()
				.then((r) => r?.update())
				.catch(() => undefined);
		};
		document.addEventListener("visibilitychange", onVisible);

		navigator.serviceWorker
			.register(SW_URL, { scope: "/", updateViaCache: "none" })
			.then((registration) => {
				// Only an update has a controller already; the first install takes over silently.
				const hasController = !!navigator.serviceWorker.controller;
				if (registration.waiting && hasController) offerUpdate(registration.waiting);
				registration.addEventListener("updatefound", () => {
					const next = registration.installing;
					next?.addEventListener("statechange", () => {
						if (next.state === "installed" && navigator.serviceWorker.controller) {
							offerUpdate(next);
						}
					});
				});
				if (hasController) {
					navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
				}
			})
			.catch(() => undefined);

		return () => {
			document.removeEventListener("visibilitychange", onVisible);
			navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
		};
	}, []);

	return null;
}
