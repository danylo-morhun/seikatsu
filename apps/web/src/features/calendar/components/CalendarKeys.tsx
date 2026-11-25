"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { startNavigationProgress } from "@/components/NavigationProgress";
import {
	CALENDAR_COOKIE,
	CALENDAR_VIEWS,
	HOME_COOKIE,
	type HomeView,
} from "@/features/calendar/lib/calendar";
import { pageKey } from "@/lib/capture-shortcut";

const YEAR = 60 * 60 * 24 * 365;

/**
 * The home's view keys: M W D L pick the calendar's view, C swaps calendar and widgets; in the
 * calendar, [ and ] step back and ahead and T comes back to today. The view shown is remembered
 * on this device, so the home opens on it next time.
 */
export function CalendarKeys({
	view,
	hrefs,
}: {
	view: HomeView;
	/** Where each key goes from here. */
	hrefs: Partial<Record<string, string>>;
}) {
	const router = useRouter();

	useEffect(() => {
		document.cookie = `${HOME_COOKIE}=${view}; path=/; max-age=${YEAR}; samesite=lax`;
		if ((CALENDAR_VIEWS as readonly string[]).includes(view))
			document.cookie = `${CALENDAR_COOKIE}=${view}; path=/; max-age=${YEAR}; samesite=lax`;
	}, [view]);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			const k = pageKey(e);
			const href = k ? hrefs[k] : undefined;
			if (!href) return;
			e.preventDefault();
			startNavigationProgress();
			router.push(href);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [router, hrefs]);

	return null;
}
