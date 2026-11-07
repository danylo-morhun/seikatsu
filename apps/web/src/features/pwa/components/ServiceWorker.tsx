"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { SW_URL, swSupported } from "@/features/pwa/lib/sw-client";

/**
 * Registers the service worker and offers a reload when a new deploy's worker takes over.
 * Production only: in dev the worker would cache Turbopack's chunks across edits.
 */
export function ServiceWorker() {
	const router = useRouter();

	// A slow (cold) server lost to the cached page: once the fresh one has landed, show it.
	useEffect(() => {
		const controller = swSupported() ? navigator.serviceWorker.controller : null;
		if (!controller) return;
		const channel = new MessageChannel();
		channel.port1.onmessage = (e) => {
			if (e.data === true) router.refresh();
			channel.port1.close();
		};
		controller.postMessage({ type: "fresh?" }, [channel.port2]);
		return () => channel.port1.close();
	}, [router]);

	useEffect(() => {
		if (!swSupported() || process.env.NODE_ENV !== "production") return;
		const sw = navigator.serviceWorker;

		// A new deploy's worker takes over by itself (sw.js install). Offer a reload only when this
		// page is older than the worker now running it: after the reload the page matches, so the
		// toast can't come back. (Asking a waiting worker to take over never worked on iOS.)
		const onControllerChange = () => {
			if (!sw.controller || isOwnWorker(sw.controller.scriptURL)) return;
			toast("A new version is ready", {
				id: "sw-update",
				duration: Number.POSITIVE_INFINITY,
				action: { label: "Reload", onClick: () => window.location.reload() },
			});
		};
		sw.addEventListener("controllerchange", onControllerChange);

		// An installed app is resumed, not reloaded, for days: look for a new deploy on each return.
		const onVisible = () => {
			if (document.visibilityState !== "visible") return;
			sw.getRegistration()
				.then((r) => r?.update())
				.catch(() => undefined);
		};
		document.addEventListener("visibilitychange", onVisible);

		isStalePage()
			.then((stale) => {
				if (!stale) return sw.register(SW_URL, { scope: "/", updateViaCache: "none" });
			})
			.catch(() => undefined);

		return () => {
			document.removeEventListener("visibilitychange", onVisible);
			sw.removeEventListener("controllerchange", onControllerChange);
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
	if (!active || isOwnWorker(active)) return false;
	try {
		const res = await fetch("/api/version", { cache: "no-store" });
		const { build } = (await res.json()) as { build: string };
		return build !== process.env.NEXT_PUBLIC_BUILD_ID;
	} catch {
		return true; // offline: keep the worker that's running
	}
}

function isOwnWorker(scriptURL: string) {
	return new URL(scriptURL).href === new URL(SW_URL, location.origin).href;
}
