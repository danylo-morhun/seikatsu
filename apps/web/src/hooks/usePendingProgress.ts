"use client";

import { useEffect, useRef } from "react";

/**
 * Drives the global top progress bar while a transition (router.push / router.refresh)
 * is pending. The current page stays visible and interactive — no overlay.
 */
export function usePendingProgress(isPending: boolean) {
	const started = useRef(false);

	useEffect(() => {
		if (isPending) {
			started.current = true;
			window.dispatchEvent(new CustomEvent("seikatsu:refresh-start"));
		} else if (started.current) {
			started.current = false;
			window.dispatchEvent(new CustomEvent("seikatsu:refresh-end"));
		}
	}, [isPending]);
}
