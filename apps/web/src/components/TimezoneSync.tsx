"use client";

import { useEffect } from "react";
import { followZone } from "@/lib/follow-zone";

/**
 * Stores the browser's IANA time zone in the `tz` cookie so the server can resolve "today"; when
 * it changes (a trip), the pushes and the Google calendar link follow it too.
 */
export function TimezoneSync() {
	useEffect(() => {
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (!zone || document.cookie.includes(`tz=${encodeURIComponent(zone)}`)) return;
		document.cookie = `tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
		void followZone(zone).catch(() => {});
	}, []);

	return null;
}
