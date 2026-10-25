"use client";

import { forgetPages } from "@/features/pwa/lib/sw-client";
import { useEffect } from "react";

/** Rendered on the signed-out landing: cached pages hold the last user's data, drop them. */
export function ForgetOfflinePages() {
	useEffect(() => {
		forgetPages().catch(() => undefined);
		try {
			window.localStorage.removeItem("seikatsu:warmed-at");
		} catch {
			// storage unavailable — nothing to forget
		}
	}, []);

	return null;
}
