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

		const offerUpdate = () => {
			toast("A new version is ready", {
				id: "sw-update",
				duration: Number.POSITIVE_INFINITY,
				action: { label: "Reload", onClick: () => void applyUpdate() },
			});
		};

		// The worker waiting now, not the one the toast was offered for (a newer deploy may have
		// replaced it). Reload anyway if the switch doesn't come: the toast must never stick.
		const applyUpdate = async () => {
			const registration = await navigator.serviceWorker.getRegistration();
			registration?.waiting?.postMessage({ type: "skipWaiting" });
			setTimeout(onControllerChange, registration?.waiting ? 3000 : 0);
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

		isStalePage()
			.then((stale) => {
				if (stale) return;
				return navigator.serviceWorker.register(SW_URL, { scope: "/", updateViaCache: "none" });
			})
			.then((registration) => {
				if (!registration) return;
				// Only an update has a controller already; the first install takes over silently.
				const hasController = !!navigator.serviceWorker.controller;
				if (registration.waiting && hasController) offerUpdate();
				registration.addEventListener("updatefound", () => {
					const next = registration.installing;
					next?.addEventListener("statechange", () => {
						if (next.state === "installed" && navigator.serviceWorker.controller) {
							offerUpdate();
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

/**
 * A page the worker answered from its cache (slow network) may be an older build. Registering
 * its worker URL would install that old worker over the live one and offer it as "a new
 * version" — forever, as each reload flips between the two. Only the live build registers.
 */
async function isStalePage(): Promise<boolean> {
	const active = navigator.serviceWorker.controller?.scriptURL;
	if (!active || new URL(active).href === new URL(SW_URL, location.origin).href) return false;
	try {
		const res = await fetch("/api/version", { cache: "no-store" });
		const { build } = (await res.json()) as { build: string };
		return build !== process.env.NEXT_PUBLIC_BUILD_ID;
	} catch {
		return true; // offline: keep the worker that's running
	}
}
