"use client";

import { useEffect } from "react";
import { clearOutbox } from "@/features/pwa/lib/outbox";
import { forgetPages } from "@/features/pwa/lib/sw-client";

/**
 * Rendered on the signed-out landing: cached pages and queued changes belong to the last
 * user, drop them.
 */
export function ForgetOfflinePages() {
	useEffect(() => {
		forgetPages().catch(() => undefined);
		clearOutbox().catch(() => undefined);
		try {
			window.localStorage.removeItem("seikatsu:warmed-at");
		} catch {
			// storage unavailable — nothing to forget
		}
	}, []);

	return null;
}
