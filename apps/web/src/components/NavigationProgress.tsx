"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type State = "idle" | "running" | "done";

// Below this, a navigation/refresh feels instant — don't flash the bar.
const SHOW_DELAY_MS = 120;

/** Dispatch before a programmatic `router.push` so the bar tracks it like a link click. */
export function startNavigationProgress() {
	window.dispatchEvent(new CustomEvent("seikatsu:navigate-start"));
}

function isInternalNavigation(event: MouseEvent): boolean {
	if (event.defaultPrevented || event.button !== 0) return false;
	if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
	const anchor = (event.target as Element | null)?.closest?.("a");
	if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return false;
	const url = new URL(anchor.href, window.location.href);
	if (url.origin !== window.location.origin) return false;
	return url.pathname + url.search !== window.location.pathname + window.location.search;
}

/** Thin top bar for navigations and data refreshes. Never blocks or hides the current page. */
export function NavigationProgress() {
	const [state, setState] = useState<State>("idle");
	const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const active = useRef(false);
	const pathname = usePathname();
	const searchParams = useSearchParams();

	function clearTimers() {
		if (showTimer.current) clearTimeout(showTimer.current);
		if (hideTimer.current) clearTimeout(hideTimer.current);
	}

	function start() {
		clearTimers();
		active.current = true;
		showTimer.current = setTimeout(() => setState("running"), SHOW_DELAY_MS);
	}

	function complete() {
		if (!active.current) return;
		active.current = false;
		clearTimers();
		setState((s) => {
			if (s === "idle") return "idle";
			hideTimer.current = setTimeout(() => setState("idle"), 400);
			return "done";
		});
	}

	useEffect(() => {
		function onClick(event: MouseEvent) {
			if (isInternalNavigation(event)) start();
		}
		document.addEventListener("click", onClick, true);
		window.addEventListener("seikatsu:navigate-start", start);
		window.addEventListener("seikatsu:refresh-start", start);
		window.addEventListener("seikatsu:refresh-end", complete);
		return () => {
			document.removeEventListener("click", onClick, true);
			window.removeEventListener("seikatsu:navigate-start", start);
			window.removeEventListener("seikatsu:refresh-start", start);
			window.removeEventListener("seikatsu:refresh-end", complete);
			clearTimers();
		};
	}, []);

	// A navigation finishes when the committed URL changes.
	useEffect(() => {
		complete();
	}, [pathname, searchParams]);

	if (state === "idle") return null;

	return (
		<div className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" aria-hidden>
			<div
				className={
					state === "running"
						? "h-full w-[85%] bg-primary [animation:progress-grow_5s_cubic-bezier(0.1,0.7,0.2,1)]"
						: "h-full w-full bg-primary opacity-0 transition-[width,opacity] duration-300 ease-in"
				}
			/>
		</div>
	);
}
